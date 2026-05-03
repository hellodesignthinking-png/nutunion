"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Database, Plus, Trash2, Save, Loader2, X, Edit3, Type, Hash,
  Calendar, DollarSign, Percent, List, Link2,
} from "lucide-react";
import { toast } from "sonner";

type FieldType = "text" | "number" | "currency" | "percent" | "date" | "select" | "multi_select" | "url" | "user";

interface FieldDef {
  id: string;
  key: string;
  label: string;
  field_type: FieldType;
  options: Array<string | { value: string; label?: string }>;
  position: number;
  is_required: boolean;
}

interface FieldValue {
  id: string;
  field_def_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_json: unknown;
}

const TYPE_ICON: Record<FieldType, typeof Type> = {
  text: Type, number: Hash, currency: DollarSign, percent: Percent,
  date: Calendar, select: List, multi_select: List, url: Link2, user: Type,
};

const TYPE_LABEL: Record<FieldType, string> = {
  text: "텍스트", number: "숫자", currency: "금액", percent: "퍼센트",
  date: "날짜", select: "선택", multi_select: "다중 선택", url: "URL", user: "사용자",
};

const TEMPLATES: Array<{ name: string; fields: Array<Omit<FieldDef, "id" | "position">> }> = [
  {
    name: "LH 매입임대",
    fields: [
      { key: "land_area_sqm", label: "대지면적(㎡)", field_type: "number", options: [], is_required: false },
      { key: "floor_area_sqm", label: "연면적(㎡)", field_type: "number", options: [], is_required: false },
      { key: "purchase_price", label: "매입가", field_type: "currency", options: [], is_required: false },
      { key: "construction_cost", label: "예상 공사비", field_type: "currency", options: [], is_required: false },
      { key: "expected_yield", label: "예상 수익률", field_type: "percent", options: [], is_required: false },
      { key: "zoning", label: "용도지역", field_type: "select", options: ["주거", "상업", "준주거", "준공업"], is_required: false },
    ],
  },
  {
    name: "웹/앱 개발",
    fields: [
      { key: "github_url", label: "GitHub", field_type: "url", options: [], is_required: false },
      { key: "deploy_url", label: "배포 URL", field_type: "url", options: [], is_required: false },
      { key: "tech_stack", label: "기술 스택", field_type: "multi_select", options: ["Next.js", "React", "Node.js", "TypeScript", "Supabase", "Vercel"], is_required: false },
      { key: "qa_status", label: "QA 상태", field_type: "select", options: ["미시작", "진행", "통과", "재테스트"], is_required: false },
    ],
  },
];

interface Props { projectId: string; canEdit: boolean; }

export function ProjectCustomFields({ projectId, canEdit }: Props) {
  const [defs, setDefs] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<FieldValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingValues, setEditingValues] = useState<Record<string, FieldValue>>({});
  const [editingDef, setEditingDef] = useState(false);
  const [newDef, setNewDef] = useState<{ key: string; label: string; field_type: FieldType; options: string }>({
    key: "", label: "", field_type: "text", options: "",
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/fields`);
      const j = await r.json();
      setDefs(j.defs ?? []);
      setValues(j.values ?? []);
      const map: Record<string, FieldValue> = {};
      for (const v of (j.values ?? []) as FieldValue[]) map[v.field_def_id] = v;
      setEditingValues(map);
    } catch {} finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  async function applyTemplate(t: typeof TEMPLATES[number]) {
    setBusy(true);
    try {
      for (let i = 0; i < t.fields.length; i++) {
        const f = t.fields[i];
        await fetch(`/api/projects/${projectId}/fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...f, position: defs.length + i }),
        });
      }
      await load();
      toast.success(`${t.name} 템플릿 적용 — ${t.fields.length}개 필드 추가`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally { setBusy(false); }
  }

  async function addDef() {
    if (!newDef.key.trim() || !newDef.label.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newDef.key,
          label: newDef.label,
          field_type: newDef.field_type,
          options: newDef.options ? newDef.options.split(",").map((s) => s.trim()).filter(Boolean) : [],
          position: defs.length,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "실패");
      setDefs((p) => [...p, j.def]);
      setNewDef({ key: "", label: "", field_type: "text", options: "" });
      toast.success("필드 추가");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally { setBusy(false); }
  }

  async function removeDef(id: string) {
    if (!window.confirm("이 필드를 삭제할까요? 모든 값도 함께 삭제됩니다.")) return;
    setDefs((p) => p.filter((d) => d.id !== id));
    await fetch(`/api/projects/fields/${id}`, { method: "DELETE" }).catch(() => undefined);
  }

  async function saveValues() {
    setBusy(true);
    try {
      const payload = Object.values(editingValues).map((v) => ({
        field_def_id: v.field_def_id,
        value_text: v.value_text,
        value_number: v.value_number,
        value_date: v.value_date,
        value_json: v.value_json,
      }));
      const r = await fetch(`/api/projects/${projectId}/fields`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payload }),
      });
      if (!r.ok) throw new Error("저장 실패");
      toast.success("저장됨");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally { setBusy(false); }
  }

  function setVal(defId: string, patch: Partial<FieldValue>) {
    setEditingValues((prev) => ({
      ...prev,
      [defId]: { ...(prev[defId] || { id: "", field_def_id: defId, value_text: null, value_number: null, value_date: null, value_json: null }), ...patch },
    }));
  }

  if (loading) {
    return <div className="text-[12px] text-nu-muted flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> 필드 로드 중…</div>;
  }

  return (
    <section className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Database size={14} className="text-nu-pink" />
          <h3 className="font-head text-base font-extrabold text-nu-ink">커스텀 필드</h3>
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{defs.length}개</span>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <button onClick={() => setEditingDef(!editingDef)} className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border-[2px] border-nu-ink/15 hover:border-nu-ink/40 inline-flex items-center gap-1">
              <Edit3 size={10} /> {editingDef ? "닫기" : "필드 관리"}
            </button>
          </div>
        )}
      </div>

      {/* 정의 편집 모드 */}
      {editingDef && canEdit && (
        <div className="bg-nu-cream/40 border-2 border-nu-ink/15 p-3 mb-3 space-y-2">
          {defs.length === 0 && (
            <>
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">템플릿으로 빠른 시작</div>
              <div className="flex gap-1 flex-wrap">
                {TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => applyTemplate(t)} disabled={busy}
                    className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-pink text-nu-pink hover:bg-nu-pink hover:text-nu-paper disabled:opacity-50">
                    {t.name} · {t.fields.length}개
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted pt-1">새 필드</div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="key — 예: 'purchase_price'"
              value={newDef.key} onChange={(e) => setNewDef((p) => ({ ...p, key: e.target.value }))}
              maxLength={40}
              className="px-2 py-1 text-[11px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none" />
            <input placeholder="label — 예: '매입가'"
              value={newDef.label} onChange={(e) => setNewDef((p) => ({ ...p, label: e.target.value }))}
              maxLength={60}
              className="px-2 py-1 text-[11px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={newDef.field_type} onChange={(e) => setNewDef((p) => ({ ...p, field_type: e.target.value as FieldType }))}
              className="px-2 py-1 text-[11px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none">
              {(Object.keys(TYPE_LABEL) as FieldType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            {(newDef.field_type === "select" || newDef.field_type === "multi_select") && (
              <input placeholder="옵션 — 쉼표 구분"
                value={newDef.options} onChange={(e) => setNewDef((p) => ({ ...p, options: e.target.value }))}
                className="px-2 py-1 text-[11px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none" />
            )}
          </div>
          <button onClick={addDef} disabled={busy || !newDef.key.trim() || !newDef.label.trim()}
            className="w-full font-mono-nu text-[10px] uppercase px-2 py-1 bg-nu-ink text-nu-paper disabled:opacity-40 inline-flex items-center justify-center gap-1">
            <Plus size={10} /> 필드 추가
          </button>

          {defs.length > 0 && (
            <ul className="space-y-1 list-none p-0 m-0 pt-2 border-t border-nu-ink/10">
              {defs.map((d) => {
                const Icon = TYPE_ICON[d.field_type];
                return (
                  <li key={d.id} className="flex items-center gap-2 bg-white border border-nu-ink/10 px-2 py-1">
                    <Icon size={11} className="text-nu-muted" />
                    <span className="text-[12px] text-nu-ink flex-1">{d.label}</span>
                    <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">{TYPE_LABEL[d.field_type]}</span>
                    <button onClick={() => removeDef(d.id)} className="p-1 text-nu-muted hover:text-red-600"><Trash2 size={10} /></button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* 값 편집 그리드 */}
      {defs.length === 0 ? (
        <div className="text-[12px] text-nu-muted italic py-2">정의된 필드 없음 — {canEdit && "관리 버튼으로 추가하세요"}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {defs.map((d) => {
              const Icon = TYPE_ICON[d.field_type];
              const v = editingValues[d.id];
              return (
                <div key={d.id} className="bg-white border border-nu-ink/10 px-2.5 py-1.5">
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-0.5 flex items-center gap-1">
                    <Icon size={9} /> {d.label}
                  </div>
                  {!canEdit ? (
                    <div className="text-[12px] text-nu-graphite">{renderValue(d, v) || <span className="text-nu-muted/60 italic">—</span>}</div>
                  ) : (
                    <FieldInput def={d} value={v} onChange={(patch) => setVal(d.id, patch)} />
                  )}
                </div>
              );
            })}
          </div>
          {canEdit && (
            <button onClick={saveValues} disabled={busy}
              className="mt-3 w-full font-mono-nu text-[10px] uppercase px-2 py-1 bg-nu-ink text-nu-paper disabled:opacity-40 inline-flex items-center justify-center gap-1">
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} 값 저장
            </button>
          )}
        </>
      )}
    </section>
  );
}

function FieldInput({ def, value, onChange }: { def: FieldDef; value?: FieldValue; onChange: (p: Partial<FieldValue>) => void }) {
  const cls = "w-full px-2 py-1 text-[12px] border border-nu-ink/15 focus:border-nu-pink outline-none";
  if (def.field_type === "text" || def.field_type === "url") {
    return <input type={def.field_type === "url" ? "url" : "text"} className={cls}
      value={value?.value_text || ""} onChange={(e) => onChange({ value_text: e.target.value })} />;
  }
  if (def.field_type === "number" || def.field_type === "currency" || def.field_type === "percent") {
    return <input type="number" className={cls}
      value={value?.value_number ?? ""} onChange={(e) => onChange({ value_number: e.target.value === "" ? null : Number(e.target.value) })} />;
  }
  if (def.field_type === "date") {
    return <input type="date" className={cls}
      value={value?.value_date || ""} onChange={(e) => onChange({ value_date: e.target.value || null })} />;
  }
  if (def.field_type === "select") {
    const opts = (def.options as string[]).map((o) => typeof o === "string" ? o : o);
    return (
      <select className={cls} value={value?.value_text || ""} onChange={(e) => onChange({ value_text: e.target.value || null })}>
        <option value="">—</option>
        {opts.map((o, i) => <option key={i} value={typeof o === "string" ? o : (o as { value: string }).value}>{typeof o === "string" ? o : ((o as { label?: string }).label || (o as { value: string }).value)}</option>)}
      </select>
    );
  }
  if (def.field_type === "multi_select") {
    const opts = def.options as string[];
    const selected = (value?.value_json as string[]) || [];
    return (
      <div className="flex flex-wrap gap-1">
        {opts.map((o, i) => {
          const s = typeof o === "string" ? o : (o as { value: string }).value;
          const active = selected.includes(s);
          return (
            <button key={i} type="button"
              onClick={() => onChange({ value_json: active ? selected.filter((x) => x !== s) : [...selected, s] })}
              className={`font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 border ${active ? "bg-nu-pink/20 border-nu-pink text-nu-pink" : "border-nu-ink/15 text-nu-muted"}`}>
              {s}
            </button>
          );
        })}
      </div>
    );
  }
  return <input className={cls} value={value?.value_text || ""} onChange={(e) => onChange({ value_text: e.target.value })} />;
}

function renderValue(def: FieldDef, v?: FieldValue): string {
  if (!v) return "";
  if (def.field_type === "currency" && v.value_number != null) return `₩${v.value_number.toLocaleString()}`;
  if (def.field_type === "percent" && v.value_number != null) return `${v.value_number}%`;
  if (def.field_type === "number" && v.value_number != null) return v.value_number.toLocaleString();
  if (def.field_type === "date" && v.value_date) return new Date(v.value_date).toLocaleDateString("ko");
  if (def.field_type === "url" && v.value_text) return v.value_text;
  if (def.field_type === "multi_select" && Array.isArray(v.value_json)) return (v.value_json as string[]).join(", ");
  return v.value_text || "";
}
