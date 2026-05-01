import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Suspense, cache } from "react";
import { GenerativeArt } from "@/components/art/generative-art";
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
  MessageSquare,
} from "lucide-react";
import dynamic from "next/dynamic";
import { GroupActions } from "@/components/groups/group-actions";
import { ShareButton } from "@/components/shared/share-dialog";
import { GroupSearch } from "@/components/groups/group-search";
import { GroupStatusPanel } from "@/components/groups/group-status-panel";
import { DriveR2MigrationBanner } from "@/components/shared/drive-r2-migration-banner";
import { OnboardingChecklist } from "@/components/groups/onboarding-checklist";
import { getCategory } from "@/lib/constants";
import { ThreadBetaSection } from "@/components/threads/thread-beta-section";
import { SpacePages } from "@/components/spaces/space-pages";
import { MeetingArchiveTimeline } from "@/components/meetings/meeting-archive-timeline";

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
  const title = group ? `${group.name} — nutunion` : "너트 — nutunion";
  const description = (group?.description || "nutunion 너트 · Protocol Collective").slice(0, 160);
  const ogUrl = `/api/og/group/${id}`;
  const canonical = `https://nutunion.co.kr/groups/${id}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: group?.name || "너트",
      description,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      type: "website",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: group?.name || "너트",
      description,
      images: [ogUrl],
    },
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
  // KST 기준 날짜 비교 — 서버(UTC)에서도 한국 날짜 기준
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const toKstDay = (d: Date): Date => {
    const shifted = new Date(d.getTime() + kstOffsetMs);
    return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
  };
  const todayStart = toKstDay(new Date());
  const targetStart = toKstDay(date);
  const diffDays = Math.round((targetStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "내일";
  if (diffDays === 2) return "모레";
  if (diffDays <= 7) {
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    // KST 기준 요일
    const kstDayIdx = new Date(date.getTime() + kstOffsetMs).getUTCDay();
    return `이번 주 ${dayNames[kstDayIdx]}요일`;
  }
  return date.toLocaleDateString("ko", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });
}

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // 비로그인 허용 — SEO 친화 공개 뷰
  const { data: { user } } = await supabase.auth.getUser();

  let group: any = null;
  let userMembership: any = null;
  let isGenesis = false;

  try {
    // 1차: 최소 필드 (확실히 존재하는 컬럼) — 이게 실패하면 그룹 자체가 없는 것
    const [groupRes, membershipRes] = await Promise.all([
      supabase.from("groups")
        .select("id, name, description, category, host_id, max_members, is_active, created_at")
        .eq("id", id)
        .single(),
      user
        ? supabase.from("group_members").select("status, role").eq("group_id", id).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const { data: groupData, error: groupError } = groupRes;
    const { data: membershipData } = membershipRes;

    if (!groupData) {
      console.error("Group not found:", id, groupError);
      notFound();
    }

    group = groupData as any;
    userMembership = membershipData;

    // 2차/3차/Genesis 병렬화 — 이전엔 3 round-trip 직렬이었음
    const [extraRes, hostRes, genesisRes] = await Promise.all([
      supabase.from("groups")
        .select("image_url, kakao_chat_url, google_drive_url, google_drive_folder_id")
        .eq("id", id)
        .maybeSingle()
        .then((r) => r, () => ({ data: null })),
      supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .eq("id", group.host_id)
        .maybeSingle()
        .then((r) => r, () => ({ data: null })),
      supabase
        .from("genesis_plans")
        .select("id")
        .eq("target_kind", "group")
        .eq("target_id", id)
        .limit(1)
        .maybeSingle()
        .then((r) => r, () => ({ data: null })),
    ]);
    const extra = (extraRes as any)?.data;
    if (extra) Object.assign(group, extra);
    const host = (hostRes as any)?.data;
    if (host) group.host = host;
    isGenesis = !!(genesisRes as any)?.data;
  } catch (err: any) {
    // If notFound() was thrown it will propagate correctly; re-throw
    if (err?.digest?.startsWith("NEXT_NOT_FOUND")) throw err;
    console.error("Group detail data fetch error:", err);
    notFound();
  }

  if (!group) notFound();

  const isHost        = !!user && group.host_id === user.id;
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
      {/* ── Compact Hero with Generative Cover ──────────── */}
      <div className={`relative border-b-[3px] border-nu-ink ${colors.light} overflow-hidden`}>
        {group.image_url ? (
          <div className="absolute inset-0 z-0">
            <img src={group.image_url} alt="" className="w-full h-full object-cover" />
            <div className={`absolute inset-0 bg-gradient-to-r ${colors.light} via-nu-paper/90 to-nu-paper/40`} />
            <div className="absolute inset-0 bg-nu-paper/30 backdrop-blur-[1px]" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
            <GenerativeArt
              seed={group.id}
              category={(["space","culture","platform","vibe"].includes(group.category) ? group.category : "culture") as any}
              variant="hero"
              className="w-full h-full"
              title={`${group.name} visual`}
            />
            <div className={`absolute inset-0 bg-gradient-to-r ${colors.light} via-nu-paper/85 to-nu-paper/40`} />
          </div>
        )}

        <div className="max-w-6xl mx-auto px-6 md:px-8 py-5 relative z-10 w-full">
          <div className="flex items-center gap-1 font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mb-2">
            <Link href="/groups" className="hover:text-nu-ink transition-colors no-underline">너트</Link>
            <ChevronRight size={10} />
            <span className="text-nu-ink">{group.name}</span>
          </div>

          <div className="flex items-start md:items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="font-head text-[22px] md:text-[26px] font-extrabold text-nu-ink tracking-tight m-0">
                  {group.name}
                </h1>
                <span className={`inline-block font-mono-nu text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 text-white ${colors.bg}`}>
                  {group.category}
                </span>
                {categoryMeta && (
                  <span className={`inline-block font-mono-nu text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border-[1.5px] ${categoryMeta.border} ${categoryMeta.text} ${categoryMeta.light}`}>
                    {categoryMeta.label}
                  </span>
                )}
                {isGenesis && (
                  <Link
                    href={`/groups/${id}/genesis`}
                    className="inline-flex items-center gap-1 font-mono-nu text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border-[1.5px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink hover:border-nu-pink"
                    title="Genesis AI 로 생성된 공간"
                  >
                    ✨ Genesis AI
                  </Link>
                )}
              </div>
              {group.description && (
                <p className="text-nu-graphite leading-relaxed text-[12px] mb-2 line-clamp-2 max-w-3xl">
                  {group.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 font-mono-nu text-[11px]">
                <span className="flex items-center gap-1 text-nu-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-nu-pink animate-pulse" />
                  호스트 <span className="text-nu-ink font-bold">{groupData.host?.nickname || "—"}</span>
                </span>
                <Suspense fallback={<span className="text-nu-muted">...</span>}>
                  <HeroQuickStats id={id} />
                </Suspense>
              </div>
            </div>

            <div className="flex gap-2 shrink-0 flex-wrap">
              <Link href={`/groups/${id}/threads`} className="h-9 px-3 bg-nu-paper border-[2px] border-nu-ink/20 text-nu-graphite no-underline hover:bg-nu-ink hover:text-nu-paper inline-flex items-center font-mono-nu text-[11px] uppercase tracking-widest" title="Thread 관리">
                🧩 Thread
              </Link>
              {(isHost || isManager) && (
                <ShareButton
                  title={group.name}
                  description={group.description || "nutunion 너트 — 함께 만들어가는 공간"}
                  url={`https://nutunion.co.kr/groups/${id}`}
                  kind="너트"
                />
              )}
              {(isHost || isManager) && (
                <Link href={`/groups/${id}/settings`} className="h-9 px-3 bg-nu-paper border-[2px] border-nu-ink/20 text-nu-graphite no-underline hover:bg-nu-ink hover:text-nu-paper inline-flex items-center">
                  <Settings size={15} />
                </Link>
              )}
              {!isHost && !isManager && (
                <Suspense fallback={<div className="w-28 h-9 bg-black/5" />}>
                  <GroupJoinAction id={id} groupName={group.name} hostId={group.host_id} userId={user?.id ?? ""} maxMembers={group.max_members} membershipStatus={membershipStatus} />
                </Suspense>
              )}
            </div>
          </div>

          <Suspense fallback={<div className="h-20 bg-black/5 animate-pulse mt-8 border-t-[2px] border-nu-ink/10 pt-6" />}>
            <GroupStatsSection id={id} colors={colors} />
          </Suspense>
        </div>
      </div>

      {/* ── Drive → R2 migration nudge (admin/host only) ─── */}
      <div className="max-w-6xl mx-auto px-8 pt-4">
        <Suspense fallback={null}>
          <DriveR2MigrationBanner scope="group" id={id} driveFolderId={group.google_drive_folder_id} hostId={group.host_id} />
        </Suspense>
      </div>

      {/* ── Quick Actions Bar (members only) ─────────── */}
      {isMember && membershipStatus !== "pending" && membershipStatus !== "waitlist" && (
        <div className="max-w-6xl mx-auto px-8 pt-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: `/groups/${id}/meetings/create`, icon: <Plus size={14} />, label: "미팅 만들기", color: "hover:border-nu-blue/40 hover:text-nu-blue" },
              { href: `/groups/${id}/wiki`, icon: <FileText size={14} />, label: "위키 작성", color: "hover:border-nu-pink/40 hover:text-nu-pink" },
              { href: `/groups/${id}/resources`, icon: <Upload size={14} />, label: "자료 올리기", color: "hover:border-nu-amber/40 hover:text-nu-amber" },
              { href: `/groups/${id}/meetings`, icon: <BookOpen size={14} />, label: "미팅 기록", color: "hover:border-nu-ink/40 hover:text-nu-ink" },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={`flex items-center justify-center gap-2 px-4 py-3 border-[2px] hover:-translate-y-0.5 transition-all no-underline group shadow-[2px_2px_0_0_rgba(13,13,13,0.1)] hover:shadow-[3px_3px_0_0_rgba(13,13,13,0.15)] bg-nu-white border-nu-ink/10 ${action.color}`}
              >
                <span className="text-nu-muted group-hover:text-current transition-colors">{action.icon}</span>
                <span className="font-mono-nu text-[13px] font-bold uppercase tracking-widest text-nu-graphite group-hover:text-nu-ink transition-colors">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Content (Reader Mode) ──────────────────────── */}
      <div className="reader-shell pb-24">
        <div className="max-w-[1040px] mx-auto px-4 md:px-6 py-8">
          {/* 비로그인 공개 안내 배너 — SEO 진입 유저용 */}
          {!user && (
            <div className="mb-6 border-l-[3px] border-[color:var(--liquid-primary)] bg-[color:var(--neutral-0)] border border-[color:var(--neutral-100)] p-4 rounded-[var(--ds-radius-lg)]">
              <p className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-[color:var(--liquid-primary)] font-bold mb-1">
                Preview · Nut
              </p>
              <h2 className="text-[16px] font-semibold text-[color:var(--neutral-900)] mb-1">
                이 너트의 활동·멤버·공지를 보시려면 로그인이 필요해요
              </h2>
              <p className="text-[13px] text-[color:var(--neutral-500)] leading-relaxed mb-3">
                너트는 참여한 와셔만 내부 피드·일정·자료를 열람할 수 있어요. 아래 <strong>[가입하기]</strong> 를 눌러 합류해보세요.
              </p>
              <div className="flex gap-2">
                <Link
                  href={`/login?redirectTo=/groups/${id}`}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-[color:var(--neutral-900)] text-[color:var(--neutral-0)] rounded-[var(--ds-radius-md)] text-[13px] font-medium no-underline hover:bg-[color:var(--liquid-primary)] transition-colors"
                >
                  로그인하고 참여 →
                </Link>
                <Link
                  href="/groups"
                  className="inline-flex items-center gap-1 px-3 py-2 border border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] text-[13px] text-[color:var(--neutral-700)] no-underline hover:bg-[color:var(--neutral-50)]"
                >
                  다른 너트 둘러보기
                </Link>
              </div>
            </div>
          )}

          {/* 진행 현황 + 이슈 + 내 기여도 */}
          {(isMember || isHost) && (
            <Suspense fallback={<div className="h-32 bg-black/5 animate-pulse mb-6" />}>
              <GroupStatusPanel groupId={id} userId={user?.id ?? ""} />
            </Suspense>
          )}

          {(isMember || isHost) && (
            <div className="mb-6">
              <GroupSearch groupId={id} />
            </div>
          )}

          <Suspense fallback={null}>
            <GroupAnnouncements groupId={id} />
          </Suspense>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
            <div className="lg:col-span-2 space-y-8">
              <DailyDigest groupId={id} />

              <Suspense fallback={<div className="p-12 bg-black/5 animate-pulse" />}>
                <GroupUpcomingSection id={id} colors={colors} isHost={isHost} isMember={isMember} userId={user?.id ?? ""} />
              </Suspense>

              <Suspense fallback={<div className="p-12 bg-black/5 animate-pulse" />}>
                <ActivitySection id={id} userId={user?.id ?? ""} isMember={isMember} isHost={isHost} />
              </Suspense>
            </div>

            <div className="space-y-6">
              {(isMember || isHost) && (
                <GroupGrowthWidget groupId={id} />
              )}
              <Suspense fallback={<div className="h-64 bg-black/5 animate-pulse" />}>
                <GroupSidebarSections id={id} colors={colors} isHost={isHost} isMember={isMember} group={groupData} userId={user?.id ?? ""} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      {/* Related Groups Recommendation */}
      <RelatedGroups groupId={id} category={group.category} />

      {/* 📄 자유 페이지 — 노션 스타일 */}
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 pb-6">
        <div className="mb-2 flex items-center gap-2">
          <FileText size={14} className="text-nu-pink" />
          <h2 className="font-head text-[16px] font-extrabold text-nu-ink">페이지</h2>
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
            그룹 멤버 누구나 추가·편집·삭제 가능
          </span>
        </div>
        <SpacePages
          ownerType="nut"
          ownerId={id}
          ownerName={group.name}
          currentUserId={user?.id}
        />
      </div>

      {/* 🧪 Thread Beta — Module Lattice 실험 영역 */}
      {user?.id && (
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 pb-8">
          <ThreadBetaSection
            targetType="nut"
            targetId={id}
            currentUserId={user.id}
            canManage={isHost || isManager}
          />
        </div>
      )}
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

// Dedupe: HeroQuickStats + GroupStatsSection both need member/meeting counts.
// React's `cache` makes the request memoized for the lifetime of the request.
const getGroupCounts = cache(async (id: string) => {
  const supabase = await createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: members }, { count: totalMeetings }, { data: groupMeta }, { count: recentActivityCount }] = await Promise.all([
    supabase.from("group_members").select("user_id, status").eq("group_id", id).in("status", ["active", "pending", "waitlist"]),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("group_id", id),
    supabase.from("groups").select("created_at").eq("id", id).single(),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("group_id", id).gte("scheduled_at", sevenDaysAgo),
  ]);
  const activeCount = members?.filter((m: any) => m.status === "active").length || 0;
  const pendingCount = (members?.length || 0) - activeCount;
  return {
    activeCount,
    pendingCount,
    totalMeetings: totalMeetings ?? 0,
    createdAt: groupMeta?.created_at ?? null,
    recentActivityCount: recentActivityCount ?? 0,
  };
});

async function HeroQuickStats({ id }: { id: string }) {
  const { activeCount, totalMeetings } = await getGroupCounts(id);
  return (
    <>
      <span className="flex items-center gap-1.5 text-nu-muted">
        <Users size={12} /> <span className="text-nu-ink font-bold">{activeCount}</span> 와셔
      </span>
      <span className="flex items-center gap-1.5 text-nu-muted">
        <BookOpen size={12} /> <span className="text-nu-ink font-bold">{totalMeetings}</span> 미팅
      </span>
    </>
  );
}

async function GroupStatsSection({ id, colors }: { id: string; colors: any }) {
  try {
  // Single source of truth: getGroupCounts is React-cached per request,
  // so HeroQuickStats and this section share the underlying queries.
  const { activeCount, pendingCount, totalMeetings, createdAt, recentActivityCount } = await getGroupCounts(id);

  const createdDaysAgo = createdAt
    ? Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isRecentlyActive = recentActivityCount > 0;

  const stats = [
    { icon: <Users size={18} />, label: "와셔", value: activeCount, sub: pendingCount > 0 ? `+${pendingCount} 대기` : null },
    { icon: <BookOpen size={18} />, label: "총 미팅", value: totalMeetings, sub: null },
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
    (async () => {
      // Try the rich shape (post-migration 129). Fall back to the legacy column
      // set if ai_result/next_topics columns don't exist yet.
      const now = new Date().toISOString();
      const rich = await supabase
        .from("meetings")
        .select("id, title, scheduled_at, summary, next_topic, next_topics, ai_result, google_doc_url, status")
        .eq("group_id", id)
        .or(`status.eq.completed,scheduled_at.lt.${now}`)
        .order("scheduled_at", { ascending: false })
        .limit(10);
      if (!rich.error) return rich;
      return supabase
        .from("meetings")
        .select("id, title, scheduled_at, summary, next_topic, status, google_doc_url")
        .eq("group_id", id)
        .or(`status.eq.completed,scheduled_at.lt.${now}`)
        .order("scheduled_at", { ascending: false })
        .limit(10);
    })(),
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
              // KST 기준 일/월 — 서버(UTC) 환경에서도 올바른 한국 날짜 표시
              const kstDay = new Intl.DateTimeFormat("ko-KR", { day: "numeric", timeZone: "Asia/Seoul" }).format(date).replace(/\D/g, "");
              const kstMonth = new Intl.DateTimeFormat("ko-KR", { month: "short", timeZone: "Asia/Seoul" }).format(date);
              return (
                <div key={`${item.itemType}-${item.id}`} className="bg-nu-white border-[2px] border-nu-ink/[0.08] hover:border-nu-pink/40 transition-all group">
                  <Link href={isEvent ? `/groups/${id}/events/${item.id}` : `/groups/${id}/meetings/${item.id}`} className="p-5 flex items-center gap-4 no-underline">
                    <div className={`w-14 h-14 flex flex-col items-center justify-center shrink-0 ${isEvent ? "bg-nu-pink/10" : "bg-nu-blue/10"}`}>
                      <span className={`font-head text-lg font-extrabold leading-none ${isEvent ? "text-nu-pink" : "text-nu-blue"}`}>
                        {kstDay}
                      </span>
                      <span className={`font-mono-nu text-[11px] uppercase ${isEvent ? "text-nu-pink/70" : "text-nu-blue/70"}`}>
                        {kstMonth}
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

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
            <BookOpen size={18} className="text-nu-pink" /> 회의록 아카이브
          </h2>
        </div>
        <MeetingArchiveTimeline
          meetings={(pastMeetings as any[]) || []}
          variant="group"
          baseHref={`/groups/${id}/meetings`}
        />
      </section>
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

  const hasDrive = !!group.google_drive_url;
  const hasWorkspaceLinks = hasDrive;

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
          <MessageCircle size={16} className="text-nu-pink" /> 커뮤니케이션 & 자료
        </h2>

        {/* Prominent workspace links */}
        {hasWorkspaceLinks && (
          <div className="flex flex-col gap-2 mb-4">
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

        <WorkspaceLinks workspaceType="crew" workspaceId={id} canEdit={isHost} driveUrl={group.google_drive_url} />
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
            href={`/groups/${id}/members`}
            className="block mt-2 py-2.5 text-center font-mono-nu text-[13px] font-bold uppercase tracking-widest text-nu-muted hover:text-nu-ink border-[2px] border-dashed border-nu-ink/10 hover:border-nu-ink/30 transition-all no-underline"
          >
            전체 멤버 보기 ({totalMembers}명) <ChevronRight size={12} className="inline" />
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
