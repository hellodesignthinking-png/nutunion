import { NextRequest, NextResponse } from "next/server";
import { getPreview } from "../route";
import { createClient } from "@/lib/supabase/server";
import { compileTsxToHtml } from "@/lib/threads/sandbox-compile";

// GET /api/threads/sandbox-preview/serve?token=...
//   Serves a one-shot compiled HTML preview by token (used by Code Builder UI).
//
// GET /api/threads/sandbox-preview/serve?installation_id=...
//   Serves an installed code-mode Thread by re-compiling its stored source.
//   This is the runtime endpoint that ThreadRunner iframe loads.

const CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.tailwindcss.com; " +
  "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
  "connect-src 'self'; " +
  "img-src 'self' data: https:; " +
  "frame-ancestors *;";

function htmlResponse(html: string, status = 200) {
  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": CSP,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const installationId = searchParams.get("installation_id");

  if (token) {
    const html = getPreview(token);
    if (!html) return htmlResponse(`<h1>Preview expired</h1><p>토큰이 만료되었거나 잘못되었습니다.</p>`, 404);
    return htmlResponse(html);
  }

  if (installationId) {
    const supabase = await createClient();
    const { data: inst } = await supabase
      .from("thread_installations")
      .select("id, thread_id, threads:thread_id(generated_component_source, ui_component, is_public, is_draft)")
      .eq("id", installationId)
      .maybeSingle();
    const thread: any = (inst as any)?.threads;
    if (!inst || !thread) return htmlResponse(`<h1>Not found</h1>`, 404);
    if (thread.ui_component !== "__code__") return htmlResponse(`<h1>Not a code thread</h1>`, 400);
    const source: string | null = thread.generated_component_source;
    if (!source) return htmlResponse(`<h1>No source</h1>`, 404);

    let html: string;
    try {
      // Inject the requesting page origin so the sandbox iframe knows which window is its
      // legitimate parent. If absent (direct hit), fall back to our own origin.
      const referer = req.headers.get("referer");
      let parentOrigin = "";
      if (referer) {
        try { parentOrigin = new URL(referer).origin; } catch { /* ignore */ }
      }
      if (!parentOrigin) parentOrigin = req.nextUrl.origin;
      html = await compileTsxToHtml(source, { installationId, parentOrigin });
    } catch (e: any) {
      return htmlResponse(
        `<h1>Compile error</h1><pre style="white-space:pre-wrap">${(e?.message || String(e)).replace(/[<>&]/g, (c: string) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c))}</pre>`,
        500,
      );
    }
    return htmlResponse(html);
  }

  return htmlResponse(`<h1>Missing token or installation_id</h1>`, 400);
}
