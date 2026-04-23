"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Gift, MessageCircle, Loader2, Bell, Sparkles, X } from "lucide-react";

type Person = {
  id: string; display_name: string; role_hint: string | null; company: string | null;
  relationship: string | null; importance: number;
  phone: string | null; email: string | null; kakao_id: string | null; avatar_url: string | null;
  last_contact_at: string | null;
};
type TodayEntry = {
  event_id: string; person_id: string; kind: string; title: string; event_date: string;
  detail: string | null; delta_days: number; person: Person;
  kindIcon: string; kindLabel: string;
};

function contactLink(p: Pick<Person, "kakao_id" | "phone">): { href: string; label: string } | null {
  if (p.kakao_id) return { href: `https://pf.kakao.com/_`, label: "카톡" }; // best-effort; no direct deep-link spec for kakao_id
  if (p.phone) return { href: `sms:${p.phone}`, label: "문자" };
  return null;
}

export function TodaysConnectionsActions({
  today, upcoming, dormant,
}: { today: TodayEntry[]; upcoming: TodayEntry[]; dormant: Person[] }) {
  return (
    <div className="space-y-5">
      {today.length > 0 && (
        <div>
          <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink mb-2">오늘의 주인공</h3>
          <div className="space-y-2">
            {today.map((t) => <TodayRow key={t.event_id} entry={t} />)}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink mb-2">D-3 예정</h3>
          <div className="space-y-1.5">
            {upcoming.map((t) => (
              <div key={t.event_id} className="flex items-center gap-2 bg-white border-[2px] border-nu-ink px-3 py-2">
                <span className="px-1.5 py-0.5 bg-nu-pink/20 font-mono-nu text-[10px] uppercase tracking-widest border border-nu-ink/20">
                  D-{t.delta_days}
                </span>
                <span>{t.kindIcon}</span>
                <Link href={`/people/${t.person_id}`} className="font-head font-extrabold text-nu-ink no-underline hover:underline">
                  {t.person.display_name}
                </Link>
                <span className="font-mono-nu text-[11px] text-nu-muted truncate">· {t.title}</span>
                <RemindButton entry={t} />
              </div>
            ))}
          </div>
        </div>
      )}

      {dormant.length > 0 && (
        <div>
          <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink mb-2">다시 만나면 좋을 인연</h3>
          <div className="space-y-1.5">
            {dormant.map((p) => <DormantRow key={p.id} person={p} />)}
          </div>
        </div>
      )}

      {today.length === 0 && upcoming.length === 0 && dormant.length === 0 && (
        <p className="text-sm text-nu-muted">오늘은 특별한 이벤트가 없어요. 좋은 하루 보내세요.</p>
      )}
    </div>
  );
}

function TodayRow({ entry }: { entry: TodayEntry }) {
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [msgOpen, setMsgOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/people/${entry.person_id}/ai-comment`, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setAiComment(json.comment || null);
      } catch { /* noop */ }
      finally { if (!cancelled) setAiLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [entry.person_id]);

  const link = contactLink(entry.person);
  const giftQ = encodeURIComponent(`${entry.person.display_name} ${entry.kindLabel} 선물`);

  return (
    <div className="bg-white border-[2px] border-nu-ink p-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 border-[2px] border-nu-ink bg-nu-cream flex items-center justify-center font-head font-extrabold shrink-0">
          {entry.person.display_name.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{entry.kindIcon}</span>
            <Link href={`/people/${entry.person_id}`} className="font-head font-extrabold text-nu-ink no-underline hover:underline">
              {entry.person.display_name}
            </Link>
            {entry.person.relationship && (
              <span className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-pink/20 border border-nu-ink/20">
                {entry.person.relationship}
              </span>
            )}
            <span className="font-mono-nu text-[11px] text-nu-muted">· {entry.title}</span>
          </div>
          <div className="mt-1.5 min-h-[2em] text-sm text-nu-ink/90">
            {aiLoading ? (
              <span className="inline-flex items-center gap-1 text-nu-muted"><Loader2 size={11} className="animate-spin" /> AI 조언 로딩중...</span>
            ) : aiComment ? (
              <span className="inline-flex items-start gap-1"><Sparkles size={11} className="text-nu-pink mt-1 shrink-0" /> {aiComment}</span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 mt-3 flex-wrap">
        <button onClick={() => setMsgOpen(true)}
          className="font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1.5 border-[2px] border-nu-ink bg-nu-ink text-nu-paper hover:bg-nu-paper hover:text-nu-ink">
          메시지 초안
        </button>
        {link ? (
          <a href={link.href} target="_blank" rel="noreferrer"
            className="font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1.5 border-[2px] border-nu-ink bg-white hover:bg-nu-cream no-underline inline-flex items-center gap-1">
            <MessageCircle size={10} /> {link.label}
          </a>
        ) : (
          <span className="font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1.5 border-[2px] border-nu-muted/30 text-nu-muted">연락처 없음</span>
        )}
        <a href={`https://www.google.com/search?q=${giftQ}`} target="_blank" rel="noreferrer"
          className="font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1.5 border-[2px] border-nu-ink bg-white hover:bg-nu-cream no-underline inline-flex items-center gap-1">
          <Gift size={10} /> 선물 검색
        </a>
      </div>
      {msgOpen && (
        <MessageDraftModal entry={entry} onClose={() => setMsgOpen(false)} />
      )}
    </div>
  );
}

function MessageDraftModal({ entry, onClose }: { entry: TodayEntry; onClose: () => void }) {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/people/${entry.person_id}/ai-comment`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        const baseline = `${entry.person.display_name}님, ${entry.kindLabel} 진심으로 축하드립니다.`;
        const draft = json.comment
          ? `${baseline}\n\n${json.comment}\n\n앞으로도 건강하고 행복한 날들이 가득하시길 바랍니다.`
          : `${baseline}\n\n늘 좋은 일만 가득하시기를 바랍니다.`;
        setText(draft);
      } catch {
        setText(`${entry.person.display_name}님, ${entry.kindLabel} 축하드립니다. 건강하고 좋은 일만 가득하시길.`);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [entry.person_id, entry.person.display_name, entry.kindLabel]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] p-5 w-full max-w-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-head text-lg font-extrabold">{entry.person.display_name}님께 보낼 메시지</h3>
          <button onClick={onClose} className="p-1"><X size={18} /></button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-nu-muted text-sm py-6"><Loader2 size={14} className="animate-spin" /> 생성 중...</div>
        ) : (
          <>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
              className="w-full border-[2px] border-nu-ink px-3 py-2 font-mono-nu text-sm bg-white" />
            <div className="flex gap-2 mt-3">
              <button onClick={onClose}
                className="flex-1 border-[2px] border-nu-ink px-4 py-2.5 font-mono-nu text-[12px] uppercase tracking-widest">닫기</button>
              <button onClick={() => { navigator.clipboard.writeText(text); }}
                className="flex-1 bg-nu-ink text-nu-paper px-4 py-2.5 font-mono-nu text-[12px] uppercase tracking-widest inline-flex items-center justify-center gap-1.5">
                <Copy size={12} /> 복사
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RemindButton({ entry }: { entry: TodayEntry }) {
  const [clicked, setClicked] = useState(false);
  async function enable() {
    try {
      const remindAt = new Date();
      remindAt.setHours(9, 0, 0, 0);
      // target: D-1 at 9am
      remindAt.setDate(remindAt.getDate() + Math.max(0, entry.delta_days - 1));
      await fetch("/api/personal/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `${entry.person.display_name} ${entry.kindLabel} 챙기기`,
          description: `오늘 ${entry.title}${entry.detail ? ` — ${entry.detail}` : ""}`,
          priority: "high",
          due_date: remindAt.toISOString().slice(0, 10),
        }),
      });
      setClicked(true);
    } catch { /* noop */ }
  }
  return (
    <button onClick={enable} disabled={clicked}
      className="ml-auto font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border border-nu-ink/40 hover:bg-nu-ink hover:text-nu-paper disabled:opacity-50 inline-flex items-center gap-1 shrink-0">
      <Bell size={10} /> {clicked ? "알림 설정됨" : "알림 켜기"}
    </button>
  );
}

function DormantRow({ person }: { person: Person }) {
  const [drafted, setDrafted] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function draft() {
    setLoading(true);
    try {
      const res = await fetch(`/api/people/${person.id}/ai-comment`, { cache: "no-store" });
      const json = await res.json();
      const base = `${person.display_name}님, 오랜만입니다.`;
      setDrafted(json.comment ? `${base} ${json.comment}` : `${base} 잘 지내시죠? 얼굴 한 번 뵙고 싶네요.`);
    } catch {
      setDrafted(`${person.display_name}님, 오랜만입니다. 잘 지내시죠?`);
    } finally { setLoading(false); }
  }
  return (
    <div className="bg-white border-[2px] border-nu-ink px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Link href={`/people/${person.id}`} className="font-head font-extrabold text-nu-ink no-underline hover:underline">
          {person.display_name}
        </Link>
        {person.role_hint && <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{person.role_hint}</span>}
        {person.last_contact_at && (
          <span className="font-mono-nu text-[10px] text-nu-muted">마지막 연락 {person.last_contact_at.slice(0, 10)}</span>
        )}
        <button onClick={draft} disabled={loading}
          className="ml-auto font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border border-nu-ink/40 hover:bg-nu-ink hover:text-nu-paper disabled:opacity-50 shrink-0 inline-flex items-center gap-1">
          {loading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} 안부 문자 초안
        </button>
      </div>
      {drafted && (
        <div className="mt-2 bg-nu-cream border border-nu-ink/20 px-3 py-2 text-sm flex items-start gap-2">
          <span className="flex-1 whitespace-pre-wrap">{drafted}</span>
          <button onClick={() => navigator.clipboard.writeText(drafted)}
            className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border border-nu-ink bg-white inline-flex items-center gap-1 shrink-0">
            <Copy size={10} /> 복사
          </button>
        </div>
      )}
    </div>
  );
}
