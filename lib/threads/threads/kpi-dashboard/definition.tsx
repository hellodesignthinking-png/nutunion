"use client";
import { useEffect, useMemo, useState } from "react";
import { registry, type ThreadProps } from "@/lib/threads/registry";
import {
  listThreadData,
  createThreadData,
  deleteThreadData,
  type ThreadDataRow,
} from "@/lib/threads/data-client";

interface KpiRecord {
  metric_key: string;
  value: number;
  target?: number | null;
  recorded_at: string;
  note?: string;
}

interface MetricDef {
  key: string;
  label: string;
  unit?: string;
  higher_is_better?: boolean;
}

interface KpiConfig {
  metrics?: MetricDef[];
}

const DEFAULT_METRICS: MetricDef[] = [
  { key: "DAU", label: "일활성", unit: "명", higher_is_better: true },
  { key: "MAU", label: "월활성", unit: "명", higher_is_better: true },
  { key: "MRR", label: "월반복매출", unit: "원", higher_is_better: true },
  { key: "NPS", label: "추천지수", unit: "점", higher_is_better: true },
];

function fmtVal(v: number, unit?: string) {
  if (unit === "원") return `${v.toLocaleString("ko-KR")}원`;
  if (unit) return `${v.toLocaleString("ko-KR")}${unit}`;
  return v.toLocaleString("ko-KR");
}

function KpiComponent({ installation, canEdit, config }: ThreadProps) {
  const [rows, setRows] = useState<ThreadDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [metricKey, setMetricKey] = useState("");
  const [value, setValue] = useState("");
  const [target, setTarget] = useState("");
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Local config draft
  const cfg = config as KpiConfig;
  const metrics: MetricDef[] = cfg?.metrics && cfg.metrics.length > 0 ? cfg.metrics : DEFAULT_METRICS;

  useEffect(() => {
    if (!metricKey && metrics.length > 0) setMetricKey(metrics[0].key);
  }, [metrics, metricKey]);

  // Config editor draft
  const [cfgDraft, setCfgDraft] = useState<MetricDef[]>(metrics);
  const [cfgSaving, setCfgSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listThreadData(installation.id, { limit: 500 });
      setRows(data); setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [installation.id]);

  const records = useMemo(() => {
    return rows
      .map((r) => ({ row: r, k: r.data as KpiRecord }))
      .filter((x) => x.k?.metric_key && x.k?.recorded_at && typeof x.k.value === "number")
      .sort((a, b) => new Date(b.k.recorded_at).getTime() - new Date(a.k.recorded_at).getTime());
  }, [rows]);

  const byMetric = useMemo(() => {
    const map = new Map<string, typeof records>();
    records.forEach((x) => {
      const arr = map.get(x.k.metric_key) || [];
      arr.push(x); map.set(x.k.metric_key, arr);
    });
    return map;
  }, [records]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!metricKey || !value || !recordedAt) return;
    setSubmitting(true);
    try {
      const payload: KpiRecord = {
        metric_key: metricKey,
        value: Number(value),
        target: target ? Number(target) : null,
        recorded_at: new Date(recordedAt).toISOString(),
        note: note.trim() || undefined,
      };
      await createThreadData(installation.id, payload);
      setValue(""); setTarget(""); setNote("");
      setShowForm(false);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("이 측정 기록을 삭제할까요?")) return;
    try { await deleteThreadData(id); await load(); } catch (e: any) { setError(e.message); }
  };

  const saveConfig = async () => {
    setCfgSaving(true);
    try {
      const res = await fetch(`/api/threads/installations/${installation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: { ...(cfg || {}), metrics: cfgDraft } }),
      });
      if (!res.ok) throw new Error("config_save_failed");
      // soft refresh — page-level state will be stale but the metric list updates next render
      window.location.reload();
    } catch (e: any) { setError(e.message); }
    finally { setCfgSaving(false); }
  };

  return (
    <div className="border-[3px] border-nu-ink p-4 bg-white shadow-[4px_4px_0_0_#0D0F14] space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="font-head text-lg font-extrabold text-nu-ink">📊 KPI 대시보드</h3>
        <div className="flex gap-2 items-center">
          {canEdit && (
            <button onClick={() => setShowCfg((v) => !v)}
              className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1">
              ⚙ Metric 설정
            </button>
          )}
          {canEdit && (
            <button onClick={() => setShowForm((v) => !v)}
              className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest font-bold px-2 py-1 shadow-[2px_2px_0_0_#0D0F14]">
              + 측정 기록
            </button>
          )}
        </div>
      </div>

      {error && <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-[11px] font-mono">{error}</div>}

      {showCfg && canEdit && (
        <div className="border-[2px] border-nu-ink/30 p-3 bg-nu-cream/30 space-y-2">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">Metric 정의</div>
          {cfgDraft.map((m, i) => (
            <div key={i} className="grid grid-cols-[80px_1fr_80px_50px_30px] gap-1">
              <input value={m.key} onChange={(e) => { const n = [...cfgDraft]; n[i] = { ...m, key: e.target.value }; setCfgDraft(n); }}
                placeholder="KEY" className="border border-nu-ink/50 px-1 text-xs font-mono" />
              <input value={m.label} onChange={(e) => { const n = [...cfgDraft]; n[i] = { ...m, label: e.target.value }; setCfgDraft(n); }}
                placeholder="이름" className="border border-nu-ink/50 px-1 text-xs font-mono" />
              <input value={m.unit || ""} onChange={(e) => { const n = [...cfgDraft]; n[i] = { ...m, unit: e.target.value }; setCfgDraft(n); }}
                placeholder="단위" className="border border-nu-ink/50 px-1 text-xs font-mono" />
              <label className="text-[10px] font-mono flex items-center gap-1">
                <input type="checkbox" checked={!!m.higher_is_better}
                  onChange={(e) => { const n = [...cfgDraft]; n[i] = { ...m, higher_is_better: e.target.checked }; setCfgDraft(n); }} />
                ↑좋
              </label>
              <button onClick={() => setCfgDraft(cfgDraft.filter((_, j) => j !== i))} className="text-nu-muted hover:text-nu-pink text-xs">×</button>
            </div>
          ))}
          <div className="flex justify-between">
            <button onClick={() => setCfgDraft([...cfgDraft, { key: "", label: "", unit: "", higher_is_better: true }])}
              className="font-mono-nu text-[10px] text-nu-muted hover:text-nu-ink">+ metric</button>
            <button disabled={cfgSaving} onClick={saveConfig}
              className="border-[2px] border-nu-ink bg-nu-ink text-white font-mono-nu text-[10px] uppercase tracking-widest font-bold px-2 py-1 disabled:opacity-50">
              {cfgSaving ? "..." : "저장 (새로고침)"}
            </button>
          </div>
        </div>
      )}

      {canEdit && showForm && (
        <form onSubmit={submit} className="space-y-2 border-[2px] border-nu-ink/30 p-3 bg-nu-cream/30">
          <div className="grid grid-cols-2 gap-2">
            <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}
              className="border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono">
              {metrics.map((m) => <option key={m.key} value={m.key}>{m.label} ({m.key})</option>)}
            </select>
            <input type="datetime-local" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} required
              className="border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} placeholder="값 *" required
              className="border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
            <input type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="목표 (선택)"
              className="border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="노트"
            className="w-full border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="font-mono-nu text-[11px] text-nu-muted">취소</button>
            <button disabled={submitting}
              className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14] disabled:opacity-50">
              {submitting ? "..." : "기록"}
            </button>
          </div>
        </form>
      )}

      {/* 4-col grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {metrics.map((m) => {
          const series = (byMetric.get(m.key) || []).slice().sort((a, b) => new Date(a.k.recorded_at).getTime() - new Date(b.k.recorded_at).getTime());
          const latest = series[series.length - 1];
          const sevenAgo = Date.now() - 7 * 24 * 3600 * 1000;
          const past = series.filter((x) => new Date(x.k.recorded_at).getTime() < sevenAgo);
          const refValue = past.length ? past[past.length - 1].k.value : (series[0]?.k.value ?? 0);
          const delta = latest ? latest.k.value - refValue : 0;
          const deltaPct = refValue ? (delta / Math.abs(refValue)) * 100 : 0;
          const better = m.higher_is_better === false ? delta < 0 : delta > 0;
          const targetVal = latest?.k.target ?? null;
          const progress = targetVal ? Math.min(100, Math.max(0, (latest!.k.value / targetVal) * 100)) : null;

          // Sparkline
          const sw = 100, sh = 28;
          const vals = series.map((x) => x.k.value);
          const max = Math.max(1, ...vals);
          const min = Math.min(0, ...vals);
          const sx = series.length > 1 ? sw / (series.length - 1) : 0;
          const sparkPath = series.map((x, i) => {
            const y = sh - ((x.k.value - min) / (max - min || 1)) * sh;
            return `${i === 0 ? "M" : "L"} ${i * sx} ${y}`;
          }).join(" ");

          return (
            <div key={m.key} className="border-[2px] border-nu-ink p-2 bg-white">
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">{m.key}</div>
              <div className="font-bold text-sm text-nu-ink">{m.label}</div>
              <div className="text-lg font-head font-extrabold text-nu-ink mt-1">
                {latest ? fmtVal(latest.k.value, m.unit) : "—"}
              </div>
              {latest && series.length > 1 && (
                <div className={`text-[10px] font-mono ${better ? "text-green-700" : "text-red-600"}`}>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}% (7d)
                </div>
              )}
              {series.length > 1 && (
                <svg viewBox={`0 0 ${sw} ${sh}`} className="w-full h-7 mt-1">
                  <path d={sparkPath} fill="none" stroke="#E91E63" strokeWidth="1.5" />
                </svg>
              )}
              {progress !== null && (
                <div className="mt-1">
                  <div className="h-1 border border-nu-ink/30 bg-white">
                    <div className="h-full bg-nu-ink" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="text-[9px] font-mono text-nu-muted mt-0.5">목표 {fmtVal(targetVal!, m.unit)} · {progress.toFixed(0)}%</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="text-[11px] font-mono text-nu-muted">로딩...</div>
      ) : records.length === 0 ? (
        <div className="text-[11px] font-mono text-nu-muted">아직 측정 기록이 없어요.</div>
      ) : (
        <details className="text-[11px]">
          <summary className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted cursor-pointer">최근 측정 ({records.length})</summary>
          <ul className="mt-2 space-y-1">
            {records.slice(0, 20).map(({ row, k }) => {
              const m = metrics.find((mm) => mm.key === k.metric_key);
              return (
                <li key={row.id} className="border border-nu-ink/20 px-2 py-1 flex justify-between items-center">
                  <span className="font-mono">
                    {new Date(k.recorded_at).toLocaleDateString("ko-KR")} · {m?.label || k.metric_key} · {fmtVal(k.value, m?.unit)}
                    {k.note && <span className="text-nu-muted"> · {k.note}</span>}
                  </span>
                  {canEdit && (
                    <button onClick={() => remove(row.id)} className="text-[10px] text-nu-muted hover:text-nu-pink">삭제</button>
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
  slug: "kpi-dashboard",
  name: "📊 KPI 대시보드",
  description: "메트릭 측정값 — 카드/스파크라인/목표 진행률.",
  icon: "📊",
  category: "growth",
  scope: ["bolt"],
  schema: {
    type: "object",
    properties: {
      metric_key: { type: "string" },
      value: { type: "number" },
      target: { type: ["number", "null"] },
      recorded_at: { type: "string", format: "date-time" },
      note: { type: "string" },
    },
    required: ["metric_key", "value", "recorded_at"],
  },
  configSchema: {
    type: "object",
    properties: {
      metrics: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string" },
            label: { type: "string" },
            unit: { type: "string" },
            higher_is_better: { type: "boolean" },
          },
        },
      },
    },
  },
  Component: KpiComponent,
  isCore: true,
  version: "1.0.0",
});
