/**
 * lib/ai/model — nutunion AI 모델 단일 진실점 + 자동 fallback 체인.
 *
 * 기본 모델: Google Gemini 2.5 Flash (가격/속도 우위)
 * Fallback 순서:
 *   1) Google Gemini        → GOOGLE_GENERATIVE_AI_API_KEY
 *   2) OpenAI GPT-4.1-mini   → OPENAI_API_KEY
 *   3) Anthropic Claude      → ANTHROPIC_API_KEY
 *
 * 적어도 1개 키만 있으면 서비스 유지. 한 공급자 장애 시 자동 다음 모델 시도.
 *
 * 사용:
 *   import { generateWithFallback } from "@/lib/ai/model";
 *   const { object, model_used } = await generateWithFallback("object", {
 *     schema: MySchema, system, prompt, maxOutputTokens: 2000,
 *   });
 */

import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { generateText, generateObject, gateway, createGateway } from "ai";
import type { z } from "zod";

// ──────────────────────────────────────────────
// Vercel AI Gateway 우선 — AI_GATEWAY_API_KEY 가 있으면 모든 호출이 Gateway 통과.
// 장점: 단일 키로 다중 provider, 비용 가시성, 자동 failover, OIDC 자동.
// 미설정 시 기존 직접 키 fallback chain 으로 graceful degrade.
// ──────────────────────────────────────────────
const GATEWAY_KEY = process.env.AI_GATEWAY_API_KEY;
const USE_GATEWAY = !!GATEWAY_KEY || process.env.VERCEL_OIDC_TOKEN; // Vercel deploy시 OIDC 자동
const gatewayProvider = GATEWAY_KEY
  ? createGateway({ apiKey: GATEWAY_KEY })
  : USE_GATEWAY
  ? gateway // OIDC 자동 인증
  : null;

// ──────────────────────────────────────────────
// 환경변수 이름 3중 fallback — 유저가 GEMINI_API_KEY 로 등록했어도 작동
// (Gateway 미설정 환경의 직접 호출용 fallback)
// ──────────────────────────────────────────────
const GOOGLE_KEY =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_AI_API_KEY;

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// 명시적 provider 인스턴스 (env 이름 불일치 대응)
const googleProvider = GOOGLE_KEY ? createGoogleGenerativeAI({ apiKey: GOOGLE_KEY }) : null;
const openaiProvider = OPENAI_KEY ? createOpenAI({ apiKey: OPENAI_KEY }) : null;
const anthropicProvider = ANTHROPIC_KEY ? createAnthropic({ apiKey: ANTHROPIC_KEY }) : null;

// ──────────────────────────────────────────────
// 모델 정의 + 레거시 export (뒷하위호환)
// ──────────────────────────────────────────────
// 키 없으면 기본 google() 로 (런타임 에러 가능하지만 개발 중 문제 회피)
export const NU_AI_MODEL = googleProvider ? googleProvider("gemini-2.5-flash") : google("gemini-2.5-flash");
export const NU_AI_MODEL_PRO = googleProvider ? googleProvider("gemini-2.5-pro") : google("gemini-2.5-pro");
export const NU_AI_MODEL_LABEL = "google/gemini-2.5-flash";
export const NU_AI_MODEL_PRO_LABEL = "google/gemini-2.5-pro";

export const NU_AI_PRICING = {
  flash: { input_per_mtok_usd: 0.075, output_per_mtok_usd: 0.30 },
  pro:   { input_per_mtok_usd: 1.25,  output_per_mtok_usd: 10.00 },
};

// ──────────────────────────────────────────────
// Fallback 체인
// ──────────────────────────────────────────────

interface ModelCandidate {
  label: string;
  model: any;
  envKey: string;
}

/** tier: "fast" (flash/mini) | "pro" (pro/opus)
 *
 * Gateway 우선 — gatewayProvider 가 활성화돼 있으면 gateway 모델 3개를 chain 으로.
 * Gateway model id 는 dot 표기(`anthropic/claude-sonnet-4.5`), 직접 SDK 는 hyphen 표기.
 * Gateway 미설정 시 직접 provider 키로 fallback.
 */
function buildChain(tier: "fast" | "pro" = "fast"): ModelCandidate[] {
  const chain: ModelCandidate[] = [];

  // ─ Gateway 모드 ─ AI_GATEWAY_API_KEY 또는 OIDC 자동
  if (gatewayProvider) {
    const ids = tier === "pro"
      ? ["google/gemini-2.5-pro", "openai/gpt-4.1", "anthropic/claude-sonnet-4.5"]
      : ["google/gemini-2.5-flash", "openai/gpt-4.1-mini", "anthropic/claude-haiku-4.5"];
    for (const id of ids) {
      chain.push({
        label: id,
        model: gatewayProvider.languageModel(id),
        envKey: "AI_GATEWAY_API_KEY (or OIDC)",
      });
    }
    return chain;
  }

  // ─ Direct provider 모드 ─ 개별 키로 fallback chain
  // Google (GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY 둘 다 인식)
  if (googleProvider) {
    chain.push({
      label: tier === "pro" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
      model: tier === "pro" ? googleProvider("gemini-2.5-pro") : googleProvider("gemini-2.5-flash"),
      envKey: "GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY",
    });
  }
  // OpenAI
  if (openaiProvider) {
    chain.push({
      label: tier === "pro" ? "openai/gpt-4.1" : "openai/gpt-4.1-mini",
      model: tier === "pro" ? openaiProvider("gpt-4.1") : openaiProvider("gpt-4.1-mini"),
      envKey: "OPENAI_API_KEY",
    });
  }
  // Anthropic — 직접 SDK 는 hyphen 표기 (claude-sonnet-4-5)
  if (anthropicProvider) {
    chain.push({
      label: tier === "pro" ? "anthropic/claude-sonnet-4-5" : "anthropic/claude-haiku-4-5",
      model: tier === "pro" ? anthropicProvider("claude-sonnet-4-5") : anthropicProvider("claude-haiku-4-5"),
      envKey: "ANTHROPIC_API_KEY",
    });
  }

  return chain;
}

export interface FallbackResult<T = unknown> {
  text?: string;
  object?: T;
  usage?: { inputTokens?: number; outputTokens?: number };
  model_used: string;
  /** 체인에서 몇 번째로 성공했는지 (0 = primary) */
  fallback_index: number;
  /** 실패한 시도들 */
  attempts: Array<{ label: string; error: string }>;
}

export interface FallbackOptions {
  system?: string;
  prompt: string;
  maxOutputTokens?: number;
  tier?: "fast" | "pro";
  /** 각 모델별 최대 시도 시간 (ms) */
  timeoutMs?: number;
}

/** 텍스트 생성 — 체인 순차 시도 */
export async function generateTextWithFallback(opts: FallbackOptions): Promise<FallbackResult<never>> {
  const chain = buildChain(opts.tier);
  if (chain.length === 0) {
    throw new Error("AI 공급자가 하나도 설정되지 않음 (GOOGLE_GENERATIVE_AI_API_KEY/OPENAI_API_KEY/ANTHROPIC_API_KEY 중 최소 1개 필요)");
  }
  const attempts: Array<{ label: string; error: string }> = [];
  for (let i = 0; i < chain.length; i++) {
    const c = chain[i];
    try {
      const res = await withTimeout(
        generateText({
          model: c.model,
          system: opts.system,
          prompt: opts.prompt,
          maxOutputTokens: opts.maxOutputTokens ?? 1024,
        }),
        opts.timeoutMs ?? 45_000,
        c.label,
      );
      return {
        text: res.text,
        usage: { inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens },
        model_used: c.label,
        fallback_index: i,
        attempts,
      };
    } catch (err: any) {
      attempts.push({ label: c.label, error: err?.message || String(err) });
      // 다음 모델 시도
    }
  }
  const detail = attempts.map((a) => `${a.label}: ${a.error}`).join(" | ");
  throw new Error(`모든 AI 공급자 실패 (${chain.length} 시도) — ${detail}`);
}

/** 구조화 객체 생성 — zod schema 강제 */
export async function generateObjectWithFallback<T>(
  schema: z.ZodType<T>,
  opts: FallbackOptions,
): Promise<FallbackResult<T>> {
  const chain = buildChain(opts.tier);
  if (chain.length === 0) {
    throw new Error("AI 공급자가 하나도 설정되지 않음");
  }
  const attempts: Array<{ label: string; error: string }> = [];
  for (let i = 0; i < chain.length; i++) {
    const c = chain[i];
    try {
      const res = await withTimeout(
        generateObject({
          model: c.model,
          schema,
          system: opts.system,
          prompt: opts.prompt,
          maxOutputTokens: opts.maxOutputTokens ?? 2000,
        }),
        opts.timeoutMs ?? 60_000,
        c.label,
      );
      return {
        object: res.object,
        usage: { inputTokens: res.usage?.inputTokens, outputTokens: res.usage?.outputTokens },
        model_used: c.label,
        fallback_index: i,
        attempts,
      };
    } catch (err: any) {
      attempts.push({ label: c.label, error: err?.message || String(err) });
    }
  }
  const detail = attempts.map((a) => `${a.label}: ${a.error}`).join(" | ");
  throw new Error(`모든 AI 공급자 실패 (${chain.length} 시도) — ${detail}`);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ms}ms (${label})`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}

/** 디버그/헬스 체크 — 설정된 공급자 목록 */
export function listConfiguredProviders(): string[] {
  return buildChain("fast").map((c) => c.label);
}
