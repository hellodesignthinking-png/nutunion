"use client";

import { useState, useMemo } from "react";
import { Star, Calendar, MessageSquareQuote, Clock, Trash2, Edit3, Save, X } from "lucide-react";

type Person = {
  id: string; display_name: string; role_hint: string | null; company: string | null;
  phone: string | null; email: string | null; kakao_id: string | null;
  relationship: string | null; importance: number; notes: string | null;
  last_contact_at: string | null; avatar_url: string | null; tags: string[] | null;
};
type PersonEvent = { id: string; kind: string; title: string; event_date: string; lunar: boolean; recurring: boolean; detail: string | null; source: string };
type PersonNote = { id: string; note: string; extracted_from: string | null; created_at: string };

const KIND_ICON: Record<string, string> = { birthday: "🎂", anniversary: "💍", founding_day: "🏢", memorial: "🕯️", milestone: "⭐", note: "📝" };
const KIND_LABEL: Record<string, string> = { birthday: "생일", anniversary: "기념일", founding_day: "창립일", memorial: "추모일", milestone: "마일스톤", note: "메모" };

export function PersonDetailClient({
  personId, initialPerson, initialEvents, initialNotes,
}: { personId: string; initialPerson: Person; initialEvents: PersonEvent[]; initialNotes: PersonNote[] }) {
  const [person, setPerson] = useState<Person>(initialPerson);
  const [events, setEvents] = useState<PersonEvent[]>(initialEvents);
  const [notes, setNotes] = useState<PersonNote[]>(initialNotes);
  const [tab, setTab] = useState<"events" | "notes" | "timeline">("events");
  const [editing, setEditing] = useState(false);

  const timeline = useMemo(() => {
    const items: Array<{ ts: string; kind: "event" | "note"; label: string; detail?: string }> = [];
    for (const e of events) items.push({ ts: e.event_date, kind: "event", label: `${KIND_ICON[e.kind]} ${e.title}`, detail: e.detail || undefined });
    for (const n of notes) items.push({ ts: n.created_at, kind: "note", label: n.note });
    items.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return items;
  }, [events, notes]);

  return (
    <>
      {/* Header */}
      <div className="bg-nu-cream border-[3px] border-nu-ink shadow-[4px_4px_0_0_#0D0F14] p-5 mb-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 border-[3px] border-nu-ink bg-white flex items-center justify-center font-head text-3xl font-extrabold shrink-0">
            {person.display_name.slice(0, 1)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-head text-2xl md:text-3xl font-extrabold text-nu-ink tracking-tight">{person.display_name}</h1>
            <div className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mt-1">
              {[person.role_hint, person.company, person.relationship].filter(Boolean).join(" · ") || "-"}
            </div>
            <div className="flex items-center gap-1 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={12} className={i < person.importance ? "fill-amber-400 text-amber-400" : "text-nu-muted/30"} />
              ))}
            </div>
            {(person.phone || person.email || person.kakao_id) && (
              <div className="flex flex-wrap gap-2 mt-3 font-mono-nu text-[11px]">
                {person.phone && <span className="px-2 py-0.5 bg-white border border-nu-ink/30">📞 {person.phone}</span>}
                {person.email && <span className="px-2 py-0.5 bg-white border border-nu-ink/30">✉ {person.email}</span>}
                {person.kakao_id && <span className="px-2 py-0.5 bg-white border border-nu-ink/30">카톡 {person.kakao_id}</span>}
              </div>
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink bg-white hover:bg-nu-ink hover:text-nu-paper flex items-center gap-1"
          >
            <Edit3 size={10} /> 편집
          </button>
        </div>
        {person.notes && <p className="text-sm text-nu-ink/80 mt-3 whitespace-pre-wrap">{person.notes}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b-[2px] border-nu-ink mb-4">
        {([
          ["events", "이벤트", Calendar],
          ["notes", "맥락 메모", MessageSquareQuote],
          ["timeline", "타임라인", Clock],
        ] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest flex items-center gap-1.5 border-[2px] border-nu-ink border-b-0 ${tab === k ? "bg-nu-ink text-nu-paper" : "bg-white hover:bg-nu-cream"}`}>
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      {tab === "events" && <EventsTab personId={personId} events={events} setEvents={setEvents} />}
      {tab === "notes" && <NotesTab personId={personId} notes={notes} setNotes={setNotes} />}
      {tab === "timeline" && (
        <div className="space-y-2">
          {timeline.length === 0 ? (
            <p className="text-sm text-nu-muted">기록된 이벤트/메모가 없습니다.</p>
          ) : timeline.map((t, i) => (
            <div key={i} className="bg-white border-[2px] border-nu-ink p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">
                  {t.ts.slice(0, 10)} · {t.kind === "event" ? "이벤트" : "메모"}
                </div>
              </div>
              <div className="text-sm text-nu-ink mt-1">{t.label}</div>
              {t.detail && <div className="text-sm text-nu-ink/70 mt-1">{t.detail}</div>}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditPersonModal
          person={person}
          onClose={() => setEditing(false)}
          onSaved={(p) => { setPerson(p); setEditing(false); }}
        />
      )}
    </>
  );
}

function EventsTab({ personId, events, setEvents }: { personId: string; events: PersonEvent[]; setEvents: (e: PersonEvent[]) => void }) {
  const [form, setForm] = useState({ kind: "birthday", title: "", event_date: "", lunar: false, recurring: true, detail: "" });
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!form.title.trim() || !form.event_date) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/people/${personId}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (res.ok) {
        setEvents([json.row as PersonEvent, ...events]);
        setForm({ kind: "birthday", title: "", event_date: "", lunar: false, recurring: true, detail: "" });
      }
    } finally { setSaving(false); }
  }
  async function remove(id: string) {
    if (!confirm("삭제하시겠어요?")) return;
    const res = await fetch(`/api/people/${personId}/events?event_id=${id}`, { method: "DELETE" });
    if (res.ok) setEvents(events.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border-[2px] border-nu-ink p-3">
        <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">+ 이벤트 추가</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
            className="border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white">
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{KIND_ICON[k]} {v}</option>)}
          </select>
          <input placeholder="제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white col-span-2" />
          <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })}
            className="border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white" />
        </div>
        <input placeholder="세부 (선택)" value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })}
          className="w-full border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white mb-2" />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-3 font-mono-nu text-[11px]">
            <label className="flex items-center gap-1"><input type="checkbox" checked={form.lunar} onChange={(e) => setForm({ ...form, lunar: e.target.checked })} /> 음력</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} /> 매년 반복</label>
          </div>
          <button onClick={add} disabled={saving}
            className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 bg-nu-ink text-nu-paper disabled:opacity-50">
            {saving ? "저장 중..." : "추가"}
          </button>
        </div>
      </div>
      {events.length === 0 ? <p className="text-sm text-nu-muted px-1">이벤트가 없습니다.</p> : events.map((e) => (
        <div key={e.id} className="bg-white border-[2px] border-nu-ink p-3 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <span className="text-lg">{KIND_ICON[e.kind]}</span>
            <div className="min-w-0">
              <div className="font-head font-extrabold text-nu-ink">{e.title}</div>
              <div className="font-mono-nu text-[11px] text-nu-muted">
                {e.event_date} {e.lunar && "(음)"} {e.recurring && "· 매년"}
              </div>
              {e.detail && <div className="text-sm text-nu-ink/80 mt-1">{e.detail}</div>}
            </div>
          </div>
          <button onClick={() => remove(e.id)} className="p-1 text-nu-muted hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function NotesTab({ personId, notes, setNotes }: { personId: string; notes: PersonNote[]; setNotes: (n: PersonNote[]) => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/people/${personId}/notes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: text.trim() }) });
      const json = await res.json();
      if (res.ok) { setNotes([json.row as PersonNote, ...notes]); setText(""); }
    } finally { setSaving(false); }
  }
  async function remove(id: string) {
    if (!confirm("삭제하시겠어요?")) return;
    const res = await fetch(`/api/people/${personId}/notes?note_id=${id}`, { method: "DELETE" });
    if (res.ok) setNotes(notes.filter((n) => n.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border-[2px] border-nu-ink p-3">
        <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">+ 맥락 메모 추가</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
          placeholder="예: 따님이 아프다고 했음 / ESG 경영에 관심"
          className="w-full border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white" />
        <div className="flex justify-end mt-2">
          <button onClick={add} disabled={saving}
            className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 bg-nu-ink text-nu-paper disabled:opacity-50">
            {saving ? "저장 중..." : "추가"}
          </button>
        </div>
      </div>
      {notes.length === 0 ? <p className="text-sm text-nu-muted px-1">메모가 없습니다.</p> : notes.map((n) => (
        <div key={n.id} className="bg-white border-[2px] border-nu-ink p-3 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-nu-ink whitespace-pre-wrap">{n.note}</p>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-1">
              {n.created_at.slice(0, 10)} · {n.extracted_from || "manual"}
            </div>
          </div>
          <button onClick={() => remove(n.id)} className="p-1 text-nu-muted hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function EditPersonModal({ person, onClose, onSaved }: { person: Person; onClose: () => void; onSaved: (p: Person) => void }) {
  const [f, setF] = useState({
    display_name: person.display_name,
    role_hint: person.role_hint || "",
    company: person.company || "",
    phone: person.phone || "",
    email: person.email || "",
    kakao_id: person.kakao_id || "",
    relationship: person.relationship || "biz",
    importance: person.importance,
    notes: person.notes || "",
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/people/${person.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const json = await res.json();
      if (res.ok) onSaved(json.row as Person);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={save}
        className="bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] p-5 w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-head text-xl font-extrabold">인맥 편집</h2>
          <button type="button" onClick={onClose} className="p-1"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {([
            ["display_name", "이름 *"], ["role_hint", "역할"], ["company", "회사"],
            ["phone", "전화"], ["email", "이메일"], ["kakao_id", "카카오 ID"],
          ] as const).map(([k, label]) => (
            <label key={k} className="block">
              <span className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">{label}</span>
              <input value={(f as any)[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}
                className="w-full border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white" />
            </label>
          ))}
          <label className="block">
            <span className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">관계</span>
            <select value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })}
              className="w-full border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white">
              {["biz","family","friend","crew","partner"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">중요도</span>
            <input type="number" min={1} max={5} value={f.importance} onChange={(e) => setF({ ...f, importance: Number(e.target.value) || 3 })}
              className="w-full border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white" />
          </label>
        </div>
        <label className="block mt-2">
          <span className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">메모</span>
          <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3}
            className="w-full border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white" />
        </label>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose}
            className="flex-1 border-[2px] border-nu-ink px-4 py-2.5 font-mono-nu text-[12px] uppercase tracking-widest">취소</button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-nu-pink text-nu-paper px-4 py-2.5 font-mono-nu text-[12px] uppercase tracking-widest flex items-center justify-center gap-1.5">
            <Save size={12} /> {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
