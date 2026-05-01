import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { preparePreview, releasePreview } from "@/lib/threads/sandbox-provider";

// POST /api/threads/sandbox-preview
// Body: { source: string, installation_id?: string }
// Returns: { token: string, url: string, strategy: "iframe" | "vercel-sandbox" }
//
// 두 가지 격리 전략 (lib/threads/sandbox-provider.ts):
//   - iframe (기본): esbuild → inline HTML, sandbox=allow-scripts iframe 으로 서빙
//   - vercel-sandbox (옵트인): Firecracker microVM 안에서 정적 서빙 — Pro + 환경
//     플래그 THREADS_USE_VERCEL_SANDBOX=1 일 때만
//
// DELETE /api/threads/sandbox-preview?token=...
// vercel-sandbox 경로에서만 의미 있음 — 사용자가 프리뷰를 닫을 때 microVM 회수.

interface CacheEntry {
  html: string;
  expires: number;
}

const CACHE = (globalThis as any).__threadSandboxCache__ as Map<string, CacheEntry> | undefined;
const cache: Map<string, CacheEntry> =
  CACHE || ((globalThis as any).__threadSandboxCache__ = new Map());

const TTL_MS = 5 * 60 * 1000;

export function putPreview(token: string, html: string) {
  cache.set(token, { html, expires: Date.now() + TTL_MS });
  // Opportunistic GC
  for (const [k, v] of cache.entries()) {
    if (v.expires < Date.now()) cache.delete(k);
  }
}

export function getPreview(token: string): string | null {
  const entry = cache.get(token);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    cache.delete(token);
    return null;
  }
  return entry.html;
}

export const POST = withRouteLog("threads.sandbox-preview", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const source: string | undefined = body?.source;
  const installationId: string | undefined = body?.installation_id;
  if (!source || typeof source !== "string") {
    return NextResponse.json({ error: "source_required" }, { status: 400 });
  }
  if (source.length > 50_000) {
    return NextResponse.json({ error: "source_too_large" }, { status: 413 });
  }

  const token = `${user.id.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const result = await preparePreview(source, {
      token,
      installationId,
      iframeServePath: "/api/threads/sandbox-preview/serve",
      putIframeCache: putPreview,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    log.error(e, "threads.sandbox-preview.failed");
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "compile_failed", detail }, { status: 400 });
  }
});

export const DELETE = withRouteLog("threads.sandbox-preview.release", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token_required" }, { status: 400 });

  // 토큰 prefix 가 user id 인지 확인 — 다른 사용자 sandbox 강제 종료 방지
  if (!token.startsWith(user.id.slice(0, 8))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await releasePreview(token);
  return NextResponse.json({ ok: true });
});
