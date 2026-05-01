/**
 * GET /api/polls/[id]
 *   → poll 정보 + 옵션별 집계 + 내 투표
 *
 * POST /api/polls/[id]
 *   body: { option_idx: number, toggle?: boolean }
 *   → 투표. toggle=true 이면 같은 옵션 재선택 시 취소.
 *   → allow_multi=false 인 polls 는 다른 옵션에 투표 시 이전 투표 삭제.
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { finalizePoll, type PollRow } from "@/lib/chat/poll-finalize";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

async function loadPollSummary(db: any, pollId: string, userId: string) {
  const { data: poll, error: pollErr } = await db
    .from("polls")
    .select("id, room_id, question, options, allow_multi, created_by, created_at, closes_at, closed_at, result_posted")
    .eq("id", pollId)
    .maybeSingle();
  if (pollErr || !poll) return { notFound: true };

  // Lazy trigger — 만료됐는데 아직 공지 안 됐으면 즉시 마감 처리 + 결과 공지 투입
  // service_role 이 필요하므로 admin client 로 처리 (조용히 best-effort)
  try {
    const p = poll as PollRow;
    const closesAt = p.closes_at ? new Date(p.closes_at) : null;
    if (closesAt && closesAt <= new Date() && !p.result_posted) {
      const admin = (() => {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) return null;
        return createAdminClient(url, key, { auth: { persistSession: false } });
      })();
      if (admin) {
        await finalizePoll(admin, p);
        // DB 상태 업데이트 반영 (closed_at, result_posted)
        const { data: refreshed } = await admin
          .from("polls")
          .select("closed_at, result_posted")
          .eq("id", pollId)
          .maybeSingle();
        if (refreshed) {
          (poll as any).closed_at = (refreshed as any).closed_at;
          (poll as any).result_posted = (refreshed as any).result_posted;
        }
      }
    }
  } catch {
    // lazy finalize 는 silent fail — 원래 GET 흐름은 유지
  }

  const { data: votes } = await db
    .from("poll_votes")
    .select("option_idx, user_id")
    .eq("poll_id", pollId);

  const options: string[] = (poll as any).options || [];
  const counts = options.map(() => 0);
  const myChoices: number[] = [];
  for (const v of (votes as any[]) || []) {
    if (typeof v.option_idx === "number" && v.option_idx >= 0 && v.option_idx < counts.length) {
      counts[v.option_idx]++;
      if (v.user_id === userId) myChoices.push(v.option_idx);
    }
  }

  const p = poll as any;
  const closesAt = p.closes_at ? new Date(p.closes_at) : null;
  const closedAt = p.closed_at ? new Date(p.closed_at) : null;
  const expired = closesAt && closesAt <= new Date();
  return {
    id: p.id,
    room_id: p.room_id,
    question: p.question,
    options,
    counts,
    total: counts.reduce((s, n) => s + n, 0),
    allow_multi: !!p.allow_multi,
    my_choices: myChoices,
    closes_at: p.closes_at || null,
    closed_at: p.closed_at || null,
    closed: !!closedAt || !!expired,
  };
}

export const GET = withRouteLog("polls.id.get", async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getAdmin() || supabase;
  try {
    const summary = await loadPollSummary(db, id, auth.user.id);
    if ((summary as any).notFound) return NextResponse.json({ error: "poll not found" }, { status: 404 });
    return NextResponse.json(summary);
  } catch (err: any) {
    log.error(err, "polls.id.failed");
    if (/relation.*polls.*does not exist|PGRST205/.test(err?.message || "")) {
      return NextResponse.json({ error: "MIGRATION_PENDING" }, { status: 501 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

export const POST = withRouteLog("polls.id.post", async (req: NextRequest, { params }: Ctx) => {
  const { id: pollId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const optionIdx = Number(body?.option_idx);
  if (!Number.isInteger(optionIdx) || optionIdx < 0) {
    return NextResponse.json({ error: "option_idx 필요" }, { status: 400 });
  }
  const toggle = !!body?.toggle;

  const db = getAdmin() || supabase;

  // poll 메타 (allow_multi / option 길이 / 마감)
  const { data: poll, error: pollErr } = await db
    .from("polls")
    .select("id, options, allow_multi, room_id, closes_at, closed_at")
    .eq("id", pollId)
    .maybeSingle();
  if (pollErr) {
    if (/relation.*polls.*does not exist|PGRST205/.test(pollErr.message)) {
      return NextResponse.json({ error: "MIGRATION_PENDING" }, { status: 501 });
    }
    return NextResponse.json({ error: pollErr.message }, { status: 500 });
  }
  if (!poll) return NextResponse.json({ error: "poll not found" }, { status: 404 });

  // 마감 체크
  const p = poll as any;
  const closedAt = p.closed_at ? new Date(p.closed_at) : null;
  const closesAt = p.closes_at ? new Date(p.closes_at) : null;
  if (closedAt || (closesAt && closesAt <= new Date())) {
    return NextResponse.json({ error: "마감된 투표입니다", closed: true }, { status: 410 });
  }

  if (optionIdx >= ((poll as any).options?.length || 0)) {
    return NextResponse.json({ error: "invalid option_idx" }, { status: 400 });
  }

  // 이미 해당 옵션에 투표?
  const { data: existing } = await db
    .from("poll_votes")
    .select("id, option_idx")
    .eq("poll_id", pollId)
    .eq("user_id", auth.user.id);
  const existingList = (existing as any[]) || [];
  const alreadySame = existingList.find((v) => v.option_idx === optionIdx);

  if (toggle && alreadySame) {
    // 같은 옵션 재클릭 → 삭제
    await db.from("poll_votes").delete().eq("id", alreadySame.id);
  } else if ((poll as any).allow_multi) {
    // 복수 선택: 새 옵션이면 추가 (중복 제약 UNIQUE 로 자동 방지)
    if (!alreadySame) {
      await db.from("poll_votes").insert({ poll_id: pollId, user_id: auth.user.id, option_idx: optionIdx });
    }
  } else {
    // 단일 선택: 기존 투표 전부 지우고 새로 삽입
    if (existingList.length > 0) {
      await db.from("poll_votes").delete().eq("poll_id", pollId).eq("user_id", auth.user.id);
    }
    await db.from("poll_votes").insert({ poll_id: pollId, user_id: auth.user.id, option_idx: optionIdx });
  }

  const summary = await loadPollSummary(db, pollId, auth.user.id);
  return NextResponse.json(summary);
});
