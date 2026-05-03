import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ moduleId: string }>; }

/** PATCH — body: { title?, config?, width?, is_visible? } */
export const PATCH = withRouteLog("projects.module.patch", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { moduleId } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    title?: string | null;
    config?: Record<string, unknown>;
    width?: number;
    is_visible?: boolean;
  } | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.title !== "undefined") update.title = body.title?.slice(0, 80) || null;
  if (body.config) update.config = body.config;
  if (typeof body.width === "number") update.width = Math.max(1, Math.min(3, body.width));
  if (typeof body.is_visible === "boolean") update.is_visible = body.is_visible;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "no_changes" }, { status: 400 });

  const { data, error } = await supabase
    .from("project_modules")
    .update(update)
    .eq("id", moduleId)
    .select("id, kind, title, config, width, sort_order, is_visible, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ module: data });
});

/** DELETE */
export const DELETE = withRouteLog("projects.module.delete", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { moduleId } = await ctx.params;
  const { error } = await supabase.from("project_modules").delete().eq("id", moduleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
