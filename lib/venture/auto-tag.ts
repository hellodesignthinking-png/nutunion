// 인사이트 자동 태깅 — 저장 직후 AI 로 카테고리 태그 2~4개 추출.
// 실패해도 본 저장에 영향 없음 (fire-and-forget).

import { generateObject } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const TagsSchema = z.object({
  tags: z.array(z.string().min(1).max(20)).min(1).max(5),
});

import { NU_AI_MODEL } from "@/lib/ai/model";
const MODEL = NU_AI_MODEL;

const ALLOWED = [
  "감정", "비용", "시간", "접근성", "품질",
  "UX", "신뢰", "외로움", "정보부족", "기술",
  "커뮤니티", "건강", "학습", "효율", "안전",
  "관계", "경제", "환경",
];

export async function autoTagInsight(
  supabase: SupabaseClient,
  insightId: string,
  payload: { quote: string; pain_point?: string | null; target_user?: string | null }
): Promise<void> {
  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: TagsSchema,
      system: `당신은 UX 리서치 태깅 전문가입니다. 유저 인사이트에서 2~4개의 핵심 카테고리 태그를 추출하세요.
선호 태그(최대한 이 중에서 선택): ${ALLOWED.join(", ")}.
허용 태그에 없는 개념이 핵심이면 1~2개는 자유 태그 가능 (짧게, 한국어).`,
      prompt: [
        `인용: "${payload.quote.slice(0, 300)}"`,
        payload.pain_point ? `고통점: ${payload.pain_point}` : null,
        payload.target_user ? `대상: ${payload.target_user}` : null,
      ].filter(Boolean).join("\n"),
      maxOutputTokens: 150,
    });

    const tags = [...new Set(object.tags)].slice(0, 5);
    if (tags.length === 0) return;

    await supabase.from("venture_insights").update({ tags }).eq("id", insightId);
  } catch (err) {
    console.warn("[auto-tag]", err);
  }
}
