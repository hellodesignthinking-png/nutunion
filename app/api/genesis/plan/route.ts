/**
 * POST /api/genesis/plan
 * Genesis AI — 한 줄 의도 → 구조화된 로드맵 (phases + wikis + roles + tasks).
 *
 * Body: { intent: string, kind: "group" | "project" }
 * Response: { plan, model_used }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateObjectForUser, generateTextForUser } from "@/lib/ai/vault";
import { log } from "@/lib/observability/logger";

export const maxDuration = 60;

const PlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  category: z.string(),
  phases: z
    .array(
      z.object({
        name: z.string(),
        goal: z.string(),
        duration_days: z.number().nullable(),
        wiki_pages: z
          .array(
            z.object({
              title: z.string(),
              outline: z.string(),
            }),
          )
          .min(1)
          .max(4),
        milestones: z.array(z.string()).max(5),
      }),
    )
    .min(2)
    .max(6),
  suggested_roles: z
    .array(
      z.object({
        role_name: z.string(),
        specialty_tags: z.array(z.string()),
        why: z.string(),
      }),
    )
    .max(5),
  resources_folders: z.array(z.string()).max(6),
  first_tasks: z.array(z.string()).min(3).max(8),
});

export type GenesisPlan = z.infer<typeof PlanSchema>;

const SYSTEM =
  "당신은 창업/프로젝트 공간 설계 비서이다. 한 줄 의도를 받아 실행 가능한 로드맵을 한국어로 구조화한다. 각 phase 는 명확한 목표 + 산출물 중심. 뽑는 역할은 실제 스킬 기반. phase 이름은 '01 공감', '02 아이디어' 처럼 번호를 앞에 붙인다. wiki_pages 의 outline 은 3-5 개 bullet 로 구성된 짧은 마크다운.";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const body = await request.json();
    const intent = String(body?.intent || "").trim();
    const kind = body?.kind === "project" ? "project" : "group";

    if (!intent) {
      return NextResponse.json({ error: "의도(intent)를 입력해주세요" }, { status: 400 });
    }
    if (intent.length > 500) {
      return NextResponse.json({ error: "의도는 500자 이내로 작성" }, { status: 400 });
    }

    const userPrompt = `## ${kind === "group" ? "너트(소모임)" : "볼트(프로젝트)"} 의도\n${intent}\n\n위 의도를 구조화된 로드맵으로 변환해주세요.\n- 공간 타입: ${kind}\n- phases 는 2~6 단계로 나누고 각 단계마다 1~4개 위키 페이지 초안을 제시\n- suggested_roles 는 실제 스킬 기반 (최대 5명)\n- first_tasks 는 바로 착수 가능한 3~8개의 실행 과제`;

    // 1차 시도: generateObject (zod 자동 검증)
    let plan: GenesisPlan | null = null;
    let modelUsed = "";
    try {
      const res = await generateObjectForUser<GenesisPlan>(user.id, PlanSchema, {
        system: SYSTEM,
        prompt: userPrompt,
        maxOutputTokens: 4000,
        tier: "fast",
      });
      plan = res.object ?? null;
      modelUsed = res.model_used;
    } catch (objErr: any) {
      log.warn("genesis.plan.object_failed_fallback_text", { error: objErr?.message });
      // 2차 폴백: generateText + 수동 JSON 파싱 (Gemini 가 object mode 에서 JSON 형식 어긋날 때 대비)
      const textPrompt = `${userPrompt}\n\n반드시 아래 JSON 스키마를 **정확히** 따라 JSON 만 반환하라 (마크다운 코드 블록 금지):\n{\n  "title": "string",\n  "summary": "string",\n  "category": "string",\n  "phases": [\n    {"name":"01 단계명","goal":"목표","duration_days":7,"wiki_pages":[{"title":"...","outline":"- 항목1\\n- 항목2"}],"milestones":["마일스톤1"]}\n  ],\n  "suggested_roles": [{"role_name":"...","specialty_tags":["..."],"why":"..."}],\n  "resources_folders": ["..."],\n  "first_tasks": ["..."]\n}\n제약: phases 2~6개, 각 phase 에 wiki_pages 1~4개, suggested_roles 최대 5개, resources_folders 최대 6개, first_tasks 3~8개.`;

      const textRes = await generateTextForUser(user.id, {
        system: SYSTEM + " 반드시 유효한 JSON 객체 하나만 반환하고 그 외 텍스트 금지.",
        prompt: textPrompt,
        maxOutputTokens: 4000,
        tier: "fast",
      });
      modelUsed = textRes.model_used + " (text-fallback)";

      const raw = (textRes.text || "").trim();
      // JSON 추출 — 코드블록/첨언 제거
      const jsonStr =
        raw
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
      // 첫 { 부터 마지막 } 까지
      const start = jsonStr.indexOf("{");
      const end = jsonStr.lastIndexOf("}");
      if (start < 0 || end < 0) {
        throw new Error(`AI 응답에서 JSON 을 찾을 수 없음 (길이 ${raw.length})`);
      }
      const sliced = jsonStr.slice(start, end + 1);
      let parsed: unknown;
      try {
        parsed = JSON.parse(sliced);
      } catch (pe: any) {
        throw new Error(`JSON 파싱 실패: ${pe?.message}`);
      }
      // Zod 검증 — 실패하면 safeParse 로 부분 허용
      const validated = PlanSchema.safeParse(parsed);
      if (!validated.success) {
        // 부족한 제약 완화 재시도
        const lenient = z.object({
          title: z.string().default("새 공간"),
          summary: z.string().default(""),
          category: z.string().default("general"),
          phases: z.array(z.any()).default([]),
          suggested_roles: z.array(z.any()).default([]),
          resources_folders: z.array(z.any()).default([]),
          first_tasks: z.array(z.any()).default([]),
        });
        const lenientRes = lenient.safeParse(parsed);
        if (!lenientRes.success) throw new Error("AI 응답이 스키마에 맞지 않음");
        plan = lenientRes.data as GenesisPlan;
      } else {
        plan = validated.data;
      }
    }

    if (!plan) {
      return NextResponse.json({ error: "AI 가 계획을 생성하지 못했어요. 다시 시도해주세요." }, { status: 502 });
    }

    log.info("genesis.plan.generated", {
      user_id: user.id,
      kind,
      model_used: modelUsed,
      phase_count: plan.phases?.length || 0,
    });

    return NextResponse.json({ plan, model_used: modelUsed });
  } catch (err: any) {
    log.error(err, "genesis.plan.failed");
    return NextResponse.json(
      { error: err?.message || "Genesis AI 계획 생성 실패" },
      { status: 500 },
    );
  }
}
