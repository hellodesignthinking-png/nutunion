"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Meeting } from "@/lib/types";
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  ListChecks,
  Lightbulb,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; className: string }> = {
  upcoming:    { label: "예정",    className: "bg-nu-blue/10 text-nu-blue border-nu-blue/20" },
  in_progress: { label: "진행 중", className: "bg-nu-amber/10 text-nu-amber border-nu-amber/20" },
  completed:   { label: "완료",    className: "bg-nu-pink/10 text-nu-pink border-nu-pink/20" },
  cancelled:   { label: "취소됨",  className: "bg-nu-red/10 text-nu-red border-nu-red/20" },
};

export default function MeetingsPage() {
  const params  = useParams();
  const groupId = params.id as string;
  const [meetings, setMeetings] = useState<(Meeting & { agenda_count?: number; summary?: string })[]>([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [lastNextTopic, setLastNextTopic] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: membership }, { data: group }] = await Promise.all([
        supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", user.id).eq("status", "active").maybeSingle(),
        supabase.from("groups").select("host_id, name").eq("id", groupId).single(),
      ]);
      setIsMember(!!membership || group?.host_id === user.id);
      setGroupName(group?.name || "너트");

      // 날짜 필터 없이 전체 미팅 조회
      const { data: meetingsData } = await supabase
        .from("meetings")
        .select("*, agendas:meeting_agendas(id)")
        .eq("group_id", groupId)
        .order("scheduled_at", { ascending: false });

      if (meetingsData) {
        const withCount = meetingsData.map((m: any) => ({
          ...m,
          agenda_count: m.agendas?.length || 0,
          agendas: undefined,
        }));
        setMeetings(withCount);
        const lastDone = meetingsData.find((m: any) => m.status === "completed" && m.next_topic);
        if (lastDone) setLastNextTopic(lastDone.next_topic);
      }
      setLoading(false);
    }
    load();
  }, [groupId]);

  const upcoming  = meetings.filter(m => m.status === "upcoming" || m.status === "in_progress");
  const completed = meetings.filter(m => m.status === "completed" || m.status === "cancelled");

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="flex items-center gap-1.5 mb-6">
          <div className="h-4 w-16 bg-nu-ink/5 animate-pulse" />
          <div className="h-4 w-4 bg-nu-ink/5 animate-pulse" />
          <div className="h-4 w-12 bg-nu-ink/5 animate-pulse" />
        </div>
        <div className="h-10 w-48 bg-nu-ink/5 animate-pulse mb-8" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border-[2px] border-nu-ink/[0.08] p-5 flex items-center gap-4">
              <div className="w-14 h-14 bg-nu-ink/5 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-3/4 bg-nu-ink/5 animate-pulse" />
                <div className="h-3 w-1/2 bg-nu-ink/5 animate-pulse" />
              </div>
              <div className="h-6 w-16 bg-nu-ink/5 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 mb-6 font-mono-nu text-[13px] uppercase tracking-widest">
        <Link href={`/groups/${groupId}`}
          className="text-nu-muted hover:text-nu-ink no-underline flex items-center gap-1 transition-colors">
          <ArrowLeft size={12} /> {groupName}
        </Link>
        <ChevronRight size={12} className="text-nu-muted/40" />
        <span className="text-nu-ink">미팅</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">미팅</h1>
          <p className="text-nu-gray text-sm mt-1">
            총 {meetings.length}개 · 예정 {upcoming.length}개 · 완료 {completed.length}개
          </p>
        </div>
        {isMember && (
          <Link href={`/groups/${groupId}/meetings/create`}
            className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-colors inline-flex items-center gap-2">
            <Plus size={14} /> 미팅 만들기
          </Link>
        )}
      </div>

      {/* Next topic highlight */}
      {lastNextTopic && (
        <div className="bg-nu-yellow/10 border border-nu-yellow/30 p-5 mb-8 flex items-start gap-3">
          <Lightbulb size={18} className="text-nu-amber shrink-0 mt-0.5" />
          <div>
            <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-amber font-bold mb-1">
              다음 미팅 예정 주제
            </p>
            <p className="text-sm text-nu-ink">{lastNextTopic}</p>
          </div>
        </div>
      )}

      {/* Upcoming */}
      <section className="mb-10">
        <h2 className="font-head text-xl font-extrabold flex items-center gap-2 mb-4">
          <Calendar size={18} className="text-nu-blue" />
          예정된 미팅
          <span className="font-mono-nu text-[13px] text-nu-muted font-normal">({upcoming.length})</span>
        </h2>
        {upcoming.length === 0 ? (
          <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
            <p className="text-nu-gray text-sm">예정된 미팅이 없습니다</p>
            {isMember && (
              <Link href={`/groups/${groupId}/meetings/create`}
                className="mt-3 inline-block font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink no-underline hover:underline">
                + 미팅 만들기
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map(m => <MeetingCard key={m.id} meeting={m} groupId={groupId} />)}
          </div>
        )}
      </section>

      {/* Completed */}
      <section>
        <h2 className="font-head text-xl font-extrabold flex items-center gap-2 mb-4">
          <ListChecks size={18} className="text-nu-pink" />
          완료된 미팅
          <span className="font-mono-nu text-[13px] text-nu-muted font-normal">({completed.length})</span>
        </h2>
        {completed.length === 0 ? (
          <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
            <p className="text-nu-gray text-sm">완료된 미팅이 없습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {completed.map(m => <MeetingCard key={m.id} meeting={m} groupId={groupId} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function MeetingCard({
  meeting,
  groupId,
}: {
  meeting: Meeting & { agenda_count?: number; summary?: string };
  groupId: string;
}) {
  const date = new Date(meeting.scheduled_at);
  const cfg  = statusConfig[meeting.status] || statusConfig.upcoming;

  return (
    <Link href={`/groups/${groupId}/meetings/${meeting.id}`}
      className="bg-nu-white border border-nu-ink/[0.08] p-5 no-underline hover:border-nu-pink/30 transition-colors block">
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 bg-nu-pink/10 flex flex-col items-center justify-center shrink-0">
          <span className="font-head text-lg font-extrabold text-nu-pink leading-none">{date.getDate()}</span>
          <span className="font-mono-nu text-[11px] uppercase text-nu-pink/70">
            {date.toLocaleDateString("ko", { month: "short" })}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-head text-sm font-bold text-nu-ink truncate">{meeting.title}</h3>
            <Badge className={`text-[12px] shrink-0 ${cfg.className} ${meeting.status === "in_progress" ? "animate-pulse" : ""}`}>
              {meeting.status === "in_progress" && <span className="w-1.5 h-1.5 rounded-full bg-nu-amber mr-1" />}
              {cfg.label}
            </Badge>
            {meeting.status === "completed" && meeting.summary && (
              <span className="font-mono-nu text-[11px] text-nu-pink">📝 회의록</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-nu-muted">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {date.toLocaleString("ko", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
            {meeting.duration_min && (
              <span className="flex items-center gap-1"><Clock size={12} />{meeting.duration_min}분</span>
            )}
            {meeting.location && (
              <span className="flex items-center gap-1 max-w-[160px] truncate">
                <MapPin size={12} />{meeting.location}
              </span>
            )}
            {(meeting as any).agenda_count > 0 && (
              <span className="flex items-center gap-1">
                <ListChecks size={12} />안건 {(meeting as any).agenda_count}개
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={16} className="text-nu-muted shrink-0" />
      </div>
      {/* Summary preview for completed meetings */}
      {meeting.status === "completed" && meeting.summary && (
        <p className="mt-2 ml-[76px] text-[13px] text-nu-gray line-clamp-2 leading-relaxed">
          {meeting.summary}
        </p>
      )}
      {/* Next topic carry-over */}
      {meeting.status === "completed" && (meeting as any).next_topic && (
        <div className="mt-2 ml-[76px] flex items-center gap-1.5">
          <Lightbulb size={10} className="text-nu-amber shrink-0" />
          <span className="font-mono-nu text-[11px] text-nu-amber uppercase tracking-widest truncate">
            다음 주제: {(meeting as any).next_topic}
          </span>
        </div>
      )}
    </Link>
  );
}
