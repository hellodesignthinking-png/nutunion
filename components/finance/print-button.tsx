"use client";

export function PrintButton({ label = "🖨 인쇄 / PDF 저장" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-5 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink"
    >
      {label}
    </button>
  );
}
