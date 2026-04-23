import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Settings, Calendar, UserPlus, Clock, CheckCircle2, AlertCircle, TrendingUp, Users, Zap } from "lucide-react";
import { TabsInner } from "./tabs-inner";
import { ProjectStatusPanel } from "@/components/projects/project-status-panel";
import { RoleSlotsDisplay } from "@/components/projects/role-slots-editor";
import { DuplicateDescriptionHint } from "@/components/projects/duplicate-description-hint";
import { DriveR2MigrationBanner } from "@/components/shared/drive-r2-migration-banner";

// 사용자별 상태가 많아 force-dynamic — 정적 캐시 불가
// 하지만 fetch 기본 no-store 로 overhead 있으므로 dynamic 만 명시
export const dynamic = "force-dynamic";
import { PageHero } from "@/components/shared/page-hero";
import { SquadRecommender } from "@/components/projects/squad-recommender";
import { MilestoneSettlement } from "@/components/projects/milestone-settlement";
import { CancelApplicationButton } from "@/components/projects/cancel-application-button";
import { CloseProjectModal } from "@/components/project-closure/close-project-modal";
import { ProjectClosureBanner } from "@/components/project-closure/project-closure-banner";
import { VentureStageBadge } from "@/components/venture/venture-stage-badge";
import { ThreadBetaSection } from "@/components/threads/thread-beta-section";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: project, error } = await supabase.from("projects").select("title, description").eq("id", id).single();
    if (error || !project) {
      return { title: "볼트 — nutunion", description: "nutunion 볼트" };
    }
    const description = (project.description || "nutunion 볼트 · Protocol Collective").slice(0, 160);
    const ogUrl = `/api/og/project/${id}`;
    return {
      title: `${project.title} — nutunion`,
      description,
      openGraph: {
        title: project.title,
        description,
        images: [{ url: ogUrl, width: 1200, height: 630 }],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: project.title,
        description,
        images: [ogUrl],
      },
    };
  } catch {
    return { title: "볼트 — nutunion", description: "nutunion 볼트" };
  }
}

const catColors: Record<string, string> = {
  space: "bg-nu-blue",
  culture: "bg-nu-amber",
  platform: "bg-nu-ink",
  vibe: "bg-nu-pink",
};

const statusConfig: Record<string, { bg: string; label: string; icon: "clock" | "check" | "pencil" | "archive" }> = {
  draft:     { bg: "bg-nu-gray text-white",    label: "준비중", icon: "pencil" },
  active:    { bg: "bg-green-600 text-white",  label: "진행중", icon: "clock" },
  idle:      { bg: "bg-nu-amber text-white",   label: "대기중", icon: "clock" },
  completed: { bg: "bg-nu-blue text-white",   label: "완료",   icon: "check" },
  archived:  { bg: "bg-nu-muted text-white",   label: "보관",   icon: "archive" },
};

const boltTypeLabels: Record<string, { label: string; color: string }> = {
  hex:      { label: "Hex",     color: "text-nu-muted bg-nu-ink/5 border-nu-ink/15" },
  anchor:   { label: "Anchor", color: "text-blue-700 bg-blue-50 border-blue-200" },
  carriage: { label: "Carriage", color: "text-amber-700 bg-amber-50 border-amber-200" },
  eye:      { label: "Eye",    color: "text-purple-700 bg-purple-50 border-purple-200" },
  wing:     { label: "Wing",   color: "text-sky-700 bg-sky-50 border-sky-200" },
  torque:   { label: "Torque", color: "text-teal-700 bg-teal-50 border-teal-300" },
};

function formatDateClean(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric" });
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // 비로그인 허용 — SEO/첫인상 위해 읽기 모드 항상 렌더
  const { data: { user } } = await supabase.auth.getUser();

  const richCols = "id, type, parent_bolt_id, title, description, status, category, image_url, start_date, end_date, created_at, created_by, venture_mode, venture_stage, recruiting, needed_roles, total_budget, budget_currency, reward_total, reward_currency, closed_at, closed_by, closure_summary, closure_highlights, closure_model, finance_snapshot, rewards_finalized_at, google_drive_folder_id, google_drive_url, role_slots, creator:profiles!projects_created_by_fkey(id, nickname, avatar_url)";
  // safeCols: type/parent_bolt_id 가 아직 없는 환경(migration 084 미실행) 대비 — 최소 컬럼
  const safeCols = "id, title, description, status, category, image_url, start_date, end_date, created_at, created_by, creator:profiles!projects_created_by_fkey(id, nickname, avatar_url)";

  const [projectRich, profileRes, applicationRes, milestoneCountRes, memberCountRes, isMemberRes, pendingAppsRes] = await Promise.all([
    supabase.from("projects").select(richCols).eq("id", id).maybeSingle(),
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : Promise.resolve({ data: null }),
    user ? supabase.from("project_applications").select("status").eq("project_id", id).eq("applicant_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("project_milestones").select("id, status").eq("project_id", id),
    supabase.from("project_members").select("id", { count: "exact", head: true }).eq("project_id", id),
    user ? supabase.from("project_members").select("id").eq("project_id", id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("project_applications").select("id", { count: "exact", head: true }).eq("project_id", id).eq("status", "pending") : Promise.resolve({ count: 0 }),
  ]);

  let project: any = projectRich.data;
  // migration 109 미적용이면 column 부재 → silent 시도
  let hasDevPlan = false;
  try {
    const devRes = await supabase.from("projects").select("dev_plan").eq("id", id).maybeSingle();
    hasDevPlan = !!(devRes.data as any)?.dev_plan;
  } catch {
    hasDevPlan = false;
  }
  if (projectRich.error || !project) {
    // 일부 컬럼이 없는 스키마에서도 동작하도록 최소 컬럼 fallback
    const safeRes = await supabase.from("projects").select(safeCols).eq("id", id).maybeSingle();
    if (safeRes.error || !safeRes.data) {
      console.error("[ProjectDetail] load failed", projectRich.error || safeRes.error);
      notFound();
    }
    project = safeRes.data;
  }

  const profile = profileRes.data;
  const application = applicationRes.data;
  const isMember = !!isMemberRes.data;

  const isAdmin = profile?.role === "admin";
  const applicationStatus = application?.status as "pending" | "approved" | "rejected" | "withdrawn" | null;

  // Milestone quick stats for sidebar
  const allMilestones = milestoneCountRes.data || [];
  const totalMilestones = allMilestones.length;
  const completedMilestones = allMilestones.filter((m: any) => m.status === "completed").length;
  const milestoneProgressPct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  const memberCount = memberCountRes.count || 0;
  const pendingAppsCount = (pendingAppsRes as { count?: number }).count || 0;

  // Genesis AI 로 생성된 공간인지 확인
  let isGenesis = false;
  try {
    const { data: gp } = await supabase
      .from("genesis_plans")
      .select("id")
      .eq("target_kind", "project")
      .eq("target_id", id)
      .limit(1)
      .maybeSingle();
    isGenesis = !!gp;
  } catch { /* migration 104 미적용 */ }

  const statusCfg = statusConfig[project.status] || statusConfig.draft;

  // 빌드 Hero Stats
  const heroStats = [];
  if (project.start_date) {
    let dateStr = formatDateClean(project.start_date);
    if (project.end_date) dateStr += ` - ${formatDateClean(project.end_date)}`;
    heroStats.push({ label: "일정", value: dateStr, icon: <Calendar size={14} /> });
  }
  if (project.total_budget !== null && project.total_budget !== undefined) {
    const currency = project.budget_currency || "KRW";
    // Format numbers like 30,000,000
    const formattedBudget = Number(project.total_budget).toLocaleString('ko-KR');
    heroStats.push({ label: "프로젝트 비용", value: `${formattedBudget} ${currency}`, icon: <TrendingUp size={14} /> });
  }
  heroStats.push({ label: "참여 인원", value: `${memberCount}명`, icon: <Users size={14} /> });

  return (
    <>
      <PageHero
        compact
        category={project.category}
        title={project.title}
        description={project.description || ""}
        stats={heroStats}
        cover={
          ["space","culture","platform","vibe"].includes(project.category)
            ? { seed: project.id, category: project.category as any, opacity: 0.22 }
            : undefined
        }
      />

      {/* Detail Meta & Actions — constrained width */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-10 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-0 border-b border-nu-ink/5 pb-6">
          <div className="flex flex-wrap items-center gap-3 font-mono-nu text-[13px]">
            {/* 볼트 유형 배지 */}
            {project.type && boltTypeLabels[project.type] && (
              <span className={`font-mono-nu text-[11px] font-black uppercase tracking-[0.15em] px-3 py-1.5 border-[2px] flex items-center gap-1.5 ${boltTypeLabels[project.type].color}`}>
                <Zap size={11} /> {boltTypeLabels[project.type].label}
              </span>
            )}
            {/* 상태 배지 */}
            <span className={`font-mono-nu text-[13px] font-black uppercase tracking-[0.12em] px-4 py-2 inline-flex items-center gap-2 ${statusCfg.bg}`}>
              {statusCfg.icon === "clock" && <Clock size={14} />}
              {statusCfg.icon === "check" && <CheckCircle2 size={14} />}
              {statusCfg.icon === "pencil" && <AlertCircle size={14} />}
              {statusCfg.icon === "archive" && <AlertCircle size={14} />}
              {statusCfg.label}
            </span>
            <VentureStageBadge
              ventureMode={!!project.venture_mode}
              ventureStage={project.venture_stage ?? null}
              completed={project.status === "completed"}
              size="md"
            />
            <span className="text-nu-muted">진행자: <span className="text-nu-ink font-bold">{(Array.isArray(project.creator) ? project.creator[0]?.nickname : (project.creator as { nickname?: string } | null)?.nickname) || "—"}</span></span>
            {isGenesis && (
              <Link
                href={`/projects/${id}/genesis`}
                className="inline-flex items-center gap-1 font-mono-nu text-[11px] font-bold uppercase tracking-widest px-2 py-1 border-[2px] border-nu-ink bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink hover:border-nu-pink"
                title="Genesis AI 로 생성된 공간"
              >
                ✨ Genesis AI
              </Link>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {!isAdmin && applicationStatus === "pending" && (
              <div className="flex items-center gap-2">
                <span className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-5 py-2.5 bg-amber-500 text-white inline-flex items-center gap-2">
                  <Clock size={14} /> 승인 대기 중
                </span>
                {user && <CancelApplicationButton projectId={id} userId={user.id} />}
              </div>
            )}
            {/* 통일 스타일: 모든 버튼 border-[2.5px] h-10 px-4 text-[11px] uppercase tracking-widest */}
            {!isAdmin && applicationStatus === "approved" && (
              <span className="h-10 px-4 border-[2.5px] border-green-700 bg-green-600 text-white font-mono-nu text-[11px] font-bold uppercase tracking-widest inline-flex items-center gap-2">
                <CheckCircle2 size={14} /> 참여중
              </span>
            )}
            {!isAdmin && applicationStatus === "rejected" && (
              <Link href={`/projects/${id}/apply`} className="h-10 px-4 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] font-bold uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-2 transition-colors">
                다시 지원하기
              </Link>
            )}
            {!isAdmin && !applicationStatus && project.status === "active" && !isMember && (
              <Link
                href={user ? `/projects/${id}/apply` : `/login?redirectTo=/projects/${id}/apply`}
                className="h-10 px-4 border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper font-mono-nu text-[11px] font-black uppercase tracking-widest no-underline hover:bg-nu-ink inline-flex items-center gap-2 transition-colors"
              >
                <UserPlus size={14} /> {user ? "볼트 참여하기" : "로그인하고 참여"}
              </Link>
            )}
            <Link href={`/projects/${id}/tap`} className="h-10 px-4 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-2 transition-colors">
              📚 Tap
            </Link>
            {(isMember || isAdmin) && (
              <Link href={`/projects/${id}?tab=meetings`} className="h-10 px-4 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-2 transition-colors">
                📝 회의록
              </Link>
            )}
            {(isMember || isAdmin) && (
              <Link href={`/projects/${id}/venture`} className="h-10 px-4 border-[2.5px] border-nu-pink bg-nu-paper text-nu-pink font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-nu-pink hover:text-nu-paper inline-flex items-center gap-2 transition-colors">
                🚀 Venture
              </Link>
            )}
            {isAdmin && (
              <Link
                href={`/projects/${id}/applications`}
                className="h-10 px-4 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-2 transition-colors relative"
              >
                <UserPlus size={14} /> 지원서
                {pendingAppsCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-nu-pink text-nu-paper font-mono-nu text-[9px] font-bold rounded-full">
                    {pendingAppsCount}
                  </span>
                )}
              </Link>
            )}
            {isAdmin && project.status !== "completed" && (
              <CloseProjectModal projectId={id} projectTitle={project.title} />
            )}
            {hasDevPlan && (
              <Link href={`/projects/${id}/dev-plan`} className="h-10 px-4 border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-nu-ink inline-flex items-center gap-2 transition-colors">
                🚀 개발 로드맵 보기
              </Link>
            )}
            {isAdmin && (
              <Link href={`/projects/${id}/settings`} className="h-10 px-4 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-2 transition-colors">
                <Settings size={14} /> 볼트 설정
              </Link>
            )}
          </div>
        </div>
      </div>

      {project.status === "completed" && project.closure_summary && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
          <ProjectClosureBanner
            project={project}
            canCancel={!!user && (isAdmin || project.closed_by === user.id)}
          />
        </div>
      )}

      {/* 복붙 감지 — 호스트/admin에게만 수정 유도 (첫 100자 해시로 다른 볼트와 충돌 체크) */}
      {user && (isAdmin || project.created_by === user.id) && project.description && (
        <DuplicateDescriptionHint projectId={id} description={project.description} />
      )}

      {/* Drive → R2 migration nudge (admin/host only) */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <Suspense fallback={null}>
          <DriveR2MigrationBanner
            scope="project"
            id={id}
            driveFolderId={(project as any).google_drive_folder_id}
            hostId={project.created_by}
          />
        </Suspense>
      </div>

      {/* 모든 마일스톤 완료인데 status 는 active — 마감 유도 배너 */}
      {project.status === "active" && totalMilestones > 0 && completedMilestones === totalMilestones && (isAdmin || (user && project.created_by === user.id)) && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
          <div className="border-[2.5px] border-green-600 bg-gradient-to-r from-green-50 to-nu-amber/10 p-4 flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-green-700 font-bold">🏁 모든 마일스톤 완료</div>
              <p className="text-[12px] text-nu-ink mt-0.5">
                {totalMilestones}/{totalMilestones} 마일스톤이 완료됐습니다. 볼트를 마감하고 <strong>탭(Tap) 아카이브</strong>에 승격해 팀의 성과를 공개하세요.
              </p>
            </div>
            {isAdmin && <CloseProjectModal projectId={id} projectTitle={project.title} />}
          </div>
        </div>
      )}

      {!user ? (
        // 🌐 비로그인 읽기 모드 — SEO 친화적 공개 뷰 (Reader Mode)
        <div className="reader-shell max-w-[720px] mx-auto px-4 md:px-6 pb-24 pt-8 space-y-8">
          {/* 역할 슬롯 */}
          {project.recruiting && Array.isArray(project.role_slots) && project.role_slots.length > 0 && (
            <RoleSlotsDisplay slots={project.role_slots} />
          )}

          {/* 공개 마감 회고 */}
          {project.status === "completed" && project.closure_summary && (
            <section className="border-[2.5px] border-nu-ink bg-nu-paper p-5">
              <h2 className="font-head text-lg font-extrabold text-nu-ink mb-3">🏁 볼트 회고</h2>
              <p className="text-[13px] text-nu-ink leading-relaxed whitespace-pre-wrap">{project.closure_summary}</p>
            </section>
          )}

          <div className="border-l-[3px] border-nu-pink bg-nu-pink/5 p-4">
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink font-bold mb-1">Join nutunion</p>
            <p className="text-[13px] text-nu-ink leading-relaxed">
              마일스톤, 활동 피드, 참여자 정보는 <Link href={`/login?redirectTo=/projects/${id}`} className="font-bold text-nu-pink underline">로그인</Link> 후 확인할 수 있습니다.
            </p>
          </div>
        </div>
      ) : (!isMember && !isAdmin) ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4 pt-10 pb-20">
          <div className="w-16 h-16 bg-nu-ink/[0.03] rounded-full flex items-center justify-center mb-6">
            <span className="text-3xl opacity-20">🔒</span>
          </div>
          <h2 className="font-head text-2xl font-extrabold text-nu-ink mb-2 uppercase tracking-widest">Access Restricted</h2>
          <p className="text-nu-muted text-sm mb-6 max-w-sm leading-relaxed">
            해당 볼트는 승인된 팀원만 내부 문서를 열람하고 활동할 수 있습니다. 위 <strong>[볼트 참여하기]</strong> 버튼을 눌러주세요.
          </p>
          {project.recruiting && Array.isArray(project.role_slots) && project.role_slots.length > 0 && (
            <div className="max-w-xl w-full">
              <RoleSlotsDisplay slots={project.role_slots} />
            </div>
          )}
        </div>
      ) : (
        <div className="reader-shell mx-auto px-4 md:px-8 pb-24">
          <div className="max-w-6xl mx-auto pt-4">
            <Suspense fallback={<div className="h-32 bg-black/5 animate-pulse mb-6" />}>
              <ProjectStatusPanel projectId={id} userId={user.id} />
            </Suspense>
          </div>

          {project.recruiting && Array.isArray(project.role_slots) && project.role_slots.length > 0 && (
            <div className="max-w-6xl mx-auto mb-6">
              <RoleSlotsDisplay slots={project.role_slots} />
            </div>
          )}

          <Suspense fallback={
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3 space-y-4">
                <div className="h-64 bg-nu-ink/5 animate-pulse" />
              </div>
              <div className="h-64 bg-nu-ink/5 animate-pulse" />
            </div>
          }>
            <ProjectTabsWrapper id={id} userId={user.id} isAdmin={isAdmin} project={project} />
          </Suspense>

          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
            <SquadRecommender projectId={id} projectTitle={project.title} />
            <MilestoneSettlement projectId={id} userId={user.id} />
          </div>

        </div>
      )}
    </>
  );
}

async function ProjectTabsWrapper({ id, userId, isAdmin, project }: any) {
  const supabase = await createClient();

  // 모든 쿼리를 병렬 — 이전에는 sequential 로 4번 round-trip
  const [msRichRes, memRes, updRes, evtRes] = await Promise.all([
    supabase
      .from("project_milestones")
      .select("*, tasks:project_tasks(*, assignee:profiles!project_tasks_assigned_to_fkey(id, nickname, avatar_url))")
      .eq("project_id", id)
      .order("sort_order"),
    supabase
      .from("project_members")
      .select("*, profile:profiles!project_members_user_id_fkey(id, nickname, avatar_url, email), crew:groups!project_members_crew_id_fkey(id, name, category, image_url)")
      .eq("project_id", id)
      .order("joined_at"),
    supabase
      .from("project_updates")
      .select("*, author:profiles!project_updates_author_id_fkey(id, nickname, avatar_url)")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("events")
      .select("*, group:groups(name)")
      .eq("project_id", id)
      .order("start_at")
      .limit(10),
  ]);

  // 조인 실패 fallback 은 개별 엔티티 단위로 — 병렬 실행 유지
  let milestones = msRichRes.data;
  if (msRichRes.error || !milestones) {
    const msBasic = await supabase.from("project_milestones").select("*").eq("project_id", id).order("sort_order");
    milestones = (msBasic.data ?? []).map((m: any) => ({ ...m, tasks: [] }));
  }

  let members = memRes.data;
  if (memRes.error || !members) {
    const memBasic = await supabase.from("project_members").select("*").eq("project_id", id).order("joined_at");
    members = memBasic.data ?? [];
  }

  let updates = updRes.data;
  if (updRes.error || !updates) {
    const updBasic = await supabase.from("project_updates").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(50);
    updates = updBasic.data ?? [];
  }

  const events = evtRes.data ?? [];

  const membersList = members || [];
  const directUserMembers = membersList.filter((m: any) => m.user_id && m.profile);
  const crewMembers = membersList.filter((m: any) => m.crew_id && m.crew);
  const isMember  = membersList.some((m: any) => m.user_id === userId);
  const isLead    = membersList.some((m: any) => m.user_id === userId && m.role === "lead");
  const isManager = membersList.some((m: any) => m.user_id === userId && (m.role === "manager" || m.role === "lead"));
  const canEdit   = isLead || isAdmin;

  // ── 너트(crew) 초대 시 너트 멤버 전원을 와셔 목록에 포함 ──
  // crewMembers 에서 crew_id 목록 수집 → group_members 조회 → userMembers 에 병합
  let nutMembersAsWashers: any[] = [];
  const crewIds = crewMembers.map((m: any) => m.crew_id).filter(Boolean);
  if (crewIds.length > 0) {
    try {
      const { data: groupMembersData } = await supabase
        .from("group_members")
        .select("user_id, group_id, role, profiles!group_members_user_id_fkey(id, nickname, avatar_url, email)")
        .in("group_id", crewIds);
      if (groupMembersData && groupMembersData.length > 0) {
        const existingUserIds = new Set(directUserMembers.map((m: any) => m.user_id));
        nutMembersAsWashers = (groupMembersData as any[])
          .filter((gm: any) => gm.user_id && gm.profiles && !existingUserIds.has(gm.user_id))
          .map((gm: any) => {
            const crewInfo = crewMembers.find((cm: any) => cm.crew_id === gm.group_id);
            return {
              id: `nut-member-${gm.user_id}-${gm.group_id}`,
              project_id: id,
              user_id: gm.user_id,
              role: "member",
              profile: gm.profiles,
              crew_id: gm.group_id,
              crew: crewInfo?.crew || null,
              _from_nut: true, // 너트를 통해 포함된 멤버 표시
            };
          });
      }
    } catch { /* group_members 조회 실패 시 무시 */ }
  }

  const userMembers = [...directUserMembers, ...nutMembersAsWashers];

  const allTasks = (milestones || []).flatMap((m: any) => m.tasks || []);
  const taskStats = {
    todo: allTasks.filter((t: any) => t.status === "todo").length,
    in_progress: allTasks.filter((t: any) => t.status === "in_progress").length,
    done: allTasks.filter((t: any) => t.status === "done").length,
  };
  const totalTasks = taskStats.todo + taskStats.in_progress + taskStats.done;
  const progressPct = totalTasks > 0 ? Math.round((taskStats.done / totalTasks) * 100) : 0;
  
  const myTasks = allTasks.filter((t: any) => t.assigned_to === userId && t.status !== "done");

  return (
    <>
      <TabsInner
        projectId={id}
        milestonesData={JSON.stringify(milestones)}
        updatesData={JSON.stringify(updates)}
        eventsData={JSON.stringify(events)}
        userMembersData={JSON.stringify(userMembers)}
        crewMembersData={JSON.stringify(crewMembers)}
        projectData={JSON.stringify(project)}
        myTasksData={JSON.stringify(myTasks)}
        userId={userId}
        canEdit={canEdit}
        isMember={isMember}
        taskStats={taskStats}
        totalTasks={totalTasks}
        progressPct={progressPct}
      />
      {/* 🧪 Thread Beta — Module Lattice 실험 영역 */}
      {userId && (
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 pb-8">
          <ThreadBetaSection
            targetType="bolt"
            targetId={id}
            currentUserId={userId}
            canManage={isLead}
          />
        </div>
      )}
    </>
  );
}

