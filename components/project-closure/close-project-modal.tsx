"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface ClosureDraft {
  headline: string;
  summary: string;
  achievements: string[];
  challenges: string[];
  lessons: string[];
  final_outputs: string[];
  key_contributors: { name: string; role: string | null; contribution: string }[];
}

interface Props {
  projectId: string;
  projectTitle: string;
  triggerLabel?: string;
}

export function CloseProjectModal({ projectId, projectTitle, triggerLabel = "🏁 프로젝트 마감" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"intro" | "draft" | "confirm">("intro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [extraNotes, setExtraNotes] = useState("");
  const [draft, setDraft] = useState<ClosureDraft | null>(null);

  // 편집 가능한 복사본
  const [summary, setSummary] = useState("");
  const [headline, setHeadline] = useState("");

  const reset = () => {
    setStep("intro");
    setExtraNotes("");
    setDraft(null);
    setSummary("");
    setHeadline("");
    setError(null);
    setLoading(false);
  };

  const close = () => {
    if (loading) return;
    reset();
    setOpen(false);
  };

  const generateDraft = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "draft",
          extra_notes: extraNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "생성 실패");
      const d = data.draft as ClosureDraft;
      setDraft(d);
      setSummary(d.summary);
      setHeadline(d.headline);
      setStep("draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setLoading(false);
    }
  };

  const confirmClose = async () => {
    if (!draft) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "confirm",
          manual_summary: summary.trim(),
          manual_highlights: {
            headline: headline.trim(),
            achievements: draft.achievements,
            challenges: draft.challenges,
            lessons: draft.lessons,
            final_outputs: draft.final_outputs,
            key_contributors: draft.key_contributors,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "마감 실패");
      toast.success("프로젝트가 마감되었습니다");
      close();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "마감 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 px-4 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest inline-flex items-center gap-2 hover:bg-red-600 hover:text-nu-paper hover:border-red-600 transition-colors"
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
          onClick={close}
        >
          <div
            className="bg-nu-paper border-[2.5px] border-nu-ink w-full max-w-3xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-nu-paper border-b-[2px] border-nu-ink px-5 py-3 flex justify-between items-center">
              <h2 className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-ink">
                🏁 볼트 마감 · {projectTitle}
              </h2>
              <button type="button" onClick={close} aria-label="닫기" className="text-nu-graphite hover:text-nu-ink text-[18px]">
                ✕
              </button>
            </div>

            <div className="p-5">
              {step === "intro" && (
                <IntroStep
                  extraNotes={extraNotes}
                  setExtraNotes={setExtraNotes}
                  onNext={generateDraft}
                  loading={loading}
                  error={error}
                />
              )}

              {step === "draft" && draft && (
                <DraftStep
                  draft={draft}
                  summary={summary}
                  setSummary={setSummary}
                  headline={headline}
                  setHeadline={setHeadline}
                  onBack={() => setStep("intro")}
                  onNext={() => setStep("confirm")}
                  onRegenerate={generateDraft}
                  loading={loading}
                  error={error}
                />
              )}

              {step === "confirm" && draft && (
                <ConfirmStep
                  headline={headline}
                  summary={summary}
                  draft={draft}
                  onBack={() => setStep("draft")}
                  onConfirm={confirmClose}
                  loading={loading}
                  error={error}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function IntroStep({
  extraNotes,
  setExtraNotes,
  onNext,
  loading,
  error,
}: {
  extraNotes: string;
  setExtraNotes: (s: string) => void;
  onNext: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-nu-ink leading-relaxed">
        마감을 진행하면 AI 가 볼트의 <strong>멤버 · 마일스톤 · 회의록</strong> 을
        바탕으로 종합 요약을 생성합니다. 생성된 요약은 편집한 뒤 저장할 수 있습니다.
      </p>
      <div>
        <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
          추가 메모 (선택)
        </label>
        <textarea
          value={extraNotes}
          onChange={(e) => setExtraNotes(e.target.value)}
          rows={4}
          placeholder="AI 에 전달할 맥락 — 외부 출시 URL, 외부 성과 수치, 비공식 피드백 등"
          maxLength={5000}
          className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none resize-y"
        />
      </div>
      {error && (
        <div className="border-[2px] border-red-500 bg-red-50 text-red-600 px-3 py-2 text-[12px]">{error}</div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={loading}
          className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-5 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
        >
          {loading ? "AI 작성 중... (10~20초)" : "AI 초안 생성"}
        </button>
      </div>
    </div>
  );
}

function DraftStep({
  draft,
  summary,
  setSummary,
  headline,
  setHeadline,
  onBack,
  onNext,
  onRegenerate,
  loading,
  error,
}: {
  draft: ClosureDraft;
  summary: string;
  setSummary: (s: string) => void;
  headline: string;
  setHeadline: (s: string) => void;
  onBack: () => void;
  onNext: () => void;
  onRegenerate: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border-[2px] border-yellow-500 p-3 text-[12px] text-yellow-800">
        AI 초안입니다. 한 줄/요약만 편집 가능. 나머지 항목은 그대로 저장됩니다 (다음 단계에서 확인).
      </div>

      <div>
        <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
          한 줄 타이틀
        </label>
        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          maxLength={200}
          className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[14px] font-bold outline-none"
        />
      </div>

      <div>
        <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">
          전체 요약 (편집 가능)
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={6}
          maxLength={20_000}
          className="w-full border-[2px] border-nu-ink bg-nu-paper px-3 py-2 text-[13px] outline-none resize-y leading-relaxed"
        />
      </div>

      <PreviewSections draft={draft} />

      {error && (
        <div className="border-[2px] border-red-500 bg-red-50 text-red-600 px-3 py-2 text-[12px]">{error}</div>
      )}

      <div className="flex justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5"
        >
          ← 뒤로
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={loading}
            className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5 disabled:opacity-50"
          >
            {loading ? "재생성 중..." : "↻ AI 재생성"}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-5 py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink"
          >
            확인 단계로 →
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmStep({
  headline,
  summary,
  draft,
  onBack,
  onConfirm,
  loading,
  error,
}: {
  headline: string;
  summary: string;
  draft: ClosureDraft;
  onBack: () => void;
  onConfirm: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-red-50 border-[2px] border-red-500 p-3 text-[12px] text-red-700">
        <strong>주의:</strong> 마감 시 프로젝트 상태가 <code>completed</code> 로 전환됩니다.
        신규 지원이 막히고 마감 요약이 상세 페이지 상단에 표시됩니다. 필요 시 마감 취소도 가능합니다.
      </div>

      <div className="border-[2px] border-nu-ink bg-nu-paper p-4">
        <div className="font-mono-nu text-[9px] uppercase tracking-[0.2em] text-nu-graphite mb-1">Headline</div>
        <div className="text-[16px] font-bold text-nu-ink mb-3">{headline}</div>
        <div className="font-mono-nu text-[9px] uppercase tracking-[0.2em] text-nu-graphite mb-1">Summary</div>
        <div className="text-[13px] text-nu-ink whitespace-pre-wrap leading-relaxed">{summary}</div>
      </div>

      <PreviewSections draft={draft} compact />

      {error && (
        <div className="border-[2px] border-red-500 bg-red-50 text-red-600 px-3 py-2 text-[12px]">{error}</div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5 disabled:opacity-50"
        >
          ← 편집
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="border-[2.5px] border-red-600 bg-red-600 text-nu-paper px-5 py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "마감 중..." : "✓ 프로젝트 마감"}
        </button>
      </div>
    </div>
  );
}

function PreviewSections({ draft, compact }: { draft: ClosureDraft; compact?: boolean }) {
  const max = compact ? 3 : 10;
  return (
    <div className="space-y-3 text-[12px]">
      <Grp title="성과" items={draft.achievements.slice(0, max)} />
      <Grp title="과제" items={draft.challenges.slice(0, max)} />
      <Grp title="배운 점" items={draft.lessons.slice(0, max)} />
      <Grp title="최종 산출물" items={draft.final_outputs.slice(0, max)} />
      {draft.key_contributors.length > 0 && (
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">
            핵심 기여자
          </div>
          <ul className="space-y-0.5 text-[12px]">
            {draft.key_contributors.slice(0, max).map((c, i) => (
              <li key={i}>
                <strong>{c.name}</strong>
                {c.role && <span className="text-nu-graphite"> ({c.role})</span>}
                <span className="text-nu-graphite"> — {c.contribution}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Grp({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">
        {title}
      </div>
      <ul className="list-disc pl-5 space-y-0.5">
        {items.map((s, i) => (
          <li key={i} className="text-nu-ink">{s}</li>
        ))}
      </ul>
    </div>
  );
}
