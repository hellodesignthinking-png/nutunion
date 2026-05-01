/**
 * GET /api/automations/:id/logs — recent execution logs for rule
 */
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = withRouteLog("automations.id.logs", async (_: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Ownership check first
  const { data: rule } = await supabase
    .from("automation_rules")
    .select("id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!rule) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("automation_logs")
    .select("*")
    .eq("rule_id", id)
    .order("executed_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data || [] });
});
