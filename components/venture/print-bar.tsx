"use client";

export function PrintBar({ backHref }: { backHref: string }) {
  return (
    <div className="print-hide sticky top-0 z-50 bg-nu-ink text-nu-paper p-3 flex justify-between items-center">
      <div className="font-mono-nu text-[11px] uppercase tracking-widest">
        Venture Report · 인쇄 → PDF 저장
      </div>
      <div className="flex gap-2">
        <a
          href={backHref}
          className="border-[2px] border-nu-paper text-nu-paper px-3 py-1 font-mono-nu text-[10px] uppercase tracking-widest no-underline hover:bg-nu-paper hover:text-nu-ink"
        >
          ← 돌아가기
        </a>
        <button
          onClick={() => window.print()}
          className="border-[2px] border-nu-pink bg-nu-pink text-nu-paper px-3 py-1 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-paper hover:text-nu-ink"
        >
          🖨 인쇄 / PDF 저장
        </button>
      </div>
    </div>
  );
}
