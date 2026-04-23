"use client";

/**
 * /insights — 주간/월간 AI 인사이트 리포트 전체 히스토리.
 * 브루탈리스트 카드 리스트, 기간 필터(주간/월간/전체).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, ArrowLeft, Calendar, CalendarDays, Loader2 } from "lucide-react";

interface InsightReport {
  id: string;
  period: "weekly" | "monthly";
  period_start: string;
  period_end: string;
  content: any;
  model_used?: string | null;
  created_at: string;
}

export default function InsightsPage() {
  const [reports, setReports] = useState<InsightReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "weekly" | "monthly">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      let q = supabase
        .from("insight_reports")
        .select("*")
        .order("period_start", { ascending: false })
        .limit(100);
      if (filter !== "all") q = q.eq("period", filter);
      const { data } = await q;
      setReports((data as InsightReport[]) || []);
    } catch { setReports([]); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center gap-2 mb-2">
        <Link href="/dashboard" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-ink flex items-center gap-1 no-underline">
          <ArrowLeft size={11} /> 대시보드
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-nu-pink" />
          <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink font-bold">AI Insights</span>
        </div>
        <h1 className="font-head text-3xl md:text-4xl font-extrabold text-nu-ink tracking-tight">
          인사이트 리포트 히스토리
        </h1>
        <p className="font-mono-nu text-[13px] text-nu-muted uppercase tracking-widest mt-1">
          매주/매월 자동 생성되는 나의 성장 코칭 기록
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {([
          { key: "all" as const, label: "전체" },
          { key: "weekly" as const, label: "📅 주간", icon: Calendar },
          { key: "monthly" as const, label: "📆 월간", icon: CalendarDays },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`font-mono-nu text-[12px] uppercase tracking-widest px-3 py-2 border-2 transition-colors ${
              filter === f.key ? "bg-nu-ink text-nu-paper border-nu-ink" : "border-nu-ink/15 text-nu-muted hover:border-nu-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-nu-muted text-sm py-12 justify-center">
          <Loader2 size={14} className="animate-spin" /> 불러오는 중...
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-nu-white border-2 border-dashed border-nu-ink/15 p-10 text-center">
          <Sparkles size={28} className="text-nu-ink/20 mx-auto mb-3" />
          <p className="text-nu-muted text-sm mb-1">아직 리포트가 없습니다</p>
          <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">
            매주 월요일 · 매월 1일 오전에 자동 생성됩니다
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report }: { report: InsightReport }) {
  const summary: string = report.content?.summary || "";
  const stats = report.content?.stats || {};
  const isWeekly = report.period === "weekly";

  return (
    <article className="bg-nu-white border-2 border-nu-ink shadow-[4px_4px_0px_rgba(13,13,13,0.08)] p-5">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className={`font-mono-nu text-[10px] font-black uppercase tracking-widest px-2 py-0.5 ${
            isWeekly ? "bg-nu-blue/10 text-nu-blue border border-nu-blue/20" : "bg-nu-pink/10 text-nu-pink border border-nu-pink/20"
          }`}>
            {isWeekly ? "📅 주간" : "📆 월간"}
          </span>
          <span className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">
            {report.period_start} → {report.period_end}
          </span>
        </div>
        {report.model_used && (
          <span className="font-mono-nu text-[9px] text-nu-muted/60 uppercase tracking-widest">{report.model_used}</span>
        )}
      </div>
      <p className="text-[14px] text-nu-ink leading-relaxed whitespace-pre-wrap mb-3">
        {summary || "요약이 비어있습니다."}
      </p>
      {Object.keys(stats).length > 0 && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-nu-ink/10">
          {Object.entries(stats).map(([k, v]) => (
            <span key={k} className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-nu-cream/50 border border-nu-ink/10">
              {k.replace(/_/g, " ")}: {String(v)}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
