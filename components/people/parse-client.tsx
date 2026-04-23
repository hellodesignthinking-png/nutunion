"use client";

import { useState } from "react";
import { Lock, Sparkles, Loader2, CheckSquare, Square } from "lucide-react";

type PeopleOption = { id: string; display_name: string; company: string | null };
type ParseResult = {
  summary: string;
  inferred_person: { name: string | null; role_hint: string | null; kakao_id: string | null } | null;
  events: Array<{ kind: string; title: string; event_date: string | null; detail?: string }>;
  context_notes: string[];
};

const KIND_ICON: Record<string, string> = { birthday: "🎂", anniversary: "💍", founding_day: "🏢", memorial: "🕯️", milestone: "⭐", note: "📝" };

export function ParseClient({ people }: { people: PeopleOption[] }) {
  const [text, setText] = useState("");
  const [personId, setPersonId] = useState<string>("");
  const [personHint, setPersonHint] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [selEv, setSelEv] = useState<Record<number, boolean>>({});
  const [selNotes, setSelNotes] = useState<Record<number, boolean>>({});
  const [newName, setNewName] = useState("");
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState<string | null>(null);

  async function analyze() {
    if (text.trim().length < 20) { setErr("대화 내용이 너무 짧습니다"); return; }
    setLoading(true); setErr(null); setResult(null); setCommitted(null);
    try {
      const hint = personId
        ? (people.find((p) => p.id === personId)?.display_name || "")
        : personHint;
      const res = await fetch("/api/people/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, person_hint: hint }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "분석 실패");
      setResult(json.result as ParseResult);
      // default: all selected
      const evSel: Record<number, boolean> = {};
      (json.result.events || []).forEach((_: any, i: number) => { evSel[i] = true; });
      setSelEv(evSel);
      const nSel: Record<number, boolean> = {};
      (json.result.context_notes || []).forEach((_: any, i: number) => { nSel[i] = true; });
      setSelNotes(nSel);
      if (json.result.inferred_person?.name && !personId) setNewName(json.result.inferred_person.name);
    } catch (e: any) { setErr(e?.message || "실패"); }
    finally { setLoading(false); }
  }

  async function commit() {
    if (!result) return;
    if (!personId && !newName.trim()) { setErr("사람을 선택하거나 새 이름을 입력하세요"); return; }
    setCommitting(true); setErr(null);
    try {
      const selectedEvents = result.events
        .map((e, i) => ({ e, i }))
        .filter(({ i }) => selEv[i] && result.events[i].event_date)
        .map(({ e }) => e);
      const selectedNotes = result.context_notes.filter((_, i) => selNotes[i]);

      const res = await fetch("/api/people/parse/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          person_id: personId || undefined,
          new_person_name: !personId ? newName.trim() : undefined,
          new_person_role_hint: result.inferred_person?.role_hint || undefined,
          new_person_kakao_id: result.inferred_person?.kakao_id || undefined,
          events: selectedEvents,
          notes: selectedNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "저장 실패");
      setCommitted(`저장 완료 — 이벤트 ${json.events_saved}, 메모 ${json.notes_saved}`);
      // 원문 삭제 — 저장 후에도 클라이언트에서 비움
      setText("");
      setResult(null);
    } catch (e: any) { setErr(e?.message || "실패"); }
    finally { setCommitting(false); }
  }

  return (
    <div className="space-y-4">
      {/* Privacy notice */}
      <div className="bg-nu-pink/10 border-[2px] border-nu-pink px-4 py-3 flex items-start gap-2">
        <Lock size={14} className="text-nu-pink mt-0.5 shrink-0" />
        <p className="text-sm text-nu-ink">
          <strong>대화 원문은 서버에 저장되지 않으며, 분석이 끝나면 즉시 폐기됩니다.</strong>
          {" "}추출된 이벤트와 메모만 사용자가 승인한 경우 저장됩니다.
        </p>
      </div>

      {/* Input */}
      <div className="bg-white border-[3px] border-nu-ink shadow-[4px_4px_0_0_#0D0F14] p-4">
        <label className="block mb-2">
          <span className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">누구와의 대화? (선택)</span>
          <div className="flex gap-2 flex-wrap">
            <select value={personId} onChange={(e) => setPersonId(e.target.value)}
              className="flex-1 border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white min-w-[180px]">
              <option value="">-- 등록된 사람 선택 --</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}{p.company ? ` (${p.company})` : ""}
                </option>
              ))}
            </select>
            <input placeholder="또는 직접 힌트 입력"
              value={personHint} onChange={(e) => setPersonHint(e.target.value)} disabled={!!personId}
              className="flex-1 border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white min-w-[180px] disabled:bg-nu-cream/50" />
          </div>
        </label>

        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10}
          placeholder="카톡/문자 대화를 여기에 붙여넣기..."
          className="w-full border-[2px] border-nu-ink px-3 py-2 font-mono-nu text-sm bg-white" />
        {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
        <div className="flex justify-end mt-2">
          <button onClick={analyze} disabled={loading || !text.trim()}
            className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 bg-nu-ink text-nu-paper disabled:opacity-50 flex items-center gap-1.5">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {loading ? "분석 중..." : "AI 분석"}
          </button>
        </div>
      </div>

      {committed && (
        <div className="bg-emerald-50 border-[2px] border-emerald-600 px-4 py-3 text-sm text-emerald-900 font-medium">
          ✓ {committed}
        </div>
      )}

      {result && (
        <div className="bg-nu-cream border-[3px] border-nu-ink shadow-[4px_4px_0_0_#0D0F14] p-4 space-y-4">
          <div>
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">요약</p>
            <p className="text-sm text-nu-ink">{result.summary}</p>
          </div>

          {!personId && (
            <div>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">새 인맥 이름</p>
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="저장할 이름"
                className="w-full border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white" />
              {result.inferred_person && (
                <p className="font-mono-nu text-[11px] text-nu-muted mt-1">
                  AI 추정: {result.inferred_person.name || "-"}
                  {result.inferred_person.role_hint ? ` · ${result.inferred_person.role_hint}` : ""}
                </p>
              )}
            </div>
          )}

          {result.events.length > 0 && (
            <div>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">추출된 이벤트</p>
              <div className="space-y-1.5">
                {result.events.map((e, i) => (
                  <label key={i} className="flex items-start gap-2 bg-white border-[2px] border-nu-ink px-3 py-2 cursor-pointer">
                    <button type="button" onClick={() => setSelEv({ ...selEv, [i]: !selEv[i] })}>
                      {selEv[i] ? <CheckSquare size={14} className="text-nu-pink" /> : <Square size={14} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-nu-ink">
                        {KIND_ICON[e.kind]} {e.title}
                        {e.event_date ? <span className="font-mono-nu text-[11px] text-nu-muted ml-1">({e.event_date})</span> : <span className="font-mono-nu text-[11px] text-red-500 ml-1">(날짜 미추출)</span>}
                      </div>
                      {e.detail && <div className="text-xs text-nu-ink/70">{e.detail}</div>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {result.context_notes.length > 0 && (
            <div>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">추출된 맥락 메모</p>
              <div className="space-y-1.5">
                {result.context_notes.map((n, i) => (
                  <label key={i} className="flex items-start gap-2 bg-white border-[2px] border-nu-ink px-3 py-2 cursor-pointer">
                    <button type="button" onClick={() => setSelNotes({ ...selNotes, [i]: !selNotes[i] })}>
                      {selNotes[i] ? <CheckSquare size={14} className="text-nu-pink" /> : <Square size={14} />}
                    </button>
                    <span className="text-sm text-nu-ink">{n}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={commit} disabled={committing}
              className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 bg-nu-pink text-nu-paper disabled:opacity-50">
              {committing ? "저장 중..." : "선택한 항목 저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
