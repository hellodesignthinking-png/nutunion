import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { PROVIDERS, signState } from "@/lib/oauth/integrations";

/**
 * GET /api/integrations/[provider]/connect?projectId=xxx&returnTo=/projects/xxx
 * Slack/Notion/GitHub OAuth 시작 — 공급자 authorize URL 로 302 리다이렉트.
 */
export const GET = withRouteLog("integrations.provider.connect", async (req: Request, { params }: { params: Promise<{ provider: string }> }) => {
  const { provider } = await params;
  if (!(provider in PROVIDERS)) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  }
  const cfg = (PROVIDERS as any)[provider];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const url = new URL(req.url);
    return NextResponse.redirect(new URL(`/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`, req.url));
  }

  const clientId = process.env[cfg.clientIdEnv];
  if (!clientId) {
    return NextResponse.json({ error: `${cfg.clientIdEnv} not configured` }, { status: 501 });
  }

  const sp = new URL(req.url).searchParams;
  const redirectUri = new URL(`/api/integrations/${provider}/callback`, req.url).toString();
  const state = signState({
    userId: user.id,
    provider,
    projectId: sp.get("projectId") || null,
    returnTo: sp.get("returnTo") || "/profile",
  });

  const authUrl = cfg.authUrl({
    clientId,
    redirectUri,
    state,
    scopes: sp.get("scopes") || cfg.defaultScopes,
  });
  return NextResponse.redirect(authUrl);
});
