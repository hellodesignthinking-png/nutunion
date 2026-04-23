"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

/** 경과 초 타이머 훅 — 로딩 진행 체감 개선 */
function useElapsedSeconds(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [active]);
  return elapsed;
}

interface Citation {
  source_id: string;
  title: string;
  kind: string;
  quote: string;
}

interface ProblemCandidate {
  hmw_statement: string;
  target_user?: string;
  context?: string;
  success_metric?: string;
  rationale?: string;
  citations?: Citation[];
}

interface IdeaCandidate {
  title: string;
  description?: string;
  linked_problem_id?: string | null;
  rationale?: string;
  differentiation?: string;
  risk?: string;
  mvp_hint?: string;
  citations?: Citation[];
}

interface ProblemsResult {
  synthesis: string;
  clusters: string[];
  problems: ProblemCandidate[];
  stats: { sources_used: number; insights_used: number; problems_generated: number };
}

interface IdeasResult {
  divergence_note: string;
  ideas: IdeaCandidate[];
  stats: { problems_used: number; sources_used: number; ideas_generated: number };
}

// ── HMW 생성 패널 ─────────────────────────────────────
export function VentureSynthesizeProblemsPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProblemsResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const elapsed = useElapsedSeconds(loading);

  const generate = async () => {
    setLoading(true);
    setResult(null);
    setSelected(new Set());
    try {
      const res = await fetch(`/api/venture/${projectId}/synthesize-problems`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setResult(data);
      // 기본적으로 전부 선택
      setSelected(new Set(data.problems.map((_: unknown, i: number) => i)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const save = async () => {
    if (!result || selected.size === 0) {
      toast.error("저장할 HMW 를 선택하세요");
      return;
    }
    setSaving(true);
    try {
      const chosen = result.problems.filter((_, i) => selected.has(i));
      const res = await fetch(`/api/venture/${projectId}/synthesize-problems/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problems: chosen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      toast.success(`${data.inserted}개 HMW 저장됨`);
      setResult(null);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) return null;

  return (
    <section className="border-[2.5px] border-nu-pink bg-nu-pink/5 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink">
            🎯 AI Define Engine
          </div>
          <div className="font-bold text-[14px] text-nu-ink mt-0.5">
            Source Library + Insights → HMW 후보 생성
          </div>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="h-9 px-3 border-[2px] border-nu-pink bg-nu-pink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:border-nu-ink disabled:opacity-50"
        >
          {loading ? "분석 중..." : result ? "다시 생성" : "AI 로 HMW 생성"}
        </button>
      </div>

      {loading && (
        <div className="py-6 text-center font-mono-nu text-[11px] text-nu-graphite flex flex-col items-center gap-2">
          <Loader2 size={18} className="animate-spin text-nu-pink" />
          <div>
            자료를 종합 분석하는 중...
            <span className="ml-2 tabular-nums text-nu-pink font-bold">{elapsed}s</span>
          </div>
          <div className="text-[10px] text-nu-graphite/70">예상 20~40초 · 경과 표시됨</div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="font-mono-nu text-[10px] text-nu-graphite">
            소스 {result.stats.sources_used}건 · 인사이트 {result.stats.insights_used}건 → HMW {result.stats.problems_generated}개
          </div>

          {result.synthesis && (
            <div className="border-[1.5px] border-nu-ink bg-nu-paper p-3">
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">공통 통찰</div>
              <p className="text-[12px] text-nu-ink leading-relaxed m-0">{result.synthesis}</p>
              {result.clusters && result.clusters.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {result.clusters.map((c) => (
                    <span key={c} className="font-mono-nu text-[10px] bg-nu-ink text-nu-paper px-2 py-0.5">{c}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {result.problems.map((p, i) => (
              <label
                key={i}
                className={`flex gap-3 p-3 border-[2px] cursor-pointer transition-colors ${
                  selected.has(i) ? "border-nu-pink bg-nu-paper" : "border-nu-ink/30 bg-nu-paper/50 hover:border-nu-ink"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                  className="mt-1 w-4 h-4 accent-nu-pink"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] text-nu-ink">{p.hmw_statement}</div>
                  {p.target_user && (
                    <div className="font-mono-nu text-[10px] text-nu-graphite mt-1">👤 {p.target_user}</div>
                  )}
                  {p.context && <p className="text-[12px] text-nu-graphite mt-1.5 leading-relaxed">{p.context}</p>}
                  {p.success_metric && (
                    <div className="text-[11px] text-nu-ink mt-1.5">
                      <span className="font-mono-nu text-[9px] uppercase tracking-widest text-green-700">성공 지표</span>{" "}
                      {p.success_metric}
                    </div>
                  )}
                  {p.rationale && (
                    <div className="text-[11px] text-nu-graphite mt-2 border-l-[2px] border-nu-pink/40 pl-2 italic">{p.rationale}</div>
                  )}
                  {p.citations && p.citations.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {p.citations.map((c, ci) => (
                        <div key={ci} className="text-[10px] text-nu-graphite bg-nu-cream/40 border-l-[2px] border-nu-ink/40 pl-2 py-1">
                          <span className="font-mono-nu uppercase mr-1">{c.kind}</span>
                          <span className="font-bold">{c.title}</span>
                          <span className="block italic">&ldquo;{c.quote}&rdquo;</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving || selected.size === 0}
            className="w-full h-10 border-[2px] border-nu-ink bg-nu-ink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-pink hover:border-nu-pink disabled:opacity-50"
          >
            {saving ? "저장 중..." : `선택한 ${selected.size}개 HMW 저장 →`}
          </button>
        </div>
      )}
    </section>
  );
}

// ── Idea 생성 패널 ─────────────────────────────────────
export function VentureSynthesizeIdeasPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IdeasResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const elapsed = useElapsedSeconds(loading);

  const generate = async () => {
    setLoading(true);
    setResult(null);
    setSelected(new Set());
    try {
      const res = await fetch(`/api/venture/${projectId}/synthesize-ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setResult(data);
      setSelected(new Set(data.ideas.map((_: unknown, i: number) => i)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const save = async () => {
    if (!result || selected.size === 0) return;
    setSaving(true);
    try {
      const chosen = result.ideas.filter((_, i) => selected.has(i));
      const res = await fetch(`/api/venture/${projectId}/synthesize-ideas/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideas: chosen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      toast.success(`${data.inserted}개 아이디어 저장됨`);
      setResult(null);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) return null;

  return (
    <section className="border-[2.5px] border-nu-blue bg-nu-blue/5 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-blue">
            💡 AI Ideate Engine
          </div>
          <div className="font-bold text-[14px] text-nu-ink mt-0.5">
            HMW + Source Library → 아이디어 발산
          </div>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="h-9 px-3 border-[2px] border-nu-blue bg-nu-blue text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:border-nu-ink disabled:opacity-50"
        >
          {loading ? "발산 중..." : result ? "다시 생성" : "AI 로 아이디어 생성"}
        </button>
      </div>

      {loading && (
        <div className="py-6 text-center font-mono-nu text-[11px] text-nu-graphite flex flex-col items-center gap-2">
          <Loader2 size={18} className="animate-spin text-nu-blue" />
          <div>
            문제 + 자료 기반 발산 중...
            <span className="ml-2 tabular-nums text-nu-blue font-bold">{elapsed}s</span>
          </div>
          <div className="text-[10px] text-nu-graphite/70">예상 20~40초</div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="font-mono-nu text-[10px] text-nu-graphite">
            문제 {result.stats.problems_used}건 · 소스 {result.stats.sources_used}건 → 아이디어 {result.stats.ideas_generated}개
          </div>

          {result.divergence_note && (
            <div className="border-[1.5px] border-nu-ink bg-nu-paper p-3">
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">발산 방향</div>
              <p className="text-[12px] text-nu-ink leading-relaxed m-0">{result.divergence_note}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {result.ideas.map((idea, i) => (
              <label
                key={i}
                className={`flex flex-col gap-1 p-3 border-[2px] cursor-pointer transition-colors ${
                  selected.has(i) ? "border-nu-blue bg-nu-paper" : "border-nu-ink/30 bg-nu-paper/50 hover:border-nu-ink"
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggle(i)}
                    className="mt-1 w-4 h-4 accent-nu-blue"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[14px] text-nu-ink">{idea.title}</div>
                    {idea.description && <p className="text-[12px] text-nu-graphite mt-1 leading-relaxed">{idea.description}</p>}
                  </div>
                </div>
                <div className="pl-6 space-y-1.5 mt-1">
                  {idea.differentiation && (
                    <div className="text-[11px]">
                      <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink mr-1">차별점</span>
                      {idea.differentiation}
                    </div>
                  )}
                  {idea.mvp_hint && (
                    <div className="text-[11px]">
                      <span className="font-mono-nu text-[9px] uppercase tracking-widest text-green-700 mr-1">MVP</span>
                      {idea.mvp_hint}
                    </div>
                  )}
                  {idea.risk && (
                    <div className="text-[11px]">
                      <span className="font-mono-nu text-[9px] uppercase tracking-widest text-orange-700 mr-1">리스크</span>
                      {idea.risk}
                    </div>
                  )}
                  {idea.rationale && (
                    <div className="text-[10px] text-nu-graphite border-l-[2px] border-nu-blue/40 pl-2 italic mt-2">{idea.rationale}</div>
                  )}
                  {idea.citations && idea.citations.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {idea.citations.slice(0, 2).map((c, ci) => (
                        <div key={ci} className="text-[9px] text-nu-graphite bg-nu-cream/40 border-l-[2px] border-nu-ink/40 pl-2 py-0.5 italic">
                          {c.title}: &ldquo;{c.quote}&rdquo;
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving || selected.size === 0}
            className="w-full h-10 border-[2px] border-nu-ink bg-nu-ink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-blue hover:border-nu-blue disabled:opacity-50"
          >
            {saving ? "저장 중..." : `선택한 ${selected.size}개 아이디어 저장 →`}
          </button>
        </div>
      )}
    </section>
  );
}
