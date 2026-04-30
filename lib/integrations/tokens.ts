/**
 * lib/integrations/tokens — encrypted OAuth token vault for GitHub / Linear.
 *
 * Reuses lib/ai/vault encrypt/decrypt so we share the master key.
 */
import "server-only";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { encryptKey, decryptKey } from "@/lib/ai/vault";

export type IntegrationProvider = "github" | "linear";

interface SaveOpts {
  refreshToken?: string | null;
  scopes?: string | null;
  installationId?: string | null;
  workspaceId?: string | null;
  metadata?: Record<string, any> | null;
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("supabase admin client missing env");
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function saveIntegration(
  userId: string,
  provider: IntegrationProvider,
  accessToken: string,
  opts: SaveOpts = {},
): Promise<void> {
  const { enc, iv } = encryptKey(accessToken);
  const refresh = opts.refreshToken ? encryptKey(opts.refreshToken) : null;
  const db = admin();
  const { error } = await db.from("user_integrations").upsert(
    {
      user_id: userId,
      provider,
      access_token_enc: enc,
      access_token_iv: iv,
      refresh_token_enc: refresh?.enc ?? null,
      refresh_token_iv: refresh?.iv ?? null,
      scopes: opts.scopes ?? null,
      installation_id: opts.installationId ?? null,
      workspace_id: opts.workspaceId ?? null,
      metadata: opts.metadata ?? {},
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw error;
}

export interface LoadedIntegration {
  accessToken: string;
  refreshToken?: string | null;
  scopes?: string | null;
  installationId?: string | null;
  workspaceId?: string | null;
  metadata?: Record<string, any>;
  connectedAt?: string;
}

export async function loadIntegration(
  userId: string,
  provider: IntegrationProvider,
): Promise<LoadedIntegration | null> {
  const db = admin();
  const { data, error } = await db
    .from("user_integrations")
    .select(
      "access_token_enc, access_token_iv, refresh_token_enc, refresh_token_iv, scopes, installation_id, workspace_id, metadata, connected_at",
    )
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error || !data) return null;
  try {
    const accessToken = decryptKey(data.access_token_enc, data.access_token_iv);
    const refreshToken =
      data.refresh_token_enc && data.refresh_token_iv
        ? decryptKey(data.refresh_token_enc, data.refresh_token_iv)
        : null;
    return {
      accessToken,
      refreshToken,
      scopes: data.scopes,
      installationId: data.installation_id,
      workspaceId: data.workspace_id,
      metadata: data.metadata || {},
      connectedAt: data.connected_at,
    };
  } catch {
    return null;
  }
}

export async function deleteIntegration(
  userId: string,
  provider: IntegrationProvider,
): Promise<void> {
  const db = admin();
  await db
    .from("user_integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
}
