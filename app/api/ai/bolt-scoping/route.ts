import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { askClaude } from "@/lib/ai/client";

export const maxDuration = 30;

/**
 * POST /api/ai/bolt-scoping
 * Body: { goal: "한 문장 목표", category?, durationWeeks? }
 * → 역할 슬롯 4-5개 / 마일스톤 3-5개 / 리워드 가이드 제안 (JSON).
 */

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goal, category, durationWeeks } = await req.json();
  if (!goal?.trim()) return NextResponse.json({ error: "goal required" }, { status: 400 });

  const prompt = `다음 nutunion 볼트(프로젝트)의 **역할 슬롯·마일스톤·리워드** 를 설계해주세요.

목표: ${goal}
카테고리: ${category ?? "—"}
예상 기간: ${durationWeeks ?? "?"}주

반드시 JSON 으로만 응답. 다른 텍스트 금지. 구조:
{
  "roles": [
    { "role_type": "pm|lead|member|support|mentor|sponsor", "count": 1, "hours_per_week": 8, "description": "역할 상세", "skills": ["태그1","태그2"] }
  ],
  "milestones": [
    { "title": "M1 — 이름", "weeks_from_start": 2, "success_criteria": "완료 기준 한 줄" }
  ],
  "reward_guide": {
    "type": "experience|revenue|equity|cash",
    "rationale": "왜 이 방식이 적합한지 1-2문장"
  }
}

역할은 4-5개, 마일스톤은 3-5개. 한국어로.`;

  const result = await askClaude({
    userId: user.id,
    feature: "bolt_scoping",
    maxTokens: 1600,
    user: prompt,
  });
  if (!result.text) return NextResponse.json({ error: result.error, stubbed: result.stubbed }, { status: 500 });

  try {
    const jsonText = result.text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return NextResponse.json({ scoping: JSON.parse(jsonText) });
  } catch {
    return NextResponse.json({ scoping: null, raw: result.text, error: "JSON parse 실패 — raw 참고" });
  }
}
