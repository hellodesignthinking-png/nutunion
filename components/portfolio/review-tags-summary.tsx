"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThumbsUp, Quote, Loader2 } from "lucide-react";

// 069 마이그레이션의 12개 태그 → 라벨/축 매핑 (리뷰 모달과 일치)
const TAG_META: Record<string, { label: string; emoji: string; axis: "execution" | "communication" | "mindset" }> = {
  deadline_keeper:        { emoji: "⏰", label: "마감엄수", axis: "execution" },
  high_quality:           { emoji: "💎", label: "퀄리티",   axis: "execution" },
  initiative:             { emoji: "🚀", label: "적극성",   axis: "execution" },
  delivers_promise:       { emoji: "✅", label: "약속이행", axis: "execution" },
  clear_communication:    { emoji: "💬", label: "명확 소통", axis: "communication" },
  responsive:             { emoji: "⚡", label: "빠른 응답", axis: "communication" },
  good_listener:          { emoji: "👂", label: "경청",       axis: "communication" },
  constructive_feedback:  { emoji: "📝", label: "피드백",    axis: "communication" },
  leads:                  { emoji: "🎯", label: "리드",       axis: "mindset" },
  collaborative:          { emoji: "🤝", label: "협업",       axis: "mindset" },
  learns_fast:            { emoji: "📚", label: "학습력",    axis: "mindset" },
  calm_under_pressure:    { emoji: "🧘", label: "침착함",    axis: "mindset" },
};

const AXIS_COLOR = {
  execution:     "text-nu-pink bg-nu-pink/10 border-nu-pink/30",
  communication: "text-nu-blue bg-nu-blue/10 border-nu-blue/30",
  mindset:       "text-nu-amber bg-nu-amber/10 border-nu-amber/30",
};

interface Review {
  id: string;
  tags: string[];
  overall_note: string | null;
  would_work_again: boolean | null;
  visibility: string;
  created_at: string;
  project?: { id: string; title: string } | null;
  reviewer?: { id: string; nickname: string } | null;
}

export function ReviewTagsSummary({ targetUserId }: { targetUserId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      // PostgREST 에서 profiles 로 가는 FK 가 2개 (reviewer_id, target_user_id) 라
      // 반드시 명시적 FK hint 가 필요. target_user_id 는 where 로만 쓰니 embed 는 reviewer 쪽만.
      const { data, error } = await supabase
        .from("project_reviews")
        .select(
          "id, tags, overall_note, would_work_again, visibility, created_at, " +
          "project:projects(id,title), " +
          "reviewer:profiles!project_reviews_reviewer_id_fkey(id,nickname)"
        )
        .eq("target_user_id", targetUserId)
        .order("created_at", { ascending: false });
      if (!error && data) setReviews(data as any);
      // RLS 가 visibility 를 필터하므로 클라이언트에서 중복 필터 제거 —
      // 포트폴리오 소유자 본인도 자기 private 리뷰를 볼 수 있게.
      setLoading(false);
    })();
  }, [targetUserId]);

  if (loading) {
    return (
      <div className="border-[2px] border-nu-ink/10 p-6 flex items-center justify-center">
        <Loader2 size={16} className="animate-spin text-nu-muted" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="border-[2px] border-dashed border-nu-ink/15 p-6 text-center">
        <Quote size={20} className="mx-auto text-nu-muted mb-2" />
        <p className="text-[12px] text-nu-graphite">아직 받은 리뷰가 없습니다</p>
        <p className="text-[11px] text-nu-muted mt-1">볼트를 마감하면 팀원이 리뷰를 남길 수 있어요</p>
      </div>
    );
  }

  // 태그 집계
  const tagCounts = new Map<string, number>();
  for (const r of reviews) {
    for (const t of r.tags || []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

  // 추천 의사
  const recCount = reviews.filter((r) => r.would_work_again === true).length;
  const totalRec = reviews.filter((r) => r.would_work_again !== null).length;
  const recPct = totalRec > 0 ? Math.round((recCount / totalRec) * 100) : null;

  // 한줄평 (최신 3개)
  const notes = reviews.filter((r) => r.overall_note && r.overall_note.trim()).slice(0, 3);

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper overflow-hidden">
      <header className="px-4 py-3 border-b-[2px] border-nu-ink bg-gradient-to-r from-nu-pink/5 to-nu-amber/5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite">
              <ThumbsUp size={11} className="inline mr-1" /> 동료 리뷰 ({reviews.length}건)
            </div>
            {recPct !== null && (
              <p className="text-[12px] text-nu-ink mt-0.5">
                <span className="font-head text-[20px] font-extrabold text-green-600 tabular-nums">{recPct}%</span>
                <span className="font-mono-nu text-[11px] text-nu-graphite ml-1.5">다시 함께 일하고 싶어 함</span>
                <span className="text-nu-muted ml-1">({recCount}/{totalRec})</span>
              </p>
            )}
          </div>
        </div>
      </header>

      {/* 축별 누적 비율 — "이 와셔의 색깔" */}
      <div className="p-4 space-y-3">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite font-bold mb-2">
            🎨 이 와셔의 색깔
          </div>
          {(["execution", "communication", "mindset"] as const).map((axis) => {
            const axisTags = sortedTags.filter(([key]) => TAG_META[key]?.axis === axis);
            const axisTotal = axisTags.reduce((s, [, c]) => s + c, 0);
            const topTwo = axisTags.slice(0, 2);
            const maxCount = Math.max(1, ...axisTags.map(([, c]) => c));
            const meta = { execution: { label: "실행력", emoji: "⚡", bar: "bg-nu-pink", border: "border-nu-pink" },
                          communication: { label: "커뮤니케이션", emoji: "💬", bar: "bg-nu-blue", border: "border-nu-blue" },
                          mindset: { label: "협업 마인드셋", emoji: "🤝", bar: "bg-nu-amber", border: "border-nu-amber" } }[axis];
            return (
              <div key={axis} className="mb-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono-nu text-[10px] uppercase tracking-widest font-bold ${axis === "execution" ? "text-nu-pink" : axis === "communication" ? "text-nu-blue" : "text-nu-amber"}`}>
                    {meta.emoji} {meta.label}
                  </span>
                  <span className="font-mono-nu text-[10px] text-nu-graphite tabular-nums">
                    {axisTotal}회
                  </span>
                </div>
                {topTwo.length > 0 ? (
                  <div className="space-y-1">
                    {topTwo.map(([key, count]) => {
                      const tm = TAG_META[key];
                      if (!tm) return null;
                      const pct = Math.round((count / maxCount) * 100);
                      const popularity = Math.round((count / reviews.length) * 100);
                      return (
                        <div key={key} className="flex items-center gap-2 text-[11px]">
                          <span className="w-[100px] shrink-0 text-nu-ink">
                            {tm.emoji} {tm.label}
                          </span>
                          <div className="flex-1 h-2 bg-nu-ink/5 overflow-hidden">
                            <div className={`h-full ${meta.bar} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-[56px] text-right font-mono-nu text-[10px] tabular-nums text-nu-graphite">
                            <strong className="text-nu-ink">{popularity}%</strong> · {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-nu-muted italic">아직 태그 없음</p>
                )}
              </div>
            );
          })}
        </div>

        {/* 나머지 태그 (축 집계 아래) */}
        <div className="pt-3 border-t border-nu-ink/10">
          <div className="font-mono-nu text-[9px] uppercase tracking-[0.25em] text-nu-muted mb-1.5">전체 태그</div>
          <div className="flex flex-wrap gap-1.5">
            {sortedTags.map(([key, count]) => {
              const tmeta = TAG_META[key];
              if (!tmeta) return null;
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 px-2 py-1 border-[1.5px] font-mono-nu text-[11px] ${AXIS_COLOR[tmeta.axis]}`}
                  title={`${tmeta.label} — ${count}회`}
                >
                  <span>{tmeta.emoji}</span>
                  <span className="font-bold">{tmeta.label}</span>
                  <span className="opacity-70 tabular-nums">×{count}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* 한줄평 */}
        {notes.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-nu-ink/10">
            {notes.map((n) => (
              <blockquote key={n.id} className="pl-3 border-l-[3px] border-nu-pink/30 text-[12px] text-nu-graphite leading-relaxed italic">
                &ldquo;{n.overall_note}&rdquo;
                <div className="font-mono-nu text-[10px] text-nu-muted mt-0.5 not-italic">
                  — {n.reviewer?.nickname || "익명"}
                  {n.project && <span> · {n.project.title}</span>}
                </div>
              </blockquote>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
