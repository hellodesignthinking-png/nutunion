/**
 * POST /api/automations/approvals/:id/decide
 * body: { decision: "approve" | "reject" }
 *
 * On approve → load rule + trigger payload → execute actions → mark approved.
 * On reject  → mark rejected. Underlying log gets status = rejected.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { executeActions } from "@/lib/automation/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ id: string }> };

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "invalid decision" }, { status: 400 });
  }

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service role not configured" }, { status: 501 });

  const { data: approval } = await admin
    .from("automation_approvals")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (!approval) return NextResponse.json({ error: "approval not found" }, { status: 404 });

  if (decision === "reject") {
    await admin
      .from("automation_approvals")
      .update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("id", id);
    await admin
      .from("automation_logs")
      .update({ status: "rejected", approved_by: user.id, approved_at: new Date().toISOString() })
      .eq("id", (approval as any).log_id);
    return NextResponse.json({ ok: true, decision });
  }

  // Approve: load rule + payload, execute
  const { data: rule } = await admin
    .from("automation_rules")
    .select("*")
    .eq("id", (approval as any).rule_id)
    .maybeSingle();
  const { data: log } = await admin
    .from("automation_logs")
    .select("trigger_payload")
    .eq("id", (approval as any).log_id)
    .maybeSingle();

  if (!rule) return NextResponse.json({ error: "rule missing" }, { status: 404 });

  const result = await executeActions(admin, rule as any, (log as any)?.trigger_payload || {});

  await admin
    .from("automation_approvals")
    .update({ status: "approved", decided_at: new Date().toISOString() })
    .eq("id", id);
  await admin
    .from("automation_logs")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      action_results: result.results,
      error: result.error || null,
    })
    .eq("id", (approval as any).log_id);

  return NextResponse.json({ ok: true, decision, result });
}
