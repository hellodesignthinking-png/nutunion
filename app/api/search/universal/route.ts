import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/search/universal?q=keyword
 * 통합 검색 — 너트 · 볼트 · 와셔 · 탭 · 명령.
 * 한글 초성 지원은 client-side Fuse.js 보조. 서버는 ILIKE 기반.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ nuts: [], bolts: [], washers: [], taps: [] });

  const supabase = await createClient();
  const pattern = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const [nutsRes, boltsRes, washersRes, tapsRes] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, description, category")
      .eq("is_active", true)
      .or(`name.ilike.${pattern},description.ilike.${pattern}`)
      .limit(5),
    supabase
      .from("projects")
      .select("id, title, description, category, status")
      .in("status", ["active", "completed"])
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .limit(5),
    supabase
      .from("profiles")
      .select("id, nickname, bio, specialty, avatar_url")
      .or(`nickname.ilike.${pattern},bio.ilike.${pattern}`)
      .limit(5),
    supabase
      .from("bolt_taps")
      .select("id, title, project_id, visibility")
      .eq("visibility", "public")
      .ilike("title", pattern)
      .limit(5)
      .then((r) => r, () => ({ data: [] })),
  ]);

  return NextResponse.json({
    nuts: nutsRes.data ?? [],
    bolts: boltsRes.data ?? [],
    washers: washersRes.data ?? [],
    taps: (tapsRes as any).data ?? [],
  });
}
