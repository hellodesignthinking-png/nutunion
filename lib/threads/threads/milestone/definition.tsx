"use client";
import { useEffect, useState } from "react";
import { registry, type ThreadProps } from "@/lib/threads/registry";
import {
  listThreadData,
  createThreadData,
  updateThreadData,
  deleteThreadData,
  type ThreadDataRow,
} from "@/lib/threads/data-client";

interface Milestone {
  title: string;
  description?: string;
  sort_order?: number;
  target_date?: string | null;
  status: "pending" | "in_progress" | "completed";
  completed_at?: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "border-nu-ink/40 bg-nu-cream/40 text-nu-ink",
  in_progress: "border-amber-500 bg-amber-50 text-amber-900",
  completed: "border-green-600 bg-green-50 text-green-900",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "대기", in_progress: "진행중", completed: "완료",
};

function MilestoneComponent({ installation, canEdit, currentUserId }: ThreadProps) {
  const [rows, setRows] = useState<ThreadDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listThreadData(installation.id, { limit: 100 });
      setRows(data); setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [installation.id]);

  const sorted = [...rows].sort((a, b) => {
    const ao = (a.data as Milestone).sort_order ?? 0;
    const bo = (b.data as Milestone).sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const total = sorted.length;
  const completed = sorted.filter((r) => (r.data as Milestone).status === "completed").length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await createThreadData(installation.id, {
        title: title.trim(),
        description: description.trim(),
        target_date: targetDate || null,
        status: "pending",
        sort_order: sorted.length,
      } satisfies Milestone);
      setTitle(""); setDescription(""); setTargetDate(""); setShowForm(false);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const setStatus = async (row: ThreadDataRow, status: Milestone["status"]) => {
    const data = row.data as Milestone;
    try {
      await updateThreadData(row.id, {
        ...data,
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      });
      await load();
    } catch (e: any) { setError(e.message); }
  };

  const moveUp = async (idx: number) => {
    if (idx <= 0) return;
    const a = sorted[idx], b = sorted[idx - 1];
    try {
      await updateThreadData(a.id, { ...(a.data as Milestone), sort_order: idx - 1 });
      await updateThreadData(b.id, { ...(b.data as Milestone), sort_order: idx });
      await load();
    } catch (e: any) { setError(e.message); }
  };

  const remove = async (id: string) => {
    if (!confirm("삭제할까요?")) return;
    try { await deleteThreadData(id); await load(); } catch (e: any) { setError(e.message); }
  };

  return (
    <div className="border-[3px] border-nu-ink p-4 bg-white shadow-[4px_4px_0_0_#0D0F14] space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-head text-lg font-extrabold text-nu-ink">🎯 마일스톤</h3>
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{completed}/{total}</span>
      </div>

      <div className="h-2 border-[2px] border-nu-ink bg-white">
        <div className="h-full bg-nu-pink" style={{ width: `${pct}%` }} />
      </div>

      {error && <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-[11px] font-mono">{error}</div>}

      {canEdit && (
        <div>
          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              className="border-[2px] border-nu-ink bg-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#0D0F14] transition">
              + 마일스톤 추가
            </button>
          ) : (
            <form onSubmit={submit} className="space-y-2 border-[2px] border-nu-ink/30 p-3 bg-nu-cream/30">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목"
                className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="설명" rows={2}
                className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                className="border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="font-mono-nu text-[11px] text-nu-muted">취소</button>
                <button disabled={submitting} className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14] disabled:opacity-50">
                  {submitting ? "..." : "추가"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-[11px] font-mono text-nu-muted">로딩...</div>
      ) : sorted.length === 0 ? (
        <div className="text-[11px] font-mono text-nu-muted">아직 마일스톤이 없어요.</div>
      ) : (
        <ol className="space-y-2 relative">
          {sorted.map((row, idx) => {
            const m = row.data as Milestone;
            const isOverdue = m.target_date && m.status !== "completed" && new Date(m.target_date).getTime() < Date.now();
            return (
              <li key={row.id} className={`border-[2px] p-2 ${STATUS_STYLE[m.status] || STATUS_STYLE.pending}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-sm font-bold">
                      {idx + 1}. {m.title}
                      {isOverdue && <span className="ml-2 text-red-600">⏰</span>}
                    </div>
                    {m.description && <div className="text-[12px] mt-0.5 opacity-80">{m.description}</div>}
                    <div className="text-[10px] font-mono mt-1 opacity-70">
                      {m.target_date && `목표: ${m.target_date}`}
                      {m.completed_at && ` · 완료: ${new Date(m.completed_at).toLocaleDateString("ko-KR")}`}
                    </div>
                  </div>
                  <span className="font-mono-nu text-[10px] uppercase tracking-widest border-[1.5px] border-current px-1.5 py-0.5">
                    {STATUS_LABEL[m.status]}
                  </span>
                </div>
                {canEdit && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {m.status !== "pending" && <button onClick={() => setStatus(row, "pending")} className="text-[10px] font-mono border border-current px-1.5 py-0.5">→ 대기</button>}
                    {m.status !== "in_progress" && <button onClick={() => setStatus(row, "in_progress")} className="text-[10px] font-mono border border-current px-1.5 py-0.5">→ 진행</button>}
                    {m.status !== "completed" && <button onClick={() => setStatus(row, "completed")} className="text-[10px] font-mono border border-current px-1.5 py-0.5">→ 완료</button>}
                    <button onClick={() => moveUp(idx)} disabled={idx === 0} className="text-[10px] font-mono border border-current px-1.5 py-0.5 disabled:opacity-30">↑</button>
                    {row.created_by === currentUserId && (
                      <button onClick={() => remove(row.id)} className="text-[10px] font-mono text-nu-muted hover:text-nu-pink ml-auto">삭제</button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

registry.register({
  slug: "milestone",
  name: "🎯 마일스톤",
  description: "볼트 마일스톤 타임라인. 진행 상태/목표일.",
  icon: "🎯",
  category: "project",
  scope: ["bolt"],
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      sort_order: { type: "integer", default: 0 },
      target_date: { type: ["string", "null"], format: "date" },
      status: { type: "string", enum: ["pending", "in_progress", "completed"] },
      completed_at: { type: ["string", "null"], format: "date-time" },
    },
    required: ["title"],
  },
  Component: MilestoneComponent,
  isCore: true,
  version: "1.0.0",
});
