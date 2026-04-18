"use client";

import { useState } from "react";
import { toast } from "sonner";

type Kind = "insights" | "feedback";

interface InsightsSummary {
  themes: { title: string; frequency: number; representative_quote: string; pain_severity: "low" | "medium" | "high" }[];
  personas: { name: string; traits: string[] }[];
  top_pain_points: string[];
  next_steps: string[];
}

interface FeedbackSummary {
  sentiment: { positive: number; neutral: number; negative: number; avg_score: number };
  strengths: string[];
  weaknesses: string[];
  critical_issues: string[];
  iteration_suggestions: string[];
}

interface Props {
  projectId: string;
  kind: Kind;
  enabled: boolean;
  disabledReason?: string;
}

export function VentureAISummary({ projectId, kind, enabled, disabledReason }: Props) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<InsightsSummary | FeedbackSummary | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/venture/${projectId}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "요약 실패");
      setSummary(data.summary);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "실패");
    } finally {
      setLoading(false);
    }
  };

  const label = kind === "insights" ? "인사이트 패턴 분석" : "피드백 구조화";
  const icon = kind === "insights" ? "🔍" : "📊";

  return (
    <div className="border-[2px] border-dashed border-nu-pink bg-nu-pink/5 p-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
            {icon} AI {label}
          </div>
          <p className="text-[12px] text-nu-graphite mt-0.5">
            {kind === "insights"
              ? "수집된 유저 인터뷰에서 반복 주제 / 페르소나 / 핵심 고통점을 추출합니다."
              : "유저 테스트 피드백을 감정 분포 / 강점 / 약점 / 개선 제안으로 구조화합니다."}
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading || !enabled}
          title={enabled ? undefined : disabledReason}
          className="h-9 px-3 border-[2.5px] border-nu-pink bg-nu-paper text-nu-pink font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-pink hover:text-nu-paper disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "AI 분석 중..." : summary ? "↻ 다시 분석" : `${icon} ${label}`}
        </button>
      </div>

      {!enabled && disabledReason && !summary && (
        <p className="text-[11px] text-orange-600">⚠ {disabledReason}</p>
      )}

      {summary && kind === "insights" && <InsightsView data={summary as InsightsSummary} />}
      {summary && kind === "feedback" && <FeedbackView data={summary as FeedbackSummary} />}
    </div>
  );
}

function InsightsView({ data }: { data: InsightsSummary }) {
  const severityColor = (s: string) =>
    s === "high" ? "bg-red-500 text-white" : s === "medium" ? "bg-orange-400 text-nu-ink" : "bg-yellow-200 text-nu-ink";

  return (
    <div className="space-y-4">
      {/* 반복 주제 */}
      <div>
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">반복 주제</div>
        <div className="space-y-2">
          {data.themes.map((t, i) => (
            <div key={i} className="border-[2px] border-nu-ink bg-nu-paper p-3">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`font-mono-nu text-[9px] uppercase tracking-wider px-1.5 py-0.5 ${severityColor(t.pain_severity)}`}>
                  {t.pain_severity.toUpperCase()}
                </span>
                <h4 className="font-bold text-[14px] text-nu-ink flex-1">{t.title}</h4>
                <span className="font-mono-nu text-[11px] text-nu-graphite">
                  {t.frequency}건
                </span>
              </div>
              <p className="text-[12px] text-nu-graphite italic">&ldquo;{t.representative_quote}&rdquo;</p>
            </div>
          ))}
        </div>
      </div>

      {/* 페르소나 */}
      {data.personas.length > 0 && (
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">추출된 페르소나</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.personas.map((p, i) => (
              <div key={i} className="border-[2px] border-nu-ink bg-nu-paper p-3">
                <h4 className="font-bold text-[13px] text-nu-ink mb-1.5">{p.name}</h4>
                <ul className="space-y-0.5">
                  {p.traits.map((tr, j) => (
                    <li key={j} className="text-[11px] text-nu-graphite">· {tr}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 핵심 고통점 + 다음 단계 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">🩹 핵심 고통점</div>
          <ol className="list-decimal pl-5 space-y-1">
            {data.top_pain_points.map((p, i) => (
              <li key={i} className="text-[13px] text-nu-ink">{p}</li>
            ))}
          </ol>
        </div>
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink mb-2">→ 다음 HMW 방향</div>
          <ul className="space-y-1">
            {data.next_steps.map((s, i) => (
              <li key={i} className="text-[13px] text-nu-ink border-l-[2px] border-nu-pink pl-2">{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function FeedbackView({ data }: { data: FeedbackSummary }) {
  return (
    <div className="space-y-4">
      {/* 감정 분포 */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">
            감정 분포
          </div>
          <div className="font-mono-nu text-[11px] text-nu-ink">
            평균 <strong className="text-nu-pink text-[14px]">{data.sentiment.avg_score.toFixed(1)}</strong>/10
          </div>
        </div>
        <div className="flex h-6 border-[2px] border-nu-ink overflow-hidden">
          <div className="bg-green-500 flex items-center justify-center text-[10px] font-bold text-white" style={{ width: `${data.sentiment.positive}%` }}>
            {data.sentiment.positive > 10 ? `${data.sentiment.positive}%` : ""}
          </div>
          <div className="bg-nu-graphite/30 flex items-center justify-center text-[10px] text-nu-ink" style={{ width: `${data.sentiment.neutral}%` }}>
            {data.sentiment.neutral > 10 ? `${data.sentiment.neutral}%` : ""}
          </div>
          <div className="bg-red-500 flex items-center justify-center text-[10px] font-bold text-white" style={{ width: `${data.sentiment.negative}%` }}>
            {data.sentiment.negative > 10 ? `${data.sentiment.negative}%` : ""}
          </div>
        </div>
        <div className="flex justify-between text-[10px] font-mono-nu text-nu-graphite mt-1">
          <span>긍정 {data.sentiment.positive}%</span>
          <span>중립 {data.sentiment.neutral}%</span>
          <span>부정 {data.sentiment.negative}%</span>
        </div>
      </div>

      {/* 강점 + 약점 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Group title="✓ 강점" items={data.strengths} color="green" />
        <Group title="△ 약점" items={data.weaknesses} color="orange" />
      </div>

      {/* 크리티컬 + 이터레이션 */}
      {data.critical_issues.length > 0 && (
        <Group title="🚨 즉시 해결 필요" items={data.critical_issues} color="red" />
      )}
      <Group title="→ 다음 이터레이션 추천" items={data.iteration_suggestions} color="pink" />
    </div>
  );
}

function Group({ title, items, color }: { title: string; items: string[]; color: "green" | "orange" | "red" | "pink" }) {
  if (!items || items.length === 0) return null;
  const borderCls = {
    green:  "border-green-600",
    orange: "border-orange-500",
    red:    "border-red-500",
    pink:   "border-nu-pink",
  }[color];
  return (
    <div className={`border-l-[3px] ${borderCls} pl-3`}>
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
        {title}
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-[13px] text-nu-ink">{it}</li>
        ))}
      </ul>
    </div>
  );
}
