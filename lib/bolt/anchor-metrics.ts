/**
 * Anchor Bolt 지표 계산 유틸 — 일일 매출/원가 → 주간/월간 집계.
 *
 * bolt_metrics.metrics JSONB 구조 (Anchor 일일):
 * {
 *   revenue: { card: number, cash: number, delivery: number },
 *   cost:    { food: number, supplies: number, labor: number, rent: number, other: number },
 *   customers: number
 * }
 */

import type { BoltMetricRow } from "./types";

export interface AnchorDaily {
  date: string;             // YYYY-MM-DD
  revenue: number;          // 총매출
  revenueBreakdown: { card: number; cash: number; delivery: number };
  cost: number;             // 총원가+비용
  costBreakdown: { food: number; supplies: number; labor: number; rent: number; other: number };
  profit: number;           // revenue - cost
  marginPct: number;        // profit / revenue
  customers: number;
  avgTicket: number;        // revenue / customers
  memo: string | null;
}

export function normalizeDaily(row: BoltMetricRow): AnchorDaily {
  const m = (row.metrics as any) || {};
  const rev = m.revenue || {};
  const cost = m.cost || {};
  const card = Number(rev.card || 0);
  const cash = Number(rev.cash || 0);
  const delivery = Number(rev.delivery || 0);
  const totalRev = card + cash + delivery;

  const food = Number(cost.food || 0);
  const supplies = Number(cost.supplies || 0);
  const labor = Number(cost.labor || 0);
  const rent = Number(cost.rent || 0);
  const other = Number(cost.other || 0);
  const totalCost = food + supplies + labor + rent + other;

  const customers = Number(m.customers || 0);
  const profit = totalRev - totalCost;
  const marginPct = totalRev > 0 ? (profit / totalRev) * 100 : 0;
  const avgTicket = customers > 0 ? totalRev / customers : 0;

  return {
    date: row.period_start,
    revenue: totalRev,
    revenueBreakdown: { card, cash, delivery },
    cost: totalCost,
    costBreakdown: { food, supplies, labor, rent, other },
    profit,
    marginPct,
    customers,
    avgTicket,
    memo: row.memo ?? null,
  };
}

export interface WeeklyRollup {
  weekStart: string;        // 월요일
  weekLabel: string;        // "4월 1주"
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  days: number;             // 입력된 날짜 수 (0~7)
}

/**
 * 일일 rows 를 주 단위로 집계.
 * 주 시작: 월요일. 한국 주차 라벨 사용 (ex: "4월 3주").
 */
export function rollupWeekly(dailies: AnchorDaily[]): WeeklyRollup[] {
  const map = new Map<string, AnchorDaily[]>();
  for (const d of dailies) {
    const monday = getMonday(d.date);
    const list = map.get(monday) || [];
    list.push(d);
    map.set(monday, list);
  }

  return Array.from(map.entries())
    .map(([weekStart, days]) => {
      const revenue = days.reduce((s, d) => s + d.revenue, 0);
      const cost = days.reduce((s, d) => s + d.cost, 0);
      const profit = revenue - cost;
      const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
      return {
        weekStart,
        weekLabel: weekLabelKo(weekStart),
        revenue,
        cost,
        profit,
        marginPct,
        days: days.length,
      };
    })
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function weekLabelKo(mondayStr: string): string {
  const d = new Date(mondayStr + "T00:00:00");
  const month = d.getMonth() + 1;
  // 해당 월의 몇 번째 월요일인가
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const firstMonday = new Date(first);
  firstMonday.setDate(1 + ((1 - first.getDay() + 7) % 7));
  const weekNum = Math.floor((d.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${month}월 ${weekNum}주`;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 월 시작일 기준 기간 */
export function monthBoundaries(d: Date = new Date()): { start: string; end: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** "₩1,234,567" 포맷 */
export function fmtKRW(n: number): string {
  if (!Number.isFinite(n)) return "₩0";
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

/** "1.23M" 축약 */
export function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_0000_0000) return (n / 1_0000_0000).toFixed(1) + "억";
  if (Math.abs(n) >= 1_0000) return Math.round(n / 1_0000) + "만";
  return Math.round(n).toString();
}

export function fmtPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "0%";
  return n.toFixed(digits) + "%";
}
