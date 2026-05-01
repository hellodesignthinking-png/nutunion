import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/spaces/global-search?q=
 *
 * 사용자가 접근 가능한 모든 너트/볼트 의 페이지·블록·entity 통합 검색.
 * RLS 가 자동으로 권한 필터.
 */
export const GET = withRouteLog("spaces.global-search", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ pages: [], blocks: [], nuts: [], bolts: [] });
  }

  const safeQ = q.replace(/[%_]/g, "\\$&");
  const pattern = `%${safeQ}%`;

  const [pagesRes, blocksRes, nutsRes, boltsRes] = await Promise.all([
    // 페이지 제목
    supabase
      .from("space_pages")
      .select("id, title, icon, owner_type, owner_id, updated_at")
      .ilike("title", pattern)
      .limit(15),
    // 블록 본문
    supabase
      .from("space_page_blocks")
      .select("id, content, type, page_id, space_pages!inner(id, title, icon, owner_type, owner_id)")
      .ilike("content", pattern)
      .limit(15),
    // 너트
    supabase
      .from("groups")
      .select("id, name")
      .ilike("name", pattern)
      .limit(8),
    // 볼트
    supabase
      .from("projects")
      .select("id, title, status")
      .ilike("title", pattern)
      .limit(8),
  ]);

  const pages = (pagesRes.data ?? []).map((p: any) => ({
    id: p.id,
    title: p.title,
    icon: p.icon || "📄",
    owner_type: p.owner_type,
    owner_id: p.owner_id,
    updated_at: p.updated_at,
    href: `/${p.owner_type === "nut" ? "groups" : "projects"}/${p.owner_id}#page=${p.id}`,
  }));

  const blocks = (blocksRes.data ?? []).map((b: any) => {
    const text: string = b.content || "";
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    let snippet = text.slice(0, 100);
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + q.length + 60);
      snippet = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
    }
    return {
      block_id: b.id,
      page_id: b.page_id,
      page_title: b.space_pages?.title ?? "(제목 없음)",
      page_icon: b.space_pages?.icon ?? "📄",
      owner_type: b.space_pages?.owner_type,
      owner_id: b.space_pages?.owner_id,
      block_type: b.type,
      snippet,
      href: `/${b.space_pages?.owner_type === "nut" ? "groups" : "projects"}/${b.space_pages?.owner_id}#page=${b.page_id}`,
    };
  });

  const nuts = (nutsRes.data ?? []).map((n: any) => ({
    id: n.id, name: n.name, href: `/groups/${n.id}`,
  }));
  const bolts = (boltsRes.data ?? []).map((b: any) => ({
    id: b.id, name: b.title, sub: b.status, href: `/projects/${b.id}`,
  }));

  return NextResponse.json({ pages, blocks, nuts, bolts });
});
