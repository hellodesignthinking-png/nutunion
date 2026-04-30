"use client";
import { useEffect, useMemo, useState } from "react";
import { registry, type ThreadProps } from "@/lib/threads/registry";
import {
  listThreadData,
  createThreadData,
  updateThreadData,
  deleteThreadData,
  type ThreadDataRow,
} from "@/lib/threads/data-client";

interface DailyRow {
  date: string;
  revenue_card?: number;
  revenue_cash?: number;
  revenue_delivery?: number;
  customer_count?: number;
  cogs?: number;
  labor_cost?: number;
  memo?: string;
}

interface DailyConfig {
  monthly_revenue_goal?: number;
  margin_goal_pct?: number;
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function totalOf(d: DailyRow): number {
  return (d.revenue_card || 0) + (d.revenue_cash || 0) + (d.revenue_delivery || 0);
}

function DailyRevenueComponent({ installation, canEdit, config }: ThreadProps) {
  const [rows, setRows] = useState<ThreadDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [card, setCard] = useState("");
  const [cash, setCash] = useState("");
  const [delivery, setDelivery] = useState("");
  const [customers, setCustomers] = useState("");
  const [cogs, setCogs] = useState("");
  const [labor, setLabor] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cfg = config as DailyConfig;
  const monthlyGoal = cfg?.monthly_revenue_goal || 0;
  const marginGoal = cfg?.margin_goal_pct || 0;

  const load = async () => {
    setLoading(true);
    try {
      const data = await listThreadData(installation.id, { limit: 365 });
      setRows(data); setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [installation.id]);

  const sorted = useMemo(() => {
    return [...rows]
      .filter((r) => (r.data as DailyRow)?.date)
      .sort((a, b) => ((a.data as DailyRow).date < (b.data as DailyRow).date ? 1 : -1));
  }, [rows]);

  // Today / averages / 30-day
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRow = sorted.find((r) => (r.data as DailyRow).date === todayStr);
  const todayTotal = todayRow ? totalOf(todayRow.data as DailyRow) : 0;
  const avg = sorted.length ? sorted.reduce((s, r) => s + totalOf(r.data as DailyRow), 0) / sorted.length : 0;

  const last30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    return sorted
      .filter((r) => new Date((r.data as DailyRow).date).getTime() >= cutoff)
      .map((r) => ({
        date: (r.data as DailyRow).date,
        rev: totalOf(r.data as DailyRow),
        cust: (r.data as DailyRow).customer_count || 0,
      }))
      .reverse(); // chronological
  }, [sorted]);

  // Monthly summaries
  const byMonth = useMemo(() => {
    const map = new Map<string, { revenue: number; cust: number; cogs: number; labor: number; days: number }>();
    sorted.forEach((r) => {
      const d = r.data as DailyRow;
      const ym = (d.date || "").slice(0, 7);
      if (!ym) return;
      const cur = map.get(ym) || { revenue: 0, cust: 0, cogs: 0, labor: 0, days: 0 };
      cur.revenue += totalOf(d);
      cur.cust += d.customer_count || 0;
      cur.cogs += d.cogs || 0;
      cur.labor += d.labor_cost || 0;
      cur.days += 1;
      map.set(ym, cur);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [sorted]);

  const reset = () => {
    setEditId(null); setDate(new Date().toISOString().slice(0, 10));
    setCard(""); setCash(""); setDelivery(""); setCustomers("");
    setCogs(""); setLabor(""); setMemo(""); setShowForm(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    setSubmitting(true);
    try {
      const payload: DailyRow = {
        date,
        revenue_card: card ? Number(card) : 0,
        revenue_cash: cash ? Number(cash) : 0,
        revenue_delivery: delivery ? Number(delivery) : 0,
        customer_count: customers ? Number(customers) : 0,
        cogs: cogs ? Number(cogs) : 0,
        labor_cost: labor ? Number(labor) : 0,
        memo: memo.trim() || undefined,
      };
      if (editId) await updateThreadData(editId, payload);
      else await createThreadData(installation.id, payload);
      reset();
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const edit = (row: ThreadDataRow) => {
    const d = row.data as DailyRow;
    setEditId(row.id);
    setDate(d.date || todayStr);
    setCard(String(d.revenue_card || ""));
    setCash(String(d.revenue_cash || ""));
    setDelivery(String(d.revenue_delivery || ""));
    setCustomers(String(d.customer_count || ""));
    setCogs(String(d.cogs || ""));
    setLabor(String(d.labor_cost || ""));
    setMemo(d.memo || "");
    setShowForm(true);
  };

  const remove = async (id: string) => {
    if (!confirm("이 마감 기록을 삭제할까요?")) return;
    try { await deleteThreadData(id); await load(); } catch (e: any) { setError(e.message); }
  };

  // SVG line chart (revenue + customers, 30 days)
  const W = 320, H = 100, P = 20;
  const maxRev = Math.max(1, ...last30.map((d) => d.rev));
  const maxCust = Math.max(1, ...last30.map((d) => d.cust));
  const xStep = last30.length > 1 ? (W - P * 2) / (last30.length - 1) : 0;
  const revPath = last30.map((d, i) => `${i === 0 ? "M" : "L"} ${P + i * xStep} ${H - P - ((d.rev / maxRev) * (H - P * 2))}`).join(" ");
  const custPath = last30.map((d, i) => `${i === 0 ? "M" : "L"} ${P + i * xStep} ${H - P - ((d.cust / maxCust) * (H - P * 2))}`).join(" ");

  return (
    <div className="border-[3px] border-nu-ink p-4 bg-white shadow-[4px_4px_0_0_#0D0F14] space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-head text-lg font-extrabold text-nu-ink">💰 일매출</h3>
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{sorted.length} days</span>
      </div>

      {/* Hero pulse card */}
      <div className="border-[3px] border-nu-pink p-3 bg-nu-cream/50">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">📍 오늘 펄스 — {todayStr}</div>
        <div className="flex items-baseline gap-3 mt-1 flex-wrap">
          <div className="text-2xl font-extrabold font-head text-nu-ink">{won(todayTotal)}</div>
          <div className="text-[11px] font-mono text-nu-muted">vs 일평균 {won(Math.round(avg))}</div>
          {monthlyGoal > 0 && (
            <div className="text-[11px] font-mono text-nu-muted">
              월목표 {won(monthlyGoal)} ({Math.round((todayTotal / (monthlyGoal / 30)) * 100)}% 일할)
            </div>
          )}
        </div>
        {!todayRow && canEdit && (
          <button onClick={() => { setDate(todayStr); setShowForm(true); }}
            className="mt-2 border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14]">
            오늘 마감 입력
          </button>
        )}
      </div>

      {/* 30-day chart */}
      {last30.length > 1 && (
        <div className="border-[2px] border-nu-ink/20 p-2 bg-white">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">30일 추이</div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
            <path d={revPath} fill="none" stroke="#E91E63" strokeWidth="2" />
            <path d={custPath} fill="none" stroke="#0D0F14" strokeWidth="1.5" strokeDasharray="3,2" opacity="0.5" />
          </svg>
          <div className="flex gap-3 text-[10px] font-mono">
            <span className="text-nu-pink">━ 매출</span>
            <span className="text-nu-ink/60">┄ 손님</span>
          </div>
        </div>
      )}

      {error && <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-[11px] font-mono">{error}</div>}

      {canEdit && showForm && (
        <form onSubmit={submit} className="space-y-2 border-[2px] border-nu-ink/30 p-3 bg-nu-cream/30">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
            className="border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[10px] font-mono">카드
              <input type="number" min="0" value={card} onChange={(e) => setCard(e.target.value)}
                className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
            </label>
            <label className="text-[10px] font-mono">현금
              <input type="number" min="0" value={cash} onChange={(e) => setCash(e.target.value)}
                className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
            </label>
            <label className="text-[10px] font-mono">배달
              <input type="number" min="0" value={delivery} onChange={(e) => setDelivery(e.target.value)}
                className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[10px] font-mono">손님 수
              <input type="number" min="0" value={customers} onChange={(e) => setCustomers(e.target.value)}
                className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
            </label>
            <label className="text-[10px] font-mono">원가
              <input type="number" value={cogs} onChange={(e) => setCogs(e.target.value)}
                className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
            </label>
            <label className="text-[10px] font-mono">인건비
              <input type="number" value={labor} onChange={(e) => setLabor(e.target.value)}
                className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
            </label>
          </div>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모" rows={2}
            className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} className="font-mono-nu text-[11px] text-nu-muted">취소</button>
            <button disabled={submitting}
              className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14] disabled:opacity-50">
              {submitting ? "..." : editId ? "수정" : "저장"}
            </button>
          </div>
        </form>
      )}

      {/* Monthly summary */}
      {loading ? (
        <div className="text-[11px] font-mono text-nu-muted">로딩...</div>
      ) : byMonth.length === 0 ? (
        <div className="text-[11px] font-mono text-nu-muted">아직 매출 기록이 없어요.</div>
      ) : (
        <div className="border-[2px] border-nu-ink/20">
          <div className="grid grid-cols-[1fr_90px_70px_70px_70px] gap-1 px-2 py-1 bg-nu-cream/40 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
            <div>월</div><div>매출</div><div>손님</div><div>마진%</div><div>일</div>
          </div>
          {byMonth.map(([ym, m]) => {
            const margin = m.revenue > 0 ? Math.round(((m.revenue - m.cogs - m.labor) / m.revenue) * 100) : 0;
            const goalMet = marginGoal > 0 && margin >= marginGoal;
            return (
              <div key={ym} className="grid grid-cols-[1fr_90px_70px_70px_70px] gap-1 px-2 py-1 text-[11px] font-mono border-t border-nu-ink/10">
                <div className="font-bold">{ym}</div>
                <div className="tabular-nums">{won(m.revenue)}</div>
                <div className="tabular-nums">{m.cust}</div>
                <div className={`tabular-nums ${goalMet ? "text-green-700 font-bold" : ""}`}>{margin}%</div>
                <div className="tabular-nums text-nu-muted">{m.days}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent rows for edit/delete */}
      {sorted.slice(0, 7).length > 0 && (
        <details className="text-[11px]">
          <summary className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted cursor-pointer">최근 7일 상세</summary>
          <ul className="mt-2 space-y-1">
            {sorted.slice(0, 7).map((r) => {
              const d = r.data as DailyRow;
              return (
                <li key={r.id} className="border border-nu-ink/20 px-2 py-1 flex justify-between items-center">
                  <span className="font-mono">{d.date} · {won(totalOf(d))} · {d.customer_count || 0}명</span>
                  {canEdit && (
                    <span className="flex gap-1">
                      <button onClick={() => edit(r)} className="text-[10px] text-nu-muted hover:text-nu-ink">수정</button>
                      <button onClick={() => remove(r.id)} className="text-[10px] text-nu-muted hover:text-nu-pink">삭제</button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

registry.register({
  slug: "daily-revenue",
  name: "💰 일매출",
  description: "오프라인/배달 매출 일일 마감 — 펄스, 30일 추이, 월별 마진.",
  icon: "💰",
  category: "finance",
  scope: ["bolt"],
  schema: {
    type: "object",
    properties: {
      date: { type: "string", format: "date" },
      revenue_card: { type: "number", minimum: 0 },
      revenue_cash: { type: "number", minimum: 0 },
      revenue_delivery: { type: "number", minimum: 0 },
      customer_count: { type: "integer", minimum: 0 },
      cogs: { type: "number" },
      labor_cost: { type: "number" },
      memo: { type: "string" },
    },
    required: ["date"],
  },
  configSchema: {
    type: "object",
    properties: {
      monthly_revenue_goal: { type: "number" },
      margin_goal_pct: { type: "number" },
    },
  },
  Component: DailyRevenueComponent,
  isCore: true,
  version: "1.0.0",
});
