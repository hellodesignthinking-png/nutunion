"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Star, X } from "lucide-react";

type Person = {
  id: string;
  display_name: string;
  role_hint: string | null;
  company: string | null;
  relationship: string | null;
  importance: number;
  avatar_url: string | null;
  last_contact_at: string | null;
};
type NextEvent = { person_id: string; kind: string; title: string; event_date: string; delta_days: number };

const KIND_ICON: Record<string, string> = {
  birthday: "🎂", anniversary: "💍", founding_day: "🏢", memorial: "🕯️", milestone: "⭐", note: "📝",
};

export function PeopleListClient({
  initialPeople, nextEvents,
}: { initialPeople: Person[]; nextEvents: Record<string, NextEvent> }) {
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");

  const filtered = q.trim()
    ? people.filter((p) => p.display_name.toLowerCase().includes(q.toLowerCase()) || (p.company || "").toLowerCase().includes(q.toLowerCase()))
    : people;

  return (
    <>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름·회사 검색"
          className="flex-1 min-w-[200px] border-[2px] border-nu-ink bg-white px-3 py-2 font-mono-nu text-sm"
        />
        <button
          onClick={() => setAdding(true)}
          className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 flex items-center gap-1.5"
        >
          <Plus size={12} /> 인맥 추가
        </button>
      </div>

      {people.length === 0 ? (
        <div className="bg-nu-cream border-[3px] border-nu-ink shadow-[4px_4px_0_0_#0D0F14] p-8 text-center">
          <p className="font-head text-xl font-extrabold mb-1">아직 등록된 인맥이 없어요</p>
          <p className="text-sm text-nu-ink/70 mb-4">첫 번째 인맥을 추가해 보세요.</p>
          <button
            onClick={() => setAdding(true)}
            className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 bg-nu-ink text-nu-paper"
          >+ 인맥 추가</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const ev = nextEvents[p.id];
            return (
              <Link
                key={p.id}
                href={`/people/${p.id}`}
                className="no-underline bg-white border-[3px] border-nu-ink shadow-[4px_4px_0_0_#0D0F14] p-4 hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[5px_5px_0_0_#0D0F14] transition-transform"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 border-[2px] border-nu-ink bg-nu-cream flex items-center justify-center font-head text-xl font-extrabold shrink-0">
                    {p.display_name.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-head text-base font-extrabold text-nu-ink truncate">{p.display_name}</div>
                    <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted truncate">
                      {[p.role_hint, p.company].filter(Boolean).join(" · ") || "-"}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={10} className={i < p.importance ? "fill-amber-400 text-amber-400" : "text-nu-muted/30"} />
                      ))}
                    </div>
                  </div>
                </div>
                {ev && (
                  <div className="mt-3 pt-2 border-t border-nu-ink/10 flex items-center gap-1.5 font-mono-nu text-[11px] text-nu-ink">
                    <span>{KIND_ICON[ev.kind] || "·"}</span>
                    <span className="truncate">{ev.title}</span>
                    <span className="ml-auto px-1.5 bg-nu-pink/20 text-nu-ink border border-nu-ink/20">
                      {ev.delta_days === 0 ? "오늘" : `D-${ev.delta_days}`}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {adding && (
        <AddPersonModal
          onClose={() => setAdding(false)}
          onCreated={(p) => { setPeople((prev) => [p, ...prev]); setAdding(false); }}
        />
      )}
    </>
  );
}

function AddPersonModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Person) => void }) {
  const [form, setForm] = useState({
    display_name: "", role_hint: "", company: "", phone: "", email: "", kakao_id: "",
    relationship: "biz", importance: 3, notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.display_name.trim()) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/people", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "failed");
      onCreated(json.row as Person);
    } catch (e: any) { setErr(e?.message || "저장 실패"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] p-5 w-full max-w-lg max-h-[90vh] overflow-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-head text-xl font-extrabold">인맥 추가</h2>
          <button type="button" onClick={onClose} className="p-1"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="이름 *" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
          <Field label="역할(힌트)" value={form.role_hint} onChange={(v) => setForm({ ...form, role_hint: v })} placeholder="이사, 대표, 러닝크루..." />
          <Field label="회사/소속" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
          <Field label="전화" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="이메일" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="카카오 ID" value={form.kakao_id} onChange={(v) => setForm({ ...form, kakao_id: v })} />
          <label className="block">
            <span className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">관계</span>
            <select value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}
              className="w-full border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white">
              <option value="biz">비즈니스</option>
              <option value="family">가족</option>
              <option value="friend">친구</option>
              <option value="crew">크루</option>
              <option value="partner">파트너</option>
            </select>
          </label>
          <label className="block">
            <span className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">중요도 (1~5)</span>
            <input type="number" min={1} max={5} value={form.importance} onChange={(e) => setForm({ ...form, importance: Number(e.target.value) || 3 })}
              className="w-full border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white" />
          </label>
        </div>
        <label className="block mt-2">
          <span className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">메모</span>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white" rows={3} />
        </label>
        {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose}
            className="flex-1 border-[2px] border-nu-ink px-4 py-2.5 font-mono-nu text-[12px] uppercase tracking-widest">취소</button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-nu-pink text-nu-paper px-4 py-2.5 font-mono-nu text-[12px] uppercase tracking-widest disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border-[2px] border-nu-ink px-2 py-2 font-mono-nu text-sm bg-white" />
    </label>
  );
}
