/**
 * GET /api/cron/close-polls
 *
 * Backstop cron — lazy trigger (GET /api/polls/[id]) 가 아무도 조회하지 않는 poll 을
 * 대신 마감 처리. Vercel Hobby 플랜 제한으로 하루 1회 실행.
 *
 * 실제 대부분의 마감 처리는 유저가 poll 을 볼 때 즉시 lazy 실행됨.
 *
 * 보안: Authorization: Bearer CRON_SECRET 헤더 필수
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { finalizePoll, type PollRow } from "@/lib/chat/poll-finalize";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export const GET = withRouteLog("cron.close-polls", async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization") || "";
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: "service_role 미설정" }, { status: 501 });

  const nowIso = new Date().toISOString();

  // 마감 시각이 지났고, 공지 아직 안 된 poll 들만
  const { data: expired, error } = await admin
    .from("polls")
    .select("id, room_id, question, options, created_by, closes_at, closed_at, result_posted")
    .eq("result_posted", false)
    .not("closes_at", "is", null)
    .lte("closes_at", nowIso);

  if (error) {
    if (/relation.*polls.*does not exist|PGRST205/.test(error.message)) {
      return NextResponse.json({ ok: true, note: "polls 테이블 없음 — 091 마이그 필요" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let finalized = 0;
  let posted = 0;
  const errors: Array<{ id: string; msg: string }> = [];

  for (const p of (expired as PollRow[]) || []) {
    try {
      const r = await finalizePoll(admin, p);
      if (r.finalized) finalized++;
      if (r.posted) posted++;
    } catch (err: any) {
      errors.push({ id: p.id, msg: err?.message || "unknown" });
      log.warn("cron.close_polls.entry_failed", { poll_id: p.id, error_message: err?.message });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: (expired as any[])?.length || 0,
    finalized,
    posted,
    errors,
  });
});
