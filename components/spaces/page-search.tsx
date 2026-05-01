"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { SpacePage } from "./space-pages-types";

interface Props {
  pages: SpacePage[];
  /** owner 정보 — 블록 본문 검색에 사용 */
  ownerType: "nut" | "bolt";
  ownerId: string;
  /** 결과 클릭 시 페이지로 jump */
  onJump: (pageId: string) => void;
}

interface BlockHit {
  page_id: string;
  page_title: string;
  page_icon: string;
  block_id: string;
  snippet: string;
}

/**
 * 페이지 간 검색 — 사이드바 상단 입력.
 * 1) 페이지 제목 매칭 (즉시, 클라 측)
 * 2) 디바운스 후 블록 본문 매칭 (서버 ilike)
 */
export function PageSearch({ pages, ownerType, ownerId, onJump }: Props) {
  const [q, setQ] = useState("");
  const [blockHits, setBlockHits] = useState<BlockHit[]>([]);
  const [searching, setSearching] = useState(false);

  // 페이지 제목 매칭 — 클라이언트
  const titleMatches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return pages
      .filter((p) => p.title.toLowerCase().includes(t))
      .slice(0, 8);
  }, [q, pages]);

  // 블록 본문 검색 — 서버 (디바운스 350ms)
  useEffect(() => {
    const t = q.trim();
    if (!t || t.length < 2) {
      setBlockHits([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: t, owner_type: ownerType, owner_id: ownerId });
        const res = await fetch(`/api/spaces/search?${params.toString()}`);
        if (!res.ok) {
          setBlockHits([]);
          return;
        }
        const j = await res.json();
        setBlockHits(j.hits ?? []);
      } catch {
        setBlockHits([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [q, ownerType, ownerId]);

  if (!q) {
    return (
      <div className="px-2 py-1.5 border-b border-nu-ink/10">
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-nu-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="페이지 검색"
            className="w-full pl-7 pr-2 py-1 text-[11px] border border-nu-ink/20 focus:border-nu-ink outline-none bg-white"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border-b-[2px] border-nu-ink bg-white">
      <div className="px-2 py-1.5 border-b border-nu-ink/10">
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-nu-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="페이지 검색"
            autoFocus
            className="w-full pl-7 pr-7 py-1 text-[11px] border border-nu-ink/20 focus:border-nu-ink outline-none bg-white"
          />
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-nu-muted hover:text-nu-ink"
            aria-label="검색 지우기"
          >
            <X size={10} />
          </button>
        </div>
      </div>
      <div className="max-h-[40vh] overflow-auto py-1">
        {titleMatches.length > 0 && (
          <div className="px-2 py-1">
            <div className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted mb-0.5">
              제목 일치 · {titleMatches.length}
            </div>
            <ul className="space-y-0.5">
              {titleMatches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onJump(p.id)}
                    className="w-full text-left flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-nu-cream"
                  >
                    <span>{p.icon || "📄"}</span>
                    <span className="text-[11px] truncate">{p.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {blockHits.length > 0 && (
          <div className="px-2 py-1 border-t border-nu-ink/10">
            <div className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted mb-0.5">
              블록 일치 · {blockHits.length}
            </div>
            <ul className="space-y-0.5">
              {blockHits.map((h) => (
                <li key={h.block_id}>
                  <button
                    type="button"
                    onClick={() => onJump(h.page_id)}
                    className="w-full text-left flex items-start gap-1.5 px-1.5 py-1 hover:bg-nu-cream"
                  >
                    <span className="text-[11px] shrink-0">{h.page_icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-nu-ink truncate">{h.page_title}</div>
                      <div className="text-[10px] text-nu-muted truncate">{h.snippet}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!searching && titleMatches.length === 0 && blockHits.length === 0 && (
          <div className="px-2 py-2 text-[11px] text-nu-muted text-center">결과 없음</div>
        )}
        {searching && (
          <div className="px-2 py-1 text-[10px] text-nu-muted">블록 검색 중…</div>
        )}
      </div>
    </div>
  );
}
