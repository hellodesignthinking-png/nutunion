import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

const MAX_CONTENT = 20_000;
const ALLOWED_TYPES = new Set([
  "text", "h1", "h2", "h3", "bullet", "numbered", "todo", "code", "divider", "quote", "callout",
]);

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/spaces/pages/{pageId}/blocks → { blocks }
 * POST 동일  body: { type, content?, data?, position? } → { block }
 */
export const GET = withRouteLog("spaces.pages.blocks.get", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: pageId } = await ctx.params;
  const { data, error } = await supabase
    .from("space_page_blocks")
    .select("id, type, content, data, position, created_by, created_at, updated_at")
    .eq("page_id", pageId)
    .order("position", { ascending: true })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ blocks: data ?? [] });
});

export const POST = withRouteLog("spaces.pages.blocks.post", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: pageId } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    type?: string;
    content?: string;
    data?: Record<string, unknown>;
    position?: number;
  } | null;
  if (!body?.type || !ALLOWED_TYPES.has(body.type)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }
  if (body.content && body.content.length > MAX_CONTENT) {
    return NextResponse.json({ error: "content_too_long" }, { status: 413 });
  }

  let position = body.position;
  if (typeof position !== "number") {
    const { data: tail } = await supabase
      .from("space_page_blocks")
      .select("position")
      .eq("page_id", pageId)
      .order("position", { ascending: false })
      .limit(1);
    position = (tail?.[0]?.position ?? -1) + 1;
  }

  const { data, error } = await supabase
    .from("space_page_blocks")
    .insert({
      page_id: pageId,
      type: body.type,
      content: body.content ?? "",
      data: body.data ?? {},
      position,
      created_by: user.id,
    })
    .select("id, type, content, data, position, created_by, created_at, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ block: data });
});
