import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { compileTsxToHtml } from "@/lib/threads/sandbox-compile";

// POST /api/threads/sandbox-preview
// Body: { source: string, installation_id?: string }
// Returns: { token: string, url: string }
//
// Compiles TSX -> JS via esbuild and stashes the resulting HTML in a short-lived
// in-memory cache, returning a token. The frontend embeds the URL in an iframe
// with sandbox="allow-scripts" so user-generated code never runs in the main origin.
//
// FUTURE: migrate to @vercel/sandbox for real microVM isolation. esbuild-only
// compilation is *not* a security boundary — it merely strips the type layer.
// True isolation comes from the iframe sandbox + CSP on the GET endpoint.

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

  let html: string;
  try {
    html = await compileTsxToHtml(source, { installationId });
  } catch (e: any) {
    log.error(e, "threads.sandbox-preview.failed");
    return NextResponse.json({ error: "compile_failed", detail: e?.message || String(e) }, { status: 400 });
  }

  const token = `${user.id.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  putPreview(token, html);
  return NextResponse.json({
    token,
    url: `/api/threads/sandbox-preview/serve?token=${encodeURIComponent(token)}`,
  });
});
