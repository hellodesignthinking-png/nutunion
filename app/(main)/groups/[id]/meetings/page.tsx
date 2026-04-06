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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  upcoming: { label: "예정", className: "bg-nu-blue/10 text-nu-blue border-nu-blue/20" },
  in_progress: { label: "진행 중", className: "bg-nu-amber/10 text-nu-amber border-nu-amber/20" },
  completed: { label: "완료", className: "bg-nu-pink/10 text-nu-pink border-nu-pink/20" },
  cancelled: { label: "취소됨", className: "bg-nu-red/10 text-nu-red border-nu-red/20" },
};

export default function MeetingsPage() {
  const params = useParams();
  const groupId = params.id as string;
  const [meetings, setMeetings] = useState<(Meeting & { agenda_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [lastCompletedNextTopic, setLastCompletedNextTopic] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Check membership
      const { data: membership } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      const { data: group } = await supabase
        .from("groups")
        .select("host_id")
        .eq("id", groupId)
        .single();

      setIsMember(!!membership || group?.host_id === user.id);

      // Fetch meetings with agenda count
      const { data: meetingsData } = await supabase
        .from("meetings")
        .select("*, agendas:meeting_agendas(id), organizer:profiles!meetings_organizer_id_fkey(id, nickname, avatar_url)")
        .eq("group_id", groupId)
        .order("scheduled_at", { ascending: false });

      if (meetingsData) {
        const withCount = meetingsData.map((m: any) => ({
          ...m,
          agenda_count: m.agendas?.length || 0,
          agendas: undefined,
        }));
        setMeetings(withCount);

        // Find last completed meeting's next_topic
        const lastCompleted = meetingsData.find(
          (m: any) => m.status === "completed" && m.next_topic
        );
        if (lastCompleted) {
          setLastCompletedNextTopic(lastCompleted.next_topic);
        }
      }
      setLoading(false);
    }
    load();
  }, [groupId]);

  const now = new Date().toISOString();
  const upcoming = meetings.filter(
    (m) => m.status === "upcoming" || m.status === "in_progress"
  );
  const completed = meetings.filter(
    (m) => m.status === "completed" || m.status === "cancelled"
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-nu-cream/50 w-48" />
          <div className="h-32 bg-nu-cream/50" />
          <div className="h-32 bg-nu-cream/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">
            미팅
          </h1>
          <p className="text-nu-gray text-sm mt-1">
            소모임 미팅을 관리하세요
          </p>
        </div>
        {isMember && (
          <Link
            href={`/groups/${groupId}/meetings/create`}
            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-colors inline-flex items-center gap-2"
          >
            <Plus size={14} /> 미팅 만들기
          </Link>
        )}
      </div>

      {/* Next topic highlight */}
      {lastCompletedNextTopic && (
        <div className="bg-nu-yellow/10 border border-nu-yellow/30 p-5 mb-8 flex items-start gap-3">
          <Lightbulb size={18} className="text-nu-amber shrink-0 mt-0.5" />
          <div>
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-amber font-bold mb-1">
              다음 미팅 주제
            </p>
            <p className="text-sm text-nu-ink">{lastCompletedNextTopic}</p>
          </div>
        </div>
      )}

      {/* Upcoming meetings */}
      <section className="mb-10">
        <h2 className="font-head text-xl font-extrabold flex items-center gap-2 mb-4">
          <Calendar size={18} className="text-nu-blue" /> 예정된 미팅
        </h2>
        {upcoming.length === 0 ? (
          <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
            <p className="text-nu-gray text-sm">예정된 미팅이 없습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} groupId={groupId} />
            ))}
          </div>
        )}
      </section>

      {/* Completed meetings */}
      <section>
        <h2 className="font-head text-xl font-extrabold flex items-center gap-2 mb-4">
          <ListChecks size={18} className="text-nu-pink" /> 완료된 미팅
        </h2>
        {completed.length === 0 ? (
          <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
            <p className="text-nu-gray text-sm">완료된 미팅이 없습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {completed.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} groupId={groupId} />
            ))}
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
  meeting: Meeting & { agenda_count?: number };
  groupId: string;
}) {
  const date = new Date(meeting.scheduled_at);
  const cfg = statusConfig[meeting.status] || statusConfig.upcoming;

  return (
    <Link
      href={`/groups/${groupId}/meetings/${meeting.id}`}
      className="bg-nu-white border border-nu-ink/[0.08] p-5 flex items-center gap-5 no-underline hover:border-nu-pink/30 transition-colors"
    >
      <div className="w-14 h-14 bg-nu-pink/10 flex flex-col items-center justify-center shrink-0">
        <span className="font-head text-lg font-extrabold text-nu-pink leading-none">
          {date.getDate()}
        </span>
        <span className="font-mono-nu text-[9px] uppercase text-nu-pink/70">
          {date.toLocaleDateString("ko", { month: "short" })}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-head text-sm font-bold text-nu-ink truncate">
            {meeting.title}
          </h3>
          <Badge className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-nu-muted">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {date.toLocaleTimeString("ko", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {meeting.duration_min}분
          </span>
          {meeting.location && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {meeting.location}
            </span>
          )}
          {(meeting as any).agenda_count > 0 && (
            <span className="flex items-center gap-1">
              <ListChecks size={12} />
              안건 {(meeting as any).agenda_count}개
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
