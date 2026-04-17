import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client } from "@/lib/google/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const state = req.nextUrl.searchParams.get("state");

  let returnTo = "/dashboard";
  if (state) {
    try {
      const decoded = Buffer.from(state, "base64").toString("utf-8");
      if (decoded.startsWith("/")) returnTo = decoded;
    } catch (e) {}
  }

  const separator = returnTo.includes("?") ? "&" : "?";

  // User denied access
  if (error) {
    return NextResponse.redirect(
      new URL(`${returnTo}${separator}google=denied`, req.nextUrl.origin)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`${returnTo}${separator}google=error&reason=no_code`, req.nextUrl.origin)
    );
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Get current Supabase user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL(`/login?redirect=/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`, req.nextUrl.origin)
      );
    }

    // Save tokens to profiles
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token,
        google_token_expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to save Google tokens:", updateError);
      return NextResponse.redirect(
        new URL(`${returnTo}${separator}google=error&reason=save_failed`, req.nextUrl.origin)
      );
    }

    return NextResponse.redirect(
      new URL(`${returnTo}${separator}google=connected`, req.nextUrl.origin)
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`${returnTo}${separator}google=error&reason=token_exchange`, req.nextUrl.origin)
    );
  }
}
