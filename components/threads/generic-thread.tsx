"use client";
/**
 * GenericThread — runtime renderer for user-created Threads.
 *
 * Reads a JSON spec (fields[], views[], actions[]) and renders inputs, list/table/kanban/calendar/chart/gallery
 * views, plus thread_data CRUD via /api/threads/data.
 *
 * Used for builder_mode='no-code' or 'ai-assist' Threads where ui_component='__generic__'.
 */
import { useEffect, useMemo, useState } from "react";
import type { ThreadInstallation } from "@/lib/threads/registry";
import {
  listThreadData,
  createThreadData,
  updateThreadData,
  deleteThreadData,
  type ThreadDataRow,
} from "@/lib/threads/data-client";

export type FieldType =
  | "text" | "longtext" | "number" | "date" | "datetime" | "checkbox"
  | "select" | "multiselect" | "tags" | "person" | "url" | "location"
  | "file" | "currency";

export type ViewKind = "list" | "table" | "calendar" | "kanban" | "chart" | "gallery";
export type ActionKind = "add" | "edit" | "delete" | "export" | "notify";

export interface FieldSpec {
  key: string;
  type: FieldType;
  label: string;
  required?: boolean;
  options?: string[];
}
export interface ViewSpec {
  kind: ViewKind;
  primary_field?: string;
  group_by?: string;
}
export interface ActionSpec { kind: ActionKind; label: string }
export interface ThreadSpec {
  title?: string;
  description?: string;
  fields: FieldSpec[];
  views: ViewSpec[];
  actions: ActionSpec[];
}

interface Props {
  installation?: ThreadInstallation | null;
  spec: ThreadSpec;
  /** When true, all CRUD operations stay in local state (no DB writes). */
  ephemeral?: boolean;
}

const BTN = "border-[3px] border-nu-ink font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1.5 shadow-[3px_3px_0_0_#0D0F14] disabled:opacity-50";

export function GenericThread({ installation, spec, ephemeral = false }: Props) {
  const [rows, setRows] = useState<ThreadDataRow[]>([]);
  const [loading, setLoading] = useState(!ephemeral);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const view = spec.views[activeView] || spec.views[0];
  const fields = spec.fields || [];
  const allowAdd = (spec.actions || []).some((a) => a.kind === "add");
  const allowEdit = (spec.actions || []).some((a) => a.kind === "edit");
  const allowDelete = (spec.actions || []).some((a) => a.kind === "delete");
  const allowExport = (spec.actions || []).some((a) => a.kind === "export");

  useEffect(() => {
    if (ephemeral || !installation) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await listThreadData(installation.id, { limit: 200 });
        if (alive) { setRows(data); setError(null); }
      } catch (e: any) {
        if (alive) setError(e.message || "load_failed");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [installation, ephemeral]);

  const resetForm = () => {
    const next: Record<string, any> = {};
    fields.forEach((f) => {
      next[f.key] = f.type === "checkbox" ? false : f.type === "tags" || f.type === "multiselect" ? [] : "";
    });
    setForm(next);
  };

  const openAdd = () => { resetForm(); setEditId(null); setShowAdd(true); };
  const openEdit = (row: ThreadDataRow) => {
    setEditId(row.id);
    setForm({ ...row.data });
    setShowAdd(true);
  };

  const submit = async () => {
    // Required validation
    for (const f of fields) {
      if (f.required && (form[f.key] === undefined || form[f.key] === "" || form[f.key] === null)) {
        setError(`${f.label} 은(는) 필수입니다`);
        return;
      }
    }
    setError(null);
    if (ephemeral) {
      if (editId) {
        setRows((prev) => prev.map((r) => r.id === editId ? { ...r, data: { ...form } } : r));
      } else {
        const id = `local-${Date.now()}`;
        setRows((prev) => [{ id, installation_id: "local", data: { ...form }, created_by: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any, ...prev]);
      }
      setShowAdd(false);
      return;
    }
    if (!installation) return;
    try {
      if (editId) {
        const updated = await updateThreadData(editId, { ...form });
        setRows((prev) => prev.map((r) => r.id === editId ? updated : r));
      } else {
        const created = await createThreadData(installation.id, { ...form });
        setRows((prev) => [created, ...prev]);
      }
      setShowAdd(false);
    } catch (e: any) {
      setError(e.message || "save_failed");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("삭제할까요?")) return;
    if (ephemeral) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      return;
    }
    try {
      await deleteThreadData(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setError(e.message || "delete_failed");
    }
  };

  const exportCsv = () => {
    const headers = fields.map((f) => f.label);
    const lines = [headers.join(",")];
    rows.forEach((r) => {
      const cells = fields.map((f) => {
        const v = r.data?.[f.key];
        if (Array.isArray(v)) return `"${v.join("|")}"`;
        if (v == null) return "";
        return `"${String(v).replace(/"/g, '""')}"`;
      });
      lines.push(cells.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${spec.title || "thread"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border-[3px] border-nu-ink bg-white p-4 shadow-[4px_4px_0_0_#0D0F14] space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          {spec.title && <h3 className="font-head text-lg font-extrabold text-nu-ink">{spec.title}</h3>}
          {spec.description && <p className="text-xs font-mono text-nu-muted">{spec.description}</p>}
        </div>
        <div className="flex gap-2">
          {allowExport && rows.length > 0 && (
            <button onClick={exportCsv} className={`${BTN} bg-white`}>↓ CSV</button>
          )}
          {allowAdd && (
            <button onClick={openAdd} className={`${BTN} bg-nu-pink text-white`}>+ 추가</button>
          )}
        </div>
      </div>

      {/* View tabs */}
      {spec.views.length > 1 && (
        <div className="flex gap-1 border-b-[2px] border-nu-ink/20">
          {spec.views.map((v, i) => (
            <button
              key={`${v.kind}-${i}`}
              onClick={() => setActiveView(i)}
              className={`px-3 py-1.5 text-[11px] font-mono-nu uppercase tracking-widest font-bold border-[2px] border-b-0 ${i === activeView ? "border-nu-ink bg-nu-cream" : "border-transparent text-nu-muted"}`}
            >
              {v.kind}
            </button>
          ))}
        </div>
      )}

      {error && <div className="text-xs text-red-700 font-mono border-[2px] border-red-700 p-2 bg-red-50">{error}</div>}
      {loading ? (
        <div className="text-xs font-mono text-nu-muted">불러오는 중...</div>
      ) : rows.length === 0 ? (
        <div className="text-xs font-mono text-nu-muted py-8 text-center">아직 데이터가 없어요. {allowAdd && "[+ 추가] 를 눌러 시작하세요."}</div>
      ) : (
        <ViewRenderer view={view} fields={fields} rows={rows} onEdit={allowEdit ? openEdit : undefined} onDelete={allowDelete ? remove : undefined} />
      )}

      {/* Add / Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-nu-ink/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-head text-base font-extrabold mb-3">{editId ? "수정" : "추가"}</h4>
            <div className="space-y-3">
              {fields.map((f) => (
                <FieldInput key={f.key} field={f} value={form[f.key]} onChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))} />
              ))}
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowAdd(false)} className={`${BTN} bg-white`}>취소</button>
              <button onClick={submit} className={`${BTN} bg-nu-pink text-white`}>{editId ? "수정" : "저장"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────── Field Input ─────────────────────────────────
function FieldInput({ field, value, onChange }: { field: FieldSpec; value: any; onChange: (v: any) => void }) {
  const baseInput = "w-full border-[2px] border-nu-ink px-2 py-1.5 text-sm font-mono bg-white";
  const label = (
    <label className="block text-[11px] font-mono-nu uppercase tracking-widest font-bold text-nu-ink mb-1">
      {field.label} {field.required && <span className="text-nu-pink">*</span>}
    </label>
  );
  switch (field.type) {
    case "longtext":
      return (<div>{label}<textarea value={value || ""} onChange={(e) => onChange(e.target.value)} className={baseInput} rows={3} /></div>);
    case "number":
    case "currency":
      return (<div>{label}<input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className={baseInput} /></div>);
    case "date":
      return (<div>{label}<input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} className={baseInput} /></div>);
    case "datetime":
      return (<div>{label}<input type="datetime-local" value={value || ""} onChange={(e) => onChange(e.target.value)} className={baseInput} /></div>);
    case "checkbox":
      return (<div className="flex items-center gap-2"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /><span className="text-sm font-mono">{field.label}</span></div>);
    case "select":
      return (
        <div>{label}
          <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={baseInput}>
            <option value="">— 선택 —</option>
            {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    case "multiselect":
      return (
        <div>{label}
          <div className="flex flex-wrap gap-1">
            {(field.options || []).map((o) => {
              const arr: string[] = Array.isArray(value) ? value : [];
              const on = arr.includes(o);
              return (
                <button key={o} type="button" onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
                  className={`border-[2px] border-nu-ink px-2 py-1 text-xs font-mono ${on ? "bg-nu-pink text-white" : "bg-white"}`}>
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      );
    case "tags": {
      const arr: string[] = Array.isArray(value) ? value : [];
      return (
        <div>{label}
          <div className="flex flex-wrap gap-1 mb-1">
            {arr.map((t, i) => (
              <span key={`${t}-${i}`} className="border-[2px] border-nu-ink px-2 py-0.5 text-xs font-mono bg-nu-cream">
                {t} <button onClick={() => onChange(arr.filter((_, j) => j !== i))} className="text-nu-pink">×</button>
              </span>
            ))}
          </div>
          <input className={baseInput} placeholder="태그 입력 후 Enter" onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const v = (e.target as HTMLInputElement).value.trim();
              if (v && !arr.includes(v)) onChange([...arr, v]);
              (e.target as HTMLInputElement).value = "";
            }
          }} />
        </div>
      );
    }
    case "url":
      return (<div>{label}<input type="url" value={value || ""} onChange={(e) => onChange(e.target.value)} className={baseInput} placeholder="https://…" /></div>);
    case "location":
      return (<div>{label}<input value={value || ""} onChange={(e) => onChange(e.target.value)} className={baseInput} placeholder="위치 / 주소" /></div>);
    case "person":
      return (<div>{label}<input value={value || ""} onChange={(e) => onChange(e.target.value)} className={baseInput} placeholder="담당자명" /></div>);
    case "file":
      return (<div>{label}<input value={value || ""} onChange={(e) => onChange(e.target.value)} className={baseInput} placeholder="파일 URL (베타)" /></div>);
    case "text":
    default:
      return (<div>{label}<input value={value || ""} onChange={(e) => onChange(e.target.value)} className={baseInput} /></div>);
  }
}

// ────────────────────────────── View Renderer ───────────────────────────────
function ViewRenderer({ view, fields, rows, onEdit, onDelete }: {
  view: ViewSpec; fields: FieldSpec[]; rows: ThreadDataRow[];
  onEdit?: (r: ThreadDataRow) => void; onDelete?: (id: string) => void;
}) {
  const primary = view.primary_field || fields[0]?.key;

  if (view.kind === "table") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="bg-nu-cream/50">
              {fields.map((f) => <th key={f.key} className="border-[2px] border-nu-ink px-2 py-1 text-left">{f.label}</th>)}
              {(onEdit || onDelete) && <th className="border-[2px] border-nu-ink px-2 py-1 w-20"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {fields.map((f) => <td key={f.key} className="border-[2px] border-nu-ink px-2 py-1">{formatCell(r.data?.[f.key])}</td>)}
                {(onEdit || onDelete) && (
                  <td className="border-[2px] border-nu-ink px-1 py-1 text-right whitespace-nowrap">
                    {onEdit && <button onClick={() => onEdit(r)} className="text-nu-pink mr-2">편집</button>}
                    {onDelete && <button onClick={() => onDelete(r.id)} className="text-red-700">삭제</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (view.kind === "kanban" && view.group_by) {
    const groups: Record<string, ThreadDataRow[]> = {};
    rows.forEach((r) => {
      const k = String(r.data?.[view.group_by!] ?? "—");
      (groups[k] ||= []).push(r);
    });
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Object.entries(groups).map(([col, items]) => (
          <div key={col} className="min-w-[200px] border-[2px] border-nu-ink bg-nu-cream/30 p-2">
            <div className="font-mono-nu text-[11px] uppercase tracking-widest font-bold mb-2">{col} ({items.length})</div>
            <div className="space-y-2">
              {items.map((r) => (
                <div key={r.id} className="border-[2px] border-nu-ink bg-white p-2 text-xs font-mono">
                  <div className="font-bold">{formatCell(r.data?.[primary || ""])}</div>
                  {(onEdit || onDelete) && (
                    <div className="mt-1 flex gap-2 text-[10px]">
                      {onEdit && <button onClick={() => onEdit(r)} className="text-nu-pink">편집</button>}
                      {onDelete && <button onClick={() => onDelete(r.id)} className="text-red-700">삭제</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (view.kind === "calendar") {
    const dateField = fields.find((f) => f.type === "date" || f.type === "datetime");
    if (!dateField) return <div className="text-xs font-mono text-nu-muted">캘린더 뷰는 날짜 필드가 필요해요.</div>;
    const byDate: Record<string, ThreadDataRow[]> = {};
    rows.forEach((r) => {
      const d = String(r.data?.[dateField.key] || "").slice(0, 10);
      if (d) (byDate[d] ||= []).push(r);
    });
    const sorted = Object.keys(byDate).sort();
    return (
      <div className="space-y-2">
        {sorted.map((d) => (
          <div key={d} className="border-[2px] border-nu-ink p-2">
            <div className="font-mono-nu text-[11px] uppercase tracking-widest font-bold mb-1">{d}</div>
            {byDate[d].map((r) => (
              <div key={r.id} className="text-xs font-mono flex justify-between items-center py-0.5">
                <span>{formatCell(r.data?.[primary || ""])}</span>
                <span>
                  {onEdit && <button onClick={() => onEdit(r)} className="text-nu-pink mr-2">편집</button>}
                  {onDelete && <button onClick={() => onDelete(r.id)} className="text-red-700">삭제</button>}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (view.kind === "chart") {
    const numField = fields.find((f) => f.type === "number" || f.type === "currency");
    if (!numField) return <div className="text-xs font-mono text-nu-muted">차트 뷰는 숫자 필드가 필요해요.</div>;
    const data = rows.map((r) => Number(r.data?.[numField.key] || 0));
    const max = Math.max(...data, 1);
    const w = 400; const h = 120;
    const points = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * w},${h - (v / max) * h}`).join(" ");
    return (
      <div className="border-[2px] border-nu-ink p-3 bg-nu-cream/20">
        <div className="text-[11px] font-mono-nu uppercase tracking-widest font-bold mb-2">{numField.label}</div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32"><polyline fill="none" stroke="#E91E63" strokeWidth="2" points={points} /></svg>
      </div>
    );
  }

  if (view.kind === "gallery") {
    const imgField = fields.find((f) => f.type === "file" || f.type === "url");
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {rows.map((r) => {
          const src = imgField ? r.data?.[imgField.key] : null;
          return (
            <div key={r.id} className="border-[2px] border-nu-ink bg-white">
              <div className="aspect-square bg-nu-cream/40 flex items-center justify-center text-xs font-mono">
                {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : "—"}
              </div>
              <div className="p-1.5 text-xs font-mono truncate">{formatCell(r.data?.[primary || ""])}</div>
              {(onEdit || onDelete) && (
                <div className="px-1.5 pb-1 flex gap-2 text-[10px]">
                  {onEdit && <button onClick={() => onEdit(r)} className="text-nu-pink">편집</button>}
                  {onDelete && <button onClick={() => onDelete(r.id)} className="text-red-700">삭제</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Default: list
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="border-[2px] border-nu-ink bg-white p-2">
          <div className="flex justify-between gap-2 items-start">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-mono font-bold truncate">{formatCell(r.data?.[primary || ""]) || "(이름 없음)"}</div>
              <div className="text-xs font-mono text-nu-muted truncate">
                {fields.filter((f) => f.key !== primary).slice(0, 3).map((f) => `${f.label}: ${formatCell(r.data?.[f.key])}`).join(" · ")}
              </div>
            </div>
            <div className="text-[10px] font-mono whitespace-nowrap">
              {onEdit && <button onClick={() => onEdit(r)} className="text-nu-pink mr-2">편집</button>}
              {onDelete && <button onClick={() => onDelete(r.id)} className="text-red-700">삭제</button>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatCell(v: any): string {
  if (v == null || v === "") return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "✓" : "";
  return String(v);
}
