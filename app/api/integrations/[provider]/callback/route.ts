import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { PROVIDERS, verifyState, exchangeCodeForToken, saveIntegration } from "@/lib/oauth/integrations";

/**
 * GET /api/integrations/[provider]/callback?code=...&state=...
 * 공급자에서 code 수신 → 토큰 교환 → external_integrations 저장 → returnTo 로 리다이렉트.
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!(provider in PROVIDERS)) {
    return NextResponse.redirect(new URL("/profile?integration=unsupported", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  if (providerError) {
    return NextResponse.redirect(new URL(`/profile?integration=${provider}&error=${encodeURIComponent(providerError)}`, req.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL(`/profile?integration=${provider}&error=missing_params`, req.url));
  }

  const payload = verifyState(state);
  if (!payload || payload.provider !== provider) {
    return NextResponse.redirect(new URL(`/profile?integration=${provider}&error=invalid_state`, req.url));
  }

  const redirectUri = new URL(`/api/integrations/${provider}/callback`, req.url).toString();

  try {
    const tokenRes = await exchangeCodeForToken({
      provider: provider as any,
      code,
      redirectUri,
    });
    await saveIntegration({ userId: payload.userId, provider: provider as any, tokenRes });
  } catch (err: any) {
    log.error(err, "integrations.provider.callback.failed");
    return NextResponse.redirect(new URL(`/profile?integration=${provider}&error=${encodeURIComponent((err.message || "exchange_failed").slice(0, 100))}`, req.url));
  }

  const returnTo = payload.returnTo || "/profile";
  const redirect = new URL(returnTo, req.url);
  redirect.searchParams.set("integration", provider);
  redirect.searchParams.set("status", "connected");
  if (payload.projectId) redirect.searchParams.set("projectId", payload.projectId);
  return NextResponse.redirect(redirect);
}
