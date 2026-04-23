import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptKey, decryptKey, maskKey } from "@/lib/ai/vault";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

type Provider = "openai" | "anthropic" | "google";

/** GET — 저장된 키의 마스킹된 미리보기 + preferred_provider */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_ai_keys")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  function preview(enc: string | null, iv: string | null) {
    if (!enc || !iv) return null;
    try { return maskKey(decryptKey(enc, iv)); } catch { return "****"; }
  }

  return NextResponse.json({
    openai: preview(data?.openai_key_enc, data?.openai_key_iv),
    anthropic: preview(data?.anthropic_key_enc, data?.anthropic_key_iv),
    google: preview(data?.google_key_enc, data?.google_key_iv),
    preferred_provider: data?.preferred_provider || "auto",
  });
}

/** POST — 하나 이상의 provider 키 업데이트 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { openai, anthropic, google, preferred_provider } = body as {
    openai?: string | null;
    anthropic?: string | null;
    google?: string | null;
    preferred_provider?: string;
  };

  const patch: Record<string, any> = { user_id: user.id, updated_at: new Date().toISOString() };

  function applyKey(prov: Provider, plain: string | null | undefined) {
    if (plain === undefined) return; // 건드리지 않음
    if (plain === null || plain.trim() === "") {
      patch[`${prov}_key_enc`] = null;
      patch[`${prov}_key_iv`] = null;
      return;
    }
    const { enc, iv } = encryptKey(plain.trim());
    patch[`${prov}_key_enc`] = enc;
    patch[`${prov}_key_iv`] = iv;
  }
  applyKey("openai", openai);
  applyKey("anthropic", anthropic);
  applyKey("google", google);

  if (preferred_provider && ["auto", "openai", "anthropic", "google"].includes(preferred_provider)) {
    patch.preferred_provider = preferred_provider;
  }

  const { error } = await supabase.from("user_ai_keys").upsert(patch, { onConflict: "user_id" });
  if (error) {
    log.error(error, "user_ai_keys.upsert.failed", { user_id: user.id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  log.info("user_ai_keys.updated", { user_id: user.id });
  return NextResponse.json({ ok: true });
}
