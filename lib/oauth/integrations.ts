import { createClient as createServiceClient } from "@supabase/supabase-js";
import crypto from "crypto";

/**
 * OAuth 통합 공용 유틸 — Slack / Notion / GitHub.
 *
 * 상태(state) 는 HMAC-SHA256 서명된 payload 로 전달:
 *   base64url(JSON.stringify({ userId, provider, returnTo, nonce, ts }))
 *   + "." + hmac
 */

type Provider = "slack" | "notion" | "github" | "discord";

export interface ProviderConfig {
  clientIdEnv: string;
  clientSecretEnv: string;
  authUrl: (p: { clientId: string; redirectUri: string; state: string; scopes: string }) => string;
  tokenUrl: string;
  defaultScopes: string;
  tokenBodyContentType: "application/x-www-form-urlencoded" | "application/json";
  extraTokenHeaders?: (p: { clientId: string; clientSecret: string }) => Record<string, string>;
  userInfoFromToken?: (tokenRes: any) => { externalUserId?: string; teamId?: string; teamName?: string; scopes?: string[] };
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  slack: {
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
    authUrl: ({ clientId, redirectUri, state, scopes }) =>
      `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    defaultScopes: "channels:manage,chat:write,channels:read,im:write",
    tokenBodyContentType: "application/x-www-form-urlencoded",
    userInfoFromToken: (r) => ({
      externalUserId: r.authed_user?.id,
      teamId: r.team?.id,
      teamName: r.team?.name,
      scopes: r.scope?.split(","),
    }),
  },
  notion: {
    clientIdEnv: "NOTION_CLIENT_ID",
    clientSecretEnv: "NOTION_CLIENT_SECRET",
    authUrl: ({ clientId, redirectUri, state }) =>
      `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    defaultScopes: "",
    tokenBodyContentType: "application/json",
    extraTokenHeaders: ({ clientId, clientSecret }) => ({
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Notion-Version": "2022-06-28",
    }),
    userInfoFromToken: (r) => ({
      externalUserId: r.owner?.user?.id || r.bot_id,
      teamId: r.workspace_id,
      teamName: r.workspace_name,
    }),
  },
  github: {
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET",
    authUrl: ({ clientId, redirectUri, state, scopes }) =>
      `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
    tokenUrl: "https://github.com/login/oauth/access_token",
    defaultScopes: "repo,read:user",
    tokenBodyContentType: "application/x-www-form-urlencoded",
    userInfoFromToken: (r) => ({
      scopes: r.scope?.split(","),
    }),
  },
  discord: {
    clientIdEnv: "DISCORD_CLIENT_ID",
    clientSecretEnv: "DISCORD_CLIENT_SECRET",
    authUrl: ({ clientId, redirectUri, state, scopes }) =>
      `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`,
    tokenUrl: "https://discord.com/api/oauth2/token",
    defaultScopes: "identify guilds",
    tokenBodyContentType: "application/x-www-form-urlencoded",
  },
};

export function signState(payload: Record<string, any>): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.FLAGS_SECRET || "dev-fallback-secret-please-set";
  const data = { ...payload, nonce: crypto.randomBytes(8).toString("hex"), ts: Date.now() };
  const b64 = Buffer.from(JSON.stringify(data)).toString("base64url");
  const hmac = crypto.createHmac("sha256", secret).update(b64).digest("base64url");
  return `${b64}.${hmac}`;
}

export function verifyState(state: string): Record<string, any> | null {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.FLAGS_SECRET || "dev-fallback-secret-please-set";
  const [b64, sig] = state.split(".");
  if (!b64 || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(b64).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(b64, "base64url").toString());
    if (Date.now() - (data.ts || 0) > 10 * 60 * 1000) return null;  // 10분 만료
    return data;
  } catch {
    return null;
  }
}

export async function exchangeCodeForToken({
  provider, code, redirectUri,
}: { provider: Provider; code: string; redirectUri: string; }) {
  const cfg = PROVIDERS[provider];
  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.clientSecretEnv];
  if (!clientId || !clientSecret) throw new Error(`${cfg.clientIdEnv} / ${cfg.clientSecretEnv} not configured`);

  const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" });

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": cfg.tokenBodyContentType,
      Accept: "application/json",
      ...(cfg.extraTokenHeaders ? cfg.extraTokenHeaders({ clientId, clientSecret }) : {}),
    },
    body: cfg.tokenBodyContentType === "application/json"
      ? JSON.stringify({ code, redirect_uri: redirectUri, grant_type: "authorization_code" })
      : body.toString(),
  });

  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error_description || data.error || "Token exchange failed");
  return data;
}

export async function saveIntegration({
  userId, provider, tokenRes,
}: { userId: string; provider: Provider; tokenRes: any; }) {
  const cfg = PROVIDERS[provider];
  const info = cfg.userInfoFromToken ? cfg.userInfoFromToken(tokenRes) : {};

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE env missing");
  const db = createServiceClient(url, key, { auth: { persistSession: false } });

  const expiresAt = tokenRes.expires_in
    ? new Date(Date.now() + tokenRes.expires_in * 1000).toISOString()
    : null;

  const { error } = await db.from("external_integrations").upsert({
    user_id: userId,
    provider,
    external_user_id: info.externalUserId || null,
    external_team_id: info.teamId || null,
    external_team_name: info.teamName || null,
    access_token: tokenRes.access_token,
    refresh_token: tokenRes.refresh_token || null,
    token_expires_at: expiresAt,
    scopes: info.scopes || null,
    metadata: tokenRes,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider" });

  if (error) throw error;
}
