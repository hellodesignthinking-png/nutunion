/**
 * GET /api/automations/approvals — pending approval queue for current user
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("automation_approvals")
    .select("*")
    .eq("owner_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ approvals: [], migration_missing: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ approvals: data || [] });
}
