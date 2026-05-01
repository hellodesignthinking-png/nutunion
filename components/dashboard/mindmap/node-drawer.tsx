"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X, ExternalLink, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { MindMapNodeData } from "@/lib/dashboard/mindmap-types";
import { NODE_COLORS } from "@/lib/dashboard/mindmap-types";
import { NodeNotes } from "./node-notes";

// 노트가 의미 있는 노드 종류 — center/empty/ai-* 는 ephemeral 이라 제외
const NOTABLE_KINDS = new Set(["nut", "bolt", "schedule", "issue", "topic", "washer", "file"]);

interface BoltOption { id: string; title: string }

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
  bolts = [],
}: {
  node: MindMapNodeData | null;
  onClose: () => void;
  /** ai-task 노드 일 때 어느 볼트에 저장할지 선택지 */
  bolts?: BoltOption[];
}) {
  const [savingBoltId, setSavingBoltId] = useState<string | null>(null);

  // ESC 키로 닫기 — 접근성
  useEffect(() => {
    if (!node) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [node, onClose]);

  async function saveAiTaskTo(projectId: string) {
    if (!node || node.kind !== "ai-task") return;
    const fullTitle = (node.meta?.["전체"] as string) || node.title;
    setSavingBoltId(projectId);
    try {
      const res = await fetch("/api/dashboard/mindmap/save-ai-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, title: fullTitle }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "저장 실패");
      toast.success("볼트에 태스크로 저장됨");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSavingBoltId(null);
    }
  }

  if (!node) return null;
  const colors = NODE_COLORS[node.kind];

  return (
    <div className="fixed inset-0 z-[80] flex" role="dialog" aria-modal="true" aria-label={`${node.kind} 상세: ${node.title}`}>
      <div
        className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative ml-auto w-full sm:w-[420px] max-w-full h-full bg-nu-paper border-l-0 sm:border-l-[3px] border-nu-ink sm:shadow-[-4px_0_0_0_#0D0F14] flex flex-col animate-in slide-in-from-right duration-200 ease-out">
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

        {node.id && NOTABLE_KINDS.has(node.kind) && (
          <NodeNotes nodeId={node.id} />
        )}

        {node.kind === "ai-task" && bolts.length > 0 && (
          <div className="px-4 py-3 border-t-[2px] border-nu-ink/10 bg-orange-50/40">
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
              💾 어느 볼트에 저장할까요
            </div>
            <div className="space-y-1.5">
              {bolts.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={savingBoltId !== null}
                  onClick={() => saveAiTaskTo(b.id)}
                  className="w-full text-left text-[12px] px-3 py-2 border-[2px] border-nu-ink hover:bg-nu-amber/20 disabled:opacity-50 flex items-center justify-between gap-2"
                >
                  <span className="truncate">{b.title}</span>
                  {savingBoltId === b.id ? (
                    <Loader2 size={12} className="animate-spin shrink-0" />
                  ) : (
                    <Save size={12} className="shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

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
