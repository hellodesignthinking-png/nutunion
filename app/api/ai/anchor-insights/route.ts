import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { askClaude } from "@/lib/ai/client";

export const maxDuration = 30;

/**
 * POST /api/ai/anchor-insights
 * Body: { projectId }
 * → 최근 21일 Anchor bolt_metrics 를 분석해서 인사이트 3~5개 문장 (JSON).
 *
 * 응답:
 * {
 *   insights: [
 *     { emoji: "📈", text: "주말 매출이 평일 대비 1.8배 높음", severity: "info"|"warning"|"alert" }
 *   ],
 *   summary: "이번 주 요약 1문장"
 * }
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await req.json();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  // 최근 21일 daily metrics
  const since = new Date();
  since.setDate(since.getDate() - 21);
  const { data: rows, error } = await supabase
    .from("bolt_metrics")
    .select("period_start, metrics, memo")
    .eq("project_id", projectId)
    .eq("period_type", "daily")
    .gte("period_start", since.toISOString().slice(0, 10))
    .order("period_start", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length < 3) {
    return NextResponse.json({
      insights: [
        { emoji: "📊", text: `데이터가 ${rows?.length || 0}일분 밖에 없어요. 최소 3일 이상 입력되면 인사이트가 생성돼요.`, severity: "info" },
      ],
      summary: "데이터 부족",
    });
  }

  // 샘플 줄임 — 토큰 절약
  const sample = rows.map((r: any) => {
    const m = r.metrics || {};
    const rev = m.revenue || {};
    const cost = m.cost || {};
    const revTotal = (rev.card || 0) + (rev.cash || 0) + (rev.delivery || 0);
    const costTotal = (cost.food || 0) + (cost.supplies || 0) + (cost.labor || 0) + (cost.rent || 0) + (cost.other || 0);
    return {
      date: r.period_start,
      revenue: revTotal,
      cost: costTotal,
      profit: revTotal - costTotal,
      customers: m.customers || 0,
      memo: r.memo || null,
    };
  });

  const prompt = `당신은 매장 운영 데이터 분석가입니다. 아래 최근 ${sample.length}일치 매장 일일 지표를 보고 **실무자에게 유용한 인사이트 3~5개**를 한국어로 추출해주세요.

데이터(JSON):
${JSON.stringify(sample)}

각 인사이트 규칙:
- 숫자 근거 포함 (예: "주말 평균 47만원 vs 평일 26만원")
- 결정 가능한 수준으로 구체적
- 단순 요약 금지 ("매출이 오르고 있다" X — "객단가가 3주 연속 상승 중 (7,800 → 8,200 → 8,500)" O)
- emoji 적절히 사용 (📈 상승, 📉 하락, ⚠️ 경고, 💡 기회, 🎯 목표)

반드시 JSON 으로만 응답:
{
  "insights": [
    { "emoji": "📈", "text": "...", "severity": "info" }
  ],
  "summary": "최근 ${sample.length}일 한 줄 요약"
}

severity: info | warning | alert`;

  const result = await askClaude({
    userId: user.id,
    feature: "anchor_insights",
    maxTokens: 900,
    user: prompt,
  });
  if (!result.text) return NextResponse.json({ error: result.error, stubbed: result.stubbed }, { status: 500 });

  try {
    const jsonText = result.text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return NextResponse.json(JSON.parse(jsonText));
  } catch {
    return NextResponse.json({ insights: [], raw: result.text, error: "JSON parse 실패" });
  }
}
