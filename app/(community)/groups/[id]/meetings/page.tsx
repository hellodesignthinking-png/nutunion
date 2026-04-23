import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import { MeetingsSearchFilter } from "./meetings-filter-client";

export const revalidate = 30;

const statusConfig: Record<string, { label: string; className: string }> = {
  upcoming:    { label: "예정",    className: "bg-nu-blue/10 text-nu-blue border-nu-blue/20" },
  in_progress: { label: "진행 중", className: "bg-nu-amber/10 text-nu-amber border-nu-amber/20" },
  completed:   { label: "완료",    className: "bg-nu-pink/10 text-nu-pink border-nu-pink/20" },
  cancelled:   { label: "취소됨",  className: "bg-nu-red/10 text-nu-red border-nu-red/20" },
};

export default async function MeetingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // 그룹 기본 정보 + 멤버십 병렬 조회
  const [{ data: group }, { data: membership }] = await Promise.all([
    supabase.from("groups").select("host_id, name").eq("id", groupId).single(),
    user
      ? supabase.from("group_members")
          .select("role")
          .eq("group_id", groupId)
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!group) notFound();

  const isMember = !!membership || group.host_id === user?.id;

  // 미팅 목록 조회 — 안건 수 포함
  const { data: meetingsRaw } = await supabase
    .from("meetings")
    .select("id, title, scheduled_at, duration_min, location, status, summary, next_topic, agendas:meeting_agendas(id)")
    .eq("group_id", groupId)
    .order("scheduled_at", { ascending: false });

  const meetings = (meetingsRaw || []).map((m: any) => ({
    ...m,
    agenda_count: m.agendas?.length || 0,
    agendas: undefined,
  }));

  const upcoming   = meetings.filter(m => m.status === "upcoming" || m.status === "in_progress");
  const completed  = meetings.filter(m => m.status === "completed" || m.status === "cancelled");
  const lastNextTopic = meetings.find((m: any) => m.status === "completed" && m.next_topic)?.next_topic ?? null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 mb-6 font-mono-nu text-[13px] uppercase tracking-widest">
        <Link
          href={`/groups/${groupId}`}
          className="text-nu-muted hover:text-nu-ink no-underline flex items-center gap-1 transition-colors"
        >
          <ArrowLeft size={12} /> {group.name}
        </Link>
        <ChevronRight size={12} className="text-nu-muted/40" />
        <span className="text-nu-ink">미팅</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">미팅</h1>
          <p className="text-nu-gray text-sm mt-1">
            총 {meetings.length}개 &middot; 예정 {upcoming.length}개 &middot; 완료 {completed.length}개
          </p>
        </div>
        {isMember && (
          <Link
            href={`/groups/${groupId}/meetings/create`}
            className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-colors inline-flex items-center gap-2 shrink-0"
          >
            <Plus size={14} /> 미팅 만들기
          </Link>
        )}
      </div>

      {/* 다음 미팅 예정 주제 */}
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

      {/* 예정된 미팅 */}
      <section className="mb-10">
        <h2 className="font-head text-xl font-extrabold flex items-center gap-2 mb-4">
          <Calendar size={18} className="text-nu-blue" />
          예정된 미팅
          <span className="font-mono-nu text-[13px] text-nu-muted font-normal">({upcoming.length})</span>
        </h2>

        {upcoming.length === 0 ? (
          <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-10 text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-nu-ink/5 flex items-center justify-center">
              <Calendar size={24} className="text-nu-muted" />
            </div>
            <div>
              <p className="font-head text-sm font-bold text-nu-graphite mb-1">예정된 미팅이 없습니다</p>
              <p className="font-mono-nu text-[12px] text-nu-muted uppercase tracking-widest">
                아직 등록된 미팅이 없어요
              </p>
            </div>
            {isMember && (
              <Link
                href={`/groups/${groupId}/meetings/create`}
                className="inline-flex items-center gap-2 px-5 py-2.5 border-[2px] border-nu-ink text-nu-ink font-mono-nu text-[13px] font-bold uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper transition-all"
              >
                <Plus size={14} /> 미팅 만들기
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map(m => <MeetingCard key={m.id} meeting={m} groupId={groupId} />)}
          </div>
        )}
      </section>

      {/* 완료된 회의록 — 클라이언트 검색 포함 */}
      <section>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
          <h2 className="font-head text-xl font-extrabold flex items-center gap-2">
            <ListChecks size={18} className="text-nu-pink" />
            완료된 회의록
            <span className="font-mono-nu text-[13px] text-nu-muted font-normal">
              ({completed.length})
            </span>
          </h2>
        </div>

        {completed.length === 0 ? (
          <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
            <p className="text-nu-gray text-sm">완료된 미팅이 없습니다</p>
          </div>
        ) : (
          <MeetingsSearchFilter meetings={completed} groupId={groupId} />
        )}
      </section>
    </div>
  );
}

function MeetingCard({
  meeting,
  groupId,
}: {
  meeting: any;
  groupId: string;
}) {
  // KST 기준 날짜 — 서버(UTC) 환경에서도 올바른 한국 날짜
  const date = new Date(meeting.scheduled_at);
  const cfg  = statusConfig[meeting.status] || statusConfig.upcoming;

  const kstDay = new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date).replace(/\D/g, "");

  const kstMonth = new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    timeZone: "Asia/Seoul",
  }).format(date);

  const kstTime = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);

  return (
    <Link
      href={`/groups/${groupId}/meetings/${meeting.id}`}
      className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-5 no-underline hover:border-nu-pink/40 transition-all block group"
    >
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 bg-nu-blue/10 flex flex-col items-center justify-center shrink-0">
          <span className="font-head text-lg font-extrabold text-nu-blue leading-none">{kstDay}</span>
          <span className="font-mono-nu text-[11px] uppercase text-nu-blue/70">{kstMonth}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-head text-sm font-bold text-nu-ink truncate group-hover:text-nu-pink transition-colors">
              {meeting.title}
            </h3>
            <Badge
              className={`text-[12px] shrink-0 ${cfg.className} ${meeting.status === "in_progress" ? "animate-pulse" : ""}`}
            >
              {meeting.status === "in_progress" && (
                <span className="w-1.5 h-1.5 rounded-full bg-nu-amber mr-1" />
              )}
              {cfg.label}
            </Badge>
            {meeting.status === "completed" && meeting.summary && (
              <span className="font-mono-nu text-[11px] text-nu-pink">📝 회의록</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-nu-muted">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {kstTime}
            </span>
            {meeting.duration_min && (
              <span className="flex items-center gap-1"><Clock size={12} />{meeting.duration_min}분</span>
            )}
            {meeting.location && (
              <span className="flex items-center gap-1 max-w-[160px] truncate">
                <MapPin size={12} />{meeting.location}
              </span>
            )}
            {meeting.agenda_count > 0 && (
              <span className="flex items-center gap-1">
                <ListChecks size={12} />안건 {meeting.agenda_count}개
              </span>
            )}
          </div>
        </div>

        <ChevronRight size={16} className="text-nu-muted shrink-0 group-hover:text-nu-pink transition-colors" />
      </div>

      {meeting.status === "completed" && meeting.summary && (
        <p className="mt-3 ml-[76px] text-[13px] text-nu-gray line-clamp-2 leading-relaxed">
          {meeting.summary}
        </p>
      )}
      {meeting.status === "completed" && meeting.next_topic && (
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
