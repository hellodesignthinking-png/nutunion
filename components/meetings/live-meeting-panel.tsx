"use client";

/**
 * LiveMeetingPanel — shown when meeting.status === 'in_progress'.
 *
 * - Live notes textarea, debounced auto-save to /api/meetings/:id/notes
 * - Agenda quick-check reference (read-only)
 * - Progress modal for AI processing during conclude
 *
 * Recording is handled by the existing <MeetingRecorder /> — this panel pairs
 * with it so that the final "⏹️ 회의 종료" flow sends both audio + notes to
 * /api/meetings/:id/conclude for cross-validation by the meeting-summary AI.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Save, CheckCircle2, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  meetingId: string;
  initialNotes?: string | null;
  disabled?: boolean;
}

export function LiveMeetingPanel({ meetingId, initialNotes, disabled }: Props) {
  const [notes, setNotes] = useState<string>(initialNotes || "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const saveNotes = useCallback(
    async (value: string) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/meetings/${meetingId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: value }),
        });
        if (!res.ok) throw new Error("save failed");
        if (mountedRef.current) setSaveState("saved");
        // revert to idle after 1.2s
        setTimeout(() => {
          if (mountedRef.current) setSaveState("idle");
        }, 1200);
      } catch {
        if (mountedRef.current) setSaveState("error");
      }
    },
    [meetingId],
  );

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setNotes(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNotes(v), 2000);
  }

  return (
    <div className="mb-4 border-[3px] border-nu-ink bg-nu-paper overflow-hidden">
      <div className="bg-nu-ink text-nu-paper px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />
          <span className="font-head text-sm font-bold">실시간 노트</span>
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
            AUTO-SAVE
          </span>
        </div>
        <div className="font-mono-nu text-[10px] uppercase tracking-widest flex items-center gap-1">
          {saveState === "saving" && (
            <>
              <Loader2 size={10} className="animate-spin" /> 저장 중
            </>
          )}
          {saveState === "saved" && (
            <>
              <CheckCircle2 size={10} className="text-green-400" /> 저장됨
            </>
          )}
          {saveState === "error" && (
            <>
              <AlertTriangle size={10} className="text-amber-400" /> 오류
            </>
          )}
          {saveState === "idle" && <Save size={10} className="text-nu-paper/40" />}
        </div>
      </div>
      <div className="p-4">
        <textarea
          value={notes}
          onChange={handleChange}
          disabled={disabled}
          rows={8}
          placeholder={"회의 중 핵심 논의·결정·액션을 자유롭게 적으세요.\n2초 뒤 자동 저장됩니다.\nAI 가 녹음과 이 노트를 교차검증해 회의록을 생성합니다."}
          className="w-full px-3 py-2 border-2 border-nu-ink/15 bg-nu-white text-[14px] focus:outline-none focus:border-nu-pink transition-colors resize-vertical font-mono leading-relaxed"
        />
        <p className="mt-2 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
          💡 종료 버튼을 누르면 AI 가 녹음·노트·안건을 교차검증해 회의록을 자동 생성합니다
        </p>
      </div>
    </div>
  );
}

/**
 * Fullscreen progress modal shown while /conclude processes audio+notes.
 */
export function ConcludeProgressModal({
  open,
  step,
  error,
  onRetry,
  onClose,
}: {
  open: boolean;
  step: string;
  error?: string | null;
  onRetry?: () => void;
  onClose?: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[999] bg-nu-ink/80 flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md mx-4 border-[3px] border-nu-pink bg-nu-ink text-nu-paper p-5 md:p-8 text-sm md:text-base">
        {error ? (
          <>
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-red-400 mb-2">
              ⚠ 회의록 생성 실패
            </p>
            <h2 className="font-head text-2xl font-black mb-3">다시 시도할 수 있어요</h2>
            <p className="text-[13px] text-nu-paper/70 mb-6">{error}</p>
            <div className="flex gap-2">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex-1 font-mono-nu text-[13px] uppercase tracking-widest py-3 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 font-bold"
                >
                  🔄 다시 시도
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="font-mono-nu text-[13px] uppercase tracking-widest px-4 py-3 border-2 border-nu-paper/20 text-nu-paper/60 hover:border-nu-paper/40"
                >
                  닫기
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <Sparkles size={18} className="text-nu-pink animate-pulse" />
              <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink font-bold">
                AI MEETING-SUMMARY
              </span>
            </div>
            <h2 className="font-head text-2xl font-black mb-2">
              🧠 AI 가 회의 내용을 분석하고 있어요
            </h2>
            <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-paper/60 mb-6">
              {step}
            </p>
            <div className="w-full h-1 bg-nu-paper/10 overflow-hidden">
              <div
                className="h-full bg-nu-pink animate-pulse"
                style={{ width: "70%" }}
              />
            </div>
            <p className="mt-4 text-[11px] text-nu-paper/50 leading-relaxed">
              녹음 업로드 → 트랜스크립션 → 노트 교차검증 → 구조화된 회의록 생성 → (선택) Google Docs 저장
            </p>
          </>
        )}
      </div>
    </div>
  );
}
