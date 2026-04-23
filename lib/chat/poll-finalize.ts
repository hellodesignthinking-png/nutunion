/**
 * lib/chat/poll-finalize — 만료된 Poll 을 마감 + 결과 공지 투입.
 *
 * 두 경로에서 공유:
 *  - `/api/cron/close-polls` (스케줄링 — 하루 1회 backstop)
 *  - `/api/polls/[id] GET` (lazy trigger — 누군가 조회할 때 즉시 마감 처리)
 *
 * 멱등 보장:
 *  - `closed_at` 이 이미 세팅되어 있으면 중복 마킹 안 함
 *  - `result_posted=true` 면 공지 중복 투입 안 함
 *  - 두 곳에서 동시에 호출돼도 안전하도록 conditional update 사용
 */

import { encodeAction } from "./chat-actions";

export interface PollRow {
  id: string;
  room_id: string;
  question: string;
  options: string[];
  created_by: string;
  closes_at: string | null;
  closed_at: string | null;
  result_posted: boolean;
}

export interface FinalizeResult {
  finalized: boolean;
  alreadyClosed: boolean;
  posted: boolean;
}

/**
 * 단일 poll 을 마감 처리. admin Supabase client 필요 (service_role).
 * @returns 처리 결과 — 이미 마감된 경우 alreadyClosed, 공지 투입한 경우 posted
 */
export async function finalizePoll(admin: any, poll: PollRow): Promise<FinalizeResult> {
  // 이미 closed_at 있고 result_posted 도 true 면 스킵
  if (poll.closed_at && poll.result_posted) {
    return { finalized: false, alreadyClosed: true, posted: false };
  }

  // 마감 시각 확인 — 아직 안 지났으면 스킵
  const now = new Date();
  const closesAt = poll.closes_at ? new Date(poll.closes_at) : null;
  if (!closesAt || closesAt > now) {
    return { finalized: false, alreadyClosed: false, posted: false };
  }

  const nowIso = now.toISOString();

  // 1) closed_at 멱등 마킹 — 이미 있으면 update 0 rows
  if (!poll.closed_at) {
    await admin
      .from("polls")
      .update({ closed_at: nowIso })
      .eq("id", poll.id)
      .is("closed_at", null);
  }

  // 2) 이미 공지됐으면 여기서 끝
  if (poll.result_posted) {
    return { finalized: true, alreadyClosed: !!poll.closed_at, posted: false };
  }

  // 3) 투표 집계
  const { data: votes } = await admin
    .from("poll_votes")
    .select("option_idx")
    .eq("poll_id", poll.id);

  const counts: number[] = poll.options.map(() => 0);
  for (const v of (votes as any[]) || []) {
    if (typeof v.option_idx === "number" && v.option_idx >= 0 && v.option_idx < counts.length) {
      counts[v.option_idx]++;
    }
  }
  const total = counts.reduce((s, n) => s + n, 0);

  // 1위 (공동 1위 가능)
  let topCount = 0;
  for (const c of counts) if (c > topCount) topCount = c;
  const winners = poll.options
    .map((opt, i) => ({ opt, c: counts[i] }))
    .filter((x) => x.c === topCount && x.c > 0);

  const resultLines = poll.options.map((opt, i) => {
    const c = counts[i];
    const pct = total > 0 ? Math.round((c / total) * 100) : 0;
    return `• ${opt}: ${c}표 (${pct}%)`;
  });
  const winnerLine =
    winners.length === 0
      ? "투표 없이 마감됨"
      : winners.length === 1
        ? `🏆 ${winners[0].opt}`
        : `공동 1위: ${winners.map((w) => w.opt).join(", ")}`;

  const displayText =
    `📊 투표 종료 — ${poll.question}\n${winnerLine}\n총 ${total}표\n\n${resultLines.join("\n")}`;

  // 4) result_posted = true 로 **먼저** update → 경쟁 조건에서 한 쪽만 insert
  //    (returning row 로 성공 여부 확인)
  const { data: upd, error: updErr } = await admin
    .from("polls")
    .update({ result_posted: true })
    .eq("id", poll.id)
    .eq("result_posted", false)
    .select("id")
    .maybeSingle();

  if (updErr || !upd) {
    // 다른 프로세스가 먼저 posted 했음 → 공지 재투입 X
    return { finalized: true, alreadyClosed: true, posted: false };
  }

  // 5) 시스템 메시지 투입 (공지 스타일 — info severity)
  const content = encodeAction(
    { type: "announcement", pinned: false, severity: "info" } as any,
    displayText,
  );

  await admin.from("chat_messages").insert({
    room_id: poll.room_id,
    sender_id: poll.created_by,
    content,
    is_system: true,
  });

  return { finalized: true, alreadyClosed: false, posted: true };
}
