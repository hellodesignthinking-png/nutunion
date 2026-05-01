/**
 * GET  /api/automations         — list my rules
 * POST /api/automations         — create rule from template
 */
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { findTemplate } from "@/lib/automation/templates";

export const dynamic = "force-dynamic";

export const GET = withRouteLog("automations.get", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ rules: [], migration_missing: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rules: data || [] });
});

export const POST = withRouteLog("automations.post", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const template_id = body?.template_id;
  if (!template_id) return NextResponse.json({ error: "template_id required" }, { status: 400 });

  const template = findTemplate(template_id);
  if (!template) return NextResponse.json({ error: "unknown template" }, { status: 400 });

  const scope = body?.scope || { kind: "all", ids: [] };
  const require_approval = !!body?.require_approval;
  const conditions = body?.conditions && typeof body.conditions === "object" ? body.conditions : {};
  // Allow per-activation override of default actions (e.g. webhook URL/service)
  const actions = Array.isArray(body?.actions) && body.actions.length > 0
    ? body.actions
    : template.default_actions;

  const { data, error } = await supabase
    .from("automation_rules")
    .insert({
      owner_id: user.id,
      template_id: template.id,
      name: template.name,
      description: template.description,
      trigger_type: template.trigger_type,
      actions,
      conditions,
      scope,
      require_approval,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rule: data });
});
