import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { generateObjectWithFallback } from "@/lib/ai/model";

interface RouteContext { params: Promise<{ id: string }>; }

/**
 * POST /api/meetings/{id}/extract-decisions
 *
 *   회의 summary + meeting_notes 를 종합해 AI 가 "결정" 후보 추출.
 *   응답 예: { candidates: [{ title, rationale, confidence }, ...] }
 *
 *   사용자가 ProjectDecisions 로 이관 (별도 POST /api/projects/{pid}/decisions)
 */

const Schema = z.object({
  candidates: z.array(z.object({
    title: z.string().describe("결정 한 줄 요약 — '~로 결정', '~확정' 같은 형태"),
    rationale: z.string().describe("왜 그렇게 결정했는지 한 문장 (선택, 없으면 빈 문자열)"),
    confidence: z.union([z.literal("high"), z.literal("medium"), z.literal("low")]),
  })).max(10),
});

export const POST = withRouteLog("meetings.extract_decisions", async (_req: NextRequest, ctx: RouteContext) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  // 회의 + 노트 fetch — 어느 그룹의 회의든 RLS 가 통과시키면 OK
  const [{ data: meeting }, { data: notes }] = await Promise.all([
    supabase.from("meetings").select("id, title, summary, next_topic, scheduled_at, group_id").eq("id", id).maybeSingle(),
    supabase.from("meeting_notes").select("type, content, owner_id, due_date").eq("meeting_id", id).order("created_at"),
  ]);
  if (!meeting) return NextResponse.json({ error: "meeting_not_found" }, { status: 404 });

  const noteText = (notes || [])
    .map((n) => `[${n.type}] ${n.content}${n.due_date ? ` (마감 ${n.due_date})` : ""}`)
    .join("\n");

  const haystack = [
    meeting.title && `회의: ${meeting.title}`,
    meeting.summary && `요약:\n${meeting.summary}`,
    meeting.next_topic && `다음 주제: ${meeting.next_topic}`,
    noteText && `노트:\n${noteText}`,
  ].filter(Boolean).join("\n\n");

  if (!haystack.trim()) {
    return NextResponse.json({ candidates: [] });
  }

  let candidates: z.infer<typeof Schema>["candidates"] = [];
  let modelUsed = "fallback";

  try {
    const result = await generateObjectWithFallback(Schema, {
      system: [
        "당신은 NutUnion 의 회의록 분석가입니다.",
        "회의 요약과 노트에서 '결정사항' 만 골라 candidates 로 반환하세요.",
        "결정의 신호: '~로 결정', '~로 확정', '~하기로 함', '~승인', '채택', '거절', 'A안 채택' 등.",
        "단순 의견·아이디어·체크리스트는 결정이 아닙니다 — confidence='low' 이면 차라리 누락하세요.",
        "title 은 30자 이내, rationale 은 한 문장.",
      ].join(" "),
      prompt: haystack,
      tier: "fast",
      maxOutputTokens: 800,
      timeoutMs: 25_000,
    });
    if (!result.object) throw new Error("ai returned no object");
    candidates = result.object.candidates;
    modelUsed = result.model_used;
  } catch (err) {
    // 룰 fallback — '결정' '확정' 키워드 있는 문장
    const lines = haystack.split(/[\n.]/).map((l) => l.trim()).filter(Boolean);
    candidates = lines
      .filter((l) => /(결정|확정|채택|승인|거절|확인됨|합의)/.test(l))
      .slice(0, 5)
      .map((l) => ({ title: l.slice(0, 80), rationale: "", confidence: "medium" as const }));
    modelUsed = `fallback:${(err as Error).message.slice(0, 60)}`;
  }

  return NextResponse.json({ candidates, model_used: modelUsed });
});
