"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Check, Loader2, ThumbsUp, ThumbsDown, Sparkles } from "lucide-react";
import { toast } from "sonner";

// 다축 태그 — 별점 모방 금지 (관계 누적형)
const REVIEW_TAGS: { key: string; emoji: string; label: string; axis: "execution" | "communication" | "mindset" }[] = [
  // execution
  { key: "deadline_keeper",   emoji: "⏰", label: "마감을 잘 지킨다",     axis: "execution" },
  { key: "high_quality",      emoji: "💎", label: "결과물 퀄리티가 높다", axis: "execution" },
  { key: "initiative",        emoji: "🚀", label: "스스로 일을 찾아한다", axis: "execution" },
  { key: "delivers_promise",  emoji: "✅", label: "말한 건 꼭 한다",       axis: "execution" },
  // communication
  { key: "clear_communication", emoji: "💬", label: "커뮤니케이션이 명확", axis: "communication" },
  { key: "responsive",          emoji: "⚡", label: "빠르게 응답",          axis: "communication" },
  { key: "good_listener",       emoji: "👂", label: "잘 듣는다",           axis: "communication" },
  { key: "constructive_feedback", emoji: "📝", label: "건설적 피드백",      axis: "communication" },
  // mindset
  { key: "leads",             emoji: "🎯", label: "리드를 잘한다",    axis: "mindset" },
  { key: "collaborative",     emoji: "🤝", label: "협업이 편하다",    axis: "mindset" },
  { key: "learns_fast",       emoji: "📚", label: "배움이 빠르다",    axis: "mindset" },
  { key: "calm_under_pressure", emoji: "🧘", label: "위기에 침착함",   axis: "mindset" },
];

const AXIS_META = {
  execution:     { label: "실행력", color: "text-nu-pink",   bg: "bg-nu-pink/10" },
  communication: { label: "커뮤니케이션", color: "text-nu-blue",   bg: "bg-nu-blue/10" },
  mindset:       { label: "협업·마인드셋", color: "text-nu-amber", bg: "bg-nu-amber/10" },
};

interface Props {
  projectId: string;
  projectTitle: string;
  targetUser: { id: string; nickname: string; avatar_url?: string | null };
  reviewerId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function ProjectReviewModal({ projectId, projectTitle, targetUser, reviewerId, onClose, onSaved }: Props) {
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [wouldWorkAgain, setWouldWorkAgain] = useState<boolean | null>(null);
  const [visibility, setVisibility] = useState<"public" | "team" | "private">("public");
  const [saving, setSaving] = useState(false);

  function toggleTag(k: string) {
    if (tags.includes(k)) setTags(tags.filter((t) => t !== k));
    else if (tags.length < 10) setTags([...tags, k]);
    else toast.error("태그는 최대 10개까지");
  }

  async function submit() {
    if (tags.length === 0) {
      toast.error("하나 이상의 태그를 선택해주세요");
      return;
    }
    if (wouldWorkAgain === null) {
      toast.error("다시 함께할 의향을 선택해주세요");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("project_reviews").insert({
      project_id: projectId,
      reviewer_id: reviewerId,
      target_user_id: targetUser.id,
      tags,
      overall_note: note.trim() || null,
      would_work_again: wouldWorkAgain,
      visibility,
    });
    setSaving(false);
    if (error) {
      toast.error("리뷰 저장 실패: " + error.message);
    } else {
      toast.success("리뷰가 저장됐습니다");
      onSaved?.();
      onClose();
    }
  }

  const tagsByAxis = (axis: keyof typeof AXIS_META) => REVIEW_TAGS.filter((t) => t.axis === axis);

  return (
    <div className="fixed inset-0 z-[100] bg-nu-ink/60 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="review-modal-title" className="bg-nu-paper border-[2.5px] border-nu-ink shadow-[8px_8px_0_0_rgba(13,13,13,0.4)] w-full max-w-lg my-8" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-4 border-b-[2px] border-nu-ink bg-gradient-to-r from-nu-pink/8 to-nu-blue/8">
          <div className="min-w-0">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-pink font-bold flex items-center gap-1">
              <Sparkles size={11} /> 동료 리뷰
            </div>
            <h3 id="review-modal-title" className="font-head text-lg font-extrabold text-nu-ink truncate">
              {targetUser.nickname}
            </h3>
            <p className="font-mono-nu text-[10px] text-nu-graphite truncate">{projectTitle}</p>
          </div>
          <button onClick={onClose} aria-label="닫기" className="p-1 hover:bg-nu-ink/5"><X size={18} /></button>
        </header>

        <div className="p-5 space-y-5">
          {/* 다시 함께 의향 */}
          <div>
            <label className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-muted block mb-2">
              다시 함께 일하고 싶나요?
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWouldWorkAgain(true)}
                className={`flex-1 py-3 border-[2px] inline-flex items-center justify-center gap-2 transition-colors ${
                  wouldWorkAgain === true
                    ? "border-green-600 bg-green-50 text-green-700"
                    : "border-nu-ink/20 text-nu-graphite hover:border-nu-ink/40"
                }`}
              >
                <ThumbsUp size={14} /> <span className="font-bold text-[13px]">네, 강력 추천</span>
              </button>
              <button
                type="button"
                onClick={() => setWouldWorkAgain(false)}
                className={`flex-1 py-3 border-[2px] inline-flex items-center justify-center gap-2 transition-colors ${
                  wouldWorkAgain === false
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-nu-ink/20 text-nu-graphite hover:border-nu-ink/40"
                }`}
              >
                <ThumbsDown size={14} /> <span className="font-bold text-[13px]">다음엔 어려울 듯</span>
              </button>
            </div>
          </div>

          {/* 다축 태그 */}
          <div>
            <label className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-muted block mb-2">
              어떤 점이 돋보였나요? <span className="text-nu-graphite">({tags.length}/10)</span>
            </label>
            <div className="space-y-3">
              {(Object.keys(AXIS_META) as (keyof typeof AXIS_META)[]).map((axis) => (
                <div key={axis}>
                  <div className={`font-mono-nu text-[9px] uppercase tracking-[0.3em] ${AXIS_META[axis].color} font-bold mb-1.5`}>
                    {AXIS_META[axis].label}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tagsByAxis(axis).map((t) => {
                      const active = tags.includes(t.key);
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => toggleTag(t.key)}
                          className={`inline-flex items-center gap-1 px-2 py-1 border-[1.5px] font-mono-nu text-[11px] transition-colors ${
                            active
                              ? `${AXIS_META[axis].bg} ${AXIS_META[axis].color} border-current font-bold`
                              : "border-nu-ink/15 text-nu-graphite hover:border-nu-ink/40"
                          }`}
                        >
                          <span>{t.emoji}</span>
                          <span>{t.label}</span>
                          {active && <Check size={10} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 한줄평 */}
          <div>
            <label className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-muted block mb-1">
              한줄평 (선택)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={2}
              maxLength={200}
              placeholder="구체적인 경험을 한 문장으로"
              className="w-full px-3 py-2 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm resize-none"
            />
            <p className="font-mono-nu text-[9px] text-nu-muted mt-0.5">{note.length}/200</p>
          </div>

          {/* 공개 범위 */}
          <div>
            <label className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-muted block mb-1.5">
              공개 범위
            </label>
            <div className="grid grid-cols-3 gap-1">
              {([
                { k: "public",  label: "전체",   hint: "포트폴리오에 노출" },
                { k: "team",    label: "팀만",   hint: "볼트 멤버에게만" },
                { k: "private", label: "비공개", hint: "본인만 확인" },
              ] as const).map((v) => (
                <button
                  key={v.k}
                  type="button"
                  onClick={() => setVisibility(v.k)}
                  className={`p-2 border-[2px] text-left transition-colors ${
                    visibility === v.k
                      ? "border-nu-ink bg-nu-ink text-nu-paper"
                      : "border-nu-ink/15 text-nu-graphite hover:border-nu-ink/40"
                  }`}
                >
                  <div className="font-mono-nu text-[10px] font-bold uppercase">{v.label}</div>
                  <div className="text-[9px] opacity-80">{v.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="flex gap-2 px-5 py-4 border-t-[2px] border-nu-ink/10 bg-nu-cream/20">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 px-4 py-2.5 border-[2px] border-nu-ink/20 font-mono-nu text-[12px] uppercase tracking-widest hover:bg-nu-ink/5 disabled:opacity-50">
            취소
          </button>
          <button type="button" onClick={submit} disabled={saving || tags.length === 0 || wouldWorkAgain === null}
            className="flex-1 px-4 py-2.5 bg-nu-pink text-nu-paper font-mono-nu text-[12px] font-bold uppercase tracking-widest hover:bg-nu-pink/90 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
            {saving ? <><Loader2 size={12} className="animate-spin" /> 저장 중...</> : <><Check size={12} /> 리뷰 제출</>}
          </button>
        </footer>
      </div>
    </div>
  );
}

// Display — 포트폴리오에 노출
export function ProjectReviewsList({ targetUserId }: { targetUserId: string }) {
  // Server-side fetch 는 호출측에서 처리 — 이 컴포넌트는 client fetch fallback
  return null; // placeholder, integration point
}
