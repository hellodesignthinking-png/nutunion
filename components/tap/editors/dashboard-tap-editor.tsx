"use client";

/**
 * DashboardTapEditor — Tap mode='dashboard' 용 위젯 그리드 편집기.
 *
 * 위젯 4종:
 *  - number   : 큰 숫자 + 라벨 + 선택적 목표 대비
 *  - line     : 시계열 라인차트
 *  - bar      : 카테고리 막대
 *  - table    : 간단한 표 (최근 N행)
 *
 * 데이터 바인딩:
 *  - source: 'bolt_metrics' (이 프로젝트의 일일/주간/월간)
 *  - field : metrics.JSON 경로 (e.g., "revenue.card", "customers")
 *  - reduce: 'sum' | 'avg' | 'last'
 *  - range : 'this_month' | 'last_7d' | 'last_30d'
 *
 * 저장:
 *  - bolt_taps.widget_config JSONB (migration 085)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GridLayout, useContainerWidth, type LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  BarChart as BarChartIcon,
  LineChart as LineChartIcon,
  Hash,
  Table as TableIcon,
  GitCompare,
  Gauge as GaugeIcon,
  Plus,
  Trash2,
  Settings,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { fmtCompact, fmtKRW } from "@/lib/bolt/anchor-metrics";

type WidgetType = "number" | "line" | "bar" | "table" | "compare" | "gauge";
type PeriodRange = "this_month" | "last_7d" | "last_30d";
type Reducer = "sum" | "avg" | "last" | "max";

interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  field: string;      // "revenue.card" | "customers" | "revenue" (아래 path 이그잠) — 특수: "revenue" = revenue 전체 합
  reduce: Reducer;
  range: PeriodRange;
  format?: "krw" | "number" | "percent";
  goal?: number;       // gauge 전용 — 목표 값 (% 계산의 분모)
}

interface Config {
  widgets: Widget[];
  layout: LayoutItem[];
}

interface Props {
  projectId: string;
  initialConfig: Config | null;
  onSave?: (cfg: Config) => Promise<void>;
  readOnly?: boolean;
}

const defaultConfig: Config = {
  widgets: [],
  layout: [],
};

const WIDGET_SPECS: Record<WidgetType, { label: string; icon: React.ComponentType<any>; defaultSize: { w: number; h: number } }> = {
  number:  { label: "숫자",     icon: Hash,          defaultSize: { w: 3, h: 2 } },
  line:    { label: "라인",     icon: LineChartIcon, defaultSize: { w: 6, h: 3 } },
  bar:     { label: "막대",     icon: BarChartIcon,  defaultSize: { w: 6, h: 3 } },
  table:   { label: "테이블",   icon: TableIcon,     defaultSize: { w: 6, h: 4 } },
  compare: { label: "지점 비교", icon: GitCompare,   defaultSize: { w: 6, h: 3 } },
  gauge:   { label: "목표 게이지", icon: GaugeIcon,  defaultSize: { w: 4, h: 3 } },
};

export function DashboardTapEditor({ projectId, initialConfig, onSave, readOnly }: Props) {
  const [config, setConfig] = useState<Config>(initialConfig || defaultConfig);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [editingWidget, setEditingWidget] = useState<string | null>(null);
  const saveDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 데이터 로드 — 지난 60일 bolt_metrics
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const supabase = createClient();
      const { data } = await supabase
        .from("bolt_metrics")
        .select("period_start, period_type, metrics, memo")
        .eq("project_id", projectId)
        .gte("period_start", since.toISOString().slice(0, 10))
        .order("period_start", { ascending: true });
      if (!cancelled) {
        setRows(data || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // config 변경 시 자동 저장
  useEffect(() => {
    if (!onSave || readOnly) return;
    if (saveDebounce.current) clearTimeout(saveDebounce.current);
    saveDebounce.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await onSave(config);
        setStatus("saved");
      } catch {
        setStatus("idle");
      }
    }, 1500);
    return () => {
      if (saveDebounce.current) clearTimeout(saveDebounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  function addWidget(type: WidgetType) {
    const id = `w-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const spec = WIDGET_SPECS[type];
    const next: Widget = {
      id,
      type,
      title:
        type === "number"
          ? "새 숫자"
          : type === "line"
            ? "시계열 추이"
            : type === "bar"
              ? "막대차트"
              : "데이터 테이블",
      field: "revenue",
      reduce: type === "number" ? "sum" : "last",
      range: "this_month",
      format: "krw",
    };
    setConfig((c) => {
      const existingY = c.layout.reduce((max, l) => Math.max(max, l.y + l.h), 0);
      return {
        widgets: [...c.widgets, next],
        layout: [...c.layout, { i: id, x: 0, y: existingY, w: spec.defaultSize.w, h: spec.defaultSize.h }],
      };
    });
    setEditingWidget(id);
  }

  function removeWidget(id: string) {
    setConfig((c) => ({
      widgets: c.widgets.filter((w) => w.id !== id),
      layout: c.layout.filter((l) => l.i !== id),
    }));
    if (editingWidget === id) setEditingWidget(null);
  }

  function updateWidget(id: string, patch: Partial<Widget>) {
    setConfig((c) => ({
      ...c,
      widgets: c.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  }

  function updateLayout(newLayout: LayoutItem[]) {
    setConfig((c) => ({ ...c, layout: newLayout }));
  }

  if (loading) {
    return (
      <div className="border-[2px] border-nu-ink/10 rounded p-8 flex items-center justify-center">
        <Loader2 size={18} className="animate-spin text-nu-muted" />
      </div>
    );
  }

  const empty = config.widgets.length === 0;

  return (
    <div className="border-[2px] border-nu-ink/10 rounded bg-white overflow-hidden">
      {/* 툴바 */}
      {!readOnly && (
        <div className="flex items-center gap-2 border-b border-nu-ink/10 px-3 py-2 bg-nu-cream/20 flex-wrap">
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">위젯 추가:</span>
          {(Object.keys(WIDGET_SPECS) as WidgetType[]).map((t) => {
            const Icon = WIDGET_SPECS[t].icon;
            return (
              <button
                key={t}
                onClick={() => addWidget(t)}
                className="inline-flex items-center gap-1 px-2 py-1 border border-nu-ink/15 rounded text-[11px] font-mono-nu hover:bg-nu-ink hover:text-white"
              >
                <Icon size={11} /> {WIDGET_SPECS[t].label}
              </button>
            );
          })}
          <div className="flex-1" />
          {status === "saving" && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono-nu text-nu-graphite">
              <Loader2 size={11} className="animate-spin" /> 저장 중
            </span>
          )}
          {status === "saved" && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono-nu text-green-700">
              <CheckCircle2 size={11} /> 자동 저장
            </span>
          )}
        </div>
      )}

      {/* 그리드 */}
      {empty ? (
        <div className="p-10 text-center">
          <Hash size={24} className="mx-auto text-nu-muted mb-2" />
          <p className="text-[12px] text-nu-graphite">
            위젯을 추가해 대시보드를 만들어보세요. 데이터는 이 볼트의 <code>bolt_metrics</code> 에서 실시간으로 읽어옵니다.
          </p>
        </div>
      ) : (
        <GridContainer
          config={config}
          rows={rows}
          readOnly={readOnly}
          editingWidget={editingWidget}
          setEditingWidget={setEditingWidget}
          removeWidget={removeWidget}
          updateWidget={updateWidget}
          updateLayout={updateLayout}
          projectId={projectId}
        />
      )}
    </div>
  );
}

/* -------- GridContainer — useContainerWidth 훅 사용 -------- */

function GridContainer({
  config,
  rows,
  readOnly,
  editingWidget,
  setEditingWidget,
  removeWidget,
  updateWidget,
  updateLayout,
  projectId,
}: {
  config: Config;
  rows: any[];
  readOnly?: boolean;
  editingWidget: string | null;
  setEditingWidget: (id: string | null) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, patch: Partial<Widget>) => void;
  updateLayout: (l: LayoutItem[]) => void;
  projectId: string;
}) {
  const { containerRef, width } = useContainerWidth();
  return (
    <div ref={containerRef} className="p-2">
      <GridLayout
        className="layout"
        layout={config.layout}
        width={width || 800}
        gridConfig={{ cols: 12, rowHeight: 50, margin: [8, 8] }}
        dragConfig={{
          enabled: !readOnly,
          cancel: ".widget-controls, .widget-settings, .widget-settings *",
        }}
        resizeConfig={{ enabled: !readOnly }}
        onLayoutChange={(l) => updateLayout(l as LayoutItem[])}
      >
        {config.widgets.map((w) => (
          <div key={w.id} className="relative">
            <WidgetRenderer
              widget={w}
              rows={rows}
              readOnly={readOnly}
              onEdit={() => setEditingWidget(w.id === editingWidget ? null : w.id)}
              onRemove={() => removeWidget(w.id)}
              editing={editingWidget === w.id}
              onPatch={(patch) => updateWidget(w.id, patch)}
              projectId={projectId}
            />
          </div>
        ))}
      </GridLayout>
    </div>
  );
}

/* -------- Renderer -------- */

function WidgetRenderer({
  widget,
  rows,
  onEdit,
  onRemove,
  editing,
  onPatch,
  readOnly,
  projectId,
}: {
  widget: Widget;
  rows: any[];
  onEdit: () => void;
  onRemove: () => void;
  editing: boolean;
  onPatch: (patch: Partial<Widget>) => void;
  readOnly?: boolean;
  projectId: string;
}) {
  const data = useMemo(() => filterRows(rows, widget.range), [rows, widget.range]);

  return (
    <div className="h-full flex flex-col border border-nu-ink/10 bg-white rounded overflow-hidden">
      <header className="flex items-center justify-between px-3 py-1.5 border-b border-nu-ink/10 bg-nu-cream/10">
        <span className="font-mono-nu text-[11px] font-bold text-nu-ink truncate">{widget.title}</span>
        {!readOnly && (
          <div className="flex items-center gap-1 widget-controls">
            <button
              onClick={onEdit}
              title="설정"
              className="p-1 hover:bg-nu-ink/10 rounded text-nu-graphite"
            >
              <Settings size={11} />
            </button>
            <button
              onClick={onRemove}
              title="삭제"
              className="p-1 hover:bg-red-100 rounded text-red-600"
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </header>

      {/* 본문 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {widget.type === "number" && <NumberBody widget={widget} data={data} />}
        {widget.type === "line" && <LineBody widget={widget} data={data} />}
        {widget.type === "bar" && <BarBody widget={widget} data={data} />}
        {widget.type === "table" && <TableBody widget={widget} data={data} />}
        {widget.type === "gauge" && <GaugeBody widget={widget} data={data} />}
        {widget.type === "compare" && <CompareBody widget={widget} projectId={projectId} />}
      </div>

      {/* 설정 패널 */}
      {editing && !readOnly && (
        <div className="widget-settings border-t border-nu-ink/10 p-2 bg-white space-y-1.5 text-[11px]">
          <div className="flex items-center gap-1">
            <label className="w-12 text-nu-muted">제목</label>
            <input
              className="flex-1 px-2 py-1 border border-nu-ink/15 rounded text-[11px]"
              value={widget.title}
              onChange={(e) => onPatch({ title: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="w-12 text-nu-muted">필드</label>
            <select
              className="flex-1 px-2 py-1 border border-nu-ink/15 rounded text-[11px]"
              value={widget.field}
              onChange={(e) => onPatch({ field: e.target.value })}
            >
              <option value="revenue">매출 전체</option>
              <option value="revenue.card">매출 · 카드</option>
              <option value="revenue.cash">매출 · 현금</option>
              <option value="revenue.delivery">매출 · 배달</option>
              <option value="cost">비용 전체</option>
              <option value="cost.food">비용 · 식자재</option>
              <option value="cost.labor">비용 · 인건비</option>
              <option value="customers">객수</option>
              <option value="dau">DAU</option>
              <option value="mau">MAU</option>
              <option value="attendance">참석자</option>
              <option value="sales">캠페인 매출</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <label className="w-12 text-nu-muted">집계</label>
            <select
              className="flex-1 px-2 py-1 border border-nu-ink/15 rounded text-[11px]"
              value={widget.reduce}
              onChange={(e) => onPatch({ reduce: e.target.value as Reducer })}
            >
              <option value="sum">합계</option>
              <option value="avg">평균</option>
              <option value="last">최근값</option>
              <option value="max">최대</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <label className="w-12 text-nu-muted">범위</label>
            <select
              className="flex-1 px-2 py-1 border border-nu-ink/15 rounded text-[11px]"
              value={widget.range}
              onChange={(e) => onPatch({ range: e.target.value as PeriodRange })}
            >
              <option value="this_month">이번 달</option>
              <option value="last_7d">최근 7일</option>
              <option value="last_30d">최근 30일</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <label className="w-12 text-nu-muted">포맷</label>
            <select
              className="flex-1 px-2 py-1 border border-nu-ink/15 rounded text-[11px]"
              value={widget.format || "krw"}
              onChange={(e) => onPatch({ format: e.target.value as Widget["format"] })}
            >
              <option value="krw">원 (₩1,234)</option>
              <option value="number">숫자 (1,234)</option>
              <option value="percent">퍼센트 (%)</option>
            </select>
          </div>
          {widget.type === "gauge" && (
            <div className="flex items-center gap-1">
              <label className="w-12 text-nu-muted">목표</label>
              <input
                type="number"
                inputMode="numeric"
                className="flex-1 px-2 py-1 border border-nu-ink/15 rounded text-[11px] font-mono-nu tabular-nums"
                value={widget.goal ?? ""}
                onChange={(e) => onPatch({ goal: Number(e.target.value) || undefined })}
                placeholder="목표 수치"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------- Widget Bodies -------- */

function NumberBody({ widget, data }: { widget: Widget; data: any[] }) {
  const val = useMemo(() => reduceValues(extractValues(data, widget.field), widget.reduce), [data, widget.field, widget.reduce]);
  const formatted = formatVal(val, widget.format);
  return (
    <div className="h-full flex flex-col items-center justify-center p-3">
      <div className="font-head text-[36px] font-extrabold text-nu-pink tabular-nums leading-none">
        {formatted}
      </div>
      <div className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest mt-1">
        {widget.range === "this_month" ? "이번 달" : widget.range === "last_7d" ? "7일" : "30일"} · {widget.reduce}
      </div>
    </div>
  );
}

function LineBody({ widget, data }: { widget: Widget; data: any[] }) {
  const points = data.map((r) => ({
    date: r.period_start,
    value: extractOne(r.metrics, widget.field),
  }));
  return (
    <div className="h-full p-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 6, right: 8, bottom: 6, left: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#0D0D0D" opacity={0.07} vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6B6860" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => fmtCompact(Number(v))} tick={{ fontSize: 9, fill: "#6B6860" }} tickLine={false} axisLine={false} width={32} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} formatter={(v) => formatVal(Number(v), widget.format)} />
          <Line type="monotone" dataKey="value" stroke="#FF48B0" strokeWidth={2} dot={{ r: 2, fill: "#FF48B0" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarBody({ widget, data }: { widget: Widget; data: any[] }) {
  const points = data.map((r) => ({
    date: r.period_start.slice(5),
    value: extractOne(r.metrics, widget.field),
  }));
  return (
    <div className="h-full p-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 6, right: 8, bottom: 6, left: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#0D0D0D" opacity={0.07} vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6B6860" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => fmtCompact(Number(v))} tick={{ fontSize: 9, fill: "#6B6860" }} tickLine={false} axisLine={false} width={32} />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} formatter={(v) => formatVal(Number(v), widget.format)} />
          <Bar dataKey="value" fill="#FF48B0" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TableBody({ widget, data }: { widget: Widget; data: any[] }) {
  const rows = data.slice(-10).reverse();
  return (
    <div className="h-full overflow-auto text-[11px]">
      <table className="w-full">
        <thead className="sticky top-0 bg-nu-cream/20 border-b border-nu-ink/10">
          <tr>
            <th className="px-2 py-1 text-left font-mono-nu text-[10px] uppercase text-nu-muted">날짜</th>
            <th className="px-2 py-1 text-right font-mono-nu text-[10px] uppercase text-nu-muted">{widget.field}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.period_start} className="border-b border-nu-ink/5">
              <td className="px-2 py-1 tabular-nums font-mono-nu">{r.period_start}</td>
              <td className="px-2 py-1 text-right tabular-nums font-mono-nu">
                {formatVal(extractOne(r.metrics, widget.field), widget.format)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={2} className="text-center text-nu-muted py-3">데이터 없음</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* -------- Helpers -------- */

function filterRows(rows: any[], range: PeriodRange): any[] {
  const now = new Date();
  let since = new Date();
  if (range === "this_month") since = new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === "last_7d") since.setDate(now.getDate() - 7);
  if (range === "last_30d") since.setDate(now.getDate() - 30);
  const key = since.toISOString().slice(0, 10);
  return rows.filter((r) => r.period_start >= key);
}

function extractOne(metrics: any, field: string): number {
  if (!metrics) return 0;
  if (field === "revenue") {
    const r = metrics.revenue || {};
    return Number(r.card || 0) + Number(r.cash || 0) + Number(r.delivery || 0);
  }
  if (field === "cost") {
    const c = metrics.cost || {};
    return Number(c.food || 0) + Number(c.supplies || 0) + Number(c.labor || 0) + Number(c.rent || 0) + Number(c.other || 0);
  }
  const parts = field.split(".");
  let cur: any = metrics;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur == null) return 0;
  }
  return Number(cur) || 0;
}

function extractValues(rows: any[], field: string): number[] {
  return rows.map((r) => extractOne(r.metrics, field));
}

function reduceValues(vals: number[], reduce: Reducer): number {
  if (vals.length === 0) return 0;
  if (reduce === "sum") return vals.reduce((s, v) => s + v, 0);
  if (reduce === "avg") return vals.reduce((s, v) => s + v, 0) / vals.length;
  if (reduce === "last") return vals[vals.length - 1];
  if (reduce === "max") return Math.max(...vals);
  return 0;
}

function formatVal(v: number, fmt?: Widget["format"]): string {
  if (!Number.isFinite(v)) return "—";
  if (fmt === "krw") return fmtKRW(v);
  if (fmt === "percent") return `${v.toFixed(1)}%`;
  return Math.round(v).toLocaleString("ko-KR");
}

/* -------- Gauge: 목표 대비 진행률 -------- */
function GaugeBody({ widget, data }: { widget: Widget; data: any[] }) {
  const actual = useMemo(
    () => reduceValues(extractValues(data, widget.field), widget.reduce),
    [data, widget.field, widget.reduce],
  );
  const goal = widget.goal || 0;
  const pct = goal > 0 ? Math.min(100, (actual / goal) * 100) : 0;
  const over = goal > 0 && actual > goal;
  const color = over ? "#047857" : pct >= 70 ? "#FF48B0" : pct >= 40 ? "#FFA500" : "#94a3b8";

  // SVG 반원 게이지
  const size = 120;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = Math.PI * radius; // 반원 둘레
  const dash = (pct / 100) * circ;

  return (
    <div className="h-full flex flex-col items-center justify-center p-2">
      <svg viewBox={`0 0 ${size} ${size / 2 + stroke}`} className="w-full max-w-[180px]">
        <path
          d={`M ${stroke / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${size / 2}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={`M ${stroke / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          fontSize="18"
          fontWeight="800"
          fill={color}
          fontFamily="var(--font-head)"
        >
          {goal > 0 ? `${pct.toFixed(0)}%` : "—"}
        </text>
      </svg>
      <div className="text-center mt-1">
        <div className="text-[11px] font-mono-nu text-nu-ink tabular-nums">
          {formatVal(actual, widget.format)}
        </div>
        {goal > 0 && (
          <div className="text-[9px] font-mono-nu text-nu-muted tabular-nums">
            목표 {formatVal(goal, widget.format)}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------- Compare: 이 볼트의 parent=X 하위 형제들(또는 children)을 이번 달 합계로 비교 -------- */
function CompareBody({ widget, projectId }: { widget: Widget; projectId: string }) {
  const [rows, setRows] = useState<Array<{ id: string; title: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();

      // 현재 볼트의 타입으로 비교 대상 결정:
      // - 현재 볼트가 Eye 이면: 자기 children 비교
      // - 현재 볼트가 Hex/Anchor/Carriage/Wing 이면: 같은 parent 의 형제들 비교
      const { data: me } = await supabase
        .from("projects")
        .select("id, type, parent_bolt_id")
        .eq("id", projectId)
        .maybeSingle();
      if (!me) return setLoading(false);

      let siblings: Array<{ id: string; title: string }> = [];
      if ((me as any).type === "eye") {
        const { data } = await supabase
          .from("projects")
          .select("id, title")
          .eq("parent_bolt_id", projectId);
        siblings = (data as any) || [];
      } else if ((me as any).parent_bolt_id) {
        const { data } = await supabase
          .from("projects")
          .select("id, title")
          .eq("parent_bolt_id", (me as any).parent_bolt_id)
          .neq("id", projectId);
        siblings = [...((data as any) || []), { id: projectId, title: "이 볼트" }];
      }

      if (siblings.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // 이번 달 합계
      const since = new Date();
      since.setDate(1);
      const { data: metrics } = await supabase
        .from("bolt_metrics")
        .select("project_id, metrics")
        .in(
          "project_id",
          siblings.map((s) => s.id),
        )
        .eq("period_type", "daily")
        .gte("period_start", since.toISOString().slice(0, 10));

      const byBolt = new Map<string, number>();
      for (const m of metrics || []) {
        const v = extractOne((m as any).metrics, widget.field);
        const prev = byBolt.get((m as any).project_id) || 0;
        byBolt.set((m as any).project_id, prev + v);
      }

      if (!cancelled) {
        setRows(
          siblings
            .map((s) => ({ id: s.id, title: s.title, value: byBolt.get(s.id) || 0 }))
            .sort((a, b) => b.value - a.value),
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, widget.field]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={14} className="animate-spin text-nu-muted" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-3 text-center text-[11px] text-nu-graphite">
        비교할 형제 볼트가 없어요. Eye Bolt 에서 쓰거나 parent_bolt_id 가 같은 볼트가 필요합니다.
      </div>
    );
  }

  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="h-full overflow-auto p-2 space-y-1">
      {rows.map((r) => (
        <div key={r.id} className="text-[11px]">
          <div className="flex justify-between mb-0.5">
            <span className="truncate max-w-[60%]" title={r.title}>
              {r.title}
            </span>
            <span className="font-mono-nu tabular-nums font-bold">
              {formatVal(r.value, widget.format)}
            </span>
          </div>
          <div className="h-2 bg-nu-ink/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-nu-pink to-nu-amber"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
