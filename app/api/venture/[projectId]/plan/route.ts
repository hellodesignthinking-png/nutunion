import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";
import { PlanContentSchema, SYSTEM, buildPlanPrompt } from "@/lib/venture/plan-prompts";

export const runtime = "nodejs";
export const maxDuration = 90;

const MODEL = "anthropic/claude-sonnet-4.5";

/**
 * POST /api/venture/[projectId]/plan
 * 현재까지 수집된 5단계 데이터를 AI 가 종합해 사업계획서 초안 생성.
 * 새 버전을 저장하고 기존 is_current 는 false 처리.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(supabase, `${user.id}:venture-plan`, 3, 3600);
  if (!rl.allowed) return rateLimitResponse(rl);

  const [{ data: project }, { data: insights }, { data: problems }, { data: ideas }, { data: votes }, { data: tasks }, { data: feedback }] =
    await Promise.all([
      supabase.from("projects").select("title, description").eq("id", projectId).maybeSingle(),
      supabase.from("venture_insights").select("source, quote, pain_point, target_user").eq("project_id", projectId).limit(50),
      supabase.from("venture_problems").select("hmw_statement, target_user, context, success_metric, is_selected").eq("project_id", projectId).limit(20),
      supabase.from("venture_ideas").select("id, title, description, is_main").eq("project_id", projectId).limit(30),
      supabase.from("venture_idea_votes").select("idea_id, weight"),
      supabase.from("venture_prototype_tasks").select("title, status").eq("project_id", projectId).limit(50),
      supabase.from("venture_feedback").select("score, note").eq("project_id", projectId).limit(30),
    ]);

  if (!project) return NextResponse.json({ error: "프로젝트 없음" }, { status: 404 });

  // 투표 집계
  const voteMap = new Map<string, number>();
  for (const v of (votes as { idea_id: string; weight: number }[]) ?? []) {
    voteMap.set(v.idea_id, (voteMap.get(v.idea_id) ?? 0) + v.weight);
  }
  const ideasWithVotes = ((ideas as { id: string; title: string; description: string | null; is_main: boolean }[]) ?? [])
    .map((i) => ({
      title: i.title,
      description: i.description,
      is_main: i.is_main,
      vote_total: voteMap.get(i.id) ?? 0,
    }));

  const prompt = buildPlanPrompt({
    title: project.title as string,
    description: (project.description as string) ?? null,
    insights: (insights as { source: string; quote: string; pain_point: string | null; target_user: string | null }[]) ?? [],
    problems: (problems as { hmw_statement: string; target_user: string | null; context: string | null; success_metric: string | null; is_selected: boolean }[]) ?? [],
    ideas: ideasWithVotes,
    tasks: (tasks as { title: string; status: string }[]) ?? [],
    feedback: (feedback as { score: number | null; note: string }[]) ?? [],
  });

  const startedAt = Date.now();
  let object, usage;
  try {
    const result = await generateObject({
      model: MODEL,
      schema: PlanContentSchema,
      system: SYSTEM,
      prompt,
      maxOutputTokens: 3500,
    });
    object = result.object;
    usage = result.usage;
  } catch (err) {
    console.error("[venture-plan]", err);
    return NextResponse.json({ error: "AI 생성 실패. 잠시 후 재시도" }, { status: 500 });
  }

  // 기존 current 해제
  await supabase.from("venture_plans").update({ is_current: false })
    .eq("project_id", projectId).eq("is_current", true);

  // 새 버전 저장 (version = 기존 max + 1)
  const { data: latest } = await supabase
    .from("venture_plans")
    .select("version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((latest?.version as number) ?? 0) + 1;

  const { data: inserted, error: insErr } = await supabase.from("venture_plans").insert({
    project_id: projectId,
    version: nextVersion,
    is_current: true,
    generated_by: "ai",
    model: MODEL,
    content: object,
    created_by: user.id,
  }).select().single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // AI 사용량 로깅
  await supabase.from("ai_usage_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    endpoint: "venture-plan",
    model: MODEL,
    input_tokens: (usage as { inputTokens?: number })?.inputTokens ?? 0,
    output_tokens: (usage as { outputTokens?: number })?.outputTokens ?? 0,
    entity_type: "project",
    entity_id: projectId,
    duration_ms: Date.now() - startedAt,
    success: true,
  });

  return NextResponse.json({ success: true, plan: inserted });
}
