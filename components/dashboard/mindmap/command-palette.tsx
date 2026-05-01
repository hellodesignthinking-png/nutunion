"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ArrowRight, Sparkles, Focus, Route, Network, Clock, List } from "lucide-react";
import type { MindMapData, NodeKind } from "@/lib/dashboard/mindmap-types";
import { NODE_COLORS } from "@/lib/dashboard/mindmap-types";

export interface PaletteAction {
  id: string;
  label: string;
  icon: typeof Search;
  hint?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  data: MindMapData;
  actions: PaletteAction[];
  onClose: () => void;
  onJumpToNode: (nodeId: string) => void;
}

interface PaletteItem {
  type: "action" | "node";
  id: string;
  label: string;
  sub?: string;
  kind?: NodeKind;
  icon?: typeof Search;
  run: () => void;
}

/**
 * Cmd+P 명령 팔레트 — 모든 노드 + 액션을 즉시 검색해 jump.
 *
 * - 노드: 너트/볼트/일정/이슈/탭/와셔/파일 모두 인덱싱
 * - 액션: 보기 모드 전환, 포커스 진입, 경로 모드, AI 분기 등 사용자가 자주 쓰는 것
 * - 키보드 우선 — 화살표/Enter/Esc 로 모든 조작
 */
export function CommandPalette({ open, data, actions, onClose, onJumpToNode }: Props) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 모든 노드 + 액션 인덱싱
  const items = useMemo<PaletteItem[]>(() => {
    const nodeItems: PaletteItem[] = [
      ...data.nuts.map((n) => ({
        type: "node" as const,
        id: `nut-${n.id}`,
        label: n.name,
        sub: n.role === "host" ? "👑 너트" : "너트",
        kind: "nut" as NodeKind,
        run: () => onJumpToNode(`nut-${n.id}`),
      })),
      ...data.bolts.map((b) => ({
        type: "node" as const,
        id: `bolt-${b.id}`,
        label: b.title,
        sub: b.daysLeft != null ? (b.daysLeft >= 0 ? `D-${b.daysLeft} · 볼트` : `${-b.daysLeft}일 지남 · 볼트`) : `볼트 · ${b.status}`,
        kind: "bolt" as NodeKind,
        run: () => onJumpToNode(`bolt-${b.id}`),
      })),
      ...data.schedule.map((s) => ({
        type: "node" as const,
        id: `sched-${s.id}`,
        label: s.title,
        sub: `${new Date(s.at).toLocaleString("ko", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} · 일정`,
        kind: "schedule" as NodeKind,
        run: () => onJumpToNode(`sched-${s.id}`),
      })),
      ...data.issues.map((i) => ({
        type: "node" as const,
        id: `issue-${i.id}`,
        label: i.title,
        sub: i.kind === "overdue_task" ? "마감 지남 · 이슈" : "멘션 · 이슈",
        kind: "issue" as NodeKind,
        run: () => onJumpToNode(`issue-${i.id}`),
      })),
      ...data.washers.map((w) => ({
        type: "node" as const,
        id: `washer-${w.id}`,
        label: w.nickname,
        sub: `동료 · ${w.nutIds.length}너트 ${w.boltIds.length}볼트`,
        kind: "washer" as NodeKind,
        run: () => onJumpToNode(`washer-${w.id}`),
      })),
      ...data.topics.map((t) => ({
        type: "node" as const,
        id: `topic-${t.id}`,
        label: t.name,
        sub: "위키 탭",
        kind: "topic" as NodeKind,
        run: () => onJumpToNode(`topic-${t.id}`),
      })),
      ...data.files.map((f) => ({
        type: "node" as const,
        id: `file-${f.id}`,
        label: f.name,
        sub: `${f.fileType || "파일"}`,
        kind: "file" as NodeKind,
        run: () => onJumpToNode(`file-${f.id}`),
      })),
    ];
    const actionItems: PaletteItem[] = actions.map((a) => ({
      type: "action" as const,
      id: a.id,
      label: a.label,
      sub: a.hint,
      icon: a.icon,
      run: a.run,
    }));
    return [...actionItems, ...nodeItems];
  }, [data, actions, onJumpToNode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    return items
      .filter((it) =>
        it.label.toLowerCase().includes(q) || (it.sub?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 50);
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx((p) => Math.min(p, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const item = filtered[activeIdx];
        if (item) {
          e.preventDefault();
          item.run();
          onClose();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, activeIdx, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center pt-[10vh] px-4" role="dialog" aria-modal="true" aria-label="명령 팔레트">
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] flex flex-col max-h-[70vh] overflow-hidden animate-in zoom-in-95 fade-in duration-150">
        <div className="flex items-center gap-2 px-3 py-2 border-b-[2px] border-nu-ink">
          <Search size={14} className="text-nu-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="노드 검색 또는 액션…"
            className="flex-1 px-1 py-1 text-[14px] outline-none bg-transparent"
            aria-label="명령 팔레트 검색"
          />
          <kbd className="font-mono-nu text-[9px] uppercase tracking-widest border border-nu-ink/30 px-1 text-nu-muted">⌘P</kbd>
        </div>
        <div className="flex-1 overflow-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-[12px] text-nu-muted">결과 없음</div>
          ) : (
            <ul role="listbox">
              {filtered.map((item, idx) => {
                const isActive = idx === activeIdx;
                const colors = item.kind ? NODE_COLORS[item.kind] : null;
                const Icon = item.icon || ArrowRight;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => { item.run(); onClose(); }}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-1.5 ${isActive ? "bg-nu-cream" : ""}`}
                    >
                      {item.type === "node" && colors ? (
                        <span className={`font-mono-nu text-[8px] uppercase tracking-widest px-1 py-0.5 ${colors.bg} ${colors.ink} border ${colors.border} shrink-0`}>
                          {item.kind}
                        </span>
                      ) : (
                        <Icon size={11} className="shrink-0 text-nu-pink" />
                      )}
                      <span className="text-[12.5px] text-nu-ink truncate flex-1">{item.label}</span>
                      {item.sub && (
                        <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted shrink-0">
                          {item.sub}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="px-3 py-1.5 border-t border-nu-ink/10 bg-nu-cream/40 font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted flex items-center justify-between">
          <span>↑↓ 이동 · Enter 실행 · Esc 닫기</span>
          <span>{filtered.length}개</span>
        </div>
      </div>
    </div>
  );
}
