import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Users,
  Settings,
  Plus,
  MapPin,
  Clock,
  MessageCircle,
  BookOpen,
  FolderOpen,
  ChevronRight,
  FileText,
  Activity,
  Target,
  TrendingUp,
} from "lucide-react";
import { GroupActions } from "@/components/groups/group-actions";
import { CrewActivityFeed } from "@/components/crews/crew-activity-feed";
import { CrewProjects } from "@/components/crews/crew-projects";
import { WorkspaceLinks } from "@/components/integrations/workspace-links";
import { GoogleCalendarButton } from "@/components/integrations/google-calendar-button";
import { EventRsvpButton } from "@/components/groups/event-rsvp-button";
import { GroupSearch } from "@/components/groups/group-search";
import { GroupRoadmap } from "@/components/groups/group-roadmap";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: group } = await supabase.from("groups").select("name, description").eq("id", id).single();
  return {
    title: group ? `${group.name} — nutunion` : "소모임 — nutunion",
    description: group?.description || "nutunion 소모임",
  };
}

const catColors: Record<string, { bg: string; text: string; border: string; light: string }> = {
  space:    { bg: "bg-nu-blue",   text: "text-nu-blue",   border: "border-nu-blue",   light: "bg-nu-blue/10" },
  culture:  { bg: "bg-nu-amber",  text: "text-nu-amber",  border: "border-nu-amber",  light: "bg-nu-amber/10" },
  platform: { bg: "bg-nu-ink",    text: "text-nu-ink",    border: "border-nu-ink",    light: "bg-nu-ink/10" },
  vibe:     { bg: "bg-nu-pink",   text: "text-nu-pink",   border: "border-nu-pink",   light: "bg-nu-pink/10" },
};

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group } = await supabase
    .from("groups")
    .select("*, host:profiles!groups_host_id_fkey(id, nickname, avatar_url)")
    .eq("id", id)
    .single();

  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("id, user_id, role, joined_at, status, profile:profiles(id, nickname, avatar_url, specialty, grade, can_create_crew)")
    .eq("group_id", id)
    .eq("status", "active")
    .order("joined_at");

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("group_id", id)
    .gte("start_at", new Date().toISOString())
    .order("start_at")
    .limit(5);

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, title, scheduled_at, duration_min, location, status")
    .eq("group_id", id)
    .in("status", ["upcoming", "in_progress"])
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(5);

  // Past meetings for activity
  const { data: pastMeetings } = await supabase
    .from("meetings")
    .select("id, title, scheduled_at, summary, next_topic, status")
    .eq("group_id", id)
    .eq("status", "completed")
    .order("scheduled_at", { ascending: false })
    .limit(3);

  const { data: userMembership } = await supabase
    .from("group_members")
    .select("status")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  // Stats
  const { count: totalMeetings } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("group_id", id);

  const { count: totalFiles } = await supabase
    .from("file_attachments")
    .select("id", { count: "exact", head: true })
    .eq("target_type", "group")
    .eq("target_id", id);

  const isMember = members?.some((m) => m.user_id === user.id);
  const isHost = group.host_id === user.id;
  const membershipStatus = userMembership?.status as "active" | "pending" | "waitlist" | null;
  const colors = catColors[group.category] || catColors.vibe;

  const allUpcoming = [
    ...(events || []).map((e: any) => ({ ...e, itemType: "event" as const })),
    ...(meetings || []).map((m: any) => ({ ...m, start_at: m.scheduled_at, itemType: "meeting" as const })),
  ].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return (
    <div>
      {/* ── Hero Banner ──────────────────────────────── */}
      <div className={`relative border-b-[3px] border-nu-ink ${colors.light} overflow-hidden`}>
        {/* Halftone decoration */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #0d0d0d 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
        <div className={`absolute top-0 right-0 w-48 h-48 ${colors.bg} opacity-10 rounded-full translate-x-16 -translate-y-16`} />

        <div className="max-w-6xl mx-auto px-8 py-10 relative">
          {/* breadcrumb */}
          <div className="flex items-center gap-1 font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mb-4">
            <Link href="/groups" className="hover:text-nu-ink transition-colors no-underline">소모임</Link>
            <ChevronRight size={12} />
            <span className="text-nu-ink">{group.name}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex-1">
              {/* Category stamp */}
              <span className={`inline-block font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1 text-white mb-4 ${colors.bg} -rotate-1`}>
                {group.category}
              </span>

              <h1 className="font-head text-4xl font-extrabold text-nu-ink tracking-tight mb-3">
                {group.name}
              </h1>
              <p className="text-nu-gray max-w-xl leading-relaxed mb-4">
                {group.description}
              </p>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-4 font-mono-nu text-[11px] text-nu-muted">
                <span className="flex items-center gap-1.5">
                  <Users size={13} />
                  {members?.length || 0} / {group.max_members}명
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen size={13} />
                  미팅 {totalMeetings || 0}회
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText size={13} />
                  자료 {totalFiles || 0}개
                </span>
                <span>호스트: {group.host?.nickname || "—"}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 shrink-0">
              {(isMember || isHost) && (
                <>
                  <Link
                    href={`/groups/${id}/meetings`}
                    className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-blue text-nu-paper no-underline hover:bg-nu-blue/90 transition-colors inline-flex items-center gap-2"
                  >
                    <BookOpen size={14} /> 미팅
                  </Link>
                  <Link
                    href={`/groups/${id}/resources`}
                    className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-2"
                  >
                    <FolderOpen size={14} /> 자료실
                  </Link>
                  <Link
                    href={`/groups/${id}/chat`}
                    className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-2"
                  >
                    <MessageCircle size={14} /> 채팅
                  </Link>
                  <Link
                    href={`/groups/${id}/schedule`}
                    className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-2"
                  >
                    <Calendar size={14} /> 캘린더
                  </Link>
                </>
              )}
              {isHost && (
                <>
                  <Link
                    href={`/groups/${id}/events/create`}
                    className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-pink text-nu-paper no-underline hover:bg-nu-pink/90 transition-colors inline-flex items-center gap-2"
                  >
                    <Plus size={14} /> 일정 추가
                  </Link>
                  <Link
                    href={`/groups/${id}/settings`}
                    className="p-2.5 border-[2px] border-nu-ink/20 text-nu-graphite no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center"
                  >
                    <Settings size={16} />
                  </Link>
                </>
              )}
              {!isHost && (
                <GroupActions
                  groupId={id}
                  groupName={group.name}
                  hostId={group.host_id}
                  userId={user.id}
                  maxMembers={group.max_members}
                  memberCount={members?.length || 0}
                  membershipStatus={membershipStatus}
                />
              )}
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mt-8 border-t-[2px] border-nu-ink/10 pt-6">
            {[
              { icon: <Users size={16} />, label: "멤버", value: members?.length || 0 },
              { icon: <BookOpen size={16} />, label: "총 미팅", value: totalMeetings || 0 },
              { icon: <FileText size={16} />, label: "파일", value: totalFiles || 0 },
              { icon: <Activity size={16} />, label: "진행중", value: (meetings?.length || 0) + (events?.length || 0) },
            ].map((stat) => (
              <div key={stat.label} className={`flex items-center gap-3 px-4 py-3 border-r border-nu-ink/10 last:border-r-0 ${colors.light}`}>
                <span className={colors.text}>{stat.icon}</span>
                <div>
                  <p className="font-head text-xl font-extrabold text-nu-ink">{stat.value}</p>
                  <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-8 py-10">

        {/* Search bar (members only) */}
        {(isMember || isHost) && (
          <div className="mb-8">
            <GroupSearch groupId={id} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: Upcoming + Past + Activity */}
          <div className="lg:col-span-2 space-y-8">

            {/* Upcoming Schedule */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
                  <Calendar size={18} className={colors.text} /> 다가오는 일정
                </h2>
                {(isMember || isHost) && (
                  <Link href={`/groups/${id}/schedule`} className={`font-mono-nu text-[11px] uppercase tracking-widest ${colors.text} no-underline hover:underline flex items-center gap-1`}>
                    캘린더 <ChevronRight size={12} />
                  </Link>
                )}
              </div>

              {allUpcoming.length === 0 ? (
                <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-8 text-center">
                  <Calendar size={24} className="text-nu-muted mx-auto mb-2" />
                  <p className="text-nu-gray text-sm">예정된 일정이 없습니다</p>
                  {isHost && (
                    <Link href={`/groups/${id}/events/create`} className="font-mono-nu text-[11px] text-nu-pink no-underline hover:underline mt-2 inline-block">
                      + 일정 추가하기
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {allUpcoming.map((item) => {
                    const date = new Date(item.start_at);
                    const isEvent = item.itemType === "event";
                    return (
                      <div key={`${item.itemType}-${item.id}`} className="bg-nu-white border-[2px] border-nu-ink/[0.08] hover:border-nu-pink/40 transition-all group">
                        <Link
                          href={isEvent ? `/groups/${id}/events/${item.id}` : `/groups/${id}/meetings/${item.id}`}
                          className="p-5 flex items-center gap-4 no-underline"
                        >
                          <div className={`w-14 h-14 flex flex-col items-center justify-center shrink-0 ${isEvent ? "bg-nu-pink/10" : "bg-nu-blue/10"}`}>
                            <span className={`font-head text-lg font-extrabold leading-none ${isEvent ? "text-nu-pink" : "text-nu-blue"}`}>
                              {date.getDate()}
                            </span>
                            <span className={`font-mono-nu text-[9px] uppercase ${isEvent ? "text-nu-pink/70" : "text-nu-blue/70"}`}>
                              {date.toLocaleDateString("ko", { month: "short" })}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-head text-sm font-bold text-nu-ink truncate group-hover:text-nu-pink transition-colors">
                                {item.title}
                              </h3>
                              {!isEvent && (
                                <span className="font-mono-nu text-[8px] uppercase tracking-wider px-1.5 py-0.5 bg-nu-blue/10 text-nu-blue shrink-0">미팅</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-nu-muted">
                              <span className="flex items-center gap-1">
                                <Clock size={11} />
                                {date.toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {item.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin size={11} /> {item.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isEvent && (
                              <GoogleCalendarButton
                                title={item.title}
                                startAt={item.start_at}
                                endAt={(item as any).end_at || item.start_at}
                                location={(item as any).location || ""}
                                className="text-[9px] px-2 py-1.5 hidden md:inline-flex"
                              />
                            )}
                          </div>
                        </Link>
                        {/* RSVP bar — only for events, members */}
                        {isEvent && (isMember || isHost) && (
                          <div className="border-t border-nu-ink/[0.06] px-5 py-3">
                            <EventRsvpButton eventId={item.id} userId={user.id} maxAttendees={(item as any).max_attendees} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Past Meetings (with meeting notes summary) */}
            {(pastMeetings && pastMeetings.length > 0) && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
                    <Target size={18} className="text-nu-amber" /> 지난 미팅 기록
                  </h2>
                  <Link href={`/groups/${id}/meetings`} className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-amber no-underline hover:underline flex items-center gap-1">
                    전체보기 <ChevronRight size={12} />
                  </Link>
                </div>
                <div className="flex flex-col gap-3">
                  {pastMeetings.map((m: any) => (
                    <Link
                      key={m.id}
                      href={`/groups/${id}/meetings/${m.id}`}
                      className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-5 no-underline hover:border-nu-amber/40 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-nu-amber/10 flex items-center justify-center shrink-0 mt-0.5">
                          <BookOpen size={16} className="text-nu-amber" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-head text-sm font-bold text-nu-ink group-hover:text-nu-amber transition-colors mb-1">
                            {m.title}
                          </p>
                          <p className="font-mono-nu text-[10px] text-nu-muted mb-2">
                            {new Date(m.scheduled_at).toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric" })}
                          </p>
                          {m.summary && (
                            <p className="text-xs text-nu-gray line-clamp-2 mb-2 border-l-[3px] border-nu-amber/30 pl-3">
                              {m.summary}
                            </p>
                          )}
                          {m.next_topic && (
                            <div className="inline-flex items-center gap-1.5 bg-nu-amber/10 px-2 py-1">
                              <TrendingUp size={11} className="text-nu-amber" />
                              <span className="font-mono-nu text-[9px] text-nu-amber">다음: {m.next_topic}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Activity Feed */}
            <section>
              <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2 mb-4">
                <Activity size={18} className={colors.text} /> 활동
              </h2>
              <CrewActivityFeed groupId={id} userId={user.id} initialPosts={[]} canPost={!!isMember || isHost} isHost={isHost} isAdmin={false} />
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Roadmap */}
            {(isMember || isHost) && (
              <GroupRoadmap
                groupId={id}
                groupTopic={(group as any).topic}
                canEdit={isHost}
              />
            )}

            {/* Workspace links */}
            <WorkspaceLinks
              workspaceType="crew"
              workspaceId={id}
              canEdit={isHost}
              kakaoUrl={group.kakao_chat_url}
              driveUrl={group.google_drive_url}
            />

            {/* Members */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
                  <Users size={16} /> 멤버
                </h2>
                <span className="font-mono-nu text-[11px] text-nu-muted">{members?.length || 0}/{group.max_members}</span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-nu-ink/10 mb-4 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colors.bg} transition-all`}
                  style={{ width: `${Math.min(((members?.length || 0) / group.max_members) * 100, 100)}%` }}
                />
              </div>

              <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
                {members?.slice(0, 8).map((m: any) => (
                  <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 border-b border-nu-ink/[0.05] last:border-b-0 hover:bg-nu-cream/30 transition-colors">
                    <div className={`w-8 h-8 rounded-full ${colors.light} flex items-center justify-center font-head text-xs font-bold ${colors.text}`}>
                      {(m.profile?.nickname || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-nu-ink truncate">{m.profile?.nickname}</p>
                      <p className="font-mono-nu text-[10px] text-nu-muted">
                        {m.role === "host" ? "🏠 호스트" : m.role === "moderator" ? "⚡ 운영진" : "멤버"}
                      </p>
                    </div>
                  </div>
                ))}
                {(members?.length || 0) > 8 && (
                  <div className="px-4 py-3 text-center">
                    <span className="font-mono-nu text-[10px] text-nu-muted">+{(members?.length || 0) - 8}명 더</span>
                  </div>
                )}
              </div>
            </div>

            {/* Linked Projects */}
            <div>
              <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2 mb-3">
                <Target size={16} /> 연결된 프로젝트
              </h2>
              <CrewProjects groupId={id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
