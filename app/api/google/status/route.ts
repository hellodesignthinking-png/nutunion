import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ connected: false, reason: "not_logged_in" }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("google_access_token, google_token_expiry")
    .eq("id", user.id)
    .single();

  if (!profile?.google_access_token) {
    return NextResponse.json({ connected: false, reason: "not_connected" }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  const isExpired = profile.google_token_expiry
    ? new Date() >= new Date(profile.google_token_expiry)
    : false;

  return NextResponse.json({
    connected: true,
    tokenExpired: isExpired,
    connectUrl: "/api/auth/google",
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

// DELETE: Google 연결 해제
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase
    .from("profiles")
    .update({
      google_access_token: null,
      google_refresh_token: null,
      google_token_expiry: null,
    })
    .eq("id", user.id);

  return NextResponse.json({ disconnected: true });
}
