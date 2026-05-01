import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { generateObjectForUser } from "@/lib/ai/vault";
import { log } from "@/lib/observability/logger";

export const maxDuration = 60;

const ExtractSchema = z.object({
  entities: z.array(z.object({ name: z.string(), isNew: z.boolean().default(true) })).default([]),
  decisions: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  wikiUpdates: z.array(z.object({
    pageTitle: z.string(),
    suggestion: z.string(),
    action: z.enum(["create", "update"]).default("create"),
  })).default([]),
  suggestedTags: z.array(z.string()).default([]),
});

const SYSTEM_PROMPT = `당신은 NutUnion 플랫폼의 AI 지식 추출 어시스턴트입니다.
사용자가 제공하는 회의 내용에서 탭에 반영할 핵심 지식을 추출합니다.

반드시 아래 JSON 형식으로만 응답하세요:

{
  "entities": [{"name": "핵심 개념/키워드", "isNew": true}],
  "decisions": ["확정된 결정 사항"],
  "openQuestions": ["아직 해결되지 않은 질문이나 과제"],
  "wikiUpdates": [{"pageTitle": "탭 페이지 제목", "suggestion": "이 페이지에 추가할 내용 설명", "action": "create 또는 update"}],
  "suggestedTags": ["관련 태그"]
}

규칙:
- 반드시 유효한 JSON만 출력
- 한국어로 작성
- entities는 회의에서 반복적으로 언급되거나 중요한 개념/키워드
- decisions는 [결정], [합의], ~하기로 등의 표현이 포함된 문장
- openQuestions은 미해결 질문이나 앞으로 논의할 사항
- wikiUpdates는 새로 만들 탭 문서(create) 또는 기존 문서 업데이트 제안(update)
- suggestedTags는 이 미팅 내용과 관련된 분류 태그
- 내용이 부족하면 있는 만큼만 정리`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const { success } = rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!success) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const body = await request.json();
    const { meetingContent, existingTopics, existingPages } = body;

    if (!meetingContent?.trim()) {
      return NextResponse.json({ error: "분석할 미팅 내용이 필요합니다" }, { status: 400 });
    }

    let userPrompt = `## 미팅 내용\n${meetingContent}\n`;
    if (existingTopics?.length > 0) {
      userPrompt += `\n## 기존 탭 토픽\n${existingTopics.join(", ")}\n`;
    }
    if (existingPages?.length > 0) {
      userPrompt += `\n## 기존 탭 페이지\n${existingPages.join(", ")}\n`;
    }
    userPrompt += `\n위 미팅 내용을 분석하여 탭에 반영할 핵심 지식을 추출해주세요.`;
    userPrompt += `\n기존 탭 토픽/페이지와 겹치는 개념은 isNew: false 로, 새로운 개념은 isNew: true 로 표시.`;
    userPrompt += `\n기존 페이지와 관련된 내용이 있으면 wikiUpdates 에 action: "update" 로 추가.`;

    // model.ts/vault 자동 fallback chain — Gateway 우선, provider 1개 실패시 다음 시도
    const ai = await generateObjectForUser(user.id, ExtractSchema, {
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 2048,
      tier: "fast",
    });

    return NextResponse.json(ai.object);
  } catch (error: unknown) {
    log.error(error, "ai.wiki_extract.failed");
    const msg = error instanceof Error ? error.message : "탭 추출 중 오류가 발생했습니다";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
