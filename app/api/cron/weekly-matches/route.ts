import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispatchPushToUsers } from "@/lib/push/dispatch";
import { dispatchNotification } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 주간 매칭 알림 — 매주 월요일 아침 실행
 * 1. 활성 유저별 profile_embeddings 기반 매칭 TOP 3 볼트 계산
 * 2. 중복 발송 방지 (weekly_match_runs 테이블 unique)
 * 3. 알림 + 웹푸시 전송
 *
 * 환경변수: CRON_SECRET, SUPABASE_SERVICE_ROLE
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE env missing" }, { status: 501 });
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 이번 주 ISO 시작일 (일요일 기준 KST)
  const now = new Date();
  const runWeek = new Date(now);
  runWeek.setUTCHours(0, 0, 0, 0);
  runWeek.setUTCDate(runWeek.getUTCDate() - runWeek.getUTCDay());
  const runWeekStr = runWeek.toISOString().slice(0, 10);

  // 지난 30일 내 활동한 유저 대상
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: activeUsers } = await supabase
    .from("profiles")
    .select("id, nickname, specialty")
    .gte("updated_at", since)
    .limit(200);

  let sent = 0, skipped = 0;

  for (const u of activeUsers || []) {
    // 이미 이번 주 발송?
    const { data: runRow } = await supabase
      .from("weekly_match_runs")
      .select("id")
      .eq("user_id", u.id)
      .eq("run_week", runWeekStr)
      .maybeSingle();
    if (runRow) { skipped++; continue; }

    const topBolts = await pickTopBolts(supabase, u.id, u.specialty);
    if (topBolts.length === 0) { skipped++; continue; }

    const titles = topBolts.map((b: any) => b.title).slice(0, 3).join(", ");
    // 알림 insert
    try {
      await dispatchNotification({
        recipientId: u.id,
        eventType: "weekly_match",
        title: "이번 주 어울릴 볼트 TOP 3",
        body: titles,
        linkUrl: `/projects?match=weekly`,
      });
    } catch (e: any) { console.warn("[weekly-matches] notif insert failed:", e?.message); skipped++; continue; }

    // 웹푸시 (가능하면)
    try {
      await dispatchPushToUsers([u.id], {
        title: "이번 주 볼트 추천",
        body: titles,
        url: `/projects?match=weekly`,
      });
    } catch {}

    await supabase.from("weekly_match_runs").insert({
      user_id: u.id,
      run_week: runWeekStr,
      items_count: topBolts.length,
      sent_push: true,
    });
    sent++;
  }

  return NextResponse.json({ sent, skipped, week: runWeekStr });
}

async function pickTopBolts(supabase: any, userId: string, specialty: string | null) {
  // 1차: pgvector RPC (있으면) — 없으면 keyword fallback
  try {
    const { data: emb } = await supabase
      .from("profile_embeddings")
      .select("embedding")
      .eq("profile_id", userId)
      .maybeSingle();

    if (emb?.embedding) {
      // RPC: match_projects(query_embedding, match_count) — 선택적 존재
      const { data: matches } = await supabase.rpc("match_projects_by_embedding", {
        query_embedding: emb.embedding,
        match_count: 5,
        exclude_user: userId,
      });
      if (matches && matches.length > 0) return matches;
    }
  } catch {}

  // Fallback: specialty + recruiting + exclude own
  const { data: myProjects } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);
  const excludeIds = (myProjects || []).map((m: any) => m.project_id);

  let q = supabase
    .from("projects")
    .select("id, title, description, category")
    .eq("status", "active")
    .eq("recruiting", true)
    .order("created_at", { ascending: false })
    .limit(3);
  if (specialty) q = q.eq("category", specialty);
  if (excludeIds.length > 0) q = q.not("id", "in", `(${excludeIds.join(",")})`);

  const { data } = await q;
  return data || [];
}
