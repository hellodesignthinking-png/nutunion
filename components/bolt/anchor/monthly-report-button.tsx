"use client";

/**
 * MonthlyReportButton — 이번 달 일별 매출 + 주간 P&L + 요약을 PDF 로 저장.
 *
 * 구현 전략 (가벼운 버전):
 *  - `window.print()` + `@media print` CSS
 *  - 인쇄용 섹션을 화면 밖에 숨겨두고, 프린트 시에만 표시
 *  - 사용자는 브라우저 프린트 다이얼로그에서 "PDF로 저장" 선택
 */

import { useRef } from "react";
import { FileDown, Printer } from "lucide-react";
import type { AnchorDaily, WeeklyRollup } from "@/lib/bolt/anchor-metrics";
import { fmtKRW, fmtPct, fmtCompact } from "@/lib/bolt/anchor-metrics";

interface Props {
  projectId: string;
  title: string;
  dailies: AnchorDaily[];
  weeks: WeeklyRollup[];
  monthlyGoalKrw?: number | null;
  year: number;
  month: number;
}

export function MonthlyReportButton({
  title,
  dailies,
  weeks,
  monthlyGoalKrw,
  year,
  month,
}: Props) {
  const reportRef = useRef<HTMLDivElement>(null);

  const totalRevenue = dailies.reduce((s, d) => s + d.revenue, 0);
  const totalCost = dailies.reduce((s, d) => s + d.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const totalCustomers = dailies.reduce((s, d) => s + d.customers, 0);
  const avgTicket = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const goalPct = monthlyGoalKrw ? (totalRevenue / monthlyGoalKrw) * 100 : null;

  const generatedAt = new Date().toLocaleString("ko-KR");

  function print() {
    window.print();
  }

  return (
    <>
      <button
        onClick={print}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 border-[2.5px] border-nu-ink bg-white rounded-[var(--ds-radius-xl)] hover:bg-nu-cream/30 transition-colors print:hidden"
      >
        <div className="flex items-center gap-2">
          <FileDown size={16} className="text-nu-ink" />
          <div className="text-left">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-ink font-bold">
              Monthly Report
            </div>
            <div className="text-[12px] text-nu-graphite">
              {year}년 {month}월 · P&L + 일별 상세 PDF 저장
            </div>
          </div>
        </div>
        <Printer size={14} className="text-nu-graphite" />
      </button>

      {/* 인쇄 전용 레이아웃 — 화면엔 보이지 않고, print 시에만 노출 */}
      <div ref={reportRef} className="hidden print:block anchor-print-report">
        <style jsx global>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 16mm 14mm;
            }
            body * {
              visibility: hidden;
            }
            .anchor-print-report,
            .anchor-print-report * {
              visibility: visible;
            }
            .anchor-print-report {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white;
              color: #0D0D0D;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .print-kpi-grid { page-break-inside: avoid; }
            .print-table { page-break-inside: auto; }
            .print-table tr { page-break-inside: avoid; }
          }
        `}</style>

        {/* 헤더 */}
        <header style={{ borderBottom: "3px solid #0D0D0D", paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "#FF48B0", fontWeight: 800 }}>
            nutunion · Anchor Monthly Report
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: "4px 0 2px" }}>
            {title}
          </h1>
          <div style={{ fontSize: 12, color: "#6B6860" }}>
            {year}년 {month}월 월간 보고서 · 생성 {generatedAt}
          </div>
        </header>

        {/* KPI 요약 */}
        <section className="print-kpi-grid" style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#6B6860", fontWeight: 800, marginBottom: 6 }}>
            Summary
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <tbody>
              <Row label="총 매출" value={fmtKRW(totalRevenue)} accent="#FF48B0" />
              <Row label="총 비용" value={fmtKRW(totalCost)} />
              <Row label="순이익" value={fmtKRW(totalProfit)} accent={totalProfit >= 0 ? "#047857" : "#FF48B0"} bold />
              <Row label="마진율" value={fmtPct(marginPct)} />
              <Row label="총 객수 (누적)" value={`${totalCustomers.toLocaleString("ko-KR")} 명`} />
              <Row label="평균 객단가" value={fmtKRW(avgTicket)} />
              {monthlyGoalKrw && (
                <Row
                  label={`월매출 목표`}
                  value={`${fmtKRW(monthlyGoalKrw)} · 달성 ${goalPct?.toFixed(0) ?? 0}%`}
                />
              )}
              <Row label="입력 일수" value={`${dailies.filter(d => d.revenue > 0).length}일`} />
            </tbody>
          </table>
        </section>

        {/* 주간 P&L */}
        {weeks.length > 0 && (
          <section style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#6B6860", fontWeight: 800, marginBottom: 6 }}>
              Weekly P&L
            </div>
            <table className="print-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #0D0D0D" }}>
                  <Th>주차</Th>
                  <Th align="right">매출</Th>
                  <Th align="right">비용</Th>
                  <Th align="right">순이익</Th>
                  <Th align="right">마진</Th>
                  <Th align="right">일수</Th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.weekStart} style={{ borderBottom: "1px solid #e5e5e5" }}>
                    <Td>{w.weekLabel} <span style={{ color: "#999", fontSize: 9 }}>({w.weekStart})</span></Td>
                    <Td align="right" mono>{fmtCompact(w.revenue)}</Td>
                    <Td align="right" mono>{fmtCompact(w.cost)}</Td>
                    <Td align="right" mono bold>{fmtCompact(w.profit)}</Td>
                    <Td align="right" mono>{fmtPct(w.marginPct)}</Td>
                    <Td align="right" mono>{w.days}/7</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* 일별 상세 */}
        <section>
          <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#6B6860", fontWeight: 800, marginBottom: 6 }}>
            Daily Details
          </div>
          <table className="print-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #0D0D0D" }}>
                <Th>날짜</Th>
                <Th align="right">매출</Th>
                <Th align="right">비용</Th>
                <Th align="right">순이익</Th>
                <Th align="right">객수</Th>
                <Th align="right">객단가</Th>
                <Th>메모</Th>
              </tr>
            </thead>
            <tbody>
              {dailies
                .filter((d) => d.revenue > 0 || d.cost > 0)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((d) => (
                  <tr key={d.date} style={{ borderBottom: "1px solid #eee" }}>
                    <Td mono>{d.date}</Td>
                    <Td align="right" mono>{fmtCompact(d.revenue)}</Td>
                    <Td align="right" mono>{fmtCompact(d.cost)}</Td>
                    <Td align="right" mono>{fmtCompact(d.profit)}</Td>
                    <Td align="right" mono>{d.customers}</Td>
                    <Td align="right" mono>{d.avgTicket > 0 ? fmtCompact(d.avgTicket) : "—"}</Td>
                    <Td>{d.memo || ""}</Td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>

        <footer style={{ marginTop: 20, paddingTop: 10, borderTop: "1px solid #ccc", fontSize: 9, color: "#999", textAlign: "center" }}>
          Generated by nutunion · https://nutunion.co.kr · {generatedAt}
        </footer>
      </div>
    </>
  );
}

function Row({ label, value, accent, bold }: { label: string; value: string; accent?: string; bold?: boolean }) {
  return (
    <tr style={{ borderBottom: "1px dashed #eee" }}>
      <td style={{ padding: "6px 0", color: "#6B6860" }}>{label}</td>
      <td style={{ padding: "6px 0", textAlign: "right", color: accent || "#0D0D0D", fontWeight: bold ? 800 : 600, fontFamily: "ui-monospace,monospace" }}>
        {value}
      </td>
    </tr>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{ padding: "4px 6px", textAlign: align || "left", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "#6B6860", fontWeight: 800 }}>
      {children}
    </th>
  );
}

function Td({ children, align, mono, bold }: { children: React.ReactNode; align?: "left" | "right"; mono?: boolean; bold?: boolean }) {
  return (
    <td
      style={{
        padding: "3px 6px",
        textAlign: align || "left",
        fontFamily: mono ? "ui-monospace,monospace" : "inherit",
        fontWeight: bold ? 700 : 400,
      }}
    >
      {children}
    </td>
  );
}
