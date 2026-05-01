import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { generateObjectWithFallback } from "@/lib/ai/model";

/**
 * GET /api/activity/brief
 *   AI 브리핑 — 지난 12h 통합 활동을 Genesis(Gemini) 가 우선순위 정리.
 *   같은 사용자/날짜/시간대 호출은 24h 캐시 (activity_briefings).
 *
 * 응답
 *   { summary: string, highlights: Array<{title, why, deep_link, importance:1|2|3}> , item_count, model_used, cached: boolean }
 */

const BriefSchema = z.object({
  summary: z.string().describe("한 문장으로 핵심 요약. '부재중 N개의 변화가 있었습니다' 같은 형식."),
  highlights: z.array(z.object({
    title: z.string().describe("한 줄 제목 — 누가 어디서 무엇을"),
    why: z.string().describe("왜 중요한지 한 문장"),
    deep_link: z.string().describe("/groups/{id} 또는 /projects/{id} 같은 내부 경로"),
    importance: z.union([z.literal(1), z.literal(2), z.literal(3)]).describe("3=긴급, 2=중요, 1=참고"),
  })).max(6),
});

function periodOfDay(): "morning" | "evening" | "realtime" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 22) return "realtime";
  return "evening";
}

export const GET = withRouteLog("activity.brief.get", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const period = periodOfDay();
  const today = new Date().toISOString().slice(0, 10);
  const force = req.nextUrl.searchParams.get("refresh") === "1";

  // 1) 캐시 조회
  if (!force) {
    const { data: cached } = await supabase
      .from("activity_briefings")
      .select("summary, highlights, item_count, created_at")
      .eq("user_id", user.id)
      .eq("brief_date", today)
      .eq("brief_type", period)
      .maybeSingle();
    if (cached) {
      return NextResponse.json({
        summary: cached.summary,
        highlights: cached.highlights,
        item_count: cached.item_count,
        cached: true,
        model_used: "cache",
      });
    }
  }

  // 2) 최근 활동 fetch — 내부 API 재사용
  const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const internalUrl = new URL(`/api/activity/global?since=${encodeURIComponent(since)}&limit=40`, req.nextUrl.origin);
  const cookieHeader = req.headers.get("cookie") || "";
  const itemsRes = await fetch(internalUrl.toString(), { headers: { cookie: cookieHeader } });
  const itemsData = await itemsRes.json().catch(() => ({})) as { items?: unknown[] };
  const items = Array.isArray(itemsData.items) ? itemsData.items : [];

  if (items.length === 0) {
    return NextResponse.json({
      summary: "최근 12시간 동안 새 변화가 없어요.",
      highlights: [],
      item_count: 0,
      cached: false,
      model_used: "none",
    });
  }

  // 3) AI 호출
  const condensed = items.slice(0, 30).map((raw) => {
    const it = raw as {
      source_kind?: string;
      owner_type?: string;
      owner_id?: string;
      owner_name?: string;
      actor_nickname?: string | null;
      action?: string;
      summary?: string;
      href?: string;
      importance?: number;
      created_at?: string;
    };
    return {
      kind: it.source_kind,
      where: `${it.owner_type}:${it.owner_name}`,
      who: it.actor_nickname || "system",
      what: it.action,
      summary: it.summary,
      link: it.href,
      importance: it.importance,
      at: it.created_at,
    };
  });

  let summary = "";
  let highlights: z.infer<typeof BriefSchema>["highlights"] = [];
  let modelUsed = "fallback";

  try {
    const result = await generateObjectWithFallback(BriefSchema, {
      system: [
        "당신은 NutUnion 의 Genesis AI 입니다.",
        "사용자의 부재중 활동 로그를 받아서 가장 중요한 3~5개를 한국어로 우선순위화 합니다.",
        "summary 는 한 문장. highlights 는 importance 내림차순.",
        "deep_link 는 입력의 link 를 그대로 사용. 새 URL을 만들지 마세요.",
      ].join(" "),
      prompt: `다음 활동을 정리해 주세요:\n\n${JSON.stringify(condensed, null, 2)}`,
      tier: "fast",
      maxOutputTokens: 800,
      timeoutMs: 30_000,
    });
    if (!result.object) throw new Error("ai returned no object");
    summary = result.object.summary;
    highlights = result.object.highlights;
    modelUsed = result.model_used;
  } catch (err) {
    // AI 실패 시 룰 기반 fallback
    summary = `부재중 ${items.length}개의 변화가 있었습니다.`;
    highlights = condensed
      .sort((a, b) => (Number(b.importance) || 0) - (Number(a.importance) || 0))
      .slice(0, 5)
      .map((c) => ({
        title: `${c.who} · ${c.where}`,
        why: c.summary || c.what || "변화 발생",
        deep_link: c.link || "/dashboard",
        importance: (c.importance && c.importance >= 2 ? 2 : 1) as 1 | 2,
      })) as never;
    modelUsed = `fallback:${(err as Error).message.slice(0, 60)}`;
  }

  // 4) 캐시 저장 (best-effort)
  await supabase.from("activity_briefings").upsert({
    user_id: user.id,
    brief_date: today,
    brief_type: period,
    summary,
    highlights,
    item_count: items.length,
  }, { onConflict: "user_id,brief_date,brief_type" });

  return NextResponse.json({
    summary,
    highlights,
    item_count: items.length,
    cached: false,
    model_used: modelUsed,
  });
});
