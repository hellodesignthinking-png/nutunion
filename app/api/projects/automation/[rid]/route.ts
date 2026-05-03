import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ rid: string }>; }

export const PATCH = withRouteLog("projects.automation.patch", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { rid } = await ctx.params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const ALLOWED = ["name", "trigger", "condition", "action", "action_config", "enabled", "cooldown_min"];
  const update: Record<string, unknown> = {};
  for (const k of ALLOWED) if (k in body) update[k] = body[k];
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "no_changes" }, { status: 400 });
  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("project_automation_rules")
    .update(update)
    .eq("id", rid)
    .select("id, name, trigger, condition, action, action_config, enabled, cooldown_min, last_fired_at, fire_count")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
});

export const DELETE = withRouteLog("projects.automation.delete", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { rid } = await ctx.params;
  const { error } = await supabase.from("project_automation_rules").delete().eq("id", rid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
