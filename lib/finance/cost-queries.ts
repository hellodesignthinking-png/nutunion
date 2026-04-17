import { createClient } from "@/lib/supabase/server";

// Claude Sonnet 4.5 via AI Gateway (USD 기준)
// 1M input = $3, 1M output = $15 (2026-04 공식 요율)
const COST_PER_INPUT_TOKEN = 3 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 15 / 1_000_000;
const USD_TO_KRW = 1380; // 근사값. 배치로 환율 업데이트해도 됨

export interface AiUsageSummary {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedUsd: number;
  estimatedKrw: number;
}

export interface AiUsageByUser {
  actor_email: string | null;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  estimated_usd: number;
}

export interface AiUsageByContent {
  content_type: string | null;
  calls: number;
  input_tokens: number;
  output_tokens: number;
}

export interface AiUsageDaily {
  date: string;   // YYYY-MM-DD
  calls: number;
  input_tokens: number;
  output_tokens: number;
}

function estimate(input: number, output: number) {
  return input * COST_PER_INPUT_TOKEN + output * COST_PER_OUTPUT_TOKEN;
}

export async function getAiUsageSummary(sinceIso: string): Promise<AiUsageSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_usage_logs")
    .select("input_tokens,output_tokens,success")
    .gte("created_at", sinceIso);

  const rows = (data as { input_tokens: number; output_tokens: number; success: boolean }[]) ?? [];
  const totalInput = rows.reduce((s, r) => s + (r.input_tokens || 0), 0);
  const totalOutput = rows.reduce((s, r) => s + (r.output_tokens || 0), 0);
  const successCalls = rows.filter((r) => r.success).length;
  const usd = estimate(totalInput, totalOutput);

  return {
    totalCalls: rows.length,
    successCalls,
    failedCalls: rows.length - successCalls,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    estimatedUsd: usd,
    estimatedKrw: Math.round(usd * USD_TO_KRW),
  };
}

export async function getAiUsageByUser(sinceIso: string): Promise<AiUsageByUser[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_usage_logs")
    .select("actor_email,input_tokens,output_tokens")
    .eq("success", true)
    .gte("created_at", sinceIso);

  const map = new Map<string | null, { calls: number; input: number; output: number }>();
  for (const row of (data as { actor_email: string | null; input_tokens: number; output_tokens: number }[]) ?? []) {
    const key = row.actor_email;
    const cur = map.get(key) ?? { calls: 0, input: 0, output: 0 };
    cur.calls += 1;
    cur.input += row.input_tokens || 0;
    cur.output += row.output_tokens || 0;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([actor_email, v]) => ({
      actor_email,
      calls: v.calls,
      input_tokens: v.input,
      output_tokens: v.output,
      estimated_usd: estimate(v.input, v.output),
    }))
    .sort((a, b) => b.estimated_usd - a.estimated_usd);
}

export async function getAiUsageByContent(sinceIso: string): Promise<AiUsageByContent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_usage_logs")
    .select("content_type,input_tokens,output_tokens")
    .eq("success", true)
    .gte("created_at", sinceIso);

  const map = new Map<string | null, { calls: number; input: number; output: number }>();
  for (const row of (data as { content_type: string | null; input_tokens: number; output_tokens: number }[]) ?? []) {
    const key = row.content_type;
    const cur = map.get(key) ?? { calls: 0, input: 0, output: 0 };
    cur.calls += 1;
    cur.input += row.input_tokens || 0;
    cur.output += row.output_tokens || 0;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([content_type, v]) => ({
      content_type,
      calls: v.calls,
      input_tokens: v.input,
      output_tokens: v.output,
    }))
    .sort((a, b) => b.calls - a.calls);
}

export async function getAiUsageDaily(sinceIso: string): Promise<AiUsageDaily[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_usage_logs")
    .select("created_at,input_tokens,output_tokens")
    .eq("success", true)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });

  const map = new Map<string, { calls: number; input: number; output: number }>();
  for (const row of (data as { created_at: string; input_tokens: number; output_tokens: number }[]) ?? []) {
    const date = row.created_at.slice(0, 10);
    const cur = map.get(date) ?? { calls: 0, input: 0, output: 0 };
    cur.calls += 1;
    cur.input += row.input_tokens || 0;
    cur.output += row.output_tokens || 0;
    map.set(date, cur);
  }
  return Array.from(map.entries())
    .map(([date, v]) => ({ date, calls: v.calls, input_tokens: v.input, output_tokens: v.output }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export { COST_PER_INPUT_TOKEN, COST_PER_OUTPUT_TOKEN, USD_TO_KRW };
