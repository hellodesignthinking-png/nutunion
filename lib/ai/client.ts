import { generateText } from "ai";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NU_AI_MODEL, NU_AI_MODEL_LABEL, NU_AI_PRICING } from "./model";

/**
 * nutunion AI Assist — Google Gemini 2.5 Flash 직접 호출 래퍼.
 *
 * 인증: GOOGLE_GENERATIVE_AI_API_KEY (Google AI Studio 에서 발급)
 *
 * 추적: ai_usage_logs (input/output tokens + 예상 KRW)
 * Rate limit: 월 전역 30만원 / 개인 5천원 / 일 10회
 */

const MODEL = NU_AI_MODEL;
const MODEL_LABEL = NU_AI_MODEL_LABEL;

// Pricing — Gemini 2.5 Flash (중앙 집중식)
const PRICING = {
  input_per_mtok_usd: NU_AI_PRICING.flash.input_per_mtok_usd,
  output_per_mtok_usd: NU_AI_PRICING.flash.output_per_mtok_usd,
};
const USD_TO_KRW = Number(process.env.USD_TO_KRW ?? "1380");

export type AIFeature = "nut_description" | "bolt_scoping" | "tap_writer" | "profile_enhance" | "match_explain" | "feed_summarize" | "anchor_insights";

export const NUTUNION_SYSTEM = `
당신은 너트유니온의 AI Assistant입니다. 너트유니온은 "Protocol Collective"로 다음 개념을 사용합니다:
- 너트(Nut): 관심사 기반 커뮤니티
- 볼트(Bolt): 너트가 모여 실행하는 프로젝트
- 탭(Tap): 경험·지식의 아카이브
- 와셔(Washer): 플랫폼 구성원
- 강성(Stiffness): 활동 척도
답변은 한국어 존댓말. 너무 딱딱하지 않게, 전문성이 느껴지게. 너트유니온 개념을 자연스럽게 녹입니다.
`.trim();

function getService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export async function checkBudget(userId: string): Promise<{ ok: boolean; reason?: string }> {
  const db = getService();
  // Service role 부재 → 버짓 가드 무력화 방지. AI 기능 자체 비활성화.
  if (!db) return { ok: false, reason: "SUPABASE_SERVICE_ROLE 미설정 — AI 기능 비활성" };

  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const [{ data: global }, { data: mine }] = await Promise.all([
    db.from("ai_budget_logs").select("cost_krw").gte("created_at", since),
    db.from("ai_budget_logs").select("cost_krw").eq("user_id", userId).gte("created_at", since),
  ]);
  const globalSum = (global ?? []).reduce((s: number, r: any) => s + (r.cost_krw ?? 0), 0);
  const mySum = (mine ?? []).reduce((s: number, r: any) => s + (r.cost_krw ?? 0), 0);

  if (globalSum > 300_000) return { ok: false, reason: "월 전역 예산(30만원) 초과" };
  if (mySum > 5_000) return { ok: false, reason: "월 개인 한도(5천원) 초과 — 내일 다시 시도해주세요" };

  // 와셔당 하루 10회
  const today = new Date(Date.now() - 86400000).toISOString();
  const { count: todayCount } = await db
    .from("ai_budget_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", today);
  if ((todayCount ?? 0) >= 10) return { ok: false, reason: "오늘 AI 호출 한도(10회) 소진" };

  return { ok: true };
}

export async function askClaude(opts: {
  system?: string;
  user: string;
  maxTokens?: number;
  feature: AIFeature;
  userId: string;
}): Promise<{ text: string | null; error?: string; stubbed?: boolean }> {
  const budget = await checkBudget(opts.userId);
  if (!budget.ok) return { text: null, error: budget.reason };

  const start = Date.now();

  try {
    // AI Gateway 경유 — OIDC 자동 인증 (Vercel deploy) 또는 로컬 env pull.
    // Model slug: provider/model@version (dots for version).
    const res = await generateText({
      model: MODEL,
      system: opts.system ?? NUTUNION_SYSTEM,
      prompt: opts.user,
      maxOutputTokens: opts.maxTokens ?? 1024,
    });

    const text = res.text ?? "";
    const inputTokens = res.usage?.inputTokens ?? 0;
    const outputTokens = res.usage?.outputTokens ?? 0;
    const costUsd = (inputTokens / 1_000_000) * PRICING.input_per_mtok_usd + (outputTokens / 1_000_000) * PRICING.output_per_mtok_usd;
    const costKrw = Math.ceil(costUsd * USD_TO_KRW);

    // 로깅
    try {
      const db = getService();
      if (db) {
        await db.from("ai_budget_logs").insert({
          user_id: opts.userId,
          feature: opts.feature,
          model: MODEL_LABEL,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd_cents: Math.round(costUsd * 100),
          cost_krw: costKrw,
          latency_ms: Date.now() - start,
        });
      }
    } catch {}

    return { text };
  } catch (err: any) {
    try {
      const db = getService();
      if (db) {
        await db.from("ai_budget_logs").insert({
          user_id: opts.userId,
          feature: opts.feature,
          model: MODEL_LABEL,
          input_tokens: 0 as number,
          output_tokens: 0,
          latency_ms: Date.now() - start,
          error: (err.message || "unknown").slice(0, 200),
        });
      }
    } catch {}
    return { text: null, error: err.message || "Claude API 호출 실패" };
  }
}

/** 수용 여부 로깅 */
export async function markAIAccepted(userId: string, feature: AIFeature, accepted: boolean) {
  try {
    const db = getService();
    if (!db) return;
    // 마지막 기록 업데이트
    const { data } = await db
      .from("ai_budget_logs")
      .select("id")
      .eq("user_id", userId)
      .eq("feature", feature)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      await db.from("ai_budget_logs").update({ accepted }).eq("id", data.id);
    }
  } catch {}
}
