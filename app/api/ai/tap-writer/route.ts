import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { askClaude } from "@/lib/ai/client";

export const maxDuration = 30;

/**
 * POST /api/ai/tap-writer
 * Body: { projectTitle, answers: { lesson, turningPoint, nextBolt } }
 * → Claude 가 회고록 초안 (Markdown, 800~1200자) 생성.
 */

export const POST = withRouteLog("ai.tap-writer", async (req: Request) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectTitle, answers } = await req.json();
  if (!projectTitle || !answers?.lesson) {
    return NextResponse.json({ error: "projectTitle + answers.lesson required" }, { status: 400 });
  }

  const prompt = `다음은 nutunion 볼트의 마감 회고용 3문 인터뷰 답변입니다.
이를 바탕으로 탭(Tap) 아카이브에 영구 보관될 회고록 초안을 Markdown 으로 작성해주세요 (800-1200자).

볼트명: ${projectTitle}

Q1. 이 볼트에서 가장 배운 점은?
A1. ${answers.lesson}

Q2. 가장 결정적이었던 순간 / 전환점?
A2. ${answers.turningPoint ?? "—"}

Q3. 이 볼트를 이어받을 다음 팀에게 한 마디?
A3. ${answers.nextBolt ?? "—"}

구성:
# ${projectTitle} 회고

## 우리가 푼 문제
## 과정과 전환점
## 공개 산출물 (인터뷰 기반 추정 / 자리만 만들기 — 빈 칸은 "(TBD)" 로)
## 다음 볼트를 위한 한 줄

톤: 담담하지만 깊이. 과장 없이, 동료가 이어받을 만한 실용 정보 위주.`;

  const result = await askClaude({
    userId: user.id,
    feature: "tap_writer",
    maxTokens: 1600,
    user: prompt,
  });

  if (!result.text) return NextResponse.json({ error: result.error || "AI 호출 실패", stubbed: result.stubbed }, { status: 500 });
  return NextResponse.json({ draft: result.text });
});
