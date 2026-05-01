import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/spaces/search?q=&owner_type=&owner_id=
 * 블록 본문 ilike 매칭 (RLS 자동 필터). 페이지 제목 검색은 클라이언트 측.
 */
export const GET = withRouteLog("spaces.search", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const ownerType = searchParams.get("owner_type");
  const ownerId = searchParams.get("owner_id");
  if (!q || q.length < 2) return NextResponse.json({ hits: [] });
  if (ownerType !== "nut" && ownerType !== "bolt") {
    return NextResponse.json({ error: "invalid_owner_type" }, { status: 400 });
  }

  const safeQ = q.replace(/[%_]/g, "\\$&");
  const pattern = `%${safeQ}%`;

  // page → block 조인. RLS 가 owner 멤버십 자동 필터링.
  const { data, error } = await supabase
    .from("space_page_blocks")
    .select("id, content, type, page_id, space_pages!inner(id, title, icon, owner_type, owner_id)")
    .ilike("content", pattern)
    .eq("space_pages.owner_type", ownerType)
    .eq("space_pages.owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hits = (data ?? []).map((row: any) => {
    const text: string = row.content || "";
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    let snippet = text.slice(0, 100);
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + q.length + 60);
      snippet = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
    }
    return {
      block_id: row.id,
      page_id: row.page_id,
      page_title: row.space_pages?.title ?? "(제목 없음)",
      page_icon: row.space_pages?.icon ?? "📄",
      block_type: row.type,
      snippet,
    };
  });

  return NextResponse.json({ hits });
});
