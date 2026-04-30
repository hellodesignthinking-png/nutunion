"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { registry, type ThreadProps } from "@/lib/threads/registry";
import {
  listThreadData,
  createThreadData,
  updateThreadData,
  deleteThreadData,
  type ThreadDataRow,
} from "@/lib/threads/data-client";
import { uploadFile } from "@/lib/storage/upload-client";

interface BudgetItem {
  item_name: string;
  category?: string;
  amount: number;
  is_planned?: boolean;
  spent_at?: string | null;
  receipt_url?: string | null;
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const PALETTE = ["#E91E63", "#0D0F14", "#C8A97E", "#5E81AC", "#A3BE8C", "#B48EAD", "#D08770", "#88C0D0"];

function BudgetComponent({ installation, canEdit }: ThreadProps) {
  const [rows, setRows] = useState<ThreadDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [isPlanned, setIsPlanned] = useState(true);
  const [spentAt, setSpentAt] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "planned" | "spent">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listThreadData(installation.id, { limit: 500 });
      setRows(data); setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [installation.id]);

  const items = useMemo(() => rows
    .map((r) => ({ row: r, b: r.data as BudgetItem }))
    .filter((x) => x.b?.item_name)
    .sort((a, b) => new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime()),
    [rows]);

  const planned = items.filter((x) => x.b.is_planned !== false && !x.b.spent_at);
  const spent = items.filter((x) => !!x.b.spent_at || x.b.is_planned === false);

  const plannedTotal = planned.reduce((s, x) => s + (x.b.amount || 0), 0);
  const spentTotal = spent.reduce((s, x) => s + (x.b.amount || 0), 0);
  const variance = spentTotal - plannedTotal;
  const maxBar = Math.max(plannedTotal, spentTotal, 1);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((x) => { if (x.b.category) set.add(x.b.category); });
    return Array.from(set);
  }, [items]);

  // Donut: by category, summed (spent only)
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    spent.forEach((x) => {
      const c = x.b.category || "기타";
      map.set(c, (map.get(c) || 0) + (x.b.amount || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [spent]);

  const donutTotal = byCategory.reduce((s, [, v]) => s + v, 0);

  const filtered = filter === "planned" ? planned : filter === "spent" ? spent : items;

  const reset = () => {
    setEditId(null); setName(""); setCategory(""); setAmount(""); setIsPlanned(true);
    setSpentAt(""); setReceiptUrl(""); setShowForm(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;
    setSubmitting(true);
    try {
      const payload: BudgetItem = {
        item_name: name.trim(),
        category: category.trim() || undefined,
        amount: Number(amount),
        is_planned: isPlanned,
        spent_at: spentAt ? new Date(spentAt).toISOString() : null,
        receipt_url: receiptUrl || null,
      };
      if (editId) await updateThreadData(editId, payload);
      else await createThreadData(installation.id, payload);
      reset();
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const edit = (row: ThreadDataRow) => {
    const b = row.data as BudgetItem;
    setEditId(row.id);
    setName(b.item_name || "");
    setCategory(b.category || "");
    setAmount(String(b.amount || ""));
    setIsPlanned(b.is_planned !== false);
    setSpentAt(b.spent_at ? new Date(b.spent_at).toISOString().slice(0, 16) : "");
    setReceiptUrl(b.receipt_url || "");
    setShowForm(true);
  };

  const remove = async (id: string) => {
    if (!confirm("이 항목을 삭제할까요?")) return;
    try { await deleteThreadData(id); await load(); } catch (e: any) { setError(e.message); }
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadFile(file, { prefix: "uploads", scopeId: installation.id });
      setReceiptUrl(res.url);
    } catch (e: any) { setError(`업로드 실패: ${e.message}`); }
    finally { setUploading(false); }
  };

  // Donut SVG (CSS-only segments)
  const R = 50, CX = 60, CY = 60, STROKE = 18;
  const C = 2 * Math.PI * R;
  let acc = 0;

  return (
    <div className="border-[3px] border-nu-ink p-4 bg-white shadow-[4px_4px_0_0_#0D0F14] space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-head text-lg font-extrabold text-nu-ink">💸 예산</h3>
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{items.length} items</span>
      </div>

      {/* Variance bars */}
      <div className="border-[2px] border-nu-ink/20 p-3 bg-nu-cream/30 space-y-2">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">계획 vs 실지출</div>
        <div className="space-y-1">
          <div>
            <div className="flex justify-between text-[11px] font-mono">
              <span>계획</span><span className="tabular-nums">{won(plannedTotal)}</span>
            </div>
            <div className="h-3 border-[2px] border-nu-ink bg-white">
              <div className="h-full bg-nu-ink/40" style={{ width: `${(plannedTotal / maxBar) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] font-mono">
              <span>실지출</span><span className="tabular-nums">{won(spentTotal)}</span>
            </div>
            <div className="h-3 border-[2px] border-nu-ink bg-white">
              <div className="h-full bg-nu-pink" style={{ width: `${(spentTotal / maxBar) * 100}%` }} />
            </div>
          </div>
          <div className={`text-[11px] font-mono ${variance > 0 ? "text-red-600" : "text-green-700"}`}>
            차이 {variance >= 0 ? "+" : ""}{won(variance)}
          </div>
        </div>
      </div>

      {/* Donut */}
      {donutTotal > 0 && (
        <div className="flex items-center gap-3 border-[2px] border-nu-ink/20 p-3">
          <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0">
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#0D0F14" strokeWidth="2" opacity="0.1" />
            {byCategory.map(([cat, v], i) => {
              const pct = v / donutTotal;
              const dash = pct * C;
              const off = -acc * C;
              acc += pct;
              return (
                <circle key={cat} cx={CX} cy={CY} r={R} fill="none"
                  stroke={PALETTE[i % PALETTE.length]} strokeWidth={STROKE}
                  strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={off}
                  transform={`rotate(-90 ${CX} ${CY})`} />
              );
            })}
          </svg>
          <ul className="flex-1 space-y-0.5">
            {byCategory.map(([cat, v], i) => (
              <li key={cat} className="flex items-center gap-2 text-[11px] font-mono">
                <span className="w-3 h-3 inline-block border border-nu-ink" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="flex-1">{cat}</span>
                <span className="tabular-nums">{won(v)}</span>
                <span className="text-nu-muted tabular-nums">{((v / donutTotal) * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-[11px] font-mono">{error}</div>}

      {/* Filter chips */}
      <div className="flex gap-1">
        {(["all", "planned", "spent"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`border-[2px] border-nu-ink px-2 py-0.5 font-mono-nu text-[10px] uppercase tracking-widest ${filter === f ? "bg-nu-ink text-white" : "bg-white"}`}>
            {f === "all" ? "전체" : f === "planned" ? "계획" : "지출"}
          </button>
        ))}
      </div>

      {canEdit && !showForm && (
        <button onClick={() => setShowForm(true)}
          className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14]">
          + 항목 추가
        </button>
      )}

      {canEdit && showForm && (
        <form onSubmit={submit} className="space-y-2 border-[2px] border-nu-ink/30 p-3 bg-nu-cream/30">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="항목명 *" required
            className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
          <div className="grid grid-cols-2 gap-2">
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="카테고리" list="budget-cats"
              className="border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
            <datalist id="budget-cats">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="금액 *" required
              className="border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1 text-[11px] font-mono">
              <input type="checkbox" checked={isPlanned} onChange={(e) => setIsPlanned(e.target.checked)} />
              계획 예산
            </label>
            <label className="text-[10px] font-mono">지출일
              <input type="datetime-local" value={spentAt} onChange={(e) => setSpentAt(e.target.value)}
                className="ml-1 border-[2px] border-nu-ink/50 px-1 py-0.5 text-xs font-mono" />
            </label>
          </div>
          <div>
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
              className="hidden" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 disabled:opacity-50">
                {uploading ? "업로드 중..." : "🧾 영수증 업로드"}
              </button>
              {receiptUrl && (
                <a href={receiptUrl} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-nu-pink underline">
                  영수증 보기
                </a>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} className="font-mono-nu text-[11px] text-nu-muted">취소</button>
            <button disabled={submitting}
              className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14] disabled:opacity-50">
              {submitting ? "..." : editId ? "수정" : "추가"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-[11px] font-mono text-nu-muted">로딩...</div>
      ) : filtered.length === 0 ? (
        <div className="text-[11px] font-mono text-nu-muted">항목이 없어요.</div>
      ) : (
        <ul className="space-y-1">
          {filtered.map(({ row, b }) => {
            const isSpent = !!b.spent_at || b.is_planned === false;
            return (
              <li key={row.id} className={`border-[2px] p-2 ${isSpent ? "border-nu-pink bg-nu-pink/5" : "border-nu-ink/40 bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-nu-ink truncate">
                      {isSpent ? "💸" : "📝"} {b.item_name}
                      {b.category && <span className="ml-2 font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted border border-nu-ink/30 px-1">{b.category}</span>}
                    </div>
                    <div className="text-[10px] font-mono text-nu-muted">
                      {b.spent_at ? new Date(b.spent_at).toLocaleDateString("ko-KR") : "계획"}
                      {b.receipt_url && <a href={b.receipt_url} target="_blank" rel="noreferrer" className="ml-2 text-nu-pink underline">🧾</a>}
                    </div>
                  </div>
                  <div className="font-bold font-mono tabular-nums text-sm">{won(b.amount)}</div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => edit(row)} className="text-[10px] text-nu-muted hover:text-nu-ink">수정</button>
                      <button onClick={() => remove(row.id)} className="text-[10px] text-nu-muted hover:text-nu-pink">삭제</button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

registry.register({
  slug: "budget",
  name: "💸 예산",
  description: "계획 vs 실지출 — 카테고리 도넛, 영수증 업로드.",
  icon: "💸",
  category: "finance",
  scope: ["bolt"],
  schema: {
    type: "object",
    properties: {
      item_name: { type: "string" },
      category: { type: "string" },
      amount: { type: "number" },
      is_planned: { type: "boolean", default: true },
      spent_at: { type: ["string", "null"], format: "date-time" },
      receipt_url: { type: ["string", "null"], format: "uri" },
    },
    required: ["item_name", "amount"],
  },
  Component: BudgetComponent,
  isCore: true,
  version: "1.0.0",
});
