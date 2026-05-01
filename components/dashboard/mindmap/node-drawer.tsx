"use client";

import Link from "next/link";
import { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import type { MindMapNodeData } from "@/lib/dashboard/mindmap-types";
import { NODE_COLORS } from "@/lib/dashboard/mindmap-types";

function renderMetaValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.length === 0 ? "(없음)" : v.map((x) => renderMetaValue(x)).join(", ");
  if (typeof v === "object") {
    try { return JSON.stringify(v, null, 2); }
    catch { return "(객체)"; }
  }
  return String(v);
}

/**
 * 노드 클릭 시 우측 슬라이드 drawer.
 * 노드 종류별 다른 메타 표시 — 너트(멤버 정보), 볼트(상태), 일정(시간), 이슈(원인).
 */
export function NodeDrawer({
  node,
  onClose,
}: {
  node: MindMapNodeData | null;
  onClose: () => void;
}) {
  // ESC 키로 닫기 — 접근성
  useEffect(() => {
    if (!node) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [node, onClose]);

  if (!node) return null;
  const colors = NODE_COLORS[node.kind];

  return (
    <div className="fixed inset-0 z-[80] flex" role="dialog" aria-modal="true" aria-label={`${node.kind} 상세: ${node.title}`}>
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full sm:w-[420px] h-full bg-nu-paper border-l-[3px] border-nu-ink shadow-[-4px_0_0_0_#0D0F14] flex flex-col animate-in slide-in-from-right duration-200">
        <div className={`flex items-center justify-between px-4 py-3 border-b-[3px] border-nu-ink ${colors.bg}`}>
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest opacity-70">
              {node.kind}
            </div>
            <h3 className={`font-head text-lg font-extrabold ${colors.ink} mt-0.5`}>
              {node.title}
            </h3>
            {node.subtitle && (
              <p className="text-[12px] opacity-80 mt-0.5">{node.subtitle}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-nu-muted hover:text-nu-ink shrink-0" aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {node.meta && Object.entries(node.meta).map(([k, v]) => {
            const rendered = renderMetaValue(v);
            if (!rendered) return null;
            const isMultiline = rendered.includes("\n");
            return (
              <div key={k} className="border border-nu-ink/10 p-2.5 bg-white">
                <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">
                  {k.replace(/_/g, " ")}
                </div>
                {isMultiline ? (
                  <pre className="text-[12px] text-nu-ink whitespace-pre-wrap break-words font-mono-nu">{rendered}</pre>
                ) : (
                  <div className="text-[13px] text-nu-ink break-words">{rendered}</div>
                )}
              </div>
            );
          })}
        </div>

        {node.href && (
          <div className="px-4 py-3 border-t-[2px] border-nu-ink/10">
            <Link
              href={node.href}
              className="w-full font-mono-nu text-[11px] uppercase tracking-widest px-4 py-2.5 bg-nu-ink text-nu-paper border-[2px] border-nu-ink hover:bg-nu-pink no-underline flex items-center justify-center gap-2"
            >
              <ExternalLink size={12} /> 열기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
