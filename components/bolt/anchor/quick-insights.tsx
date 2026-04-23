"use client";

/**
 * QuickInsights — Anchor 최근 21일 데이터를 AI가 분석해서 인사이트 3~5개 출력.
 *
 * - 요청은 명시적 (버튼 클릭) — 토큰 비용 통제
 * - 결과는 세션 내 캐시 (프로젝트ID 별)
 */

import { useState } from "react";
import { Sparkles, Loader2, Info, AlertTriangle, TrendingUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Insight {
  emoji: string;
  text: string;
  severity?: "info" | "warning" | "alert";
}

interface Props {
  projectId: string;
}

export function QuickInsights({ projectId }: Props) {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/anchor-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석 실패");
      setInsights(data.insights || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!insights) {
    return (
      <section className="border-[2.5px] border-dashed border-nu-pink/40 bg-gradient-to-br from-nu-pink/5 to-nu-amber/5 rounded-[var(--ds-radius-xl)] p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-nu-pink text-white rounded-full flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="flex-1">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold">
              AI Quick Insights
            </div>
            <p className="text-[13px] text-nu-ink font-semibold mt-1">
              최근 21일 데이터를 분석해서 <strong>실무 인사이트 3~5개</strong>를 뽑아드려요.
            </p>
            <p className="text-[11px] text-nu-graphite mt-1">
              예시: "주말 매출이 평일 대비 1.8배", "객단가 3주 연속 상승 중", "원가율이 2주 초과" 등.
            </p>
            <button
              onClick={analyze}
              disabled={loading}
              className="mt-3 px-4 py-2 bg-nu-ink text-white rounded-[var(--ds-radius-md)] text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> 분석 중
                </>
              ) : (
                <>
                  <Sparkles size={12} /> 인사이트 생성
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper rounded-[var(--ds-radius-xl)] overflow-hidden">
      <header className="px-5 py-3 border-b-[2px] border-nu-ink bg-gradient-to-r from-nu-pink/10 to-nu-amber/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-nu-pink" />
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold">
            AI Quick Insights
          </span>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border border-nu-ink/20 hover:bg-nu-ink hover:text-white rounded inline-flex items-center gap-1"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          다시 분석
        </button>
      </header>
      <div className="p-4 space-y-2">
        {summary && (
          <div className="p-3 bg-nu-cream/30 rounded text-[12px] text-nu-ink italic leading-[1.6] border-l-[3px] border-nu-pink/40">
            {summary}
          </div>
        )}
        {insights.length === 0 ? (
          <div className="text-[12px] text-nu-graphite p-2">인사이트를 뽑지 못했어요.</div>
        ) : (
          <ul className="space-y-2">
            {insights.map((ins, i) => {
              const cls =
                ins.severity === "alert"
                  ? "border-red-400 bg-red-50 text-red-900"
                  : ins.severity === "warning"
                    ? "border-yellow-400 bg-yellow-50 text-yellow-900"
                    : "border-nu-ink/10 bg-white text-nu-ink";
              const Icon =
                ins.severity === "alert" ? AlertTriangle :
                ins.severity === "warning" ? Info : TrendingUp;
              return (
                <li
                  key={i}
                  className={`flex items-start gap-2 p-3 border-l-[3px] rounded ${cls}`}
                >
                  <span className="text-[16px] leading-none">{ins.emoji}</span>
                  <span className="text-[13px] leading-[1.6] flex-1">{ins.text}</span>
                  <Icon size={12} className="opacity-40 shrink-0 mt-0.5" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
