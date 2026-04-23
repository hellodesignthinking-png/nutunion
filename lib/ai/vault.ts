/**
 * lib/ai/vault — 유저별 AI 키 저장/복호화 + 모델 주입.
 *
 * 서버 전용. AES-256-GCM 으로 평문키를 암호화해 DB 에 저장.
 * 마스터 시크릿: env NU_KEY_VAULT_SECRET (32-byte base64)
 *   없으면 SUPABASE_JWT_SECRET 에서 sha256 derive (32B).
 *
 * 사용:
 *   import { getUserModel } from "@/lib/ai/vault";
 *   const { model, label, source } = await getUserModel(userId, "fast");
 */
import "server-only";
import crypto from "node:crypto";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createClient } from "@/lib/supabase/server";
import {
  generateTextWithFallback,
  generateObjectWithFallback,
  type FallbackOptions,
  type FallbackResult,
} from "@/lib/ai/model";

export type Provider = "openai" | "anthropic" | "google";
export type Tier = "fast" | "pro";

function getMasterKey(): Buffer {
  const explicit = process.env.NU_KEY_VAULT_SECRET;
  if (explicit) {
    try {
      const b = Buffer.from(explicit, "base64");
      if (b.length === 32) return b;
    } catch { /* fall through */ }
  }
  const seed = process.env.SUPABASE_JWT_SECRET || process.env.NEXTAUTH_SECRET || "nutunion-key-vault-fallback-seed";
  return crypto.createHash("sha256").update(seed).digest();
}

export function encryptKey(plain: string): { enc: string; iv: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getMasterKey(), iv);
  const encBuf = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 저장: ciphertext || authtag (base64), iv 따로
  return {
    enc: Buffer.concat([encBuf, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptKey(enc: string, iv: string): string {
  const buf = Buffer.from(enc, "base64");
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getMasterKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

export function maskKey(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 10) return "****";
  return `${plain.slice(0, 5)}…${plain.slice(-4)}`;
}

export interface UserKeys {
  openai?: string;
  anthropic?: string;
  google?: string;
  preferred: "auto" | Provider;
}

/** 현재 유저 키 (server-side only) — 복호화된 평문 + preferred. */
export async function loadUserKeys(userId: string): Promise<UserKeys> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_ai_keys")
    .select("openai_key_enc,openai_key_iv,anthropic_key_enc,anthropic_key_iv,google_key_enc,google_key_iv,preferred_provider")
    .eq("user_id", userId)
    .maybeSingle();
  const out: UserKeys = { preferred: (data?.preferred_provider as any) || "auto" };
  if (data?.openai_key_enc && data?.openai_key_iv) {
    try { out.openai = decryptKey(data.openai_key_enc, data.openai_key_iv); } catch { /* stale */ }
  }
  if (data?.anthropic_key_enc && data?.anthropic_key_iv) {
    try { out.anthropic = decryptKey(data.anthropic_key_enc, data.anthropic_key_iv); } catch { /* stale */ }
  }
  if (data?.google_key_enc && data?.google_key_iv) {
    try { out.google = decryptKey(data.google_key_enc, data.google_key_iv); } catch { /* stale */ }
  }
  return out;
}

export interface UserModel {
  model: any;
  label: string;
  source: "user" | "platform";
  provider: Provider | null;
}

/** 유저 키가 있으면 그 모델, 없으면 platform fallback 을 나타내는 메타. */
export async function getUserModel(userId: string, tier: Tier = "fast"): Promise<UserModel | null> {
  const keys = await loadUserKeys(userId);
  const order: Provider[] = keys.preferred === "auto"
    ? ["google", "openai", "anthropic"]
    : [keys.preferred as Provider, ...(["google", "openai", "anthropic"] as Provider[]).filter((p) => p !== keys.preferred)];

  for (const p of order) {
    const k = keys[p];
    if (!k) continue;
    try {
      if (p === "google") {
        const provider = createGoogleGenerativeAI({ apiKey: k });
        const name = tier === "pro" ? "gemini-2.5-pro" : "gemini-2.5-flash";
        return { model: provider(name), label: `google/${name}`, source: "user", provider: "google" };
      }
      if (p === "openai") {
        const provider = createOpenAI({ apiKey: k });
        const name = tier === "pro" ? "gpt-4.1" : "gpt-4.1-mini";
        return { model: provider(name), label: `openai/${name}`, source: "user", provider: "openai" };
      }
      if (p === "anthropic") {
        const provider = createAnthropic({ apiKey: k });
        const name = tier === "pro" ? "claude-sonnet-4-5" : "claude-haiku-4-5";
        return { model: provider(name), label: `anthropic/${name}`, source: "user", provider: "anthropic" };
      }
    } catch { /* try next */ }
  }
  return null; // caller should use platform fallback
}

/**
 * 통합 텍스트 생성 — 유저 키 우선, 없으면 platform fallback 체인.
 */
export async function generateTextForUser(
  userId: string,
  opts: FallbackOptions,
): Promise<FallbackResult<never>> {
  const tier = opts.tier || "fast";
  const userModel = await getUserModel(userId, tier);
  if (userModel) {
    // 유저 키 1회 시도, 실패하면 platform fallback
    try {
      const { generateText } = await import("ai");
      const res = await generateText({
        model: userModel.model,
        system: opts.system,
        prompt: opts.prompt,
        maxOutputTokens: opts.maxOutputTokens ?? 1024,
      });
      return {
        text: res.text,
        usage: { inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens },
        model_used: `${userModel.label} (user)`,
        fallback_index: 0,
        attempts: [],
      };
    } catch (err: any) {
      // user key 실패 → platform fallback
      const res = await generateTextWithFallback(opts);
      return { ...res, attempts: [{ label: `${userModel.label} (user)`, error: String(err?.message || err) }, ...res.attempts] };
    }
  }
  return generateTextWithFallback(opts);
}

export async function generateObjectForUser<T>(
  userId: string,
  schema: any,
  opts: FallbackOptions,
): Promise<FallbackResult<T>> {
  // 간단화: 유저 키면 1회 시도, 실패시 플랫폼 — object 는 schema 검증 비용이 있어서.
  const userModel = await getUserModel(userId, opts.tier || "fast");
  if (userModel) {
    try {
      const { generateObject } = await import("ai");
      const res = await generateObject({
        model: userModel.model,
        schema,
        system: opts.system,
        prompt: opts.prompt,
        maxOutputTokens: opts.maxOutputTokens ?? 2000,
      });
      return {
        object: res.object as T,
        usage: { inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens },
        model_used: `${userModel.label} (user)`,
        fallback_index: 0,
        attempts: [],
      };
    } catch (err: any) {
      const res = await generateObjectWithFallback<T>(schema, opts);
      return { ...res, attempts: [{ label: `${userModel.label} (user)`, error: String(err?.message || err) }, ...res.attempts] };
    }
  }
  return generateObjectWithFallback<T>(schema, opts);
}

/** 공급자 ping — 간단히 generateText 1회 던져 키 유효성 검사. */
export async function pingProvider(provider: Provider, apiKey: string): Promise<{ ok: boolean; model_used?: string; error?: string }> {
  try {
    const { generateText } = await import("ai");
    if (provider === "google") {
      const p = createGoogleGenerativeAI({ apiKey });
      const r = await generateText({ model: p("gemini-2.5-flash"), prompt: "ping", maxOutputTokens: 5 });
      return { ok: true, model_used: `google/gemini-2.5-flash${r.text ? "" : ""}` };
    }
    if (provider === "openai") {
      const p = createOpenAI({ apiKey });
      await generateText({ model: p("gpt-4.1-mini"), prompt: "ping", maxOutputTokens: 5 });
      return { ok: true, model_used: "openai/gpt-4.1-mini" };
    }
    if (provider === "anthropic") {
      const p = createAnthropic({ apiKey });
      await generateText({ model: p("claude-haiku-4-5"), prompt: "ping", maxOutputTokens: 5 });
      return { ok: true, model_used: "anthropic/claude-haiku-4-5" };
    }
    return { ok: false, error: "unknown provider" };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}
