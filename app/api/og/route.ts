import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * GET /api/og?url=<encoded-url>
 * 외부 URL의 Open Graph 메타데이터를 서버에서 프록시하여 반환.
 * 클라이언트에서 CORS 없이 사용 가능.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  try {
    const targetUrl = new URL(url);
    // 내부 IP / 루프백 차단
    const host = targetUrl.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.") || host.startsWith("10.")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Nutunionbot/1.0 (+https://nutunion.co.kr)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      // Edge runtime에서 타임아웃 — signal로 3초 제한
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "fetch failed" }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ error: "not html" }, { status: 422 });
    }

    // 최대 50KB만 읽어 파싱 비용 최소화
    const reader = res.body?.getReader();
    if (!reader) return NextResponse.json({}, { status: 200 });

    let html = "";
    let totalBytes = 0;
    const MAX_BYTES = 50_000;
    while (true) {
      const { done, value } = await reader.read();
      if (done || totalBytes >= MAX_BYTES) break;
      html += new TextDecoder().decode(value);
      totalBytes += value?.length ?? 0;
      // <head> 닫히면 stop
      if (html.includes("</head>")) break;
    }
    reader.cancel();

    // OG/Twitter meta 파싱
    const meta: Record<string, string> = {};
    const metaRe = /<meta[^>]+>/gi;
    let m: RegExpExecArray | null;
    while ((m = metaRe.exec(html)) !== null) {
      const tag = m[0];
      const propMatch = tag.match(/(?:property|name)=["']([^"']+)["']/i);
      const contentMatch = tag.match(/content=["']([^"']+)["']/i);
      if (propMatch && contentMatch) {
        meta[propMatch[1].toLowerCase()] = contentMatch[1];
      }
    }

    // <title> 태그 파싱
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = meta["og:title"] || meta["twitter:title"] || (titleMatch?.[1]?.trim()) || "";

    const og = {
      title: decodeHtmlEntities(title),
      description: decodeHtmlEntities(
        meta["og:description"] || meta["twitter:description"] || meta["description"] || ""
      ),
      image: meta["og:image"] || meta["twitter:image"] || meta["twitter:image:src"] || "",
      site_name: decodeHtmlEntities(meta["og:site_name"] || ""),
      url: meta["og:url"] || url,
    };

    return NextResponse.json(og, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err: any) {
    log.error(err, "og.failed");
    // timeout / fetch error
    return NextResponse.json({ error: err?.message || "error" }, { status: 502 });
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
