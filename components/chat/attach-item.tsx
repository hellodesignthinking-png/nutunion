"use client";

/**
 * AttachItem — 카카오톡 스타일 첨부 시트의 단일 아이템 버튼.
 * 원형 컬러 배경 + 흰 아이콘 + 라벨.
 */

export interface AttachItemProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
  pulse?: boolean;
}

export function AttachItem({ icon, label, color, onClick, pulse }: AttachItemProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl hover:bg-nu-ink/5 active:bg-nu-ink/10 transition-colors focus-visible:ring-2 focus-visible:ring-nu-pink focus-visible:ring-offset-1 outline-none"
    >
      <span
        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm ${
          pulse ? "animate-pulse" : ""
        }`}
        style={{ backgroundColor: color }}
      >
        {icon}
      </span>
      <span className="text-[11px] font-medium text-nu-graphite">{label}</span>
    </button>
  );
}
