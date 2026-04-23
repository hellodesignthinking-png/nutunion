import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptKey, pingProvider } from "@/lib/ai/vault";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { provider } = (await req.json().catch(() => ({}))) as { provider?: string };
  if (!provider || !["openai", "anthropic", "google"].includes(provider)) {
    return NextResponse.json({ ok: false, error: "invalid provider" }, { status: 400 });
  }

  const { data } = await supabase
    .from("user_ai_keys")
    .select("openai_key_enc,openai_key_iv,anthropic_key_enc,anthropic_key_iv,google_key_enc,google_key_iv")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = data as Record<string, string | null> | null;
  const enc = row?.[`${provider}_key_enc`];
  const iv = row?.[`${provider}_key_iv`];
  if (!enc || !iv) return NextResponse.json({ ok: false, error: "키가 저장되어 있지 않습니다" });

  let plain: string;
  try { plain = decryptKey(enc, iv); }
  catch { return NextResponse.json({ ok: false, error: "복호화 실패 (마스터 시크릿 변경?)" }); }

  const res = await pingProvider(provider as any, plain);
  return NextResponse.json(res);
}
