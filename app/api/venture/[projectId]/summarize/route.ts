import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

import { NU_AI_MODEL, NU_AI_MODEL_LABEL } from "@/lib/ai/model";
const MODEL = NU_AI_MODEL;
const MODEL_LABEL = NU_AI_MODEL_LABEL;

/** 공용 AI 요약 엔드포인트 — kind 로 분기 */
const RequestSchema = z.object({
  kind: z.enum(["insights", "feedback"]),
});

const InsightSummarySchema = z.object({
  themes: z
    .array(
      z.object({
        title: z.string().describe("주제 한 줄 (예: '혼자 사는 외로움')"),
        frequency: z.number().int().min(1).describe("이 주제가 언급된 인사이트 개수"),
        representative_quote: z.string().describe("이 주제를 가장 잘 보여주는 인용 1개"),
        pain_severity: z.enum(["low", "medium", "high"]).describe("고통점 강도"),
      })
    )
    .describe("반복 주제 3~6개, 빈도 순"),
  personas: z
    .array(z.object({
      name: z.string().describe("페르소나 한 줄 요약"),
      traits: z.array(z.string()).describe("특징 3~5개"),
    }))
    .describe("추출된 페르소나 2~4개"),
  top_pain_points: z
    .array(z.string())
    .describe("가장 반복적으로 등장한 고통점 TOP 3"),
  next_steps: z
    .array(z.string())
    .describe("Define 단계로 넘어가기 위한 추천 HMW 방향 3~5개"),
});

const FeedbackSummarySchema = z.object({
  sentiment: z
    .object({
      positive: z.number().int().min(0).max(100).describe("긍정 비율 (%)"),
      neutral: z.number().int().min(0).max(100),
      negative: z.number().int().min(0).max(100),
      avg_score: z.number().describe("1~10 평균 점수 (점수 없는 항목 제외)"),
    })
    .describe("감정/점수 분포"),
  strengths: z.array(z.string()).describe("강점 (긍정 피드백에서 추출) 3~5개"),
  weaknesses: z.array(z.string()).describe("약점/개선 필요 사항 3~5개"),
  critical_issues: z.array(z.string()).describe("즉시 해결 필요한 문제 0~3개"),
  iteration_suggestions: z.array(z.string()).describe("다음 이터레이션 추천 액션 3~5개"),
});

function buildInsightPrompt(insights: { source: string; quote: string; pain_point: string | null; target_user: string | null }[]): string {
  return [
    `[수집된 인사이트 ${insights.length}건]`,
    ...insights.slice(0, 50).map((i, idx) => `${idx + 1}. (${i.source})${i.target_user ? ` [${i.target_user}]` : ""} "${i.quote.slice(0, 200)}"${i.pain_point ? ` → ${i.pain_point}` : ""}`),
    "",
    "위 인사이트에서 반복되는 주제/페르소나/고통점을 추출하고, Define 단계로 나아가기 위한 HMW 방향을 제안하세요.",
  ].join("\n");
}

function buildFeedbackPrompt(fb: { score: number | null; note: string; tester_name: string | null }[]): string {
  return [
    `[유저 피드백 ${fb.length}건]`,
    ...fb.slice(0, 50).map((f, idx) => `${idx + 1}. ${f.score ? `[${f.score}/10] ` : ""}${f.tester_name ? `(${f.tester_name}) ` : ""}${f.note.slice(0, 250)}`),
    "",
    "피드백을 감정 분포/강점/약점/개선 제안으로 구조화하세요. 점수 없는 항목은 note 톤으로 판단.",
  ].join("\n");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const rl = await checkRateLimit(supabase, `${user.id}:venture-summarize:${parsed.data.kind}`, 5, 3600);
  if (!rl.allowed) return rateLimitResponse(rl);

  const startedAt = Date.now();
  let object, usage, kind = parsed.data.kind;

  try {
    if (kind === "insights") {
      const { data } = await supabase
        .from("venture_insights")
        .select("source, quote, pain_point, target_user")
        .eq("project_id", projectId)
        .limit(50);
      const rows = (data as { source: string; quote: string; pain_point: string | null; target_user: string | null }[] | null) ?? [];
      if (rows.length < 3) {
        return NextResponse.json({ error: "인사이트 3건 이상 필요" }, { status: 400 });
      }
      const result = await generateObject({
        model: MODEL,
        schema: InsightSummarySchema,
        system: "당신은 디자인 씽킹 인사이트 분석 전문가입니다. 수집된 유저 발언을 반복 주제/페르소나/고통점으로 구조화합니다. 데이터에 없는 내용 창작 금지. 한국어 평문.",
        prompt: buildInsightPrompt(rows),
        maxOutputTokens: 2500,
      });
      object = result.object;
      usage = result.usage;
    } else {
      const { data } = await supabase
        .from("venture_feedback")
        .select("score, note, tester_name")
        .eq("project_id", projectId)
        .limit(50);
      const rows = (data as { score: number | null; note: string; tester_name: string | null }[] | null) ?? [];
      if (rows.length < 1) {
        return NextResponse.json({ error: "피드백 1건 이상 필요" }, { status: 400 });
      }
      const result = await generateObject({
        model: MODEL,
        schema: FeedbackSummarySchema,
        system: "당신은 유저 테스트 분석 전문가입니다. 피드백을 감정/강점/약점/개선제안으로 구조화합니다. 감정 비율 합은 100 에 근접. 한국어 평문.",
        prompt: buildFeedbackPrompt(rows),
        maxOutputTokens: 2500,
      });
      object = result.object;
      usage = result.usage;
    }
  } catch (err) {
    console.error(`[venture-summarize:${kind}]`, err);
    return NextResponse.json({ error: "AI 요약 실패" }, { status: 500 });
  }

  await supabase.from("ai_usage_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    endpoint: `venture-summarize-${kind}`,
    model: MODEL,
    input_tokens: (usage as { inputTokens?: number })?.inputTokens ?? 0,
    output_tokens: (usage as { outputTokens?: number })?.outputTokens ?? 0,
    entity_type: "project",
    entity_id: projectId,
    duration_ms: Date.now() - startedAt,
    success: true,
  });

  return NextResponse.json({ success: true, kind, summary: object });
}
