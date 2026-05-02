"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen, Clock, MapPin, ChevronDown, ChevronUp, ListChecks,
  CheckSquare, FileText, Loader2, Filter, ArrowRight, Sparkles, Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

/**
 * MeetingNotesHistory — 너트 일정 페이지 하단 "지난 회의록" 패널.
 *
 *  • 그룹의 지난 미팅(완료 OR 시작 시각 < now) 을 시간 역순
 *  • 각 카드: 제목 / 일시 / summary / 결정·액션·노트 개수 + pending 액션 미리보기 3개
 *  • 펼치기 시 결정·액션·노트 전체 + 다음 주제 (next_topic) 표시
 *  • 필터 칩: 전체 / 결정 있음 / 미완료 액션 있음 / 회고 있음
 *  • 검색: 제목·summary 매칭
 *  • 더보기: 5개씩 점진 로드
 */

interface Meeting {
  id: string;
  title: string;
  scheduled_at: string;
  duration_min: number;
  location: string | null;
  status: "upcoming" | "in_progress" | "completed" | "cancelled";
  summary: string | null;
  next_topic: string | null;
}

interface Note {
  id: string;
  meeting_id: string;
  type: "note" | "action_item" | "decision";
  content: string;
  status: "pending" | "done" | null;
  due_date: string | null;
  owner_id: string | null;
}

interface OwnerMap {
  [id: string]: { nickname: string; avatar_url: string | null };
}

const FILTERS = [
  { key: "all",        label: "전체" },
  { key: "decision",   label: "결정 있음" },
  { key: "action",     label: "미완료 액션" },
  { key: "note",       label: "회고/메모" },
] as const;

const TYPE_META = {
  note:        { icon: FileText,   color: "text-nu-graphite",    label: "메모" },
  action_item: { icon: CheckSquare, color: "text-nu-pink",       label: "액션" },
  decision:    { icon: ListChecks, color: "text-nu-blue",        label: "결정" },
} as const;

const PAGE_SIZE = 5;

export function MeetingNotesHistory({ groupId }: { groupId: string }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [notesByMeeting, setNotesByMeeting] = useState<Record<string, Note[]>>({});
  const [owners, setOwners] = useState<OwnerMap>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<typeof FILTERS[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const supabase = createClient();
    const nowIso = new Date().toISOString();
    // 1) 지난 미팅 (status='completed' OR scheduled_at < now)
    const { data: msList } = await supabase
      .from("meetings")
      .select("id, title, scheduled_at, duration_min, location, status, summary, next_topic")
      .eq("group_id", groupId)
      .or(`status.eq.completed,scheduled_at.lt.${nowIso}`)
      .order("scheduled_at", { ascending: false })
      .limit(60);

    const list = (msList ?? []) as Meeting[];
    setMeetings(list);

    if (list.length > 0) {
      const meetingIds = list.map((m) => m.id);
      // 2) 노트 — type 별로 분리해 카드에 표시
      const { data: notesData } = await supabase
        .from("meeting_notes")
        .select("id, meeting_id, type, content, status, due_date, owner_id")
        .in("meeting_id", meetingIds);

      const grouped: Record<string, Note[]> = {};
      const ownerIds = new Set<string>();
      for (const n of (notesData ?? []) as Note[]) {
        if (!grouped[n.meeting_id]) grouped[n.meeting_id] = [];
        grouped[n.meeting_id].push(n);
        if (n.owner_id) ownerIds.add(n.owner_id);
      }
      setNotesByMeeting(grouped);

      if (ownerIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url")
          .in("id", [...ownerIds]);
        const map: OwnerMap = {};
        for (const p of profiles ?? []) {
          map[p.id as string] = { nickname: (p.nickname as string) || "", avatar_url: (p.avatar_url as string) || null };
        }
        setOwners(map);
      }
    }

    setLoading(false);
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const counts = useCallback(
    (mid: string): { decision: number; action: number; actionPending: number; note: number; total: number } => {
      const ns = notesByMeeting[mid] ?? [];
      let decision = 0, action = 0, actionPending = 0, note = 0;
      for (const n of ns) {
        if (n.type === "decision") decision++;
        else if (n.type === "action_item") {
          action++;
          if (n.status !== "done") actionPending++;
        } else note++;
      }
      return { decision, action, actionPending, note, total: ns.length };
    },
    [notesByMeeting]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return meetings.filter((m) => {
      const c = counts(m.id);
      if (filter === "decision" && c.decision === 0) return false;
      if (filter === "action"   && c.actionPending === 0) return false;
      if (filter === "note"     && c.note === 0) return false;
      if (q) {
        const hay = `${m.title} ${m.summary || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [meetings, filter, query, counts]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const canLoadMore = filtered.length > visible.length;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <section className="mt-12">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={20} className="text-nu-blue" />
          <h2 className="font-head text-xl font-extrabold text-nu-ink">회의록 히스토리</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-nu-muted">
          <Loader2 size={14} className="animate-spin" /> 지난 회의록 불러오는 중…
        </div>
      </section>
    );
  }

  if (meetings.length === 0) {
    return (
      <section className="mt-12">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={20} className="text-nu-blue" />
          <h2 className="font-head text-xl font-extrabold text-nu-ink">회의록 히스토리</h2>
        </div>
        <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-10 text-center">
          <BookOpen size={28} className="text-nu-muted/40 mx-auto mb-2" />
          <p className="text-sm text-nu-graphite">아직 완료된 미팅이 없습니다</p>
          <p className="text-[12px] text-nu-muted mt-1">회의가 끝나면 여기에 정리된 결정·액션·메모가 누적됩니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-12">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-nu-blue" />
          <h2 className="font-head text-xl font-extrabold text-nu-ink">회의록 히스토리</h2>
          <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">
            {meetings.length}건 · 누적
          </span>
        </div>
      </div>

      {/* 필터 + 검색 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <Filter size={11} className="text-nu-muted" />
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={`font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1 border-[2px] transition-colors ${
                filter === f.key
                  ? "bg-nu-ink text-nu-paper border-nu-ink"
                  : "border-nu-ink/15 text-nu-graphite hover:border-nu-ink/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-[320px]">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-nu-muted" />
          <input
            type="search"
            placeholder="제목·요약 검색…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="w-full pl-7 pr-2 py-1.5 border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none text-[12px]"
          />
        </div>
      </div>

      {/* 결과 없음 */}
      {filtered.length === 0 ? (
        <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/10 p-8 text-center text-sm text-nu-muted">
          조건에 맞는 회의록이 없습니다
        </div>
      ) : (
        <ol className="space-y-3 list-none p-0 m-0">
          {visible.map((m) => {
            const c = counts(m.id);
            const isOpen = expanded.has(m.id);
            const ns = notesByMeeting[m.id] ?? [];
            const decisions  = ns.filter((n) => n.type === "decision");
            const actions    = ns.filter((n) => n.type === "action_item");
            const actionsPending = actions.filter((a) => a.status !== "done");
            const notes      = ns.filter((n) => n.type === "note");
            const date = new Date(m.scheduled_at);
            return (
              <li
                key={m.id}
                className="bg-nu-white border-[2px] border-nu-ink/[0.08] hover:border-nu-blue/40 transition-colors"
              >
                {/* 헤더: 제목·일시·카운트 칩 */}
                <button
                  type="button"
                  onClick={() => toggleExpand(m.id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3"
                  aria-expanded={isOpen}
                >
                  <div className="w-12 h-12 flex flex-col items-center justify-center shrink-0 bg-nu-blue/10">
                    <span className="font-head text-base font-extrabold text-nu-blue leading-none">
                      {date.getDate()}
                    </span>
                    <span className="font-mono-nu text-[10px] text-nu-blue/70">
                      {date.toLocaleDateString("ko", { month: "short" })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-head text-base font-bold text-nu-ink truncate">{m.title}</h3>
                      {m.status === "completed" && (
                        <span className="font-mono-nu text-[10px] uppercase tracking-widest bg-emerald-50 text-emerald-700 px-1.5 py-0.5 border border-emerald-200">
                          완료
                        </span>
                      )}
                      {m.status === "cancelled" && (
                        <span className="font-mono-nu text-[10px] uppercase tracking-widest bg-nu-ink/5 text-nu-muted px-1.5 py-0.5">
                          취소
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-0.5 text-[12px] text-nu-muted">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {date.toLocaleString("ko", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" })}
                        <span className="text-nu-muted/70">· {formatDistanceToNow(date, { addSuffix: true, locale: ko })}</span>
                      </span>
                      {m.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin size={10} /> {m.location}
                        </span>
                      )}
                    </div>
                    {m.summary && (
                      <p className="text-[13px] text-nu-graphite leading-snug mt-1.5 line-clamp-2">
                        <Sparkles size={11} className="inline text-nu-pink mr-1 -mt-0.5" />
                        {m.summary}
                      </p>
                    )}
                    {/* 카운트 칩 */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {c.decision > 0 && (
                        <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest bg-nu-blue/10 text-nu-blue px-1.5 py-0.5">
                          <ListChecks size={9} /> 결정 {c.decision}
                        </span>
                      )}
                      {c.action > 0 && (
                        <span className={`inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 ${
                          c.actionPending > 0 ? "bg-nu-pink/10 text-nu-pink" : "bg-emerald-50 text-emerald-700"
                        }`}>
                          <CheckSquare size={9} /> 액션 {c.action - c.actionPending}/{c.action}
                        </span>
                      )}
                      {c.note > 0 && (
                        <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest bg-nu-ink/5 text-nu-graphite px-1.5 py-0.5">
                          <FileText size={9} /> 메모 {c.note}
                        </span>
                      )}
                      {c.total === 0 && (
                        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted/70">
                          기록 없음
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 self-start mt-1 text-nu-muted">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {/* 펼침: 결정·액션·메모 전체 + next_topic */}
                {isOpen && (
                  <div className="border-t-2 border-nu-ink/10 px-4 py-3 bg-nu-cream/20 space-y-3">
                    {decisions.length > 0 && (
                      <NoteSection
                        title="결정사항"
                        icon={ListChecks}
                        notes={decisions}
                        owners={owners}
                        accent="text-nu-blue"
                      />
                    )}
                    {actionsPending.length > 0 && (
                      <NoteSection
                        title={`미완료 액션 (${actionsPending.length}/${actions.length})`}
                        icon={CheckSquare}
                        notes={actionsPending}
                        owners={owners}
                        accent="text-nu-pink"
                        showOwner showDue
                      />
                    )}
                    {actionsPending.length === 0 && actions.length > 0 && (
                      <div className="font-mono-nu text-[11px] uppercase tracking-widest text-emerald-700 bg-emerald-50 border-l-[3px] border-emerald-700 px-3 py-1.5">
                        ✓ 모든 액션 완료 ({actions.length}건)
                      </div>
                    )}
                    {notes.length > 0 && (
                      <NoteSection
                        title="메모"
                        icon={FileText}
                        notes={notes}
                        owners={owners}
                        accent="text-nu-graphite"
                      />
                    )}
                    {m.next_topic && (
                      <div className="border-t border-nu-ink/10 pt-2.5">
                        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">
                          다음 회의 주제
                        </div>
                        <p className="text-[13px] text-nu-ink">{m.next_topic}</p>
                      </div>
                    )}
                    <div className="border-t border-nu-ink/10 pt-2.5">
                      <Link
                        href={`/groups/${groupId}/meetings/${m.id}`}
                        className="inline-flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest text-nu-blue hover:text-nu-ink no-underline"
                      >
                        회의록 전체 열기 <ArrowRight size={11} />
                      </Link>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* 더보기 */}
      {canLoadMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="font-mono-nu text-[12px] uppercase tracking-widest px-5 py-2 border-[2px] border-nu-ink/20 hover:bg-nu-ink hover:text-nu-paper transition-colors"
          >
            더 보기 (+{Math.min(PAGE_SIZE, filtered.length - visible.length)})
          </button>
        </div>
      )}
    </section>
  );
}

function NoteSection({
  title,
  icon: Icon,
  notes,
  owners,
  accent,
  showOwner = false,
  showDue = false,
}: {
  title: string;
  icon: typeof CheckSquare;
  notes: Note[];
  owners: OwnerMap;
  accent: string;
  showOwner?: boolean;
  showDue?: boolean;
}) {
  return (
    <div>
      <div className={`font-mono-nu text-[10px] uppercase tracking-widest ${accent} mb-1.5 flex items-center gap-1`}>
        <Icon size={10} /> {title}
      </div>
      <ul className="space-y-1 list-none p-0 m-0">
        {notes.map((n) => {
          const owner = n.owner_id ? owners[n.owner_id] : null;
          const overdue = n.due_date && new Date(n.due_date) < new Date() && n.status !== "done";
          return (
            <li
              key={n.id}
              className={`text-[13px] leading-snug px-3 py-1.5 bg-white border-l-[2.5px] ${
                n.type === "decision" ? "border-nu-blue" : n.type === "action_item" ? "border-nu-pink" : "border-nu-ink/30"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="flex-1 min-w-0">
                  {n.status === "done" && <span className="text-emerald-700 mr-1">✓</span>}
                  <span className={n.status === "done" ? "line-through text-nu-muted" : "text-nu-ink"}>
                    {n.content}
                  </span>
                </span>
              </div>
              {(showOwner || showDue) && (
                <div className="flex flex-wrap items-center gap-2 mt-0.5 font-mono-nu text-[10px] uppercase tracking-widest">
                  {showOwner && owner && (
                    <span className="text-nu-graphite">담당 · {owner.nickname}</span>
                  )}
                  {showDue && n.due_date && (
                    <span className={overdue ? "text-red-700 font-bold" : "text-nu-muted"}>
                      {overdue ? "지남" : "마감"} · {new Date(n.due_date).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
