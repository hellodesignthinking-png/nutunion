import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { generateObjectForUser } from "@/lib/ai/vault";
import { aiError } from "@/lib/ai/error";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const maxDuration = 60;

const PlanSchema = z.object({
  wikiTopics: z.array(z.object({
    name: z.string(),
    description: z.string(),
    emoji: z.string().default("📝"),
  })).max(5).default([]),
  meetingTypes: z.array(z.object({
    name: z.string(),
    frequency: z.string(),
    purpose: z.string(),
  })).max(3).default([]),
  contentPlan: z.string().default(""),
  suggestedTags: z.array(z.string()).max(6).default([]),
});

const SYSTEM_PROMPT = `당신은 NutUnion 커뮤니티 플랫폼의 AI 기획 어시스턴트입니다.
사용자가 만들려는 소모임(너트)의 이름과 소개를 바탕으로 운영 계획을 제안합니다.

반드시 아래 JSON 형식으로만 응답하세요:

{
  "wikiTopics": [
    {"name": "탭 이름", "description": "이 탭에서 다룰 내용 설명", "emoji": "적절한 이모지"}
  ],
  "meetingTypes": [
    {"name": "회의 유형 이름", "frequency": "주 1회 / 격주 / 월 1회 등", "purpose": "이 회의의 목적과 진행 방식"}
  ],
  "contentPlan": "전체 운영 방향 및 콘텐츠 기획 요약 (2-3문장)",
  "suggestedTags": ["태그1", "태그2", "태그3"]
}

규칙:
- 반드시 유효한 JSON만 출력
- 한국어로 작성
- wikiTopics: 3-5개 제안 (이 소모임에 필요한 지식 문서 탭)
- meetingTypes: 2-3개 제안 (정기 회의 유형)
- contentPlan: 간결하고 실용적인 운영 방향
- suggestedTags: 4-6개 관련 키워드
- 소모임의 성격과 목적에 맞게 구체적으로 제안`;

export const POST = withRouteLog("ai.group-plan", async (request: NextRequest) => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const { success } = rateLimit(`ai:group-plan:${user.id}`, 10, 60_000);
    if (!success) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "소모임 이름이 필요합니다" }, { status: 400 });
    }

    const userPrompt = `## 소모임 이름\n${name}\n\n## 소개\n${description || "소개 없음"}\n\n위 소모임을 위한 운영 계획을 제안해주세요.`;

    // model.ts/vault 자동 fallback chain
    const ai = await generateObjectForUser(user.id, PlanSchema, {
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 1024,
      tier: "fast",
    });

    return NextResponse.json(ai.object);
  } catch (error: unknown) {
    log.error(error, "ai.group_plan.failed");
    return aiError("server_error", "ai/group-plan", { internal: error });
  }
});
