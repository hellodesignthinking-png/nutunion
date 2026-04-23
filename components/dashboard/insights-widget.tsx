"use client";

/**
 * InsightsWidget — 대시보드용 최신 주간/월간 인사이트 카드.
 *
 * Tabs: 📅 주간 / 📆 월간
 * - 최신 리포트 1건 표시 (period · 성장 포인트 · 다음 우선순위)
 * - "📊 전체 리포트" → /insights
 * - "🔄 지금 생성" → /api/cron/insights-weekly | insights-monthly 수동 트리거 (테스트용)
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Sparkles, RefreshCw, ChevronRight, Loader2, Calendar, CalendarDays } from "lucide-react";

interface InsightReport {
  id: string;
  period: "weekly" | "monthly";
  period_start: string;
  period_end: string;
  content: any;
  model_used?: string | null;
  created_at: string;
}

export function InsightsWidget() {
  const [tab, setTab] = useState<"weekly" | "monthly">("weekly");
  const [reports, setReports] = useState<Record<"weekly" | "monthly", InsightReport | null>>({
    weekly: null,
    monthly: null,
  });
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: weekly } = await supabase
        .from("insight_reports")
        .select("*")
        .eq("period", "weekly")
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: monthly } = await supabase
        .from("insight_reports")
        .select("*")
        .eq("period", "monthly")
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      setReports({
        weekly: (weekly as InsightReport) || null,
        monthly: (monthly as InsightReport) || null,
      });
    } catch { /* table may not exist yet */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function triggerNow() {
    setTriggering(true);
    try {
      const res = await fetch("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: tab }),
      });
      if (!res.ok) throw new Error(`생성 실패 (${res.status})`);
      toast.success("인사이트 생성이 시작되었습니다");
      // Optimistic reload after short delay
      setTimeout(() => { load(); }, 1500);
    } catch (e: any) {
      toast.error(e?.message || "생성 실패");
    } finally {
      setTriggering(false);
    }
  }

  const current = reports[tab];
  const summary: string = current?.content?.summary || "";
  const stats = current?.content?.stats || {};

  return (
    <section className="bg-amber-50/40 border-2 border-amber-800/60 shadow-[4px_4px_0px_rgba(13,13,13,0.08)] p-5 mb-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-amber-200 text-nu-ink border-[2px] border-amber-800">
            <Sparkles size={10} /> 회고 리포트
          </span>
          <span className="font-head text-sm font-black text-nu-ink uppercase tracking-tight">
            지난 주 · 지난 달 AI 인사이트
          </span>
          <span className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">past-tense</span>
        </div>
        <Link
          href="/insights"
          className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink hover:underline flex items-center gap-1"
        >
          📊 전체 리포트 <ChevronRight size={11} />
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-nu-ink/10 mb-3">
        <button
          onClick={() => setTab("weekly")}
          className={`px-3 py-2 font-mono-nu text-[12px] uppercase tracking-widest border-b-2 -mb-[2px] transition-colors flex items-center gap-1.5 ${
            tab === "weekly" ? "border-nu-pink text-nu-pink" : "border-transparent text-nu-muted hover:text-nu-ink"
          }`}
        >
          <Calendar size={12} /> 📅 주간
        </button>
        <button
          onClick={() => setTab("monthly")}
          className={`px-3 py-2 font-mono-nu text-[12px] uppercase tracking-widest border-b-2 -mb-[2px] transition-colors flex items-center gap-1.5 ${
            tab === "monthly" ? "border-nu-pink text-nu-pink" : "border-transparent text-nu-muted hover:text-nu-ink"
          }`}
        >
          <CalendarDays size={12} /> 📆 월간
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-nu-muted text-xs py-6 justify-center">
          <Loader2 size={12} className="animate-spin" /> 불러오는 중...
        </div>
      ) : current ? (
        <div>
          <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest mb-2">
            {current.period_start} → {current.period_end}
          </p>
          <p className="text-sm md:text-base text-nu-ink leading-relaxed whitespace-pre-wrap mb-3">
            {summary || "요약이 비어있습니다."}
          </p>
          <div className="flex flex-wrap gap-2 mb-2 max-w-full">
            {Object.entries(stats).map(([k, v]) => (
              <span key={k} className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-nu-cream/50 border border-nu-ink/10">
                {k.replace(/_/g, " ")}: {String(v)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-nu-muted">
          <p className="text-xs mb-2">아직 {tab === "weekly" ? "주간" : "월간"} 리포트가 없습니다.</p>
          <p className="font-mono-nu text-[10px] uppercase tracking-widest">
            {tab === "weekly" ? "매주 월요일 오전" : "매월 1일 오전"}에 자동 생성됩니다
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-nu-ink/10">
        <button
          onClick={triggerNow}
          disabled={triggering}
          className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border-2 border-nu-ink/20 hover:border-nu-pink hover:text-nu-pink transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          {triggering ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          🔄 지금 생성
        </button>
        <span className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">테스트용 — 일반적으로 cron 이 자동 실행</span>
      </div>
    </section>
  );
}
