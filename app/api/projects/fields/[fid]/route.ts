import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ fid: string }>; }

export const PATCH = withRouteLog("projects.field.patch_def", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { fid } = await ctx.params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const ALLOWED = ["label", "options", "position", "is_required"];
  const update: Record<string, unknown> = {};
  for (const k of ALLOWED) if (k in body) update[k] = body[k];
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "no_changes" }, { status: 400 });

  const { data, error } = await supabase
    .from("project_field_defs")
    .update(update)
    .eq("id", fid)
    .select("id, key, label, field_type, options, position, is_required")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ def: data });
});

export const DELETE = withRouteLog("projects.field.delete_def", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { fid } = await ctx.params;
  const { error } = await supabase.from("project_field_defs").delete().eq("id", fid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
