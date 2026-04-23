"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * AISuggestButton — "AI 제안 받기" 공통 버튼.
 * Hero accent 컬러 + Sparkles 아이콘으로 AI 지점 시각 통일.
 */
export function AISuggestButton({
  onClick, loading, success, label = "AI 제안 받기", className = "",
}: {
  onClick: () => void | Promise<void>;
  loading?: boolean;
  success?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 border-[1.5px] border-[color:var(--liquid-primary)]/40 text-[color:var(--liquid-primary)] bg-[color:var(--liquid-primary)]/5 rounded-[var(--ds-radius-md)] text-[12px] font-medium hover:bg-[color:var(--liquid-primary)]/10 transition-colors disabled:opacity-50 ${className}`}
      style={{ transitionDuration: "var(--ds-dur-utility)" }}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : success ? <Check size={12} /> : <Sparkles size={12} />}
      {label}
    </button>
  );
}

/** AI 산출물을 표시 · 수락 · 거절하는 공통 카드 */
export function AISuggestionCard({ title, children, onAccept, onDismiss, accepted }: {
  title?: string;
  children: React.ReactNode;
  onAccept?: () => void;
  onDismiss?: () => void;
  accepted?: boolean;
}) {
  return (
    <div className="border-l-[3px] border-[color:var(--liquid-primary)] bg-[color:var(--liquid-primary)]/5 rounded-[var(--ds-radius-md)] p-3 my-2">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={11} className="text-[color:var(--liquid-primary)]" />
        <span className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-[color:var(--liquid-primary)] font-bold">
          {title ?? "AI 제안"}
        </span>
        {accepted && <Check size={11} className="text-green-600" />}
      </div>
      <div className="text-[13px] leading-[1.6] text-[color:var(--neutral-900)] whitespace-pre-wrap">{children}</div>
      {(onAccept || onDismiss) && !accepted && (
        <div className="flex gap-1.5 mt-2">
          {onAccept && (
            <button type="button" onClick={onAccept}
              className="px-2 py-1 bg-[color:var(--neutral-900)] text-white rounded-[var(--ds-radius-sm)] text-[11px] font-medium hover:bg-[color:var(--liquid-primary)]">
              수락
            </button>
          )}
          {onDismiss && (
            <button type="button" onClick={onDismiss}
              className="px-2 py-1 border border-[color:var(--neutral-200)] rounded-[var(--ds-radius-sm)] text-[11px] text-[color:var(--neutral-700)] hover:bg-[color:var(--neutral-50)]">
              거절
            </button>
          )}
        </div>
      )}
    </div>
  );
}
