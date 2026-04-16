import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import {
  Calendar,
  Users,
  Settings,
  MapPin,
  Clock,
  MessageCircle,
  BookOpen,
  ChevronRight,
  Activity,
  Target,
  Plus,
  FileText,
  Upload,
  Crown,
  Shield,
  UserPlus,
  ExternalLink,
  Link2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { GroupActions } from "@/components/groups/group-actions";
import { GroupSearch } from "@/components/groups/group-search";
import { OnboardingChecklist } from "@/components/groups/onboarding-checklist";
import { getCategory } from "@/lib/constants";

// Lazy-load heavy below-fold components
const CrewActivityFeed = dynamic(() => import("@/components/crews/crew-activity-feed").then(m => m.CrewActivityFeed));
const CrewProjects = dynamic(() => import("@/components/crews/crew-projects").then(m => m.CrewProjects));
const WorkspaceLinks = dynamic(() => import("@/components/integrations/workspace-links").then(m => m.WorkspaceLinks));
const EventRsvpButton = dynamic(() => import("@/components/groups/event-rsvp-button").then(m => m.EventRsvpButton));
const GroupRoadmap = dynamic(() => import("@/components/groups/group-roadmap").then(m => m.GroupRoadmap));
const GroupRadarChart = dynamic(() => import("@/components/groups/group-vitals").then(m => m.GroupRadarChart));
const ActivityHeatmap = dynamic(() => import("@/components/groups/group-vitals").then(m => m.ActivityHeatmap));
const DailyDigest = dynamic(() => import("@/components/groups/daily-digest").then(m => m.DailyDigest));
const RelatedGroups = dynamic(() => import("@/components/groups/related-groups").then(m => m.RelatedGroups));
const GroupAnnouncements = dynamic(() => import("@/components/groups/group-announcements").then(m => m.GroupAnnouncements));
const GroupGrowthWidget = dynamic(() => import("@/components/groups/group-growth-widget").then(m => m.GroupGrowthWidget));

export const revalidate = 60; // ISR: 60초 캐시

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: group } = await supabase.from("groups").select("name, description").eq("id", id).single();
  return {
    title: group ? `${group.name} — nutunion` : "너트 — nutunion",
    description: group?.description || "nutunion 너트",
  };
}

const catColors: Record<string, { bg: string; text: string; border: string; light: string }> = {
  space:    { bg: "bg-nu-blue",   text: "text-nu-blue",   border: "border-nu-blue",   light: "bg-nu-blue/10" },
  culture:  { bg: "bg-nu-amber",  text: "text-nu-amber",  border: "border-nu-amber",  light: "bg-nu-amber/10" },
  platform: { bg: "bg-nu-ink",    text: "text-nu-ink",    border: "border-nu-ink",    light: "bg-nu-ink/10" },
  vibe:     { bg: "bg-nu-pink",   text: "text-nu-pink",   border: "border-nu-pink",   light: "bg-nu-pink/10" },
};

/** Relative date formatter for upcoming events within 7 days */
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((targetStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "내일";
  if (diffDays === 2) return "모레";
  if (diffDays <= 7) {
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    return `이번 주 ${dayNames[date.getDay()]}요일`;
  }
  return date.toLocaleDateString("ko", { month: "long", day: "numeric" });
}

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── 데이터 조회 (병렬) ──────────────────────────────────
  let group: any = null;
  let userMembership: any = null;

  try {
    const [groupRes, membershipRes] = await Promise.all([
      supabase.from("groups")
        .select("id, name, description, category, image_url, host_id, max_members, is_active, kakao_chat_url, google_drive_url, created_at, host:profiles!groups_host_id_fkey(id, nickname, avatar_url)")
        .eq("id", id)
        .single(),
      supabase.from("group_members")
        .select("status, role")
        .eq("group_id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const { data: groupData, error: groupError } = groupRes;
    const { data: membershipData } = membershipRes;

    if (!groupData) {
      console.error("Group not found:", id, groupError);
      notFound();
    }

    group = groupData;
    userMembership = membershipData;
  } catch (err: any) {
    // If notFound() was thrown it will propagate correctly; re-throw
    if (err?.digest?.startsWith("NEXT_NOT_FOUND")) throw err;
    console.error("Group detail data fetch error:", err);
    notFound();
  }

  if (!group) notFound();

  const isHost        = group.host_id === user.id;
  const isManager     = isHost || userMembership?.role === "moderator";
  const isMember      = isHost || userMembership?.status === "active";
  const membershipStatus = userMembership?.status as "active" | "pending" | "waitlist" | null;
  const colors        = catColors[group.category] || catColors.vibe;
  const categoryMeta  = getCategory(group.category);

  // Supabase join returns array or single object depending on FK constraint
  const hostProfile = Array.isArray(group.host) ? group.host[0] : group.host;
  const groupData = { ...group, host: hostProfile } as any;

  return (
    <>
      {/* ── Hero Banner ──────────────────────────────── */}
      <div className={`relative border-b-[3px] border-nu-ink ${colors.light} overflow-hidden min-h-[320px] flex items-center`}>
        {/* Background Image/Pattern */}
        {group.image_url ? (
          <div className="absolute inset-0 z-0">
            <img
              src={group.image_url}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className={`absolute inset-0 bg-gradient-to-r ${colors.light} via-nu-paper/90 to-nu-paper/40 mix-blend-normal`} />
            <div className="absolute inset-0 bg-nu-paper/20 backdrop-blur-[2px]" />
          </div>
        ) : (
          <>
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #0d0d0d 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-nu-pink/5 rounded-full blur-3xl" />
            <div className="absolute -left-20 -top-20 w-80 h-80 bg-nu-blue/5 rounded-full blur-3xl" />
          </>
        )}

        <div className="max-w-6xl mx-auto px-8 py-10 relative z-10 w-full">
          <div className="flex items-center gap-1 font-mono-nu text-[12px] text-nu-muted uppercase tracking-widest mb-6">
            <Link href="/groups" className="hover:text-nu-ink transition-colors no-underline">너트</Link>
            <ChevronRight size={12} />
            <span className="text-nu-ink">{group.name}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-6">
                <span className={`inline-block font-mono-nu text-[11px] font-bold uppercase tracking-[0.15em] px-3 py-1 text-white ${colors.bg} -rotate-1 shadow-lg shadow-black/10`}>
                  {group.category}
                </span>
                {/* Category pill from constants */}
                {categoryMeta && (
                  <span className={`inline-block font-mono-nu text-[11px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 border-[2px] ${categoryMeta.border} ${categoryMeta.text} ${categoryMeta.light}`}>
                    {categoryMeta.label}
                  </span>
                )}
              </div>
              <h1 className="font-head text-5xl font-extrabold text-nu-ink tracking-tight mb-4 drop-shadow-sm">
                {group.name}
              </h1>
              <p className="text-nu-graphite max-w-xl leading-relaxed mb-6 text-sm font-medium">
                {group.description}
              </p>
              <div className="flex flex-wrap items-center gap-6 font-mono-nu text-[13px]">
                 <span className="flex items-center gap-2 text-nu-muted">
                   <span className="w-1.5 h-1.5 rounded-full bg-nu-pink animate-pulse" />
                   호스트: <span className="text-nu-ink font-bold">{groupData.host?.nickname || "—"}</span>
                 </span>
                 <Suspense fallback={<span className="text-nu-muted">...</span>}>
                   <HeroQuickStats id={id} />
                 </Suspense>
              </div>
            </div>

            <div className="flex flex-col gap-3 shrink-0 items-end">
              {(isHost || isManager) && (
                <Link href={`/groups/${id}/settings`} className="p-3 bg-nu-paper border-[2px] border-nu-ink/20 text-nu-graphite no-underline hover:bg-nu-ink hover:text-nu-paper transition-all hover:-translate-y-0.5 inline-flex items-center">
                  <Settings size={18} />
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

      {/* ── Quick Actions Bar (members only) ─────────── */}
      {isMember && membershipStatus !== "pending" && membershipStatus !== "waitlist" && (
        <div className="max-w-6xl mx-auto px-8 pt-8">
          <div className="grid grid-cols-3 gap-3">
            {[
              { href: `/groups/${id}/meetings/create`, icon: <Plus size={14} />, label: "미팅 만들기" },
              { href: `/groups/${id}/wiki`, icon: <FileText size={14} />, label: "탭 작성" },
              { href: `/groups/${id}/resources`, icon: <Upload size={14} />, label: "자료 올리기" },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-nu-white border-[2px] border-nu-ink/10 hover:border-nu-pink/40 hover:-translate-y-0.5 transition-all no-underline group"
              >
                <span className="text-nu-muted group-hover:text-nu-pink transition-colors">{action.icon}</span>
                <span className="font-mono-nu text-[13px] font-bold uppercase tracking-widest text-nu-graphite group-hover:text-nu-ink transition-colors">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Content ────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-8 py-10 pb-24">
        {(isMember || isHost) && (
          <div className="mb-8">
            <GroupSearch groupId={id} />
          </div>
        )}

        <Suspense fallback={null}>
          <GroupAnnouncements groupId={id} />
        </Suspense>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Daily Digest */}
            <DailyDigest groupId={id} />

            <Suspense fallback={<div className="p-12 bg-black/5 animate-pulse" />}>
              <GroupUpcomingSection id={id} colors={colors} isHost={isHost} isMember={isMember} userId={user.id} />
            </Suspense>

            <Suspense fallback={<div className="p-12 bg-black/5 animate-pulse" />}>
              <ActivitySection id={id} userId={user.id} isMember={isMember} isHost={isHost} />
            </Suspense>
          </div>

          <div className="space-y-6">
            {/* Growth Widget */}
            {(isMember || isHost) && (
              <GroupGrowthWidget groupId={id} />
            )}
            <Suspense fallback={<div className="h-64 bg-black/5 animate-pulse" />}>
              <GroupSidebarSections id={id} colors={colors} isHost={isHost} isMember={isMember} group={groupData} userId={user.id} />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Related Groups Recommendation */}
      <RelatedGroups groupId={id} category={group.category} />
    </>
  );
}

// ── Streaming용 하위 서버 컴포넌트들 ──────────────────────────────

async function GroupJoinAction({ id, groupName, hostId, userId, maxMembers, membershipStatus }: any) {
  const supabase = await createClient();
  const { count } = await supabase.from("group_members").select("user_id", { count: "exact", head: true }).eq("group_id", id).eq("status", "active");
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

async function HeroQuickStats({ id }: { id: string }) {
  const supabase = await createClient();
  const [{ count: memberCount }, { count: meetingCount }] = await Promise.all([
    supabase.from("group_members").select("user_id", { count: "exact", head: true }).eq("group_id", id).eq("status", "active"),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("group_id", id),
  ]);
  return (
    <>
      <span className="flex items-center gap-1.5 text-nu-muted">
        <Users size={12} /> <span className="text-nu-ink font-bold">{memberCount ?? 0}</span> 와셔
      </span>
      <span className="flex items-center gap-1.5 text-nu-muted">
        <BookOpen size={12} /> <span className="text-nu-ink font-bold">{meetingCount ?? 0}</span> 미팅
      </span>
    </>
  );
}

async function GroupStatsSection({ id, colors }: { id: string; colors: any }) {
  try {
  const supabase = await createClient();

  // Parallel queries: members + meetings count + group created_at + recent activity check
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: members }, { count: totalMeetings }, { data: groupMeta }, { count: recentActivityCount }] = await Promise.all([
    supabase.from("group_members").select("user_id, status").eq("group_id", id).in("status", ["active", "pending", "waitlist"]),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("group_id", id),
    supabase.from("groups").select("created_at").eq("id", id).single(),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("group_id", id).gte("scheduled_at", sevenDaysAgo),
  ]);

  const activeCount = members?.filter(m => m.status === "active").length || 0;
  const pendingCount = (members?.length || 0) - activeCount;
  const createdDaysAgo = groupMeta?.created_at
    ? Math.floor((Date.now() - new Date(groupMeta.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isRecentlyActive = (recentActivityCount ?? 0) > 0;

  const stats = [
    { icon: <Users size={18} />, label: "와셔", value: activeCount, sub: pendingCount > 0 ? `+${pendingCount} 대기` : null },
    { icon: <BookOpen size={18} />, label: "총 미팅", value: totalMeetings ?? 0, sub: null },
    { icon: <Clock size={18} />, label: "활동일", value: createdDaysAgo, sub: "일째" },
  ];

  return (
    <div className="mt-8 border-t-[2px] border-nu-ink/10 pt-6">
      {/* Active indicator */}
      {isRecentlyActive && (
        <div className="flex items-center gap-2 mb-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-green-600">활동중</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-0">
        {stats.map((stat) => (
          <div key={stat.label} className={`flex flex-col items-center gap-1 px-4 py-5 border-r-[2px] border-nu-ink/10 last:border-r-0 ${colors.light}`}>
            <span className={`${colors.text} mb-1`}>{stat.icon}</span>
            <p className="font-head text-3xl font-extrabold text-nu-ink leading-none">
              {(stat.value || 0).toLocaleString()}
            </p>
            <p className="font-mono-nu text-[12px] text-nu-muted uppercase tracking-widest">
              {stat.label}
            </p>
            {stat.sub && (
              <p className="font-mono-nu text-[11px] text-nu-muted/70 uppercase tracking-wider">
                {stat.sub}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
  } catch (err) {
    console.error("GroupStatsSection error:", err);
    return null;
  }
}

async function GroupUpcomingSection({ id, colors, isHost, isMember, userId }: any) {
  try {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [
    { data: events },
    { data: meetings },
    { data: pastMeetings },
  ] = await Promise.all([
    supabase.from("events").select("id, title, start_at, end_at, location, max_attendees").eq("group_id", id).gte("start_at", now).order("start_at").limit(5),
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
            <Link href={`/groups/${id}/schedule`} className={`font-mono-nu text-[13px] uppercase tracking-widest ${colors.text} no-underline hover:underline flex items-center gap-1`}>
              캘린더 <ChevronRight size={12} />
            </Link>
          )}
        </div>

        {allUpcoming.length === 0 ? (
          <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-10 text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-nu-ink/5 flex items-center justify-center">
              <Calendar size={24} className="text-nu-muted" />
            </div>
            <div>
              <p className="font-head text-sm font-bold text-nu-graphite mb-1">예정된 일정이 없습니다</p>
              <p className="font-mono-nu text-[12px] text-nu-muted uppercase tracking-widest">아직 등록된 미팅이나 이벤트가 없어요</p>
            </div>
            {(isMember || isHost) && (
              <Link
                href={`/groups/${id}/meetings/create`}
                className={`inline-flex items-center gap-2 px-5 py-2.5 border-[2px] border-nu-ink text-nu-ink font-mono-nu text-[13px] font-bold uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper transition-all hover:-translate-y-0.5`}
              >
                <Plus size={14} /> 미팅 만들기
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {allUpcoming.map((item) => {
              const date = new Date(item.start_at);
              const isEvent = item.itemType === "event";
              const relativeLabel = formatRelativeDate(date);
              return (
                <div key={`${item.itemType}-${item.id}`} className="bg-nu-white border-[2px] border-nu-ink/[0.08] hover:border-nu-pink/40 transition-all group">
                  <Link href={isEvent ? `/groups/${id}/events/${item.id}` : `/groups/${id}/meetings/${item.id}`} className="p-5 flex items-center gap-4 no-underline">
                    <div className={`w-14 h-14 flex flex-col items-center justify-center shrink-0 ${isEvent ? "bg-nu-pink/10" : "bg-nu-blue/10"}`}>
                      <span className={`font-head text-lg font-extrabold leading-none ${isEvent ? "text-nu-pink" : "text-nu-blue"}`}>
                        {date.getDate()}
                      </span>
                      <span className={`font-mono-nu text-[11px] uppercase ${isEvent ? "text-nu-pink/70" : "text-nu-blue/70"}`}>
                        {date.toLocaleDateString("ko", { month: "short" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-head text-sm font-bold text-nu-ink truncate group-hover:text-nu-pink transition-colors">
                          {item.title}
                        </h3>
                        {!isEvent && <span className="font-mono-nu text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-nu-blue/10 text-nu-blue shrink-0">미팅</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-nu-muted">
                        <span className="font-mono-nu text-[12px] font-bold text-nu-graphite">{relativeLabel}</span>
                        <span className="flex items-center gap-1"><Clock size={11} /> {date.toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
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
                    <p className="font-mono-nu text-[12px] text-nu-muted">{new Date(m.scheduled_at).toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric" })}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
  } catch (err) {
    console.error("GroupUpcomingSection error:", err);
    return <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-8 text-center"><p className="text-nu-gray text-sm">일정을 불러오는 중 오류가 발생했습니다.</p></div>;
  }
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

async function GroupSidebarSections({ id, colors, isHost, isMember, group, userId }: any) {
  try {
  const supabase = await createClient();

  // Fetch members + recent activity for online status
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: members }, { data: recentPosts }] = await Promise.all([
    supabase.from("group_members").select("user_id, role, profile:profiles(id, nickname, avatar_url)").eq("group_id", id).eq("status", "active").order("joined_at"),
    supabase.from("posts").select("author_id").eq("group_id", id).gte("created_at", twentyFourHoursAgo),
  ]);

  // Set of user IDs with recent activity (approximate online status)
  const recentlyActiveUserIds = new Set((recentPosts || []).map((p: any) => p.author_id));

  const hasKakao = !!group.kakao_chat_url;
  const hasDrive = !!group.google_drive_url;
  const hasWorkspaceLinks = hasKakao || hasDrive;

  const MEMBERS_DISPLAY_LIMIT = 12;
  const displayMembers = members?.slice(0, MEMBERS_DISPLAY_LIMIT) || [];
  const totalMembers = members?.length || 0;
  const hasMoreMembers = totalMembers > MEMBERS_DISPLAY_LIMIT;

  return (
    <div className="space-y-6">
      {isHost && (
        <OnboardingChecklist groupId={id} isHost={isHost} />
      )}

      {(isMember || isHost) && (
        <GroupRoadmap groupId={id} canEdit={isHost} userId={userId} />
      )}

      {/* Team Vitals: Radar + Heatmap */}
      <GroupRadarChart groupId={id} />
      <ActivityHeatmap groupId={id} />

      {/* ── Communication & Knowledge ─────────────── */}
      <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-5">
        <h2 className="font-head text-sm font-bold text-nu-ink mb-4 flex items-center gap-2">
          <MessageCircle size={16} className="text-nu-pink" /> Communication & Knowledge
        </h2>

        {/* Prominent workspace links */}
        {hasWorkspaceLinks && (
          <div className="flex flex-col gap-2 mb-4">
            {hasKakao && (
              <a
                href={group.kakao_chat_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 border-[2px] border-[#FEE500]/60 bg-[#FEE500]/10 hover:bg-[#FEE500]/20 transition-colors no-underline group"
              >
                <span className="w-8 h-8 bg-[#FEE500] flex items-center justify-center font-head text-xs font-extrabold text-[#3C1E1E]">K</span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono-nu text-[13px] font-bold uppercase tracking-widest text-nu-ink">카카오톡 채팅</p>
                  <p className="font-mono-nu text-[11px] text-nu-muted truncate">{group.kakao_chat_url}</p>
                </div>
                <ExternalLink size={14} className="text-nu-muted shrink-0" />
              </a>
            )}
            {hasDrive && (
              <a
                href={group.google_drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 border-[2px] border-[#4285F4]/40 bg-[#4285F4]/5 hover:bg-[#4285F4]/10 transition-colors no-underline group"
              >
                <span className="w-8 h-8 bg-[#4285F4] flex items-center justify-center font-head text-xs font-extrabold text-white">G</span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono-nu text-[13px] font-bold uppercase tracking-widest text-nu-ink">구글 드라이브</p>
                  <p className="font-mono-nu text-[11px] text-nu-muted truncate">{group.google_drive_url}</p>
                </div>
                <ExternalLink size={14} className="text-nu-muted shrink-0" />
              </a>
            )}
          </div>
        )}

        {/* Hint for hosts when no links configured */}
        {!hasWorkspaceLinks && isHost && (
          <Link
            href={`/groups/${id}/settings`}
            className="flex items-center gap-2 px-4 py-3 border-[2px] border-dashed border-nu-ink/10 text-nu-muted hover:border-nu-ink/30 hover:text-nu-graphite transition-all no-underline mb-4"
          >
            <Link2 size={14} />
            <span className="font-mono-nu text-[12px] uppercase tracking-widest">외부 도구 연결하기</span>
          </Link>
        )}

        <WorkspaceLinks workspaceType="crew" workspaceId={id} canEdit={isHost} kakaoUrl={group.kakao_chat_url} driveUrl={group.google_drive_url} />
      </div>

      {/* ── Members Section ───────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
            <Users size={16} /> 와셔 ({totalMembers})
          </h2>
          {isHost && (
            <Link
              href={`/groups/${id}/settings`}
              className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-pink transition-colors no-underline flex items-center gap-1"
            >
              <UserPlus size={12} /> 와셔 초대
            </Link>
          )}
        </div>
        <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
          {displayMembers.map((m: any) => {
            const isOnline = recentlyActiveUserIds.has(m.user_id);
            const memberRole = m.role as string;
            return (
              <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 border-b border-nu-ink/[0.05] last:border-b-0 hover:bg-nu-cream/30 transition-colors">
                <div className="relative">
                  <div className={`w-8 h-8 rounded-full ${colors.light} flex items-center justify-center font-head text-xs font-bold ${colors.text}`}>
                    {(m.profile?.nickname || "U").charAt(0).toUpperCase()}
                  </div>
                  {/* Online status dot */}
                  {isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-[2px] border-nu-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-nu-ink truncate">{m.profile?.nickname}</p>
                  {memberRole === "host" && (
                    <span className="inline-flex items-center gap-1 font-mono-nu text-[11px] font-bold uppercase tracking-wider text-nu-amber">
                      <Crown size={10} /> 호스트
                    </span>
                  )}
                  {memberRole === "manager" && (
                    <span className="inline-flex items-center gap-1 font-mono-nu text-[11px] font-bold uppercase tracking-wider text-nu-blue">
                      <Shield size={10} /> 매니저
                    </span>
                  )}
                  {memberRole !== "host" && memberRole !== "manager" && (
                    <p className="font-mono-nu text-[12px] text-nu-muted">와셔</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {hasMoreMembers && (
          <Link
            href={`/groups/${id}/settings`}
            className="block mt-2 py-2.5 text-center font-mono-nu text-[13px] font-bold uppercase tracking-widest text-nu-muted hover:text-nu-ink border-[2px] border-dashed border-nu-ink/10 hover:border-nu-ink/30 transition-all no-underline"
          >
            전체 보기 ({totalMembers}명) <ChevronRight size={12} className="inline" />
          </Link>
        )}
      </div>

      <CrewProjects groupId={id} />
    </div>
  );
  } catch (err) {
    console.error("GroupSidebarSections error:", err);
    return <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-8 text-center"><p className="text-nu-gray text-sm">사이드바를 불러오는 중 오류가 발생했습니다.</p></div>;
  }
}
