import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "anthropic/claude-sonnet-4.5";

const SuggestionsSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string().describe("아이디어 제목 (짧고 구체적)"),
        description: z.string().describe("3~5문장 설명 — 작동 방식, 차별점"),
        rationale: z.string().describe("왜 이 아이디어가 선정된 HMW 와 인사이트에 부합하는지"),
        risks: z.array(z.string()).describe("실행 시 주요 리스크 2~4개"),
      })
    )
    .min(3)
    .max(6),
});

const SYSTEM = `당신은 디자인 씽킹 퍼실리테이터입니다.
선정된 HMW(How Might We) 문제와 수집된 인사이트를 바탕으로,
다양한 각도의 해결 아이디어를 3~6개 제안합니다.

원칙:
1. 인사이트에 나온 실제 고통점에 직접 대응하는 아이디어
2. 단순 기술 나열이 아닌, 유저 경험 관점의 아이디어
3. 서로 다른 방향 (low-tech/high-tech, B2C/B2B, 서비스/제품)
4. 각 아이디어는 실행 가능 수준까지 구체적으로
5. 한국어 평문, 마크다운 없이`;

/**
 * POST /api/venture/[projectId]/suggest-ideas
 * 현재까지 수집된 insights + selected problem 기반으로 AI 가 아이디어 3~6개 제안.
 * 제안된 아이디어는 DB 에 저장하지 않고 그대로 반환 — 사용자가 마음에 드는 것만 수동으로 추가.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(supabase, `${user.id}:venture-suggest`, 5, 3600);
  if (!rl.allowed) return rateLimitResponse(rl);

  const [{ data: project }, { data: insights }, { data: problems }, { data: existingIdeas }] = await Promise.all([
    supabase.from("projects").select("title, description").eq("id", projectId).maybeSingle(),
    supabase.from("venture_insights").select("source, quote, pain_point, target_user").eq("project_id", projectId).limit(30),
    supabase.from("venture_problems").select("hmw_statement, target_user, context, success_metric, is_selected").eq("project_id", projectId),
    supabase.from("venture_ideas").select("title").eq("project_id", projectId),
  ]);

  if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });
  const selected = (problems as { hmw_statement: string; is_selected: boolean }[] | null)?.find((p) => p.is_selected);
  if (!selected) {
    return NextResponse.json({ error: "선정된 HMW 가 필요합니다 (정의 단계 먼저 완료)" }, { status: 400 });
  }

  const prompt = [
    `[프로젝트] ${project.title}`,
    project.description ? `설명: ${project.description}` : null,
    "",
    `[선정된 HMW]`,
    `${selected.hmw_statement}`,
    "",
    `[수집된 인사이트 ${insights?.length ?? 0}건]`,
    ...(insights as { source: string; quote: string; pain_point: string | null; target_user: string | null }[] | null ?? [])
      .slice(0, 20)
      .map((i) => `- (${i.source}) "${i.quote.slice(0, 150)}"${i.pain_point ? ` → ${i.pain_point}` : ""}`),
    "",
    `[이미 제안된 아이디어 — 중복 피하기]`,
    ...((existingIdeas as { title: string }[] | null) ?? []).slice(0, 20).map((i) => `- ${i.title}`),
    "",
    "위 정보를 바탕으로 실행 가능한 해결 아이디어 3~6개를 다양한 각도에서 제안하세요.",
  ]
    .filter(Boolean)
    .join("\n");

  const startedAt = Date.now();
  let object, usage;
  try {
    const result = await generateObject({
      model: MODEL,
      schema: SuggestionsSchema,
      system: SYSTEM,
      prompt,
      maxOutputTokens: 3000,
    });
    object = result.object;
    usage = result.usage;
  } catch (err) {
    console.error("[suggest-ideas]", err);
    return NextResponse.json({ error: "AI 제안 실패. 잠시 후 다시 시도" }, { status: 500 });
  }

  // AI 사용량 로깅
  await supabase.from("ai_usage_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    endpoint: "venture-suggest",
    model: MODEL,
    input_tokens: (usage as { inputTokens?: number })?.inputTokens ?? 0,
    output_tokens: (usage as { outputTokens?: number })?.outputTokens ?? 0,
    entity_type: "project",
    entity_id: projectId,
    duration_ms: Date.now() - startedAt,
    success: true,
  });

  return NextResponse.json({ success: true, suggestions: object.ideas });
}
