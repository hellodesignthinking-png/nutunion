import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad_json" }, { status: 400 });
  const { enabled, features } = body as { enabled?: boolean; features?: string[] };

  const ai_preferences = {
    enabled: enabled !== false,
    features: Array.isArray(features) ? features : [],
  };

  const { error } = await supabase
    .from("profiles")
    .update({ ai_preferences })
    .eq("id", user.id);
  if (error) {
    if (/column .* does not exist/i.test(error.message)) {
      return NextResponse.json({ error: "migration_121_missing" }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ai_preferences });
}
