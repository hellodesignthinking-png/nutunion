"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity, Filter, RefreshCw, Sparkles, ChevronRight, ChevronLeft,
  Loader2, Bell, CheckCheck, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

/**
 * GlobalActivityRail (L11.1) — 대시보드 우측 슬라이드 사이드바 + 모바일 bottom-sheet.
 *
 *   • Realtime 구독 (space_activity_log / project_updates / crew_posts / comments)
 *   • 4개 필터 (전체 / 너트 / 볼트 / 미확인)
 *   • 날짜 그룹 (오늘 / 어제 / 이번 주 / 이전)
 *   • Cmd+J / Ctrl+J 토글, Esc 닫기
 *   • "모두 읽음" 단일 클릭 → 모든 owner 커서 갱신
 *   • Genesis 브리핑 패널 (헤더 sparkles 토글) — 항목 클릭 시 커서 자동 갱신
 *   • localStorage 'nu.rail.open' 으로 열림 상태 보존
 */

type Item = {
  id: string;
  source_kind: "space" | "post" | "join" | "milestone" | "application" | "tap" | "comment" | "reaction";
  owner_type: "nut" | "bolt";
  owner_id: string;
  owner_name: string;
  actor_id: string | null;
  actor_nickname: string | null;
  actor_avatar: string | null;
  action: string;
  summary: string;
  href: string;
  importance: 0 | 1 | 2;
  created_at: string;
};

type Brief = {
  summary: string;
  highlights: Array<{ title: string; why: string; deep_link: string; importance: 1 | 2 | 3 }>;
  item_count: number;
  model_used: string;
  cached: boolean;
};

const ACTION_EMOJI: Record<string, string> = {
  "page.created":  "📝", "page.updated": "✏️", "page.deleted": "🗑",
  "page.shared":   "🔗", "page.unshared": "🔒",
  "block.created": "➕", "block.updated": "✏️", "block.deleted": "➖",
  "nut.post":      "💬", "nut.join":      "👋",
  "bolt.post":     "📌", "bolt.milestone_update": "🏁", "bolt.status_change": "🚦",
  "bolt.milestone_done": "🎯", "bolt.application": "📋",
  "comment.added": "💭",
};

const FILTERS = [
  { key: "all",    label: "전체"   },
  { key: "nut",    label: "너트"   },
  { key: "bolt",   label: "볼트"   },
  { key: "unread", label: "미확인" },
] as const;

type DateBucket = "today" | "yesterday" | "thisWeek" | "earlier";
const BUCKET_LABEL: Record<DateBucket, string> = {
  today: "오늘", yesterday: "어제", thisWeek: "이번 주", earlier: "이전",
};

function bucketOf(at: string): DateBucket {
  const d = new Date(at);
  const now = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, now)) return "today";
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (sameDay(d, yest)) return "yesterday";
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  if (d >= weekStart) return "thisWeek";
  return "earlier";
}

export function GlobalActivityRail() {
  const router = useRouter();
  const [open, setOpen]   = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [cursors, setCursors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<typeof FILTERS[number]["key"]>("all");
  const [briefOpen, setBriefOpen] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [markAllBusy, setMarkAllBusy] = useState(false);
  const lastFetchRef = useRef<number>(0);

  // 초기 열림 상태 복구
  useEffect(() => {
    try {
      const v = localStorage.getItem("nu.rail.open");
      if (v === "1") setOpen(true);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("nu.rail.open", open ? "1" : "0"); } catch {}
  }, [open]);

  const load = useCallback(async () => {
    if (Date.now() - lastFetchRef.current < 1500) return;
    lastFetchRef.current = Date.now();
    setLoading(true);
    try {
      const r = await fetch("/api/activity/global?summary=1&limit=60");
      const j = await r.json();
      if (Array.isArray(j.items)) setItems(j.items);
      if (j.summary?.unread)  setUnread(j.summary.unread);
      if (j.summary?.cursors) setCursors(j.summary.cursors);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 60s 폴링 fallback (구독 끊김 대비)
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Realtime — 4개 테이블 INSERT 시 재로드 (debounced)
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel("global-activity-rail")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "space_activity_log" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_updates"   }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crew_posts"        }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments"          }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // 키보드 — Cmd+J / Ctrl+J 토글, Esc 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j";
      if (isToggle) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const totalUnread = useMemo(
    () => Object.values(unread).reduce((s, n) => s + n, 0),
    [unread]
  );

  const filtered = useMemo(() => {
    if (filter === "nut")  return items.filter((it) => it.owner_type === "nut");
    if (filter === "bolt") return items.filter((it) => it.owner_type === "bolt");
    if (filter === "unread") {
      return items.filter((it) => {
        const c = cursors[`${it.owner_type}:${it.owner_id}`];
        return !c || new Date(it.created_at) > new Date(c);
      });
    }
    return items;
  }, [items, filter, cursors]);

  // 날짜 버킷 그룹
  const grouped = useMemo(() => {
    const out: Record<DateBucket, Item[]> = { today: [], yesterday: [], thisWeek: [], earlier: [] };
    for (const it of filtered) out[bucketOf(it.created_at)].push(it);
    return out;
  }, [filtered]);

  const isUnread = useCallback((it: Item) => {
    const c = cursors[`${it.owner_type}:${it.owner_id}`];
    return !c || new Date(it.created_at) > new Date(c);
  }, [cursors]);

  const markCursor = useCallback((ownerType: "nut" | "bolt", ownerId: string) => {
    const key = `${ownerType}:${ownerId}`;
    const now = new Date().toISOString();
    setCursors((p) => ({ ...p, [key]: now }));
    setUnread((p) => ({ ...p, [key]: 0 }));
    fetch("/api/activity/cursor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner_type: ownerType, owner_id: ownerId, at: now }),
    }).catch(() => undefined);
  }, []);

  const handleClick = useCallback((it: Item) => {
    markCursor(it.owner_type, it.owner_id);
    router.push(it.href);
  }, [markCursor, router]);

  const handleBriefClick = useCallback((deepLink: string) => {
    // brief.deep_link 가 /groups/uuid 또는 /projects/uuid 형식이면 owner 추정
    const m = deepLink.match(/^\/(groups|projects)\/([^/?#]+)/);
    if (m) {
      const ownerType = m[1] === "groups" ? "nut" : "bolt";
      markCursor(ownerType, m[2]);
    }
    router.push(deepLink);
  }, [markCursor, router]);

  const markAllRead = useCallback(async () => {
    setMarkAllBusy(true);
    const ownersToTouch = new Set<string>();
    for (const it of items) ownersToTouch.add(`${it.owner_type}:${it.owner_id}`);
    const now = new Date().toISOString();
    const next: Record<string, string> = { ...cursors };
    const nextUnread: Record<string, number> = { ...unread };
    for (const key of ownersToTouch) {
      next[key] = now;
      nextUnread[key] = 0;
    }
    setCursors(next);
    setUnread(nextUnread);
    await Promise.all(
      [...ownersToTouch].map((k) => {
        const [ownerType, ownerId] = k.split(":");
        return fetch("/api/activity/cursor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner_type: ownerType, owner_id: ownerId, at: now }),
        }).catch(() => undefined);
      })
    );
    setMarkAllBusy(false);
  }, [items, cursors, unread]);

  const loadBrief = useCallback(async (force = false) => {
    setBriefLoading(true);
    try {
      const r = await fetch(`/api/activity/brief${force ? "?refresh=1" : ""}`);
      const j = await r.json();
      setBrief(j);
    } catch {} finally { setBriefLoading(false); }
  }, []);

  // 닫혔을 때 — 우측 fab (데스크톱) + 하단 floating button (모바일)
  if (!open) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="활동 피드 열기 (Cmd+J)"
          title="Cmd+J / Ctrl+J"
          className="hidden md:flex fixed right-3 top-1/2 -translate-y-1/2 z-[80] flex-col items-center gap-1 px-2 py-3 bg-nu-paper border-[3px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] hover:bg-nu-cream"
        >
          <ChevronLeft size={14} />
          <Activity size={16} className="text-nu-pink" />
          <span className="font-mono-nu text-[9px] uppercase tracking-widest [writing-mode:vertical-rl]">활동</span>
          {totalUnread > 0 && (
            <span className="font-mono-nu text-[9px] font-black bg-nu-pink text-nu-paper px-1 mt-1 min-w-[18px] text-center">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="활동 피드 열기"
          className="md:hidden fixed right-3 bottom-[76px] z-[80] flex items-center gap-1 px-3 py-2 bg-nu-paper border-[3px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] active:translate-y-px"
        >
          <Activity size={14} className="text-nu-pink" />
          <span className="font-mono-nu text-[10px] uppercase tracking-widest font-black">활동</span>
          {totalUnread > 0 && (
            <span className="font-mono-nu text-[9px] font-black bg-nu-pink text-nu-paper px-1 ml-0.5 min-w-[18px] text-center">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </button>
      </>
    );
  }

  // 열림 — 데스크톱 right rail / 모바일 bottom sheet (둘 다 같은 컴포넌트로 처리)
  return (
    <>
      {/* 모바일 backdrop */}
      <div
        className="md:hidden fixed inset-0 z-[79] bg-nu-ink/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        className={[
          "fixed z-[80] flex flex-col bg-nu-paper",
          "md:right-0 md:top-[60px] md:bottom-0 md:w-[340px] md:border-l-[3px] md:border-nu-ink md:shadow-[-6px_0_0_0_rgba(13,15,20,0.05)]",
          "right-0 left-0 bottom-0 top-[20%] border-t-[3px] border-nu-ink rounded-t-lg md:rounded-none",
        ].join(" ")}
        role="complementary"
        aria-label="통합 활동 피드"
      >
        {/* 헤더 */}
        <div className="px-3 py-2.5 border-b-[3px] border-nu-ink bg-white flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink">
            <Activity size={12} className="text-nu-pink" /> 통합 활동
            {totalUnread > 0 && (
              <span className="font-mono-nu text-[9px] font-black bg-nu-pink text-nu-paper px-1 ml-1">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={markAllRead}
              disabled={markAllBusy || totalUnread === 0}
              title="모두 읽음 처리"
              className="p-1 text-nu-muted hover:text-nu-ink disabled:opacity-30"
            >
              {markAllBusy ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
            </button>
            <button
              type="button"
              onClick={() => { setBriefOpen((v) => !v); if (!brief) loadBrief(false); }}
              title="AI 브리핑"
              className={`p-1 ${briefOpen ? "text-nu-pink" : "text-nu-muted hover:text-nu-pink"}`}
            >
              <Sparkles size={13} />
            </button>
            <button type="button" onClick={() => load()} title="새로고침" className="p-1 text-nu-muted hover:text-nu-ink">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
            <button type="button" onClick={() => setOpen(false)} title="닫기 (Esc)" className="p-1 text-nu-muted hover:text-nu-ink">
              <span className="hidden md:inline"><ChevronRight size={14} /></span>
              <span className="md:hidden"><X size={14} /></span>
            </button>
          </div>
        </div>

        {/* AI 브리핑 패널 */}
        {briefOpen && (
          <div className="border-b-[3px] border-nu-ink bg-nu-cream/50 p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink font-black flex items-center gap-1">
                <Sparkles size={10} /> Genesis 브리핑
              </div>
              <button type="button" onClick={() => loadBrief(true)} className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted hover:text-nu-ink">
                {briefLoading ? "..." : "새로"}
              </button>
            </div>
            {briefLoading && !brief ? (
              <div className="flex items-center gap-1.5 text-[12px] text-nu-muted">
                <Loader2 size={11} className="animate-spin" /> 큐레이션 중…
              </div>
            ) : brief ? (
              <>
                <p className="text-[13px] text-nu-ink font-bold leading-snug mb-2">{brief.summary}</p>
                <ul className="space-y-1.5">
                  {brief.highlights.map((h, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => handleBriefClick(h.deep_link)}
                        className="block w-full text-left bg-white border-2 border-nu-ink/15 hover:border-nu-pink p-2 transition-colors"
                      >
                        <div className="flex items-start gap-1.5">
                          <span className="font-mono-nu text-[9px] font-black bg-nu-ink text-nu-paper px-1 mt-0.5 shrink-0">
                            {h.importance >= 3 ? "긴급" : h.importance >= 2 ? "중요" : "참고"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-nu-ink font-bold leading-snug truncate">{h.title}</div>
                            <div className="text-[11px] text-nu-graphite leading-snug">{h.why}</div>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted mt-2">
                  {brief.cached ? "cached · " : ""}{brief.model_used} · {brief.item_count}건
                </div>
              </>
            ) : (
              <div className="text-[12px] text-nu-muted">데이터 없음</div>
            )}
          </div>
        )}

        {/* 필터 */}
        <div className="px-2.5 py-2 border-b-2 border-nu-ink/10 flex items-center gap-1.5 overflow-x-auto">
          <Filter size={10} className="text-nu-muted shrink-0" />
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border shrink-0 ${
                filter === f.key
                  ? "bg-nu-ink text-nu-paper border-nu-ink"
                  : "border-nu-ink/15 text-nu-muted hover:text-nu-ink hover:border-nu-ink/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 리스트 */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-12 text-center">
              <Bell size={20} className="text-nu-muted/40 mx-auto mb-1.5" />
              <div className="text-[12px] text-nu-muted">
                {filter === "unread" ? "미확인 활동 없음" : "최근 활동 없음"}
              </div>
            </div>
          ) : (
            <div>
              {(["today", "yesterday", "thisWeek", "earlier"] as DateBucket[]).map((b) => {
                if (grouped[b].length === 0) return null;
                return (
                  <section key={b}>
                    <div className="sticky top-0 bg-nu-cream/95 backdrop-blur px-3 py-1 border-b border-nu-ink/10 font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted z-10">
                      {BUCKET_LABEL[b]} · {grouped[b].length}
                    </div>
                    <ul className="divide-y divide-nu-ink/10">
                      {grouped[b].map((it) => {
                        const u = isUnread(it);
                        return (
                          <li key={it.id}>
                            <button
                              type="button"
                              onClick={() => handleClick(it)}
                              className={`w-full text-left px-3 py-2 hover:bg-nu-cream/50 transition-colors ${u ? "bg-nu-yellow/5" : ""}`}
                            >
                              <div className="flex items-start gap-2">
                                <div className="shrink-0 mt-0.5 text-base leading-none">{ACTION_EMOJI[it.action] || "•"}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <span className={`font-mono-nu text-[8.5px] uppercase tracking-widest px-1 ${
                                      it.owner_type === "nut" ? "bg-nu-pink/10 text-nu-pink" : "bg-nu-blue/10 text-nu-blue"
                                    }`}>
                                      {it.owner_type === "nut" ? "너트" : "볼트"}
                                    </span>
                                    <span className="font-mono-nu text-[9px] text-nu-muted truncate flex-1 min-w-0">{it.owner_name}</span>
                                    {u && <span className="w-1.5 h-1.5 rounded-full bg-nu-pink shrink-0" />}
                                  </div>
                                  <div className="text-[12px] text-nu-ink leading-snug">
                                    {it.actor_nickname && <span className="font-bold">{it.actor_nickname} · </span>}
                                    <span className="text-nu-graphite">{it.summary || it.action}</span>
                                  </div>
                                  <div className="font-mono-nu text-[9px] text-nu-muted mt-0.5">
                                    {formatDistanceToNow(new Date(it.created_at), { addSuffix: true, locale: ko })}
                                  </div>
                                </div>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t-2 border-nu-ink/10 px-3 py-1.5 bg-white flex items-center justify-between">
          <Link href="/dashboard" className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted hover:text-nu-ink no-underline">
            대시보드 전체 →
          </Link>
          <span className="font-mono-nu text-[8.5px] uppercase tracking-widest text-nu-muted hidden md:inline" title="키보드 단축키">
            ⌘J 토글 · Esc 닫기
          </span>
        </div>
      </aside>
    </>
  );
}
