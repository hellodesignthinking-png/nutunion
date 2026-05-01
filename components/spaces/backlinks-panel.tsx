"use client";

import { useEffect, useState } from "react";
import { Link2, Loader2 } from "lucide-react";

interface BacklinkItem {
  block_id: string;
  page_id: string;
  page_title: string;
  page_icon: string;
  owner_type: "nut" | "bolt";
  owner_id: string;
  block_type: string;
  snippet: string;
}

interface Props {
  /** 어떤 entity 의 백링크를 찾을지 — 현재는 자기 페이지 자체. */
  kind: "page" | "nut" | "bolt" | "user" | "topic";
  id: string;
}

/**
 * 백링크 패널 — 이 entity 가 다른 페이지의 mention 으로 언급된 곳들.
 * Notion 의 "Linked" 섹션과 비슷하지만 우리는 entity 종류가 더 다양 (마인드맵 통합).
 */
export function BacklinksPanel({ kind, id }: Props) {
  const [items, setItems] = useState<BacklinkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/spaces/backlinks?kind=${kind}&id=${id}`)
      .then((r) => r.json())
      .then((j: { items: BacklinkItem[] }) => setItems(j.items ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [kind, id]);

  if (loading) {
    return (
      <div className="border-t-[2px] border-nu-ink/10 px-6 py-3 flex items-center gap-1.5 text-[11px] text-nu-muted">
        <Loader2 size={11} className="animate-spin" /> 백링크 검색 중…
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <div className="border-t-[2px] border-nu-ink/10 px-6 py-4 bg-nu-cream/20">
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2 flex items-center gap-1.5">
        <Link2 size={11} /> 이 페이지를 언급한 곳 · {items.length}
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.block_id} className="bg-white border-[2px] border-nu-ink/20 px-2 py-1.5 hover:border-nu-ink">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[12px]">{it.page_icon}</span>
              <span className="text-[12px] font-bold text-nu-ink truncate">{it.page_title}</span>
              <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
                {it.owner_type} · {it.block_type}
              </span>
            </div>
            <div className="text-[11px] text-nu-ink/80 break-words line-clamp-2">
              {it.snippet}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
