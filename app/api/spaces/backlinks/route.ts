import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/spaces/backlinks?kind=...&id=...
 *
 * 어떤 entity (page/nut/bolt/user/topic) 가 다른 페이지 블록의 mention 으로
 * 언급된 곳들을 찾음. mention syntax: @[label](kind:id).
 *
 * Supabase ilike 로 content 안에 "(kind:id)" 패턴이 있는 블록을 찾고,
 * 각 블록의 page 정보 + content snippet 반환.
 */
export const GET = withRouteLog("spaces.backlinks.get", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const id = searchParams.get("id");
  if (!kind || !id) return NextResponse.json({ error: "kind_and_id_required" }, { status: 400 });

  // ilike 안전 — uuid 패턴이라 wildcard 위험 적지만 한 번 escape
  const safeId = id.replace(/[%_]/g, "\\$&");
  const safeKind = kind.replace(/[%_]/g, "\\$&");
  const pattern = `%(${safeKind}:${safeId})%`;

  // 블록 + 페이지 정보 — 페이지의 RLS 가 자동으로 권한 필터
  const { data, error } = await supabase
    .from("space_page_blocks")
    .select("id, content, type, page_id, created_at, space_pages:page_id(id, title, icon, owner_type, owner_id)")
    .ilike("content", pattern)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // content 에서 mention 주변의 짧은 snippet 추출 (앞뒤 60자)
  const items = (data ?? []).map((row: any) => {
    const text: string = row.content || "";
    const re = new RegExp(`@\\[[^\\]]*\\]\\(${safeKind}:${safeId}\\)`);
    const m = text.match(re);
    let snippet = text.slice(0, 120);
    if (m && m.index !== undefined) {
      const start = Math.max(0, m.index - 60);
      const end = Math.min(text.length, m.index + m[0].length + 60);
      snippet = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
    }
    return {
      block_id: row.id,
      page_id: row.page_id,
      page_title: row.space_pages?.title ?? "(제목 없음)",
      page_icon: row.space_pages?.icon ?? "📄",
      owner_type: row.space_pages?.owner_type,
      owner_id: row.space_pages?.owner_id,
      block_type: row.type,
      snippet,
    };
  });

  return NextResponse.json({ items });
});
