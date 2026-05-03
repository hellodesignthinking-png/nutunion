import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ did: string }>; }

export const PATCH = withRouteLog("projects.decision.patch", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { did } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    title?: string; rationale?: string; status?: "active" | "reverted";
  } | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.title) update.title = body.title.slice(0, 200);
  if (typeof body.rationale === "string") update.rationale = body.rationale.slice(0, 2000) || null;
  if (body.status) update.status = body.status;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "no_changes" }, { status: 400 });

  const { data, error } = await supabase
    .from("project_decisions")
    .update(update)
    .eq("id", did)
    .select("id, title, rationale, status")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ decision: data });
});

export const DELETE = withRouteLog("projects.decision.delete", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { did } = await ctx.params;
  const { error } = await supabase.from("project_decisions").delete().eq("id", did);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
