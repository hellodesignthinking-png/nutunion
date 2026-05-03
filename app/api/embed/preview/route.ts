import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/embed/preview?url=...
 *
 *   주어진 URL 의 OG 메타데이터(title/description/image/site_name) 를 추출.
 *   8개 주요 공급자(YouTube/Twitter/Notion/Drive/Figma/GitHub/Slack/Threads) 는
 *   provider 식별 + 일부 oEmbed 변환 (YouTube embed 만 자동).
 *
 *   24h Supabase 캐시 — embed_metadata_cache.
 */

const CACHE_TTL_MS = 24 * 3600 * 1000;
const FETCH_TIMEOUT_MS = 6_000;
const MAX_HTML_BYTES   = 256 * 1024;

type Provider = "youtube" | "twitter" | "threads" | "notion" | "gdrive" | "figma" | "github" | "slack" | "linkedin" | "instagram" | "tiktok" | "generic";

function detectProvider(u: URL): Provider {
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com")) return "youtube";
  if (host === "x.com" || host === "twitter.com") return "twitter";
  if (host === "threads.net") return "threads";
  if (host.endsWith("notion.so") || host.endsWith("notion.site")) return "notion";
  if (host.endsWith("drive.google.com") || host.endsWith("docs.google.com")) return "gdrive";
  if (host === "figma.com" || host.endsWith(".figma.com")) return "figma";
  if (host === "github.com") return "github";
  if (host.endsWith("slack.com")) return "slack";
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  return "generic";
}

function parseOg(html: string): { title?: string; description?: string; image?: string; site_name?: string } {
  // 가벼운 정규식 OG 추출 — 외부 cheerio 없이.
  const out: { title?: string; description?: string; image?: string; site_name?: string } = {};
  const find = (re: RegExp) => {
    const m = html.match(re);
    return m ? m[1].trim() : undefined;
  };
  out.title = find(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
           || find(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i)
           || find(/<title>([^<]+)<\/title>/i);
  out.description = find(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
                 || find(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  out.image = find(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           || find(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  out.site_name = find(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  // HTML 엔터티 decode (간단)
  for (const k of ["title", "description", "image", "site_name"] as const) {
    const v = out[k];
    if (typeof v === "string") {
      out[k] = v.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
               .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    }
  }
  return out;
}

/** YouTube URL 에서 video id 추출 → embed iframe 생성 */
function youtubeEmbed(u: URL): string | null {
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host.endsWith("youtube.com")) {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2];
    else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2];
  }
  if (!id || !/^[A-Za-z0-9_-]{6,16}$/.test(id)) return null;
  return `<iframe src="https://www.youtube.com/embed/${id}" frameborder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>`;
}

export const GET = withRouteLog("embed.preview.get", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("url") || "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json({ error: "unsupported_scheme" }, { status: 400 });
  }
  // localhost / private 주소 차단 — SSRF 방어
  const host = parsed.hostname;
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return NextResponse.json({ error: "private_host_blocked" }, { status: 400 });
  }

  const url = parsed.toString();
  const provider = detectProvider(parsed);

  // 캐시 조회
  const { data: cached } = await supabase
    .from("embed_metadata_cache")
    .select("title, description, image_url, site_name, provider, embed_html, fetched_at")
    .eq("url", url)
    .maybeSingle();
  if (cached && new Date(cached.fetched_at as string).getTime() > Date.now() - CACHE_TTL_MS) {
    return NextResponse.json({
      url, provider: cached.provider, title: cached.title, description: cached.description,
      image: cached.image_url, site_name: cached.site_name, embed_html: cached.embed_html, cached: true,
    });
  }

  // OG fetch
  let title: string | undefined, description: string | undefined, image: string | undefined, site_name: string | undefined;
  let embed_html: string | null = null;

  // YouTube 는 OG 없이도 embed 가능
  if (provider === "youtube") embed_html = youtubeEmbed(parsed);

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "NutUnionBot/1.0 (+https://nutunion.co.kr)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(t);
    if (r.ok) {
      const reader = r.body?.getReader();
      let total = 0;
      const chunks: Uint8Array[] = [];
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value);
        total += value.byteLength;
        if (total >= MAX_HTML_BYTES) break;
      }
      try { reader?.cancel(); } catch {}
      const buf = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
      const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      const og = parseOg(html);
      title = og.title; description = og.description; image = og.image; site_name = og.site_name;
    }
  } catch { /* timeout / network — title 만 fallback */ }

  if (!title) title = parsed.hostname.replace(/^www\./, "");

  // 캐시 upsert (best effort — RLS 가 막으면 skip)
  await supabase.from("embed_metadata_cache").upsert({
    url,
    title: title || null,
    description: description || null,
    image_url: image || null,
    site_name: site_name || null,
    provider,
    embed_html,
    fetched_at: new Date().toISOString(),
  }, { onConflict: "url" }).then(() => undefined, () => undefined);

  return NextResponse.json({
    url, provider, title, description, image, site_name, embed_html, cached: false,
  });
});
