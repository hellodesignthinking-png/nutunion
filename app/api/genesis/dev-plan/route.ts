/**
 * POST /api/genesis/dev-plan
 * Genesis 기술 개발 로드맵 — 한 줄 의도 → SecondWind 수준의 상세 개발 스케줄.
 *
 * Body: { intent: string, kind?: "project", projectId?: string }
 * Response: { plan: DevPlan, model_used: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateObjectForUser, generateTextForUser } from "@/lib/ai/vault";
import { log } from "@/lib/observability/logger";
import { DevPlanSchema, type DevPlan } from "@/lib/genesis/dev-plan-schema";

export const maxDuration = 90;

const SYSTEM = [
  "# 역할",
  "당신은 넛유니온의 시니어 기술 아키텍트 겸 전략 프로젝트 매니저(PM)입니다. 15년차 경력으로 수십 개의 B2B/B2C 플랫폼을 MVP → 성장기까지 이끌어본 실무자입니다.",
  "",
  "# 임무",
  "사용자의 한 줄 아이디어를 받아 'SecondWind 개발 일정' 수준의 **전략 보고서**를 생성합니다.",
  "단순 기능 나열 금지. 비즈니스 가치 + 기술 타당성 + 팀 역량 + 리스크를 종합한 판단.",
  "",
  "# 원칙",
  "1. **과감한 스코프 조절** — \"Phase 1에서는 불필요함\", \"이 기능은 사용자 10명 이상일 때만 필요\" 같은 결단력 있는 판단을 반드시 포함.",
  "2. **플랫폼 우선순위** — PC Web / Mobile App / Admin / API / Landing 중 무엇을 **skip** 할지 명시. 애매한 \"중간\" 피하고 상/중/하/skip 중 택일.",
  "3. **구체적 공수** — \"API 설계\" 같은 추상어 금지. \"Next.js API Route + Supabase RLS 정책 8개 작성 + 토큰 회전 로직\" 식으로 구체.",
  "4. **넛유니온 스택 전제** — Next.js 16 / Supabase PostgreSQL+RLS / Cloudflare R2 / Gemini 2.5 Flash / Vercel / Brutalist Tailwind — 이 스택 기반 작업만 제안.",
  "5. **주간 병렬 계획** — 첫 주부터 BE/FE/AI/QA 가 동시에 무엇을 하는지 제시. 순차 진행 금지.",
  "6. **리스크 완화** — 각 리스크에 \"구체적 완화 방안\" 필수. \"잘 관리한다\" 금지.",
  "7. **Quick Wins** — 일정 단축을 위해 **무엇을 포기하면 N주 단축되는지** 명시.",
  "",
  "# 출력 품질",
  "- 프로젝트명은 브랜드처럼 멋지게",
  "- MVP 타겟은 **1인 페르소나** 수준으로 구체적",
  "- 모든 숫자는 현실 팀 규모 기준",
  "- 팀 시나리오 3개 (최소 2인 / 권장 4-5인 / 외주 활용 +PM) — 각각 소요 주차와 trade-off 명시",
  "- 각 team_scenarios 의 roles 배열에 role/availability(internal|external_hire|outsource)/note 포함",
].join("\n");

function aggregateSkills(talents: any[] | null | undefined): Array<{ skill: string; count: number }> {
  const map = new Map<string, number>();
  for (const t of talents || []) {
    const tags: string[] = Array.isArray(t?.skill_tags) ? t.skill_tags : [];
    for (const s of tags) {
      const k = String(s || "").trim();
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + 1);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([skill, count]) => ({ skill, count }));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const body = await request.json();
    const intent = String(body?.intent || "").trim();
    const projectIdParam = typeof body?.projectId === "string" ? body.projectId : null;
    const prebuiltPlan = body?.plan && typeof body.plan === "object" ? body.plan : null;

    // Pre-built plan attach mode — skip LLM, just persist
    if (prebuiltPlan && projectIdParam) {
      const validated = DevPlanSchema.safeParse(prebuiltPlan);
      const planToSave = validated.success ? validated.data : (prebuiltPlan as DevPlan);
      const { error: upErr } = await supabase
        .from("projects")
        .update({
          dev_plan: planToSave,
          dev_plan_generated_at: new Date().toISOString(),
        })
        .eq("id", projectIdParam);
      if (upErr) {
        log.warn("genesis.devplan.attach_persist_failed", { error: upErr.message, projectId: projectIdParam });
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      return NextResponse.json({ plan: planToSave, model_used: "prebuilt", attached: true });
    }

    if (!intent) {
      return NextResponse.json({ error: "의도(intent)를 입력해주세요" }, { status: 400 });
    }
    if (intent.length > 800) {
      return NextResponse.json({ error: "의도는 800자 이내로 작성" }, { status: 400 });
    }

    // Talent pool context — 활성 멤버 skill histogram
    let talentContext = "";
    try {
      const { data: talents } = await supabase
        .from("profiles")
        .select("id, nickname, specialty, skill_tags, role_tags, bio")
        .limit(100);
      const histogram = aggregateSkills(talents);
      if (histogram.length > 0) {
        talentContext = [
          ``,
          `## 가용 인재 풀 (넛유니온 활성 멤버)`,
          `총 ${talents?.length ?? 0}명 · 상위 보유 스킬 (빈도순):`,
          ...histogram.map((h) => `- ${h.skill}: ${h.count}명`),
          ``,
          `팀 시나리오 설계 시 이 인재 풀을 고려하여 **어떤 스킬은 내부 조달 가능 / 어떤 스킬은 외부 영입 필요**를 구분해주세요.`,
        ].join("\n");
      }
    } catch (e: any) {
      log.warn("genesis.devplan.talent_pool_failed", { error: e?.message });
    }

    const userPrompt = [
      `## 프로젝트 의도`,
      intent,
      talentContext,
      ``,
      `위 의도를 SecondWind 스타일의 상세 개발 로드맵으로 변환하세요.`,
      `- recommended_weeks / recommended_team_size 는 합리적 숫자`,
      `- target_launch 는 "N주 내 MVP" 또는 구체 일정 문자열`,
      `- strategic_decisions: PC/Mobile/Admin/API/Landing 중 필요한 항목만 골라 priority + rationale (skip 도 과감히 사용)`,
      `- effort_breakdown: 영역별 3~8개 태스크, estimated_days 는 0.5 단위 허용, 구체적 기술 용어 사용`,
      `- gantt: week 1..N 중 핵심 milestone/parallel_tracks 최소 4주 이상, BE/FE/AI/QA 병렬 표기`,
      `- team_scenarios: "최소 팀", "권장 팀", "외주 활용" 3개. 각 시나리오 roles[] 에 availability(internal|external_hire|outsource) 포함`,
      `- risks 4~10개, 각 mitigation 에 "구체적 완화 방안"`,
      `- quick_wins 3~6개, "N주 단축" 효과 명시`,
      `- tech_stack 5~15개`,
    ].join("\n");

    let plan: DevPlan | null = null;
    let modelUsed = "";
    try {
      const res = await generateObjectForUser<DevPlan>(user.id, DevPlanSchema, {
        system: SYSTEM,
        prompt: userPrompt,
        maxOutputTokens: 7000,
        tier: "pro",
      });
      plan = res.object ?? null;
      modelUsed = res.model_used;
    } catch (objErr: any) {
      log.warn("genesis.devplan.object_failed_fallback_text", { error: objErr?.message });

      const textRes = await generateTextForUser(user.id, {
        system:
          SYSTEM +
          "\n반드시 유효한 JSON 객체 하나만 반환하라. 마크다운 코드 블록 금지. 그 외 텍스트 금지.",
        prompt:
          userPrompt +
          `\n\n반드시 아래 키를 포함한 JSON 반환:\n{project_name, mvp_target, recommended_weeks, recommended_team_size, target_launch, strategic_decisions[], effort_breakdown[], gantt[], team_scenarios[{name,size,duration_weeks,trade_offs,roles[{role,availability,note}]}], risks[], quick_wins[], tech_stack[]}`,
        maxOutputTokens: 7000,
        tier: "pro",
      });
      modelUsed = textRes.model_used + " (text-fallback)";

      const raw = (textRes.text || "").trim();
      const stripped = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const start = stripped.indexOf("{");
      const end = stripped.lastIndexOf("}");
      if (start < 0 || end < 0) {
        throw new Error(`AI 응답에서 JSON 을 찾을 수 없음 (길이 ${raw.length})`);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripped.slice(start, end + 1));
      } catch (pe: any) {
        throw new Error(`JSON 파싱 실패: ${pe?.message}`);
      }
      const validated = DevPlanSchema.safeParse(parsed);
      if (!validated.success) {
        const lenient = z.object({
          project_name: z.string().default("새 프로젝트"),
          mvp_target: z.string().default(""),
          recommended_weeks: z.number().default(8),
          recommended_team_size: z.number().default(3),
          target_launch: z.string().default(""),
          strategic_decisions: z.array(z.any()).default([]),
          effort_breakdown: z.array(z.any()).default([]),
          gantt: z.array(z.any()).default([]),
          team_scenarios: z.array(z.any()).default([]),
          risks: z.array(z.any()).default([]),
          quick_wins: z.array(z.any()).default([]),
          tech_stack: z.array(z.any()).default([]),
        });
        const lr = lenient.safeParse(parsed);
        if (!lr.success) throw new Error("AI 응답이 스키마에 맞지 않음");
        plan = lr.data as DevPlan;
      } else {
        plan = validated.data;
      }
    }

    if (!plan) {
      return NextResponse.json(
        { error: "AI 가 개발 로드맵을 생성하지 못했어요. 다시 시도해주세요." },
        { status: 502 },
      );
    }

    const projectId = typeof body?.projectId === "string" ? body.projectId : null;
    if (projectId) {
      try {
        const { error: upErr } = await supabase
          .from("projects")
          .update({
            dev_plan: plan,
            dev_plan_generated_at: new Date().toISOString(),
          })
          .eq("id", projectId);
        if (upErr) {
          log.warn("genesis.devplan.persist_failed", { error: upErr.message, projectId });
        }
      } catch (e: any) {
        log.warn("genesis.devplan.persist_exception", { error: e?.message });
      }
    }

    log.info("genesis.devplan.generated", {
      user_id: user.id,
      project_id: projectId,
      model_used: modelUsed,
      weeks: plan.recommended_weeks,
      areas: plan.effort_breakdown?.length || 0,
    });

    return NextResponse.json({ plan, model_used: modelUsed });
  } catch (err: any) {
    log.error(err, "genesis.devplan.failed");
    return NextResponse.json(
      { error: err?.message || "Genesis 개발 로드맵 생성 실패" },
      { status: 500 },
    );
  }
}
