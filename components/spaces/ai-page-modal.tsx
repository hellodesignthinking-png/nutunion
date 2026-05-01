"use client";

import { useState } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  ownerType: "nut" | "bolt";
  ownerId: string;
  onClose: () => void;
  /** 생성된 페이지 id 반환 — 부모가 트리 갱신 + 그 페이지 select */
  onCreated: (pageId: string) => Promise<void> | void;
}

const QUICK_PROMPTS = [
  { label: "회의록", prompt: "오늘 팀 회의록 — 어젠다·결정·액션 아이템" },
  { label: "프로젝트 킥오프", prompt: "새 프로젝트 킥오프 문서 — 목표·범위·마일스톤·리스크" },
  { label: "주간 회고", prompt: "이번 주 회고 — 잘한 것·못한 것·다음 주" },
  { label: "리서치 노트", prompt: "리서치 노트 — 질문·가설·발견·결론" },
  { label: "1:1 미팅", prompt: "1:1 미팅 노트 — 체크인·하이라이트·피드백·다음 액션" },
  { label: "결정 로그", prompt: "ADR — 맥락·옵션·결정·결과" },
];

/**
 * AI 페이지 자동 생성 모달.
 * 사용자가 한 줄 의도 입력 → Genesis 가 골격 + 초안 블록 일괄 생성.
 */
export function AiPageModal({ open, ownerType, ownerId, onClose, onCreated }: Props) {
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function generate() {
    const t = intent.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/spaces/${ownerType}/${ownerId}/generate-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: t }),
      });
      const json = await res.json();
      if (!res.ok || !json.page) {
        throw new Error(json?.error || "AI 생성 실패");
      }
      toast.success(`📝 "${json.page.title}" — 블록 ${json.blocks_created}개`);
      await onCreated(json.page.id);
      setIntent("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-lg w-full">
        <div className="px-3 py-2 border-b-[3px] border-nu-ink bg-white flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
            <Sparkles size={11} /> Genesis 페이지 자동 생성
          </div>
          <button onClick={onClose} className="p-1 text-nu-muted hover:text-nu-ink"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="예: 이번 주 마케팅 회의록 / 'B2B 캠페인' 프로젝트 킥오프 / 신제품 리서치 노트"
            rows={3}
            maxLength={500}
            disabled={busy}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void generate();
              }
            }}
            className="w-full px-3 py-2 text-[13px] border-[2px] border-nu-ink/30 focus:border-nu-ink outline-none bg-white resize-none"
            autoFocus
          />
          <div>
            <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">자주 쓰는 시작점</div>
            <div className="flex flex-wrap gap-1">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  disabled={busy}
                  onClick={() => setIntent(q.prompt)}
                  className="font-mono-nu text-[10px] tracking-wide bg-nu-cream/70 hover:bg-nu-cream border border-nu-ink/20 hover:border-nu-ink px-1.5 py-0.5 text-nu-ink/80 hover:text-nu-ink"
                >
                  💬 {q.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-nu-ink/10">
            <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
              ⌘Enter 실행 · 분당 8회
            </span>
            <button
              type="button"
              onClick={() => void generate()}
              disabled={!intent.trim() || busy}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1 border-[2px] border-nu-ink bg-nu-ink text-nu-paper disabled:opacity-30 flex items-center gap-1.5"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {busy ? "생성 중…" : "AI 페이지 만들기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
