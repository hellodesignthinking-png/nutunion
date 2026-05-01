import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

const MAX_TITLE = 200;

interface RouteContext {
  params: Promise<{ ownerType: string; ownerId: string }>;
}

/**
 * GET /api/spaces/{ownerType}/{ownerId}/pages
 * → { pages: SpacePage[] } — 그 owner 의 모든 페이지 (트리는 클라이언트에서 조립)
 *
 * POST 동일 경로
 *   body: { parent_page_id?: string | null, title?: string, icon?: string }
 *   → { page: SpacePage }
 */
export const GET = withRouteLog("spaces.pages.get", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { ownerType, ownerId } = await ctx.params;
  if (ownerType !== "nut" && ownerType !== "bolt") {
    return NextResponse.json({ error: "invalid_owner_type" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("space_pages")
    .select("id, parent_page_id, title, icon, content, position, created_by, created_at, updated_at")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pages: data ?? [] });
});

export const POST = withRouteLog("spaces.pages.post", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { ownerType, ownerId } = await ctx.params;
  if (ownerType !== "nut" && ownerType !== "bolt") {
    return NextResponse.json({ error: "invalid_owner_type" }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as { parent_page_id?: string | null; title?: string; icon?: string } | null;
  const title = (body?.title ?? "").trim().slice(0, MAX_TITLE) || "제목 없음";
  const icon = (body?.icon ?? "📄").slice(0, 4);
  const parentPageId = body?.parent_page_id ?? null;

  // 같은 부모의 가장 큰 position + 1
  const { data: siblings } = await supabase
    .from("space_pages")
    .select("position")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .is("parent_page_id", parentPageId === null ? null : null)
    .order("position", { ascending: false })
    .limit(1);
  // RLS 로 parent_page_id 매칭 못 거르므로 한번 더
  let nextPos = 0;
  if (parentPageId === null) {
    const { data: rootSibs } = await supabase
      .from("space_pages")
      .select("position")
      .eq("owner_type", ownerType)
      .eq("owner_id", ownerId)
      .is("parent_page_id", null)
      .order("position", { ascending: false })
      .limit(1);
    nextPos = (rootSibs?.[0]?.position ?? -1) + 1;
  } else {
    const { data: childSibs } = await supabase
      .from("space_pages")
      .select("position")
      .eq("parent_page_id", parentPageId)
      .order("position", { ascending: false })
      .limit(1);
    nextPos = (childSibs?.[0]?.position ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from("space_pages")
    .insert({
      owner_type: ownerType,
      owner_id: ownerId,
      parent_page_id: parentPageId,
      title,
      icon,
      content: "",
      position: nextPos,
      created_by: user.id,
    })
    .select("id, parent_page_id, title, icon, content, position, created_by, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ page: data });
});
