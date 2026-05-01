import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { generateObjectForUser } from "@/lib/ai/vault";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 45;

/**
 * POST /api/dashboard/mindmap/expand-node
 *
 * 마인드맵의 한 노드를 컨텍스트로 받아 그 노드에서 파생되는 3~5개 분기를 AI 가 제안.
 * Miro/Whimsical 등에는 없는 컨텍스트 인지 분기 — 너트/볼트/이슈/일정의 의미를 알기 때문.
 *
 * Body: { kind, title, sub?, meta? }
 * Response: { suggestions: Array<{ title, why }> }
 */
const ExpandSchema = z.object({
  suggestions: z
    .array(
      z.object({
        title: z.string().max(60),
        why: z.string().max(140),
      }),
    )
    .min(2)
    .max(5),
});

const SYSTEM = `당신은 nutunion 의 마인드맵 전문 어시스턴트.
사용자가 "이 노드에서 분기"를 요청하면, 그 노드에서 자연스럽게 파생되는
3~5개 다음 행동/하위 항목을 한국어로 만들어주세요.

- 너트(그룹): 그 그룹에서 진행할 만한 다음 행사/지식/연결
- 볼트(프로젝트): 그 프로젝트의 다음 마일스톤/작업/리스크
- 이슈: 해결 가능한 다음 행동/대안/대응
- 일정(회의/이벤트): 회의 어젠다/사전 준비/후속 작업
- 탭(위키): 추가로 정리할 만한 하위 주제
- 와셔(동료): 함께할 수 있는 다음 활동
- 파일: 활용 시나리오/관련 작업

각 항목은:
- title: 30자 이내 행동 동사로 시작 ("...하기", "정리하기" 등)
- why: 왜 이 분기가 의미 있는지 한 문장
`;

export const POST = withRouteLog("dashboard.mindmap.expand-node", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rl = rateLimit(`expand:${user.id}`, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "분당 호출 한도 초과", code: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await req.json().catch(() => null) as
    | { kind?: string; title?: string; sub?: string; meta?: Record<string, unknown> }
    | null;
  const kind = String(body?.kind || "").trim();
  const title = String(body?.title || "").trim();
  if (!kind || !title) {
    return NextResponse.json({ error: "kind 와 title 필요" }, { status: 400 });
  }

  const metaSummary = body?.meta
    ? Object.entries(body.meta)
        .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
        .slice(0, 5)
        .join(", ")
    : "";
  const userPrompt = `노드 종류: ${kind}\n노드 제목: ${title}${body?.sub ? `\n부제: ${body.sub}` : ""}${metaSummary ? `\n메타: ${metaSummary}` : ""}\n\n위 노드에서 분기되는 3~5개 다음 행동/항목 제안.`;

  try {
    type ExpandResult = z.infer<typeof ExpandSchema>;
    const res = await generateObjectForUser<ExpandResult>(user.id, ExpandSchema, {
      system: SYSTEM,
      prompt: userPrompt,
      maxOutputTokens: 1200,
      tier: "fast",
    });
    return NextResponse.json({
      suggestions: res.object?.suggestions ?? [],
      model_used: res.model_used,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "AI 분기 생성 실패", detail: msg }, { status: 502 });
  }
});
