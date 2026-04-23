/**
 * GET /api/cron/insights-weekly
 *
 * 주간 AI 인사이트 리포트 — 월요일 10:00 KST (UTC 01:00).
 * 활성 사용자마다 지난 7일 활동을 집계하고 AI 3~5문장 코멘트를 생성해 insight_reports 에 저장.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase, SupabaseClient } from "@supabase/supabase-js";
import { generateTextWithFallback } from "@/lib/ai/model";
import { log } from "@/lib/observability/logger";

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL/SERVICE_ROLE not configured");
  return createSupabase(url, key, { auth: { persistSession: false } });
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  log.info("cron.insights-weekly.invoked", { method: "GET" });
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      log.warn("cron.insights-weekly.unauthorized", {});
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    return await runInsights("weekly");
  } catch (e: any) {
    log.error(e, "cron.insights-weekly.failed", {});
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  log.info("cron.insights-weekly.invoked", { method: "POST" });
  return GET(req);
}

export async function runInsights(period: "weekly" | "monthly", userIds?: string[]) {
  const started = Date.now();
  // KST 기준 지난 주 월요일 00:00 → 일요일 23:59 로 고정 (idempotency key 안정화)
  const kstOffset = 9 * 60 * 60 * 1000;
  const nowKst = new Date(Date.now() + kstOffset);
  const dow = nowKst.getUTCDay(); // 0=일, 1=월, ...
  const thisMondayKst = new Date(nowKst);
  thisMondayKst.setUTCHours(0, 0, 0, 0);
  thisMondayKst.setUTCDate(thisMondayKst.getUTCDate() - (dow === 0 ? 6 : dow - 1));

  let periodStart: Date;
  let periodEnd: Date;
  if (period === "weekly") {
    periodEnd = new Date(thisMondayKst.getTime() - 1); // 지난 일요일 23:59:59.999 KST
    periodStart = new Date(thisMondayKst.getTime() - 7 * 86400000); // 지난 주 월요일 00:00 KST
  } else {
    // monthly: 지난달 1일 00:00 ~ 말일 23:59:59.999 (KST)
    const thisMonth1st = new Date(Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), 1));
    periodEnd = new Date(thisMonth1st.getTime() - 1);
    periodStart = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1));
  }
  // KST → UTC
  periodStart = new Date(periodStart.getTime() - kstOffset);
  periodEnd = new Date(periodEnd.getTime() - kstOffset);
  const startIso = periodStart.toISOString();
  const endIso = periodEnd.toISOString();

  let supabase: SupabaseClient;
  try {
    supabase = getServiceClient();
  } catch (e: any) {
    log.error(e, "cron.insights.service_client_failed", { period });
    return NextResponse.json({ ok: false, error: e?.message }, { status: 500 });
  }

  // Active users — filter by provided userIds if any, else all profiles
  let usersQuery = supabase.from("profiles").select("id, nickname").limit(500);
  if (userIds && userIds.length > 0) {
    usersQuery = usersQuery.in("id", userIds);
  }
  const { data: users, error: uErr } = await usersQuery;
  if (uErr) {
    log.error(uErr, "cron.insights.profiles_query_failed", { period });
    return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of users || []) {
    try {
      // Idempotency — skip if a report already exists for this period+user
      const { data: existing } = await supabase
        .from("insight_reports")
        .select("id")
        .eq("owner_id", u.id)
        .eq("period", period)
        .eq("period_start", periodStart.toISOString().slice(0, 10))
        .maybeSingle();
      if (existing) { skipped++; continue; }

      // Aggregate activity (all counts — tables may not exist / be empty)
      const counts = await aggregateUser(supabase, u.id, startIso, endIso);

      // Nothing to report → skip
      const any = Object.values(counts).some((v) => typeof v === "number" && v > 0);
      if (!any) { skipped++; continue; }

      // AI narrative
      const nickname = (u.nickname as string) || "사용자";
      const periodKo = period === "weekly" ? "지난 주" : "지난 달";
      const nextKo = period === "weekly" ? "다음 주" : "다음 달";
      const prompt = buildPrompt(nickname, periodKo, nextKo, counts);

      let narrative = "";
      let modelUsed = "unknown";
      try {
        const aiRes = await generateTextWithFallback({
          system: "너는 사용자 성장 코치다. 한국어로 3~5문장의 따뜻하지만 날카로운 인사이트를 제공한다.",
          prompt,
          tier: "fast",
          maxOutputTokens: 500,
        });
        narrative = aiRes.text || "";
        modelUsed = aiRes.model_used || "unknown";
      } catch (e: any) {
        log.warn("cron.insights.ai_failed", { user_id: u.id, error: e?.message });
        narrative = `${periodKo} 활동을 정리했어요. 미팅 ${counts.meetings}건 · 완료 Task ${counts.tasks_done}건 · 업로드 ${counts.uploads}개.`;
      }

      const content = {
        summary: narrative,
        stats: counts,
        period,
        period_start: periodStart.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
      };

      const { error: insErr } = await supabase.from("insight_reports").insert({
        owner_id: u.id,
        scope_kind: "personal",
        scope_id: null,
        period,
        period_start: periodStart.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        content,
        model_used: modelUsed,
      });
      if (insErr) throw insErr;

      generated++;
    } catch (e: any) {
      failed++;
      log.warn("cron.insights.user_failed", { user_id: u.id, error: e?.message });
    }
  }

  const duration_ms = Date.now() - started;
  log.info("cron.insights.completed", { period, generated, skipped, failed, duration_ms });
  return NextResponse.json({ ok: true, period, generated, skipped, failed, duration_ms });
}

interface UserCounts {
  meetings: number;
  tasks_done: number;
  uploads: number;
  unread_delta: number;
  nuts_activity: number;
  bolts_progress: number;
}

async function aggregateUser(
  supabase: SupabaseClient,
  userId: string,
  startIso: string,
  endIso: string,
): Promise<UserCounts> {
  const counts: UserCounts = {
    meetings: 0,
    tasks_done: 0,
    uploads: 0,
    unread_delta: 0,
    nuts_activity: 0,
    bolts_progress: 0,
  };

  const tries: Array<[string, () => Promise<void>]> = [
    ["meetings", async () => {
      const { count } = await supabase
        .from("meeting_attendances")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startIso)
        .lte("created_at", endIso);
      counts.meetings = count || 0;
    }],
    ["tasks_done", async () => {
      const { count } = await supabase
        .from("project_action_items")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .eq("status", "done")
        .gte("updated_at", startIso)
        .lte("updated_at", endIso);
      counts.tasks_done = count || 0;
    }],
    ["uploads", async () => {
      const { count } = await supabase
        .from("file_attachments")
        .select("id", { count: "exact", head: true })
        .eq("uploaded_by", userId)
        .gte("created_at", startIso)
        .lte("created_at", endIso);
      counts.uploads = count || 0;
    }],
    ["nuts_activity", async () => {
      const { count } = await supabase
        .from("group_members")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active");
      counts.nuts_activity = count || 0;
    }],
    ["bolts_progress", async () => {
      const { count } = await supabase
        .from("project_members")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", userId);
      counts.bolts_progress = count || 0;
    }],
  ];

  for (const [, fn] of tries) {
    try { await fn(); } catch { /* table may not exist — skip */ }
  }
  return counts;
}

function buildPrompt(nickname: string, periodKo: string, nextKo: string, c: UserCounts): string {
  return [
    `${nickname}님의 ${periodKo} 활동 요약:`,
    `- 미팅 참여: ${c.meetings}건`,
    `- 완료한 할 일: ${c.tasks_done}건`,
    `- 자료 업로드: ${c.uploads}개`,
    `- 소속 너트: ${c.nuts_activity}개`,
    `- 참여 볼트: ${c.bolts_progress}개`,
    ``,
    `위 데이터를 기반으로 한국어 3~5문장:`,
    `1) 잘한 점 한 가지 (성장 포인트)`,
    `2) ${nextKo} 우선순위 1~2가지`,
    `3) 따뜻한 격려 한 줄`,
    `문장은 간결하게, 수치는 자연스럽게 녹여주세요.`,
  ].join("\n");
}
