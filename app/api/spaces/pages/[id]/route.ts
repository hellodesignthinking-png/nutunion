import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

const MAX_TITLE = 200;
const MAX_CONTENT = 200_000;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/spaces/pages/{id}
 *   body: { title?, icon?, content?, parent_page_id?: string | null, position?: number }
 *   → { page }
 *
 * DELETE 동일 — 캐스케이드로 자식 페이지/블록도 제거됨.
 */
export const PATCH = withRouteLog("spaces.pages.patch", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    title?: string;
    icon?: string;
    content?: string;
    parent_page_id?: string | null;
    position?: number;
  } | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) {
    const t = body.title.trim().slice(0, MAX_TITLE);
    update.title = t || "제목 없음";
  }
  if (body.icon !== undefined) update.icon = (body.icon || "📄").slice(0, 4);
  if (body.content !== undefined) {
    if (body.content.length > MAX_CONTENT) {
      return NextResponse.json({ error: "content_too_long" }, { status: 413 });
    }
    update.content = body.content;
  }
  if (body.parent_page_id !== undefined) {
    // 자기 자신 또는 자기 후손을 부모로 하면 사이클 — DB 가 막을 수 없으니 클라/서버에서 검사
    if (body.parent_page_id === id) {
      return NextResponse.json({ error: "cannot_be_self_parent" }, { status: 400 });
    }
    if (body.parent_page_id) {
      const isDescendant = await checkDescendant(supabase, id, body.parent_page_id);
      if (isDescendant) {
        return NextResponse.json({ error: "cycle_detected" }, { status: 400 });
      }
    }
    update.parent_page_id = body.parent_page_id;
  }
  if (typeof body.position === "number") update.position = body.position;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("space_pages")
    .update(update)
    .eq("id", id)
    .select("id, parent_page_id, title, icon, content, position, created_by, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ page: data });
});

export const DELETE = withRouteLog("spaces.pages.delete", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { error } = await supabase.from("space_pages").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

/** target 이 source 의 후손인지 검사 — 사이클 방지. */
async function checkDescendant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  source: string,
  target: string,
): Promise<boolean> {
  let cur: string | null = target;
  for (let i = 0; i < 50 && cur; i++) {
    if (cur === source) return true;
    const fetched: { data: { parent_page_id?: string | null } | null } = await supabase
      .from("space_pages")
      .select("parent_page_id")
      .eq("id", cur)
      .maybeSingle();
    cur = fetched.data?.parent_page_id ?? null;
  }
  return false;
}
