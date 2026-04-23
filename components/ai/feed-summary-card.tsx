"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

/**
 * Activity Feed 상단 요약 카드 — 선택된 너트의 이번 주 요약 3줄.
 * 수동 요청 (cost 관리) — 자동 호출 안 함.
 */
export function FeedSummaryCard({ groups }: { groups: Array<{ id: string; name: string }> }) {
  const [selected, setSelected] = useState(groups[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>("");

  const name = groups.find((g) => g.id === selected)?.name;

  async function fetchSummary() {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/feed-summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selected }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setSummary(data.summary);
        setGroupName(data.groupName ?? name ?? "");
      }
    } finally {
      setLoading(false);
    }
  }

  if (groups.length === 0) return null;

  return (
    <section className="reader-shell mb-6">
      <div className="border-l-[3px] border-[color:var(--liquid-primary)] bg-[color:var(--liquid-primary)]/5 rounded-[var(--ds-radius-lg)] p-4">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={12} className="text-[color:var(--liquid-primary)] shrink-0" />
            <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-[color:var(--liquid-primary)] font-bold">
              AI 주간 요약
            </span>
            <select
              value={selected}
              onChange={(e) => { setSelected(e.target.value); setSummary(null); }}
              className="text-[12px] font-medium bg-transparent border border-[color:var(--neutral-200)] rounded px-2 py-0.5 focus:border-[color:var(--liquid-primary)] outline-none"
            >
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={fetchSummary}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 border border-[color:var(--neutral-200)] rounded hover:bg-[color:var(--neutral-900)] hover:text-white hover:border-[color:var(--neutral-900)] disabled:opacity-50"
          >
            {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            {summary ? "새로고침" : "요약 받기"}
          </button>
        </div>

        {summary ? (
          <div className="whitespace-pre-wrap text-[13px] leading-[1.7] text-[color:var(--neutral-900)]">
            {summary}
          </div>
        ) : (
          <p className="text-[12px] text-[color:var(--neutral-500)]">
            {name ? <><strong>{name}</strong> 너트의 이번 주 활동을 3줄로 요약합니다. </> : ""}
            <button type="button" onClick={fetchSummary} className="underline">요약 받기</button>
          </p>
        )}

        {name && (
          <Link href={`/groups/${selected}`} className="text-[11px] text-[color:var(--neutral-500)] hover:text-[color:var(--neutral-900)] no-underline mt-2 inline-block">
            전체 활동 →
          </Link>
        )}
      </div>
    </section>
  );
}
