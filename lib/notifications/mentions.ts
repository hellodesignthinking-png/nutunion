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

  // 닉네임 → user_id (소문자 비교)
  const lowerNicks = nicks.map((n) => n.toLowerCase());
  const { data: profiles } = await opts.serviceClient
    .from("profiles")
    .select("id, nickname, email")
    .in("nickname", nicks)
    .limit(50);

  // 대소문자 미스매치 핸들링 — 다시 fuzzy 매치
  const matchedRows: Array<{ id: string; nickname: string; email?: string | null }> = [];
  for (const p of profiles || []) {
    const pn = (p.nickname || "").toLowerCase();
    if (lowerNicks.includes(pn)) matchedRows.push(p);
  }

  // 매칭이 부족하면 ilike 로 보강 (대소문자 무관)
  if (matchedRows.length < nicks.length) {
    const remaining = nicks.filter((n) => !matchedRows.some((m) => m.nickname.toLowerCase() === n.toLowerCase()));
    if (remaining.length > 0) {
      const orFilter = remaining.map((n) => `nickname.ilike.${n}`).join(",");
      const { data: extra } = await opts.serviceClient
        .from("profiles")
        .select("id, nickname, email")
        .or(orFilter)
        .limit(50);
      for (const p of extra || []) {
        if (!matchedRows.some((m) => m.id === p.id)) matchedRows.push(p);
      }
    }
  }

  const targets = matchedRows.filter((p) => p.id !== opts.authorId);
  const notified: string[] = [];

  const authorLabel = opts.authorNickname ? `${opts.authorNickname}님` : "누군가";
  const previewText = opts.text.length > 120 ? opts.text.slice(0, 120) + "…" : opts.text;

  for (const t of targets) {
    try {
      await dispatchNotification({
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
      });
      notified.push(t.id);
    } catch {
      // 개별 실패 무시
    }
  }

  return {
    matched: targets.map((t) => t.id),
    notified,
  };
}
