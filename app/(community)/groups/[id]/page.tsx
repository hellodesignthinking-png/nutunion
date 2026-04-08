import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
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
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/landing/footer";

export const dynamic = "force-dynamic";

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

  // ── 데이터 조회 ──────────────────────────────────
  const { data: group } = await supabase.from("groups")
    .select("*, host:profiles!groups_host_id_fkey(id, nickname, avatar_url)")
    .eq("id", id)
    .single();

  if (!group) notFound();

  const { data: userMembership } = await supabase.from("group_members")
    .select("status, role")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const isHost        = group.host_id === user.id;
  const isManager     = isHost || userMembership?.role === "manager";
  const isMember      = isHost || userMembership?.status === "active";
  const membershipStatus = userMembership?.status as "active" | "pending" | "waitlist" | null;
  const colors        = catColors[group.category] || catColors.vibe;

  return (
    <>
      {/* ── Hero Banner ──────────────────────────────── */}
      <div className={`relative border-b-[3px] border-nu-ink ${colors.light} overflow-hidden`}>
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #0d0d0d 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
        
        <div className="max-w-6xl mx-auto px-8 py-10 relative">
          <div className="flex items-center gap-1 font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mb-4">
            <Link href="/groups" className="hover:text-nu-ink transition-colors no-underline">소모임</Link>
            <ChevronRight size={12} />
            <span className="text-nu-ink">{group.name}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex-1">
              <span className={`inline-block font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1 text-white mb-4 ${colors.bg} -rotate-1`}>
                {group.category}
              </span>
              <h1 className="font-head text-4xl font-extrabold text-nu-ink tracking-tight mb-3">
                {group.name}
              </h1>
              <p className="text-nu-gray max-w-xl leading-relaxed mb-4">
                {group.description}
              </p>
              <div className="flex flex-wrap items-center gap-6 font-mono-nu text-[11px]">
                 <span className="text-nu-muted">호스트: <span className="text-nu-ink font-bold">{group.host?.nickname || "—"}</span></span>
                 {group.topic && (
                   <span className="flex items-center gap-2 text-nu-pink font-bold">
                     <Target size={12} fill="currentColor" className="opacity-20" /> TOPIC: {group.topic}
                   </span>
                 )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              {(isMember || isHost || isManager) && (
                <>
                  <Link href={`/groups/${id}/meetings`} className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-blue text-nu-paper no-underline hover:bg-nu-blue/90 transition-colors inline-flex items-center gap-2">
                    <BookOpen size={14} /> 미팅
                  </Link>
                  <Link href={`/groups/${id}/resources`} className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-2">
                    <FolderOpen size={14} /> 자료실
                  </Link>
                  <Link href={`/groups/${id}/chat`} className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-2.5 border-[2px] border-nu-ink text-nu-ink no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-2">
                    <MessageCircle size={14} /> 채팅
                  </Link>
                </>
              )}
              {(isHost || isManager) && (
                <Link href={`/groups/${id}/settings`} className="p-2.5 border-[2px] border-nu-ink/20 text-nu-graphite no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center">
                  <Settings size={16} />
                </Link>
              )}
              {!isHost && !isManager && (
                <Suspense fallback={<div className="w-32 h-10 bg-black/5" />}>
                   <GroupJoinAction id={id} groupName={group.name} hostId={group.host_id} userId={user.id} maxMembers={group.max_members} membershipStatus={membershipStatus} />
                </Suspense>
              )}
            </div>
          </div>
          
          <Suspense fallback={<div className="h-20 bg-black/5 animate-pulse mt-8 border-t-[2px] border-nu-ink/10 pt-6" />}>
            <GroupStatsSection id={id} colors={colors} />
          </Suspense>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-8 py-10 pb-24">
        {(isMember || isHost) && (
          <div className="mb-8">
            <GroupSearch groupId={id} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Suspense fallback={<div className="p-12 bg-black/5 animate-pulse" />}>
              <GroupUpcomingSection id={id} colors={colors} isHost={isHost} isMember={isMember} userId={user.id} />
            </Suspense>
            
            <Suspense fallback={<div className="p-12 bg-black/5 animate-pulse" />}>
              <ActivitySection id={id} userId={user.id} isMember={isMember} isHost={isHost} />
            </Suspense>
          </div>
          
          <div className="space-y-6">
            <Suspense fallback={<div className="h-64 bg-black/5 animate-pulse" />}>
              <GroupSidebarSections id={id} colors={colors} isHost={isHost} isMember={isMember} group={group} />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Streaming용 하위 서버 컴포넌트들 ──────────────────────────────

async function GroupJoinAction({ id, groupName, hostId, userId, maxMembers, membershipStatus }: any) {
  const supabase = await createClient();
  const { count } = await supabase.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", id).eq("status", "active");
  return (
    <GroupActions 
      groupId={id} 
      groupName={groupName} 
      hostId={hostId} 
      userId={userId} 
      maxMembers={maxMembers} 
      memberCount={count || 0} 
      membershipStatus={membershipStatus} 
    />
  );
}

async function GroupStatsSection({ id, colors }: { id: string; colors: any }) {
  const supabase = await createClient();
  
  // 가입된 멤버 수와 전체 신청/대기 멤버 수를 정확하게 분리하여 조회
  const [
    { data: activeMembers },
    { data: allApplicants },
    { data: meetingList },
  ] = await Promise.all([
    supabase.from("group_members").select("user_id").eq("group_id", id).eq("status", "active"),
    supabase.from("group_members").select("user_id").eq("group_id", id).in("status", ["active", "pending", "waitlist"]),
    supabase.from("meetings").select("id").eq("group_id", id),
  ]);

  const activeCount = activeMembers?.length || 0;
  const totalCount = allApplicants?.length || 0;
  const totalMeetings = meetingList?.length || 0;

  // Count files: group + files attached to posts + agenda resources
  const [{ data: posts }, { data: groupFilesList }] = await Promise.all([
    supabase.from("crew_posts").select("id").eq("group_id", id),
    supabase.from("file_attachments").select("id").eq("target_type", "group").eq("target_id", id),
  ]);
  
  const groupFiles = groupFilesList?.length || 0;
  
  const postIds = (posts || []).map(p => p.id);
  let postFilesCount = 0;
  if (postIds.length > 0) {
    const { data: cpFilesList } = await supabase.from("file_attachments")
      .select("id")
      .in("target_type", ["crew_post"])
      .in("target_id", postIds);
    postFilesCount = cpFilesList?.length || 0;
  }

  // Count meeting agenda resources more efficiently
  const { data: agendaResources } = await supabase.from("meetings")
    .select("agendas:meeting_agendas(resources)")
    .eq("group_id", id);
  
  let agendaFilesCount = 0;
  if (agendaResources) {
    agendaResources.forEach((m: any) => {
      m.agendas?.forEach((a: any) => {
        if (Array.isArray(a.resources)) agendaFilesCount += a.resources.length;
      });
    });
  }
  
  const totalFiles = (groupFiles ?? 0) + postFilesCount + agendaFilesCount;

  const stats = [
    { icon: <Users size={16} />, label: "멤버", value: activeCount ?? 0, sub: (totalCount || 0) > (activeCount || 0) ? `+${(totalCount || 0) - (activeCount || 0)} 대기` : null },
    { icon: <BookOpen size={16} />, label: "총 미팅", value: totalMeetings ?? 0, sub: null },
    { icon: <FileText size={16} />, label: "파일", value: totalFiles ?? 0, sub: null },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mt-8 border-t-[2px] border-nu-ink/10 pt-6">
      {stats.map((stat) => (
        <div key={stat.label} className={`flex items-center gap-3 px-4 py-3 border-r border-nu-ink/10 last:border-r-0 ${colors.light}`}>
          <span className={colors.text}>{stat.icon}</span>
          <div>
            <p className="font-head text-xl font-extrabold text-nu-ink">
              {(stat.value || 0).toLocaleString()}
            </p>
            <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">
              {stat.label} {stat.sub && `(${stat.sub})`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

async function GroupUpcomingSection({ id, colors, isHost, isMember, userId }: any) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  
  const [
    { data: events },
    { data: meetings },
    { data: pastMeetings },
  ] = await Promise.all([
    supabase.from("events").select("*").eq("group_id", id).gte("start_at", now).order("start_at").limit(5),
    supabase.from("meetings").select("id, title, scheduled_at, duration_min, location, status").eq("group_id", id).in("status", ["upcoming", "in_progress"]).gte("scheduled_at", now).order("scheduled_at").limit(5),
    supabase.from("meetings").select("id, title, scheduled_at, summary, next_topic, status").eq("group_id", id).eq("status", "completed").order("scheduled_at", { ascending: false }).limit(3),
  ]);

  const allUpcoming = [
    ...(events || []).map((e: any) => ({ ...e, itemType: "event" as const })),
    ...(meetings || []).map((m: any) => ({ ...m, start_at: m.scheduled_at, itemType: "meeting" as const })),
  ].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return (
    <div className="space-y-8">
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
            <p className="text-nu-gray text-sm">예정된 일정이 없습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {allUpcoming.map((item) => {
              const date = new Date(item.start_at);
              const isEvent = item.itemType === "event";
              return (
                <div key={`${item.itemType}-${item.id}`} className="bg-nu-white border-[2px] border-nu-ink/[0.08] hover:border-nu-pink/40 transition-all group">
                  <Link href={isEvent ? `/groups/${id}/events/${item.id}` : `/groups/${id}/meetings/${item.id}`} className="p-5 flex items-center gap-4 no-underline">
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
                        {!isEvent && <span className="font-mono-nu text-[8px] uppercase tracking-wider px-1.5 py-0.5 bg-nu-blue/10 text-nu-blue shrink-0">미팅</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-nu-muted">
                        <span className="flex items-center gap-1"><Clock size={11} /> {date.toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}</span>
                        {item.location && <span className="flex items-center gap-1"><MapPin size={11} /> {item.location}</span>}
                      </div>
                    </div>
                  </Link>
                  {isEvent && (isMember || isHost) && (
                    <div className="border-t border-nu-ink/[0.06] px-5 py-3">
                      <EventRsvpButton eventId={item.id} userId={userId} maxAttendees={(item as any).max_attendees} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {pastMeetings && pastMeetings.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
              <Target size={18} className="text-nu-amber" /> 지난 미팅 기록
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {pastMeetings.map((m: any) => (
              <Link key={m.id} href={`/groups/${id}/meetings/${m.id}`} className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-5 no-underline hover:border-nu-amber/40 transition-all group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-nu-amber/10 flex items-center justify-center shrink-0 mt-0.5">
                    <BookOpen size={16} className="text-nu-amber" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-head text-sm font-bold text-nu-ink group-hover:text-nu-amber transition-colors mb-1">{m.title}</p>
                    <p className="font-mono-nu text-[10px] text-nu-muted">{new Date(m.scheduled_at).toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric" })}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

async function ActivitySection({ id, userId, isMember, isHost }: any) {
  return (
    <section>
      <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2 mb-4">
        <Activity size={18} /> 활동
      </h2>
      <CrewActivityFeed groupId={id} userId={userId} initialPosts={[]} canPost={!!isMember || isHost} isHost={isHost} isAdmin={false} />
    </section>
  );
}

async function GroupSidebarSections({ id, colors, isHost, isMember, group }: any) {
  const supabase = await createClient();
  const { data: members } = await supabase.from("group_members").select("user_id, role, profile:profiles(id, nickname, avatar_url)").eq("group_id", id).eq("status", "active").order("joined_at");

  return (
    <div className="space-y-6">
      {(isMember || isHost) && (
        <GroupRoadmap groupId={id} groupTopic={(group as any).topic} canEdit={isHost} />
      )}
      
      <WorkspaceLinks workspaceType="crew" workspaceId={id} canEdit={isHost} kakaoUrl={group.kakao_chat_url} driveUrl={group.google_drive_url} />

      <div>
        <h2 className="font-head text-lg font-extrabold text-nu-ink mb-3 flex items-center gap-2">
          <Users size={16} /> 멤버 ({members?.length || 0})
        </h2>
        <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
          {members?.slice(0, 8).map((m: any) => (
            <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 border-b border-nu-ink/[0.05] last:border-b-0 hover:bg-nu-cream/30 transition-colors">
              <div className={`w-8 h-8 rounded-full ${colors.light} flex items-center justify-center font-head text-xs font-bold ${colors.text}`}>
                {(m.profile?.nickname || "U").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-nu-ink truncate">{m.profile?.nickname}</p>
                <p className="font-mono-nu text-[10px] text-nu-muted">{m.role === "host" ? "🏠 호스트" : "멤버"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <CrewProjects groupId={id} />
    </div>
  );
}
