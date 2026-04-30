/**
 * @ 멘션 파서 + 자동 알림 디스패치.
 *
 * 입력: 자유 텍스트 ("@태나 이거 좀 봐주세요. @박대리 도 확인 부탁")
 * 출력: 매칭된 user_id 리스트 + 알림 발송 완료
 *
 * 매칭 규칙:
 *  - @{nickname}  (한글·영문·숫자·_·.)
 *  - 가장 긴 매치 우선 (greedy)
 *  - 발송자 본인은 제외
 */

import { dispatchNotification } from "./dispatch";

const MENTION_RE = /@([\p{L}\p{N}_.]{1,32})/gu;

// 한 메시지의 멘션 알림 폭주 가드. 같은 메시지에서 50명을 멘션해도 알림은 상위 N명만.
// 그 이상은 잘려도 in-app 멘션 자체는 텍스트에 남으므로 사용자가 볼 수 있다.
const MAX_MENTION_RECIPIENTS = 20;

export function parseMentionNicknames(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) {
    set.add(m[1]);
  }
  return Array.from(set);
}

interface NotifyMentionsOpts {
  text: string;
  authorId: string;
  authorNickname?: string | null;
  contextLabel: string; // 예: "자료실 댓글", "회의 노트"
  linkUrl: string;      // 클릭 시 이동
  /** Service-role client — RLS 우회해서 profiles · prefs 조회 */
  serviceClient: any;
  metadata?: Record<string, any>;
}

export async function parseAndNotifyMentions(opts: NotifyMentionsOpts): Promise<{ matched: string[]; notified: string[] }> {
  const nicks = parseMentionNicknames(opts.text);
  if (nicks.length === 0) return { matched: [], notified: [] };

  // 닉네임 → user_id 매핑. 한 번의 쿼리로 case-insensitive 매치 — 이전엔 in() 1회 +
  // ilike OR fallback 1회로 두 번 호출했지만, ilike 가 in() 결과를 포함하므로 한 번이면 충분.
  // PostgREST 의 .or() 는 nickname.ilike.{value} 형태 — 50개를 OR 로 묶어도 인덱스 미지원
  // 시 풀스캔이지만 그건 두 쿼리든 한 쿼리든 동일.
  const lowerNicks = nicks.map((n) => n.toLowerCase());
  const orFilter = nicks
    .map((n) => `nickname.ilike.${n.replace(/[,()]/g, "")}`)
    .join(",");
  const { data: profiles } = await opts.serviceClient
    .from("profiles")
    .select("id, nickname, email")
    .or(orFilter)
    .limit(50);

  const matchedRows: Array<{ id: string; nickname: string; email?: string | null }> = [];
  for (const p of profiles || []) {
    const pn = (p.nickname || "").toLowerCase();
    if (lowerNicks.includes(pn) && !matchedRows.some((m) => m.id === p.id)) {
      matchedRows.push(p);
    }
  }

  const allTargets = matchedRows.filter((p) => p.id !== opts.authorId);
  const targets = allTargets.slice(0, MAX_MENTION_RECIPIENTS);
  const truncated = allTargets.length - targets.length;

  const authorLabel = opts.authorNickname ? `${opts.authorNickname}님` : "누군가";
  const previewText = opts.text.length > 120 ? opts.text.slice(0, 120) + "…" : opts.text;

  // 병렬 발송 + 부분 실패 격리. 직렬 await 루프는 N 명에 N 배 시간이 걸려 라우트가 timeout 위험.
  const results = await Promise.allSettled(
    targets.map((t) =>
      dispatchNotification({
        recipientId: t.id,
        eventType: "mention",
        title: `${authorLabel}이 ${opts.contextLabel}에서 회원님을 언급했어요`,
        body: previewText,
        linkUrl: opts.linkUrl,
        category: "mention",
        actorId: opts.authorId,
        channels: ["inapp", "email", "push"],
        email: t.email || undefined,
        metadata: opts.metadata,
      }),
    ),
  );

  const notified: string[] = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "fulfilled") notified.push(targets[i].id);
  }

  return {
    matched: allTargets.map((t) => t.id),
    notified,
    ...(truncated > 0 ? { truncated } : {}),
  } as { matched: string[]; notified: string[]; truncated?: number };
}
