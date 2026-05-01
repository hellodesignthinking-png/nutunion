import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_json" }, { status: 400 });
  const { outcome } = body as { outcome?: "accepted" | "rejected" | "rolled_back" };
  if (!outcome) return NextResponse.json({ error: "missing_outcome" }, { status: 400 });

  // Update most recent pending action for this user
  try {
    const { data: latest } = await supabase
      .from("user_ai_actions")
      .select("id")
      .eq("user_id", user.id)
      .eq("outcome", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) {
      await supabase.from("user_ai_actions").update({ outcome, updated_at: new Date().toISOString() }).eq("id", latest.id);
    }
  } catch { /* migration 121 may be missing */ }

  return NextResponse.json({ ok: true });
}
