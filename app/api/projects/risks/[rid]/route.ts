import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ rid: string }>; }

export const PATCH = withRouteLog("projects.risk.patch", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { rid } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    title?: string; description?: string;
    severity?: "low" | "medium" | "high" | "critical";
    status?: "open" | "mitigating" | "resolved" | "accepted";
    owner_id?: string | null;
    due_at?: string | null;
    resolution?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body.title) update.title = body.title.slice(0, 200);
  if (typeof body.description === "string") update.description = body.description.slice(0, 2000) || null;
  if (body.severity) update.severity = body.severity;
  if (body.status) {
    update.status = body.status;
    if (body.status === "resolved") {
      update.resolved_at = new Date().toISOString();
      update.resolved_by = user.id;
    }
  }
  if ("owner_id" in body) update.owner_id = body.owner_id || null;
  if ("due_at"   in body) update.due_at   = body.due_at   || null;
  if (typeof body.resolution === "string") update.resolution = body.resolution.slice(0, 2000) || null;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "no_changes" }, { status: 400 });

  const { data, error } = await supabase
    .from("project_risks")
    .update(update)
    .eq("id", rid)
    .select("id, title, description, severity, status, owner_id, due_at, resolved_at, resolution, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ risk: data });
});

export const DELETE = withRouteLog("projects.risk.delete", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { rid } = await ctx.params;
  const { error } = await supabase.from("project_risks").delete().eq("id", rid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
