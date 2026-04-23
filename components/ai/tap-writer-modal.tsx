"use client";

import { useEffect, useState } from "react";
import { X, Sparkles, Loader2, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * Tap Writer — 3문 인터뷰 → AI 회고록 초안.
 *
 * 사용: 볼트 상세 "탭 작성" 버튼이나 Tap 편집기에서 "AI 인터뷰" 버튼 클릭.
 * onAccept 가 초안 Markdown 을 받아서 에디터에 주입.
 */
export function TapWriterModal({
  projectTitle, isOpen, onClose, onAccept,
}: {
  projectTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onAccept: (draftMd: string) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | "loading" | "result">(1);
  const [lesson, setLesson] = useState("");
  const [turningPoint, setTurningPoint] = useState("");
  const [nextBolt, setNextBolt] = useState("");
  const [draft, setDraft] = useState<string | null>(null);

  // ESC 키로 모달 닫기 + body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function generate() {
    setStep("loading");
    try {
      const res = await fetch("/api/ai/tap-writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectTitle,
          answers: { lesson: lesson.trim(), turningPoint: turningPoint.trim(), nextBolt: nextBolt.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 호출 실패");
      setDraft(data.draft);
      setStep("result");
    } catch (err: any) {
      toast.error(err.message);
      setStep(3);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Tap Writer" className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-[var(--ds-radius-xl)] border border-[color:var(--neutral-100)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--neutral-100)]">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[color:var(--liquid-primary)]" />
            <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-[color:var(--liquid-primary)] font-bold">Tap Writer</span>
          </div>
          <button onClick={onClose} aria-label="닫기" className="p-1 hover:bg-[color:var(--neutral-50)] rounded">
            <X size={16} />
          </button>
        </header>

        <div className="p-6 space-y-4">
          {step === 1 && (
            <>
              <div>
                <p className="reader-meta mb-1">1 / 3</p>
                <h2 className="text-[18px] font-semibold text-[color:var(--neutral-900)] leading-tight">
                  이 볼트에서 가장 배운 점 한 가지는?
                </h2>
                <p className="reader-meta mt-1">구체적 경험 한 줄이면 충분해요</p>
              </div>
              <textarea
                value={lesson} onChange={(e) => setLesson(e.target.value)} rows={4} autoFocus
                placeholder="예: 클라이언트 미팅에서 수익모델을 중간에 바꿔봤어요"
                className="w-full p-3 border-[2px] border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] focus:border-[color:var(--liquid-primary)] outline-none text-[14px] leading-[1.6] resize-none"
              />
              <div className="flex justify-end">
                <button onClick={() => setStep(2)} disabled={lesson.trim().length < 10}
                  className="px-4 py-2 bg-[color:var(--neutral-900)] text-white rounded-[var(--ds-radius-md)] text-[13px] font-medium hover:bg-[color:var(--liquid-primary)] disabled:opacity-40 inline-flex items-center gap-1">
                  다음 <ArrowRight size={12} />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <p className="reader-meta mb-1">2 / 3</p>
                <h2 className="text-[18px] font-semibold text-[color:var(--neutral-900)] leading-tight">
                  가장 결정적이었던 순간 / 전환점은?
                </h2>
                <p className="reader-meta mt-1">건너뛰어도 됩니다</p>
              </div>
              <textarea
                value={turningPoint} onChange={(e) => setTurningPoint(e.target.value)} rows={4} autoFocus
                placeholder="예: 런칭 3일 전 사용자 5명 인터뷰에서 우리 가정이 틀렸음을 발견"
                className="w-full p-3 border-[2px] border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] focus:border-[color:var(--liquid-primary)] outline-none text-[14px] leading-[1.6] resize-none"
              />
              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="text-[13px] text-[color:var(--neutral-500)] hover:text-[color:var(--neutral-900)]">← 이전</button>
                <button onClick={() => setStep(3)}
                  className="px-4 py-2 bg-[color:var(--neutral-900)] text-white rounded-[var(--ds-radius-md)] text-[13px] font-medium hover:bg-[color:var(--liquid-primary)] inline-flex items-center gap-1">
                  다음 <ArrowRight size={12} />
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <p className="reader-meta mb-1">3 / 3</p>
                <h2 className="text-[18px] font-semibold text-[color:var(--neutral-900)] leading-tight">
                  이 볼트를 이어받을 다음 팀에게 한 마디?
                </h2>
                <p className="reader-meta mt-1">건너뛰어도 됩니다</p>
              </div>
              <textarea
                value={nextBolt} onChange={(e) => setNextBolt(e.target.value)} rows={4} autoFocus
                placeholder="예: 초기 3주는 리서치에 끌려가지 말고 프로토타입부터 던져보세요"
                className="w-full p-3 border-[2px] border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] focus:border-[color:var(--liquid-primary)] outline-none text-[14px] leading-[1.6] resize-none"
              />
              <div className="flex justify-between">
                <button onClick={() => setStep(2)} className="text-[13px] text-[color:var(--neutral-500)] hover:text-[color:var(--neutral-900)]">← 이전</button>
                <button onClick={generate}
                  className="px-4 py-2 bg-[color:var(--liquid-primary)] text-white rounded-[var(--ds-radius-md)] text-[13px] font-medium inline-flex items-center gap-1">
                  <Sparkles size={12} /> 초안 생성
                </button>
              </div>
            </>
          )}

          {step === "loading" && (
            <div className="py-10 text-center">
              <Loader2 size={28} className="animate-spin mx-auto text-[color:var(--liquid-primary)] mb-3" />
              <p className="text-[14px] text-[color:var(--neutral-900)]">AI 가 회고록 초안을 작성하고 있어요...</p>
              <p className="reader-meta mt-1">보통 5~10초</p>
            </div>
          )}

          {step === "result" && draft && (
            <>
              <div className="border-l-[3px] border-[color:var(--liquid-primary)] bg-[color:var(--liquid-primary)]/5 p-3 rounded-[var(--ds-radius-md)] max-h-[50vh] overflow-y-auto">
                <div className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-[color:var(--liquid-primary)] font-bold mb-2 inline-flex items-center gap-1">
                  <Sparkles size={10} /> AI 초안
                </div>
                <pre className="whitespace-pre-wrap font-mono text-[12px] leading-[1.7] text-[color:var(--neutral-900)]">{draft}</pre>
              </div>
              <p className="reader-meta">에디터에 반영 후 자유롭게 수정하세요</p>
              <div className="flex justify-between items-center">
                <button onClick={() => { setStep(3); setDraft(null); }} className="text-[13px] text-[color:var(--neutral-500)] hover:text-[color:var(--neutral-900)]">
                  ← 다시 답변
                </button>
                <div className="flex gap-2">
                  <button onClick={onClose} className="px-3 py-2 border border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] text-[13px]">
                    취소
                  </button>
                  <button onClick={() => { onAccept(draft); toast.success("초안이 에디터에 반영됐어요"); onClose(); }}
                    className="px-4 py-2 bg-[color:var(--neutral-900)] text-white rounded-[var(--ds-radius-md)] text-[13px] font-medium inline-flex items-center gap-1">
                    <Check size={12} /> 에디터에 반영
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
