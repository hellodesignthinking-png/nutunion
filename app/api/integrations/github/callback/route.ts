/**
 * GET /api/integrations/github/callback?code=...&state=...
 *  → exchange code for token, save encrypted, redirect to /settings/integrations.
 */
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { saveIntegration } from "@/lib/integrations/tokens";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/login", req.url));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("gh_oauth_state")?.value;
  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL("/settings/integrations?error=state", req.url));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings/integrations?error=env", req.url));
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${url.origin}/api/integrations/github/callback`,
      }),
    });
    const tokenJson = await tokenRes.json();
    const accessToken: string | undefined = tokenJson.access_token;
    if (!accessToken) {
      return NextResponse.redirect(new URL("/settings/integrations?error=token", req.url));
    }

    // user info for metadata
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "nutunion" },
    });
    const ghUser = await userRes.json().catch(() => ({}));

    await saveIntegration(auth.user.id, "github", accessToken, {
      scopes: tokenJson.scope || null,
      metadata: { login: ghUser.login, name: ghUser.name, avatar_url: ghUser.avatar_url },
    });

    const res = NextResponse.redirect(new URL("/settings/integrations?ok=github", req.url));
    res.cookies.delete("gh_oauth_state");
    return res;
  } catch (e: any) {
    log.error(e, "integrations.github.callback.failed");
    console.error("[github callback]", e);
    return NextResponse.redirect(new URL(`/settings/integrations?error=exception`, req.url));
  }
}
