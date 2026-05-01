"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, Users, Briefcase, Loader2 } from "lucide-react";

interface Workspace {
  kind: "nut" | "bolt";
  id: string;
  name: string;
  sub?: string;
  href: string;
}

interface Props {
  /** 현재 워크스페이스 — 헤더에 강조 표시 */
  currentKind: "nut" | "bolt";
  currentId: string;
  currentName: string;
}

/**
 * 워크스페이스 스위처 — 사용자가 속한 모든 너트/볼트 사이로 빠른 전환.
 * 사이드바 헤더에 위치 — 현재 너트/볼트 이름 + chevron, 클릭 시 dropdown.
 */
export function WorkspaceSwitcher({ currentKind, currentId, currentName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Workspace[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open || list !== null) return;
    fetch("/api/spaces/workspaces")
      .then((r) => r.json())
      .then((j: { nuts: Workspace[]; bolts: Workspace[] }) => {
        setList([...(j.nuts ?? []), ...(j.bolts ?? [])]);
      })
      .catch(() => setList([]));
  }, [open, list]);

  const filtered = useMemo(() => {
    if (!list) return [];
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((w) => w.name.toLowerCase().includes(t));
  }, [list, q]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-nu-cream font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-[12px]">{currentKind === "nut" ? "👥" : "📦"}</span>
        <span className="flex-1 truncate text-left">{currentName}</span>
        <ChevronDown size={11} className={`opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border-[2px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] max-h-[60vh] overflow-hidden flex flex-col"
          role="listbox"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-2 py-1.5 border-b border-nu-ink/10">
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-nu-muted" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="너트/볼트 검색"
                autoFocus
                className="w-full pl-7 pr-2 py-1 text-[11px] border border-nu-ink/20 focus:border-nu-ink outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-1">
            {list === null ? (
              <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-nu-muted">
                <Loader2 size={11} className="animate-spin" /> 로드 중…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-2 py-2 text-[11px] text-nu-muted text-center">결과 없음</div>
            ) : (
              <>
                <Section
                  title="너트"
                  items={filtered.filter((w) => w.kind === "nut")}
                  current={`${currentKind}:${currentId}`}
                  onPick={(href) => { setOpen(false); router.push(href); }}
                />
                <Section
                  title="볼트"
                  items={filtered.filter((w) => w.kind === "bolt")}
                  current={`${currentKind}:${currentId}`}
                  onPick={(href) => { setOpen(false); router.push(href); }}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  current,
  onPick,
}: {
  title: string;
  items: Workspace[];
  current: string;
  onPick: (href: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-1.5">
      <div className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted px-1.5 py-0.5">
        {title} · {items.length}
      </div>
      {items.map((w) => {
        const isActive = `${w.kind}:${w.id}` === current;
        const Icon = w.kind === "nut" ? Users : Briefcase;
        return (
          <button
            key={`${w.kind}:${w.id}`}
            type="button"
            onClick={() => onPick(w.href)}
            disabled={isActive}
            className={`w-full text-left flex items-center gap-2 px-2 py-1 ${isActive ? "bg-nu-ink text-nu-paper" : "hover:bg-nu-cream"}`}
          >
            <Icon size={11} className={isActive ? "" : "text-nu-pink"} />
            <span className="flex-1 truncate text-[12px]">{w.name}</span>
            {w.sub && <span className="font-mono-nu text-[9px] uppercase tracking-widest opacity-60">{w.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
