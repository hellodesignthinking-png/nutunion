import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { askClaude } from "@/lib/ai/client";

export const maxDuration = 30;

/**
 * POST /api/ai/nut-description
 * Body: { name, category, keywords[] }
 * → Claude 가 매력적인 너트 설명 3개 초안 반환.
 */

export const POST = withRouteLog("ai.nut-description", async (req: Request) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, category, keywords } = await req.json();
  if (!name || !category) return NextResponse.json({ error: "name/category required" }, { status: 400 });

  const result = await askClaude({
    userId: user.id,
    feature: "nut_description",
    maxTokens: 600,
    user: `다음 정보를 받아 nutunion "너트" (커뮤니티)의 설명 문안을 3가지 제안해주세요. 각 2-3문장, 서로 다른 톤으로.

- 너트명: ${name}
- 카테고리: ${category}
- 키워드: ${(keywords ?? []).join(", ") || "—"}

출력 형식:
---
Option A (차분한 톤): …

Option B (열정적인 톤): …

Option C (전문가 톤): …`,
  });

  if (!result.text) return NextResponse.json({ error: result.error || "AI 호출 실패", stubbed: result.stubbed }, { status: 500 });
  return NextResponse.json({ suggestions: result.text });
});
