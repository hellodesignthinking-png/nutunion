import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ id: string }>; }

const ALLOWED_KINDS = [
  "link", "note", "embed", "kanban_mini", "countdown", "social", "gdrive", "notion",
] as const;
type ModuleKind = typeof ALLOWED_KINDS[number];

/** GET /api/projects/{id}/modules — 정렬된 모듈 전체 */
export const GET = withRouteLog("projects.modules.get", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { data, error } = await supabase
    .from("project_modules")
    .select("id, kind, title, config, width, sort_order, is_visible, created_at, updated_at, created_by")
    .eq("project_id", id)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ modules: data ?? [] });
});

/** POST /api/projects/{id}/modules — body: { kind, title?, config?, width? } */
export const POST = withRouteLog("projects.modules.post", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    kind?: ModuleKind;
    title?: string;
    config?: Record<string, unknown>;
    width?: number;
  } | null;
  if (!body?.kind || !ALLOWED_KINDS.includes(body.kind)) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  // 다음 sort_order 결정 (최대 + 10)
  const { data: lastRow } = await supabase
    .from("project_modules")
    .select("sort_order")
    .eq("project_id", id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = ((lastRow?.sort_order as number | null) ?? 0) + 10;

  const width = Math.max(1, Math.min(3, body.width ?? 1));
  const { data, error } = await supabase
    .from("project_modules")
    .insert({
      project_id: id,
      kind: body.kind,
      title: body.title?.slice(0, 80) || null,
      config: body.config ?? {},
      width,
      sort_order: nextSort,
      created_by: user.id,
    })
    .select("id, kind, title, config, width, sort_order, is_visible, created_at, updated_at, created_by")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ module: data }, { status: 201 });
});

/** PATCH /api/projects/{id}/modules — body: { ids: string[] } 일괄 reorder */
export const PATCH = withRouteLog("projects.modules.reorder", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as { ids?: string[] } | null;
  if (!body || !Array.isArray(body.ids)) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }
  // 10, 20, 30… 으로 reset
  const updates = body.ids.map((mid, i) => ({ id: mid, project_id: id, sort_order: (i + 1) * 10 }));
  // upsert 으로 일괄 — 단, kind 가 not-null 이라 별도 update 루프 필요
  for (const u of updates) {
    await supabase.from("project_modules")
      .update({ sort_order: u.sort_order })
      .eq("id", u.id)
      .eq("project_id", id);
  }
  return NextResponse.json({ ok: true });
});
