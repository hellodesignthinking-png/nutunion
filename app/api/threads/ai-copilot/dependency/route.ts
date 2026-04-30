import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { data, error } = await supabase
      .from("user_ai_actions")
      .select("outcome")
      .eq("user_id", user.id)
      .neq("outcome", "pending")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) {
      if (/relation .* does not exist/i.test(error.message) || (error as any).code === "42P01") {
        return NextResponse.json({ recent_count: 0, accept_rate: 0 });
      }
      return NextResponse.json({ recent_count: 0, accept_rate: 0 });
    }
    const arr = (data || []) as Array<{ outcome: string }>;
    const accepted = arr.filter((a) => a.outcome === "accepted").length;
    return NextResponse.json({
      recent_count: arr.length,
      accept_rate: arr.length === 0 ? 0 : accepted / arr.length,
    });
  } catch {
    return NextResponse.json({ recent_count: 0, accept_rate: 0 });
  }
}
