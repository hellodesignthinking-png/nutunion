/**
 * POST /api/automations/custom — create a rule from the Visual Builder.
 * Unlike /api/automations (template-based), this accepts raw trigger + actions.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TRIGGERS, ACTIONS } from "@/lib/automation/palette";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const name: string = (body.name || "").trim();
  const trigger_type: string = body.trigger_type;
  const actions: Array<{ type: string; params?: any }> = Array.isArray(body.actions) ? body.actions : [];
  const conditions = body.conditions && typeof body.conditions === "object" ? body.conditions : {};
  const scope = body.scope && typeof body.scope === "object"
    ? body.scope
    : { kind: "all", ids: [] };
  const require_approval = !!body.require_approval;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!trigger_type || !TRIGGERS.find((t) => t.id === trigger_type)) {
    return NextResponse.json({ error: "unknown trigger_type" }, { status: 400 });
  }
  if (actions.length === 0) {
    return NextResponse.json({ error: "at least 1 action required" }, { status: 400 });
  }
  if (actions.length > 5) {
    return NextResponse.json({ error: "too many actions (max 5)" }, { status: 400 });
  }
  for (const a of actions) {
    if (!ACTIONS.find((spec) => spec.type === a.type)) {
      return NextResponse.json({ error: `unknown action type: ${a.type}` }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("automation_rules")
    .insert({
      owner_id: user.id,
      template_id: "custom_builder",
      name,
      description: "커스텀 룰 빌더로 생성됨",
      trigger_type,
      actions,
      conditions,
      scope,
      require_approval,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ error: "migration_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rule: data });
}
