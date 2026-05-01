import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Plus, Zap } from "lucide-react";
import { getGrade, GRADE_CONFIG } from "@/lib/constants";
import { OnboardingCoach } from "@/components/dashboard/onboarding-coach";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { MorningBriefing } from "@/components/dashboard/morning-briefing";
import { DashboardViewSwitcher } from "@/components/dashboard/dashboard-view-switcher";
import { fetchMindMapData } from "@/lib/dashboard/mindmap-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  type Profile = {
    id: string; nickname?: string; avatar_url?: string | null;
    grade?: string; role?: string; skill_tags?: string[];
    specialty?: string | null; onboarded_at?: string | null;
    points?: number; birth_date?: string | null;
  };
  type Membership = { group_id: string; role: string; groups?: { id: string; name: string; is_active?: boolean } | null };
  type ProjectMembership = { project_id: string; role?: string; projects?: { id: string; title: string; status: string } | null };

  let profile: Profile | null = null;
  let memberships: Membership[] | null = null;
  let projectMemberships: ProjectMembership[] | null = null;
  let pendingCount = 0;

  try {
    const [profileRes, { data: membershipsData }, { data: projectMembershipsData }] = await Promise.all([
      supabase.from("profiles")
        .select("id, nickname, avatar_url, grade, role, skill_tags, specialty, onboarded_at, points, birth_date")
        .eq("id", user.id).single(),
      supabase.from("group_members")
        .select("group_id, role, groups(id, name, is_active)")
        .eq("user_id", user.id).eq("status", "active").eq("groups.is_active", true),
      supabase.from("project_members")
        .select("project_id, role, projects(id, title, status)")
        .eq("user_id", user.id)
        .in("projects.status", ["active", "draft"]),
    ]);

    let profileData: any = profileRes.data;
    if (profileRes.error && /birth_date/.test(profileRes.error.message || "")) {
      const { data: fb } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url, grade, role, skill_tags, specialty, onboarded_at, points")
        .eq("id", user.id).single();
      profileData = fb;
    }

    profile = profileData as Profile | null;
    memberships = membershipsData as Membership[] | null;
    projectMemberships = projectMembershipsData as ProjectMembership[] | null;

    // 승인 대기 (내가 호스트인 너트)
    const hostGroups = (memberships || []).filter((m) => m.role === "host").map((m) => m.group_id);
    if (hostGroups.length > 0) {
      const { count } = await supabase.from("group_members")
        .select("id", { count: "exact", head: true })
        .in("group_id", hostGroups)
        .eq("status", "pending");
      pendingCount = count || 0;
    }
  } catch (err) {
    console.error("Dashboard data fetch error:", err);
  }

  // 마인드맵 데이터 — 뷰 전환 시 클라이언트에서 사용
  const mindmapData = await fetchMindMapData(supabase, user.id).catch(() => ({
    nuts: [], bolts: [], schedule: [], issues: [], washers: [], topics: [],
  }));

  const nickname = profile?.nickname?.trim() || user?.email?.split("@")[0] || "사용자";
  const gradeInfo = profile ? getGrade(profile) : GRADE_CONFIG.bronze;
  const GradeIcon = gradeInfo.icon;
  const groupCount = memberships?.length || 0;
  const projectCount = projectMemberships?.length || 0;
  const nutPoints = profile?.points || 0;
  const today = new Date().toLocaleDateString("ko", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">

      {/* ── TOP: 인사 헤더 ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b-[2px] border-nu-ink/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 border ${gradeInfo.cls}`}>
              <GradeIcon size={9} /> {gradeInfo.label}
            </span>
            <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-ink text-white">
              <Zap size={9} className="text-nu-yellow" /> {nutPoints} NUT
            </span>
          </div>
          <h1 className="font-head text-xl md:text-2xl font-extrabold text-nu-ink tracking-tight">
            {nickname}님의 공간
          </h1>
          <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mt-0.5">
            {today}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link href="/groups/create"
            className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all no-underline flex items-center gap-1">
            <Plus size={10} /> 너트
          </Link>
          <Link href="/projects/create"
            className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-all no-underline flex items-center gap-1">
            <Plus size={10} /> 볼트
          </Link>
        </div>
      </div>

      {/* ── AI Morning Briefing ─────────────────────────────── */}
      {profile?.onboarded_at && (
        <div className="mb-5">
          <MorningBriefing />
        </div>
      )}

      {/* ── 온보딩 ──────────────────────────────────────────── */}
      {!profile?.onboarded_at && (
        <div className="mb-5">
          <OnboardingCoach
            userId={user.id}
            nickname={nickname}
            currentSpecialty={profile?.specialty || null}
            onboardedAt={profile?.onboarded_at || null}
            groupCount={groupCount}
            projectCount={projectCount}
          />
        </div>
      )}

      {/* ── 뷰 전환 (리스트 ⇄ 마인드맵) ───────────────────── */}
      <DashboardViewSwitcher nickname={nickname} mindmapData={mindmapData} userId={user.id}>
        <Suspense fallback={<div className="h-64 bg-nu-cream/30 animate-pulse" />}>
          <DashboardTabs
            userId={user.id}
            nickname={nickname}
            gradeLabel={gradeInfo.label}
            nutPoints={nutPoints}
            groupCount={groupCount}
            projectCount={projectCount}
            pendingCount={pendingCount}
          />
        </Suspense>
      </DashboardViewSwitcher>
    </div>
  );
}
