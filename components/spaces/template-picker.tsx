"use client";

import { useState } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PAGE_TEMPLATES, type PageTemplate } from "./templates";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 템플릿 적용 — 부모가 페이지 + 블록을 일괄 생성. */
  onPick: (template: PageTemplate) => Promise<void>;
}

const CATEGORIES: Array<PageTemplate["category"]> = ["회의", "프로젝트", "개인", "리서치", "운영"];

/**
 * 템플릿 갤러리 — 새 페이지 만들 때 빠른 시작.
 * Notion 의 템플릿 갤러리와 비슷하지만 한국 워크 컨텍스트에 맞춤.
 */
export function TemplatePicker({ open, onClose, onPick }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b-[3px] border-nu-ink bg-white flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
            <Sparkles size={11} /> 페이지 템플릿
          </div>
          <button onClick={onClose} className="p-1 text-nu-muted hover:text-nu-ink"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {CATEGORIES.map((cat) => {
            const items = PAGE_TEMPLATES.filter((t) => t.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1.5">
                  {cat}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {items.map((tpl) => {
                    const isActive = active === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setActive(tpl.id)}
                        className={`text-left px-2.5 py-2 border-[2px] flex items-start gap-2 ${isActive ? "border-nu-pink bg-nu-pink/5" : "border-nu-ink/15 hover:border-nu-ink bg-white"}`}
                      >
                        <span className="text-[18px] leading-none">{tpl.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[12px] text-nu-ink truncate">{tpl.title}</div>
                          <div className="text-[10px] text-nu-muted mt-0.5">{tpl.description}</div>
                          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mt-1">
                            블록 {tpl.blocks.length}개
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-3 py-2 border-t-[2px] border-nu-ink bg-white flex items-center justify-between">
          <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
            {active ? PAGE_TEMPLATES.find((t) => t.id === active)?.title : "템플릿 선택"}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-ink/30 hover:bg-nu-cream"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!active || busy}
              onClick={async () => {
                if (!active) return;
                const tpl = PAGE_TEMPLATES.find((t) => t.id === active);
                if (!tpl) return;
                setBusy(true);
                try {
                  await onPick(tpl);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "생성 실패");
                } finally {
                  setBusy(false);
                  onClose();
                }
              }}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1 border-[2px] border-nu-ink bg-nu-ink text-nu-paper disabled:opacity-30 flex items-center gap-1.5"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : null}
              이 템플릿으로 만들기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
