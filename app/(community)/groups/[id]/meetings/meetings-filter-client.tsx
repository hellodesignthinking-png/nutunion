"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Clock,
  MapPin,
  ListChecks,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; className: string }> = {
  upcoming:    { label: "예정",    className: "bg-nu-blue/10 text-nu-blue border-nu-blue/20" },
  in_progress: { label: "진행 중", className: "bg-nu-amber/10 text-nu-amber border-nu-amber/20" },
  completed:   { label: "완료",    className: "bg-nu-pink/10 text-nu-pink border-nu-pink/20" },
  cancelled:   { label: "취소됨",  className: "bg-nu-red/10 text-nu-red border-nu-red/20" },
};

interface MeetingItem {
  id: string;
  title: string;
  scheduled_at: string;
  duration_min?: number;
  location?: string;
  status: string;
  summary?: string;
  next_topic?: string;
  agenda_count?: number;
}

export function MeetingsSearchFilter({
  meetings,
  groupId,
}: {
  meetings: MeetingItem[];
  groupId: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtered = q
    ? meetings.filter(m =>
        (m.title || "").toLowerCase().includes(q) ||
        (m.summary || "").toLowerCase().includes(q)
      )
    : meetings;

  return (
    <div>
      {meetings.length > 0 && (
        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="제목·회의록 검색"
            className="border-[2px] border-nu-ink px-3 py-2 text-sm outline-none focus:border-nu-pink bg-nu-paper w-full sm:w-72 transition-colors"
          />
          {q && (
            <p className="font-mono-nu text-[11px] text-nu-muted mt-1.5 uppercase tracking-widest">
              {filtered.length}개 결과 / 전체 {meetings.length}개
            </p>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
          <p className="text-nu-gray text-sm">
            {q ? "검색 결과가 없습니다" : "완료된 미팅이 없습니다"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(m => (
            <CompletedMeetingCard key={m.id} meeting={m} groupId={groupId} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompletedMeetingCard({ meeting, groupId }: { meeting: MeetingItem; groupId: string }) {
  const date = new Date(meeting.scheduled_at);
  const cfg  = statusConfig[meeting.status] || statusConfig.completed;

  const kstDay = new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date).replace(/\D/g, "");

  const kstMonth = new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    timeZone: "Asia/Seoul",
  }).format(date);

  const kstDateFull = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);

  return (
    <Link
      href={`/groups/${groupId}/meetings/${meeting.id}`}
      className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-5 no-underline hover:border-nu-amber/40 transition-all block group"
    >
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 bg-nu-pink/10 flex flex-col items-center justify-center shrink-0">
          <span className="font-head text-lg font-extrabold text-nu-pink leading-none">{kstDay}</span>
          <span className="font-mono-nu text-[11px] uppercase text-nu-pink/70">{kstMonth}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-head text-sm font-bold text-nu-ink truncate group-hover:text-nu-amber transition-colors">
              {meeting.title}
            </h3>
            <Badge className={`text-[12px] shrink-0 ${cfg.className}`}>{cfg.label}</Badge>
            {meeting.summary && (
              <span className="font-mono-nu text-[11px] text-nu-pink">📝 회의록</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-nu-muted">
            <span className="font-mono-nu text-[12px] text-nu-graphite">{kstDateFull}</span>
            {meeting.duration_min && (
              <span className="flex items-center gap-1"><Clock size={12} />{meeting.duration_min}분</span>
            )}
            {meeting.location && (
              <span className="flex items-center gap-1 max-w-[160px] truncate">
                <MapPin size={12} />{meeting.location}
              </span>
            )}
            {(meeting.agenda_count ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <ListChecks size={12} />안건 {meeting.agenda_count}개
              </span>
            )}
          </div>
        </div>

        <ChevronRight size={16} className="text-nu-muted shrink-0 group-hover:text-nu-amber transition-colors" />
      </div>

      {meeting.summary && (
        <p className="mt-3 ml-[76px] text-[13px] text-nu-gray line-clamp-2 leading-relaxed">
          {meeting.summary}
        </p>
      )}
      {meeting.next_topic && (
        <div className="mt-2 ml-[76px] flex items-center gap-1.5">
          <Lightbulb size={10} className="text-nu-amber shrink-0" />
          <span className="font-mono-nu text-[11px] text-nu-amber uppercase tracking-widest truncate">
            다음 주제: {meeting.next_topic}
          </span>
        </div>
      )}
    </Link>
  );
}
