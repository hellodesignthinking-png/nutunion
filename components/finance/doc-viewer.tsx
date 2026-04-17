"use client";

import { useState } from "react";
import Link from "next/link";

interface DocViewerProps {
  docId: string;
  title: string;
  toc: string[];
  children: React.ReactNode;
}

export function DocViewer({ docId, title, toc, children }: DocViewerProps) {
  const [_open, setOpen] = useState(false);

  const handlePrint = () => {
    const el = document.getElementById("doc-content");
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box;font-family:'Noto Sans KR',sans-serif}
body{padding:20mm;color:#222;font-size:11pt;line-height:1.8}
h1{font-size:18pt;text-align:center;margin-bottom:24px;letter-spacing:4px}
h2{font-size:12pt;margin:20px 0 8px;border-bottom:2px solid #333;padding-bottom:4px}
h3{font-size:11pt;margin:14px 0 6px}
p,li{font-size:10pt;margin-bottom:4px}
ol,ul{padding-left:20px}
table{width:100%;border-collapse:collapse;margin:8px 0}
th,td{border:1px solid #999;padding:6px 10px;font-size:10pt}
th{background:#f5f5f5;font-weight:600;text-align:center}
</style></head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4 flex justify-between items-center flex-wrap gap-3">
        <div className="flex gap-3 items-center">
          <Link href="/finance/docs" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
            ← 규정 목록
          </Link>
          <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
            {title}
          </span>
        </div>
        <button
          onClick={handlePrint}
          className="border-[2px] border-nu-ink bg-nu-paper px-4 py-2 font-mono-nu text-[11px] uppercase tracking-wider hover:bg-nu-ink hover:text-nu-paper"
        >
          인쇄
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-4">
        {/* 목차 */}
        <aside className="border-[2.5px] border-nu-ink bg-nu-paper p-4 h-fit lg:sticky lg:top-[80px]">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink mb-3">
            목차
          </div>
          <nav className="flex flex-col gap-1">
            {toc.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  const el = document.getElementById(`toc-${docId}-${i}`);
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  setOpen(false);
                }}
                className="text-left text-[11px] text-nu-graphite hover:text-nu-pink py-1"
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        {/* 본문 */}
        <div
          id="doc-content"
          className="bg-white border-[2.5px] border-nu-ink p-6 sm:p-10 text-[#222] leading-[1.8] max-h-[calc(100vh-200px)] overflow-y-auto"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// 공통 Section/Article
export function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4" id={id}>
      <h2 className="text-[15px] font-bold border-b-[2px] border-[#333] pb-1 mt-5 mb-2">{title}</h2>
      {children}
    </div>
  );
}

export function Article({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="text-[13px] font-semibold mt-3 mb-1">제{n}조 ({title})</h3>
      <div className="pl-2 text-[12px]">{children}</div>
    </div>
  );
}

export const thS = "border border-[#bbb] px-2.5 py-1.5 text-[11px] bg-[#f5f5f5] font-semibold text-center";
export const tdS = "border border-[#bbb] px-2.5 py-1.5 text-[11px] text-center";
