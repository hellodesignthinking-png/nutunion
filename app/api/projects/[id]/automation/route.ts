import { NextRequest, NextResponse } from "next/server";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

interface RouteContext { params: Promise<{ id: string }>; }

const TRIGGERS = [
  "project.state_changed", "task.overdue", "milestone.due_soon",
  "risk.added.high", "decision.added", "file.uploaded",
] as const;

const ACTIONS = ["create_task", "create_risk", "notify", "send_webhook"] as const;

export const GET = withRouteLog("projects.automation.get", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { data: rules, error } = await supabase
    .from("project_automation_rules")
    .select("id, name, trigger, condition, action, action_config, enabled, cooldown_min, last_fired_at, fire_count, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 최근 실행 5건
  const { data: recentRuns } = await supabase
    .from("project_automation_runs")
    .select("rule_id, status, ran_at, error_msg")
    .eq("project_id", id)
    .order("ran_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ rules: rules ?? [], recent_runs: recentRuns ?? [] });
});

export const POST = withRouteLog("projects.automation.post", async (req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null) as {
    name?: string;
    trigger?: typeof TRIGGERS[number];
    condition?: Record<string, unknown>;
    action?: typeof ACTIONS[number];
    action_config?: Record<string, unknown>;
    cooldown_min?: number;
  } | null;

  if (!body?.name || !body.trigger || !TRIGGERS.includes(body.trigger)
      || !body.action || !ACTIONS.includes(body.action)) {
    return NextResponse.json({ error: "invalid_rule" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("project_automation_rules")
    .insert({
      project_id: id,
      name: body.name.slice(0, 80),
      trigger: body.trigger,
      condition: body.condition ?? {},
      action: body.action,
      action_config: body.action_config ?? {},
      cooldown_min: Math.max(1, Math.min(10080, body.cooldown_min ?? 1440)),
      created_by: user.id,
    })
    .select("id, name, trigger, condition, action, action_config, enabled, cooldown_min, last_fired_at, fire_count, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
});
