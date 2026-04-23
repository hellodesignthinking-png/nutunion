"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Target,
  Activity,
  Layers,
  Users,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  BookOpen,
  FileText,
  DollarSign,
  Wallet,
  ChevronRight,
  CheckSquare,
  Save,
  Zap,
  FolderOpen,
  TrendingUp,
  Loader2,
  Columns3,
  BarChart3,
  Puzzle,
} from "lucide-react";
import { MilestoneList } from "@/components/projects/milestone-list";
import { ProjectActivityFeed } from "@/components/projects/project-activity-feed";
import { ProjectRoadmap } from "@/components/projects/project-roadmap";
import { ProjectResourceHub } from "@/components/projects/project-resource-hub";
import { ProjectFinanceDashboard } from "@/components/projects/project-finance-dashboard";
import { ProjectFinanceSnapshot, type FinanceSnapshot } from "@/components/projects/project-finance-snapshot";
import { ProjectBurndownChart } from "@/components/projects/project-burndown-chart";
import { ProjectMeetings } from "@/components/projects/project-meetings";
import { ProjectRadarChart, ProjectActivityHeatmap } from "@/components/projects/project-vitals";
import { ProjectKanbanBoard } from "@/components/projects/project-kanban-board";
import { ProjectInsights } from "@/components/projects/project-insights";
import { EndorsementPanel } from "@/components/shared/endorsement-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnchorDashboard } from "@/components/bolt/anchor/anchor-dashboard";
import { CarriageDashboard } from "@/components/bolt/carriage/carriage-dashboard";
import { EyeDashboard } from "@/components/bolt/eye/eye-dashboard";
import { WingDashboard } from "@/components/bolt/wing/wing-dashboard";
import { TorqueView } from "@/components/bolt/torque/TorqueView";
import { BoltCalendar } from "@/components/bolt/bolt-calendar";
import { ConsultingAddonManager } from "@/components/bolt/consulting-addon-manager";

const baseTabs = [
  { key: "overview",    label: "개요",     icon: Target },
  { key: "kanban",      label: "칸반 보드", icon: Columns3 },
  { key: "milestones", label: "마일스톤",  icon: Layers },
  { key: "calendar",   label: "캘린더",   icon: Calendar },
  { key: "insights",   label: "인사이트",  icon: BarChart3 },
  { key: "meetings",   label: "회의록",   icon: FileText },
  { key: "resources",  label: "자료실",   icon: FolderOpen },
  { key: "finance",    label: "자금·보상", icon: Wallet },
  { key: "modules",    label: "모듈",     icon: Puzzle },
  { key: "activity",   label: "활동",     icon: Activity },
];

const roleLabels: Record<string, string> = {
  lead: "리드",
  member: "와셔",
  observer: "옵저버",
};

const catColors: Record<string, string> = {
  space: "bg-nu-blue",
  culture: "bg-nu-amber",
  platform: "bg-nu-ink",
  vibe: "bg-nu-pink",
};

const msStatusColors: Record<string, string> = {
  pending: "bg-nu-gray",
  in_progress: "bg-nu-yellow",
  completed: "bg-green-600",
};

export function TabsInner({
  projectId,
  milestonesData,
  updatesData,
  userMembersData,
  crewMembersData,
  eventsData,
  canEdit,
  userId,
  isMember,
  taskStats,
  progressPct,
  totalTasks,
  projectData,
  myTasksData,
}: {
  projectId: string;
  milestonesData: string;
  updatesData: string;
  userMembersData: string;
  crewMembersData: string;
  eventsData: string;
  canEdit: boolean;
  userId: string;
  isMember: boolean;
  taskStats: { todo: number; in_progress: number; done: number };
  progressPct: number;
  totalTasks: number;
  projectData?: string;
  myTasksData?: string;
}) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("overview");

  // URL ?tab=... 반영 + 해시 스크롤 (캘린더에서 클릭한 경우)
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t) setActiveTab(t);
    // 해시 스크롤은 렌더 뒤 지연 실행
    if (window.location.hash) {
      setTimeout(() => {
        const el = document.querySelector(window.location.hash);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [searchParams]);

  const milestones  = JSON.parse(milestonesData);
  const updates     = JSON.parse(updatesData);
  const userMembers = JSON.parse(userMembersData);
  const crewMembers = JSON.parse(crewMembersData);
  const events      = JSON.parse(eventsData);
  const project     = projectData ? JSON.parse(projectData) : null;
  const myTasks     = myTasksData ? JSON.parse(myTasksData) : [];

  // ── Live task stats (refreshable on client) ──
  const [liveTaskStats, setLiveTaskStats] = useState(taskStats);
  const [liveTotalTasks, setLiveTotalTasks] = useState(totalTasks);
  const [liveProgressPct, setLiveProgressPct] = useState(progressPct);

  const refreshTaskStats = useCallback(async () => {
    const supabase = createClient();
    const { data: tasks } = await supabase
      .from("project_tasks")
      .select("status")
      .eq("project_id", projectId);
    if (tasks) {
      const newStats = {
        todo: tasks.filter(t => t.status === "todo").length,
        in_progress: tasks.filter(t => t.status === "in_progress").length,
        done: tasks.filter(t => t.status === "done").length,
      };
      const newTotal = newStats.todo + newStats.in_progress + newStats.done;
      setLiveTaskStats(newStats);
      setLiveTotalTasks(newTotal);
      setLiveProgressPct(newTotal > 0 ? Math.round((newStats.done / newTotal) * 100) : 0);
    }
  }, [projectId]);

  // Build tabs with item counts
  const tabCounts: Record<string, number | null> = {
    overview: null,
    kanban: liveTotalTasks || null,
    milestones: milestones?.length || null,
    insights: null,
    meetings: events?.length || null,
    resources: null,
    finance: null,
    activity: updates?.length || null,
  };
  const tabs = baseTabs.map((t) => ({
    ...t,
    count: tabCounts[t.key] ?? null,
  }));

  // Calculate milestone progress
  const totalMilestones = milestones?.length || 0;
  const completedMilestones = milestones?.filter((m: any) => m.status === "completed")?.length || 0;
  const milestoneProgressPct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
  const isCompleted = milestoneProgressPct === 100;

  return (
    <>
      {/* ── Milestone Progress Bar ── */}
      <div className="bg-nu-paper border-b-[2px] border-nu-ink/[0.08] mb-8">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-head text-sm font-bold text-nu-ink flex items-center gap-2">
                <TrendingUp size={16} className="text-nu-pink" /> 마일스톤 진행률
              </h3>
            </div>
            <span className="font-mono-nu text-[13px] font-bold text-nu-ink">
              {completedMilestones}/{totalMilestones}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-2.5 bg-nu-cream rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    isCompleted ? "bg-green-600" : "bg-nu-pink"
                  }`}
                  style={{ width: `${milestoneProgressPct}%` }}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono-nu text-[12px] font-bold text-nu-ink">
                {milestoneProgressPct}%
              </p>
              <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">
                {isCompleted ? "완료" : "진행 중"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar — full width, scrollable on mobile */}
      <div className="max-w-6xl mx-auto flex gap-0 border-b-[2px] border-nu-ink/[0.08] mb-8 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`font-mono-nu text-[13px] uppercase tracking-widest px-5 py-3.5 border-b-[3px] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === tab.key
                ? "border-nu-pink text-nu-ink font-black bg-nu-pink/[0.04]"
                : "border-transparent text-nu-muted hover:text-nu-graphite"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={`text-[11px] font-bold px-1.5 py-0.5 ${
                activeTab === tab.key
                  ? "bg-nu-pink/15 text-nu-pink"
                  : "bg-nu-ink/5 text-nu-muted"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
        {canEdit && (
          <Link
            href={`/projects/${projectId}/settings`}
            className="font-mono-nu text-[13px] uppercase tracking-widest px-5 py-3.5 border-b-[3px] border-transparent text-nu-muted hover:text-nu-graphite no-underline ml-auto flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            설정
          </Link>
        )}
      </div>

      {/* Overview Tab — 유형별 전용 대시보드 */}
      {activeTab === "overview" && project?.type === "anchor" && (
        <div className="max-w-6xl mx-auto">
          <AnchorDashboard projectId={projectId} title={project?.title || "매장"} />
        </div>
      )}
      {activeTab === "overview" && project?.type === "carriage" && (
        <div className="max-w-6xl mx-auto">
          <CarriageDashboard projectId={projectId} title={project?.title || "플랫폼"} />
        </div>
      )}
      {activeTab === "overview" && project?.type === "eye" && (
        <div className="max-w-6xl mx-auto">
          <EyeDashboard projectId={projectId} title={project?.title || "포트폴리오"} />
        </div>
      )}
      {activeTab === "overview" && project?.type === "wing" && (
        <div className="max-w-6xl mx-auto">
          <WingDashboard
            projectId={projectId}
            title={project?.title || "캠페인"}
            startDate={project?.start_date}
            endDate={project?.end_date}
          />
        </div>
      )}

      {/* Overview Tab — Torque (컨설팅형) */}
      {activeTab === "overview" && project?.type === "torque" && (
        <div className="max-w-6xl mx-auto">
          <TorqueView
            projectId={projectId}
            projectTitle={project?.title || "컨설팅"}
            torqueMeta={null}
          />
        </div>
      )}

      {/* 모듈 탭 — 모든 볼트 유형에서 접근 가능 */}
      {activeTab === "modules" && (
        <div className="max-w-5xl mx-auto py-6">
          <ConsultingAddonManager
            projectId={projectId}
            canEdit={canEdit}
          />
        </div>
      )}

      {/* Overview Tab — Hex(기본) constrained width */}
      {activeTab === "overview" && (!project?.type || project?.type === "hex") && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">

            {/* ── Project Description ── */}
            {project?.description && (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
                <h3 className="font-head text-lg font-extrabold mb-3 flex items-center gap-2">
                  <FileText size={18} /> 볼트 소개
                </h3>
                <div className="text-sm text-nu-graphite leading-relaxed whitespace-pre-wrap">
                  {project.description}
                </div>
              </div>
            )}

            {/* ── Progress + Budget Summary (connected view) ── */}
            <div className="bg-nu-white border-[2px] border-nu-ink p-6">
              <h3 className="font-head text-lg font-extrabold mb-5 flex items-center gap-2">
                <Target size={18} /> 진행 현황 & 비용
              </h3>

              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-nu-cream/50 border border-nu-ink/5">
                  <p className="font-head text-3xl font-extrabold text-nu-ink">{liveProgressPct}%</p>
                  <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mt-1">전체 진행률</p>
                </div>
                <div className="text-center p-4 bg-nu-cream/50 border border-nu-ink/5">
                  <p className="font-head text-3xl font-extrabold text-nu-ink">{liveTotalTasks}</p>
                  <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mt-1">전체 태스크</p>
                </div>
                <div className="text-center p-4 bg-green-50 border border-green-200">
                  <p className="font-head text-3xl font-extrabold text-green-600">{liveTaskStats.done}</p>
                  <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mt-1">완료</p>
                </div>
                {project?.total_budget ? (
                  <div className="text-center p-4 bg-nu-blue/5 border border-nu-blue/20 cursor-pointer hover:bg-nu-blue/10 transition-colors" onClick={() => setActiveTab("finance")}>
                    <p className="font-head text-2xl font-extrabold text-nu-ink">
                      {parseInt(project.total_budget).toLocaleString("ko-KR")}
                    </p>
                    <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mt-1">총 예산 ({project.budget_currency || "KRW"})</p>
                  </div>
                ) : (
                  <div className="text-center p-4 bg-nu-cream/50 border border-nu-ink/5">
                    <p className="font-head text-3xl font-extrabold text-nu-amber">{liveTaskStats.in_progress}</p>
                    <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mt-1">진행 중</p>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono-nu text-[12px] text-nu-muted uppercase tracking-widest">태스크 진행률</span>
                  <span className="font-mono-nu text-[12px] font-bold">{liveTaskStats.done}/{liveTotalTasks}</span>
                </div>
                <div className="h-3 bg-nu-cream rounded-full overflow-hidden flex">
                  <div className="h-full bg-green-600 transition-all" style={{ width: `${liveTotalTasks > 0 ? (liveTaskStats.done / liveTotalTasks) * 100 : 0}%` }} />
                  <div className="h-full bg-nu-amber transition-all" style={{ width: `${liveTotalTasks > 0 ? (liveTaskStats.in_progress / liveTotalTasks) * 100 : 0}%` }} />
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-[12px] text-nu-muted"><span className="w-2 h-2 bg-green-600 rounded-full" /> 완료 {liveTaskStats.done}</span>
                  <span className="flex items-center gap-1.5 text-[12px] text-nu-muted"><span className="w-2 h-2 bg-nu-amber rounded-full" /> 진행 중 {liveTaskStats.in_progress}</span>
                  <span className="flex items-center gap-1.5 text-[12px] text-nu-muted"><span className="w-2 h-2 bg-nu-cream rounded-full border border-nu-ink/10" /> 대기 {liveTaskStats.todo}</span>
                </div>
              </div>
            </div>

            {/* ── Milestone Summary with budget per milestone ── */}
            <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-head text-lg font-extrabold flex items-center gap-2">
                  <Layers size={18} /> 마일스톤
                </h3>
                <button onClick={() => setActiveTab("milestones")} className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors flex items-center gap-1">
                  상세 보기 <ChevronRight size={12} />
                </button>
              </div>
              {milestones.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-nu-gray text-sm mb-2">아직 마일스톤이 없습니다</p>
                  {canEdit && <p className="text-[12px] text-nu-muted">마일스톤 탭에서 첫 마일스톤을 추가해보세요</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  {milestones.map((ms: any) => {
                    const tasks = ms.tasks || [];
                    const done = tasks.filter((t: any) => t.status === "done").length;
                    const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
                    const rewardPct = (ms as any).reward_percentage || 0;
                    const budgetAmount = project?.total_budget ? Math.round((parseInt(project.total_budget) * rewardPct) / 100) : 0;
                    return (
                      <div key={ms.id} className="p-4 bg-nu-cream/20 border border-nu-ink/5">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${msStatusColors[ms.status] || "bg-nu-gray"}`} />
                          <p className="text-sm font-bold flex-1 truncate">{ms.title}</p>
                          {rewardPct > 0 && (
                            <span className="font-mono-nu text-[11px] text-green-600 bg-green-50 px-2 py-0.5 border border-green-200 shrink-0">
                              {rewardPct}% · {budgetAmount.toLocaleString("ko-KR")}원
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-nu-cream rounded-full overflow-hidden">
                            <div className="h-full bg-green-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono-nu text-[12px] text-nu-muted shrink-0">{done}/{tasks.length}</span>
                          {ms.due_date && <span className="font-mono-nu text-[11px] text-nu-muted shrink-0">{new Date(ms.due_date).toLocaleDateString("ko", { month: "short", day: "numeric" })}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Project Snapshot (Archived content) */}
            {(project as any)?.snapshot_content && (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
                <h3 className="font-head text-lg font-extrabold mb-4 flex items-center gap-2">
                  <FileText size={18} className="text-nu-muted" /> 볼트 아카이브 스냅샷
                </h3>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-nu-gray leading-relaxed text-sm bg-nu-cream/10 p-4 border border-nu-ink/5">
                   {(project as any).snapshot_content}
                </div>
              </div>
            )}

            {/* Linked events */}
            {events.length > 0 && (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
                <h3 className="font-head text-lg font-extrabold mb-4 flex items-center gap-2">
                  <Calendar size={18} /> 연결된 일정
                </h3>
                <div className="space-y-3">
                  {events.map((evt: any) => (
                    <div key={evt.id} className="flex items-center gap-4 p-3 bg-nu-cream/30">
                      <div className="w-12 h-12 bg-nu-pink/10 flex flex-col items-center justify-center shrink-0">
                        <span className="font-head text-base font-extrabold text-nu-pink leading-none">{new Date(evt.start_at).getDate()}</span>
                        <span className="font-mono-nu text-[10px] uppercase text-nu-pink/70">{new Date(evt.start_at).toLocaleDateString("ko", { month: "short" })}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{evt.title}</p>
                        <div className="flex items-center gap-3 text-xs text-nu-muted mt-0.5">
                          <span className="flex items-center gap-1"><Clock size={10} />{new Date(evt.start_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}</span>
                          {evt.location && <span className="flex items-center gap-1"><MapPin size={10} />{evt.location}</span>}
                          {evt.group?.name && <span className="text-nu-pink">{evt.group.name}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ZeroSite Launch */}
            {canEdit && (
              <div className="bg-nu-white border-[2px] border-nu-pink/20 p-6 relative overflow-hidden group">
                 <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <span className="bg-nu-pink text-white text-[11px] font-bold uppercase tracking-widest px-2 py-0.5">ZeroSite</span>
                      <h3 className="font-head text-lg font-extrabold text-nu-ink mt-2 mb-1">오프라인 프로그램 출시 제안</h3>
                      <p className="text-xs text-nu-gray leading-relaxed max-w-lg">이 볼트의 결과물을 제로싸이트 공간의 정규 프로그램으로 출시해보세요.</p>
                    </div>
                    {!(project as any)?.zerosite_launch_status || (project as any)?.zerosite_launch_status === "idle" ? (
                      <Button
                        onClick={async () => {
                          if (!confirm("제로싸이트 운영팀에 이 볼트를 오프라인 프로그램으로 제안하시겠습니까?")) return;
                          const supabase = createClient();
                          const { error } = await supabase.from("projects").update({ zerosite_launch_status: "pending" }).eq("id", projectId);
                          if (error) toast.error("제안 발송 실패: " + error.message);
                          else { toast.success("제안서가 운영팀에 성공적으로 전달되었습니다."); window.location.reload(); }
                        }}
                        className="bg-nu-ink text-nu-paper hover:bg-nu-pink transition-all font-mono-nu text-[12px] uppercase tracking-widest px-6 py-5 h-auto shrink-0"
                      >
                        Launch <ChevronRight size={14} className="ml-1" />
                      </Button>
                    ) : (
                      <div className="bg-nu-cream/50 border border-nu-ink/5 px-5 py-3 text-center shrink-0">
                        <p className="font-mono-nu text-[12px] text-nu-muted uppercase mb-0.5">Status</p>
                        <p className="font-head text-sm font-extrabold text-nu-ink capitalize">{(project as any)?.zerosite_launch_status}</p>
                      </div>
                    )}
                 </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* ── My Tasks Widget (Logged-in User's Tasks) ── */}
            <div className="bg-nu-pink/5 border-[2px] border-nu-pink/20 p-5">
              <h3 className="font-head text-base font-extrabold flex items-center gap-2 mb-3 text-nu-pink">
                <CheckSquare size={16} /> 내 할 일 ({myTasks.length})
              </h3>
              {myTasks.length === 0 ? (
                <p className="text-xs text-nu-muted">할당받은 할 일이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {myTasks.map((t: any) => (
                    <div key={t.id} className="flex items-start gap-2 bg-white border border-nu-ink/5 p-2 px-3 shadow-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-nu-pink mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-nu-ink">{t.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`font-mono-nu text-[10px] uppercase px-1 py-0.5 border ${
                            t.status === "in_progress" ? "bg-nu-amber/10 text-nu-amber border-nu-amber/20" : "bg-nu-gray/10 text-nu-gray border-nu-gray/20"
                          }`}>
                            {t.status === "in_progress" ? "진행 중" : "대기"}
                          </span>
                          {t.due_date && (
                            <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-0.5">
                              <Clock size={9} /> {new Date(t.due_date).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="font-mono-nu text-[10px] text-nu-muted mt-2 text-right uppercase">
                    자세한 관리는 칸반 보드 탭에서 가능합니다.
                  </p>
                </div>
              )}
            </div>

            {/* ── Tool Hub (compact) ─── */}
            {project && (project.tool_slack || project.tool_notion || project.tool_drive) && (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
                <h3 className="font-head text-base font-extrabold flex items-center gap-2 mb-3">
                  <ExternalLink size={15} /> 툴 허브
                </h3>
                <div className="flex flex-wrap gap-2">
                  {project.tool_slack && (
                    <a href={project.tool_slack} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 border border-nu-ink/[0.08] hover:border-[#4A154B]/40 hover:bg-[#4A154B]/5 transition-colors no-underline text-sm text-nu-ink">
                      <div className="w-5 h-5 bg-[#4A154B] flex items-center justify-center shrink-0">
                        <MessageCircle size={10} className="text-white" />
                      </div>
                      Slack
                    </a>
                  )}
                  {project.tool_notion && (
                    <a href={project.tool_notion} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 border border-nu-ink/[0.08] hover:border-nu-ink/30 hover:bg-nu-ink/5 transition-colors no-underline text-sm text-nu-ink">
                      <div className="w-5 h-5 bg-nu-ink flex items-center justify-center shrink-0">
                        <BookOpen size={10} className="text-white" />
                      </div>
                      Notion
                    </a>
                  )}
                  {project.tool_drive && (
                    <a href={project.tool_drive} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 border border-nu-ink/[0.08] hover:border-[#1967D2]/30 hover:bg-[#1967D2]/5 transition-colors no-underline text-sm text-nu-ink">
                      <div className="w-5 h-5 bg-[#1967D2] flex items-center justify-center shrink-0">
                        <FileText size={10} className="text-white" />
                      </div>
                      Drive
                    </a>
                  )}
                  {/* 카카오 툴 제거 — 내장 채팅 사용 */}
                </div>
              </div>
            )}

            {/* ── Budget Summary (compact, links to Finance tab) ── */}
            {project?.total_budget && (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-5 cursor-pointer hover:border-nu-pink/30 transition-colors" onClick={() => setActiveTab("finance")}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-head text-base font-extrabold flex items-center gap-2">
                    <Wallet size={15} /> 예산
                  </h3>
                  <ChevronRight size={14} className="text-nu-muted" />
                </div>
                <p className="font-head text-2xl font-extrabold text-nu-ink">
                  {parseInt(project.total_budget).toLocaleString("ko-KR")}
                  <span className="font-mono-nu text-sm font-normal text-nu-muted ml-1">{project.budget_currency || "KRW"}</span>
                </p>
                <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest mt-1">자금·보상 탭에서 상세 확인 →</p>
              </div>
            )}

            {/* User Members */}
            <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
              <h3 className="font-head text-base font-extrabold flex items-center gap-2 mb-4">
                <Users size={16} /> 와셔 ({userMembers.length})
              </h3>
              <div className="space-y-3">
                {userMembers.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-nu-cream flex items-center justify-center font-head text-xs font-bold text-nu-ink shrink-0">
                      {(m.profile?.nickname || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.profile?.nickname}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-nu-muted">{roleLabels[m.role] || m.role}</span>
                        {m._from_nut && m.crew?.name && (
                          <span className="inline-flex items-center gap-0.5 font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-amber/10 text-nu-amber border border-nu-amber/20 shrink-0">
                            🥜 {m.crew.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {userMembers.length === 0 && <p className="text-nu-gray text-xs">와셔가 없습니다</p>}
              </div>
            </div>

            {/* Crew Members */}
            {crewMembers.length > 0 && (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
                <h3 className="font-head text-base font-extrabold flex items-center gap-2 mb-4">
                  <Layers size={16} /> 참여 크루 ({crewMembers.length})
                </h3>
                <div className="space-y-3">
                  {crewMembers.map((m: any) => (
                    <Link key={m.id} href={`/groups/${m.crew_id}`}
                      className="flex items-center gap-3 no-underline hover:bg-nu-cream/30 p-1 -m-1 transition-colors">
                      <div className={`w-8 h-8 flex items-center justify-center font-head text-xs font-bold text-white ${catColors[m.crew?.category] || "bg-nu-gray"}`}>
                        {(m.crew?.name || "C").charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-nu-ink">{m.crew?.name}</p>
                        <p className="text-[12px] text-nu-muted capitalize">{m.crew?.category}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Project Vitals */}
            <ProjectRadarChart projectId={projectId} />
            <ProjectActivityHeatmap projectId={projectId} />
          </div>
        </div>
      )}

      {/* Kanban Board Tab */}
      {activeTab === "kanban" && (
        <ProjectKanbanBoard projectId={projectId} canEdit={canEdit} onTaskChange={refreshTaskStats} />
      )}

      {/* Milestones Tab (includes roadmap + burndown) — constrained */}
      {activeTab === "milestones" && (
        <div className="max-w-6xl mx-auto space-y-8">
          {/* ── 전체 번다운 차트 — 모든 타입에서 표시 ── */}
          <ProjectBurndownChart projectId={projectId} />

          <ProjectRoadmap projectId={projectId} milestones={milestones} isLead={canEdit} />
          <MilestoneList projectId={projectId} initialMilestones={milestones} canEdit={canEdit} onTaskChange={refreshTaskStats} />
        </div>
      )}

      {/* Calendar Tab — events + meetings + milestones due_date 통합 월 뷰 */}
      {activeTab === "calendar" && (
        <div className="max-w-6xl mx-auto">
          <BoltCalendar projectId={projectId} canEdit={canEdit} />
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === "insights" && (
        <ProjectInsights
          projectId={projectId}
          totalBudget={project?.total_budget ? parseInt(project.total_budget) : 0}
        />
      )}

      {/* Meetings Tab — project meeting notes */}
      {activeTab === "meetings" && (
        <div className="max-w-6xl mx-auto">
          <ProjectMeetings
            projectId={projectId}
            canEdit={canEdit}
            userId={userId}
          />
        </div>
      )}

      {/* Resources Tab — FULL WIDTH for split-view */}
      {activeTab === "resources" && (
        <ProjectResourceHub
          projectId={projectId}
          isLead={canEdit}
          isMember={isMember}
          userId={userId}
        />
      )}

      {/* Finance + Rewards Tab — constrained */}
      {activeTab === "finance" && (
        <div className="max-w-6xl mx-auto space-y-10">
          {project?.closed_at && project?.finance_snapshot ? (
            // 마감된 볼트 — 정산 스냅샷 우선 렌더
            <>
              <ProjectFinanceSnapshot
                snapshot={project.finance_snapshot as FinanceSnapshot}
                finalizedAt={project.rewards_finalized_at ?? project.closed_at}
              />
              {canEdit && (
                <details className="border-[2px] border-nu-ink/20">
                  <summary className="px-4 py-2 font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink cursor-pointer">
                    ▼ 원본 거래 내역 보기 (호스트 전용)
                  </summary>
                  <div className="p-4 border-t-[2px] border-nu-ink/10">
                    <ProjectFinanceDashboard
                      projectId={projectId}
                      totalBudget={project?.total_budget ? parseInt(project.total_budget) : 0}
                      isLead={canEdit}
                      milestones={milestones}
                    />
                  </div>
                </details>
              )}
            </>
          ) : (
            // 진행 중 볼트 — 대시보드 + 편집기
            <>
              <ProjectFinanceDashboard
                projectId={projectId}
                totalBudget={project?.total_budget ? parseInt(project.total_budget) : 0}
                isLead={canEdit}
                milestones={milestones}
              />
              <div className="border-t-2 border-nu-ink/10 pt-10">
                <ProjectRewardsTab project={project} members={userMembers} canEdit={canEdit} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Activity Tab — constrained */}
      {activeTab === "activity" && (
        <div className="max-w-6xl mx-auto space-y-8">
          <ProjectActivityFeed
            projectId={projectId}
            initialUpdates={updates}
            canPost={isMember}
            userId={userId}
          />
          {/* 동료 보증 — 팀원들 상호 보증 */}
          {userMembers.length > 0 && (
            <div>
              <h3 className="font-mono-nu text-[12px] font-black uppercase tracking-widest text-nu-muted mb-4">팀원 보증</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userMembers.filter((m: any) => m.user_id !== userId).map((m: any) => (
                  <EndorsementPanel
                    key={m.user_id}
                    targetUserId={m.user_id}
                    projectId={projectId}
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ── Rewards Tab Component ───────────────────────────────────────────── */
function ProjectRewardsTab({ project, members, canEdit }: any) {
  const [total, setTotal] = useState(project?.reward_total || project?.total_budget || 0);
  const [currency, setCurrency] = useState(project?.reward_currency || project?.budget_currency || "KRW");
  const [ratios, setRatios] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    members.forEach((m: any) => { map[m.id] = m.reward_ratio || 0; });
    return map;
  });
  const [saving, setSaving] = useState(false);
  const totalRatio = Object.values(ratios).reduce((a, b) => a + b, 0);

  async function saveRewards() {
    setSaving(true);
    try {
      const supabase = createClient();
      // Save total + currency to projects table
      const { error: projErr } = await supabase.from("projects").update({
        reward_total: total,
        reward_currency: currency,
      }).eq("id", project?.id);
      if (projErr) throw projErr;

      // Save each member's reward_ratio
      for (const [memberId, ratio] of Object.entries(ratios)) {
        const { error } = await supabase.from("project_members")
          .update({ reward_ratio: ratio })
          .eq("id", memberId);
        if (error) console.warn("reward_ratio update:", error.message);
      }
      toast.success("보상 배분이 저장되었습니다");
    } catch (err: any) {
      toast.error(err.message || "저장 실패");
    } finally { setSaving(false); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        {/* Total reward budget */}
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
           <h3 className="font-head text-lg font-extrabold mb-4 flex items-center gap-2">
             <DollarSign size={18} className="text-green-600" /> 보상 예산
           </h3>
           <div className="bg-nu-cream/40 p-5 border border-nu-ink/5 mb-4">
             <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-1">총 보상 예산</p>
             <p className="font-head text-3xl font-extrabold">
               {parseInt(String(total)).toLocaleString("ko-KR")}
               <span className="text-base font-normal ml-1">{currency}</span>
             </p>
           </div>
           {canEdit && (
             <div className="flex gap-2">
               <Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} className="h-10 text-sm border-nu-ink/20 flex-1" placeholder="보상 금액" />
               <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-10 px-3 border border-nu-ink/20 text-sm bg-white">
                 <option value="KRW">KRW</option>
                 <option value="USD">USD</option>
                 <option value="NUT">NUT</option>
               </select>
             </div>
           )}
        </div>

        {/* Member distribution */}
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-head text-lg font-extrabold flex items-center gap-2"><Users size={18} /> 와셔별 배분</h3>
            <span className={`font-mono-nu text-[13px] font-bold px-2 py-1 border ${totalRatio === 100 ? "text-green-600 bg-green-50 border-green-200" : totalRatio > 100 ? "text-red-600 bg-red-50 border-red-200" : "text-nu-amber bg-nu-amber/10 border-nu-amber/20"}`}>
              합계: {totalRatio}%
            </span>
          </div>
          <div className="space-y-3">
             {members.map((m: any) => {
               const ratio = ratios[m.id] || 0;
               const amount = Math.round((parseInt(String(total)) * ratio) / 100);
               return (
                <div key={m.id} className="p-4 bg-nu-cream/20 border border-nu-ink/5">
                   <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center gap-2">
                       <div className="w-7 h-7 rounded-full bg-nu-cream flex items-center justify-center font-head text-[12px] font-bold">
                         {(m.profile?.nickname || "U").charAt(0).toUpperCase()}
                       </div>
                       <span className="text-sm font-bold text-nu-ink">{m.profile?.nickname}</span>
                       <span className="font-mono-nu text-[10px] text-nu-muted uppercase">{roleLabels[m.role] || m.role}</span>
                     </div>
                     <span className="font-mono-nu text-sm font-bold text-green-600">{ratio}%</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <div className="flex-1 h-2 bg-nu-cream border border-nu-ink/5 overflow-hidden">
                       <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(ratio, 100)}%` }} />
                     </div>
                     {canEdit && (
                       <input type="number" value={ratio}
                         onChange={(e) => setRatios(prev => ({ ...prev, [m.id]: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }))}
                         className="w-14 h-7 text-[13px] text-center border border-nu-ink/20 bg-white focus:outline-none focus:border-nu-pink"
                         max={100} min={0} />
                     )}
                   </div>
                   <p className="text-[12px] text-nu-muted mt-1.5">
                     예상 지급액: <span className="font-bold text-nu-ink">{amount.toLocaleString("ko-KR")}</span> {currency}
                   </p>
                </div>
               );
             })}
             {members.length === 0 && <p className="text-xs text-nu-muted">참여 와셔가 없습니다.</p>}
          </div>
          {canEdit && (
            <Button onClick={saveRewards} disabled={saving}
              className="w-full mt-6 bg-nu-ink text-nu-paper hover:bg-nu-pink py-6 font-mono-nu text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <><Loader2 size={14} className="animate-spin" /> 저장 중...</> : <><Save size={16} /> 배분 변경사항 저장</>}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
           <h3 className="font-head text-lg font-extrabold mb-4 flex items-center gap-2">
             <CheckCircle2 size={18} /> 리워드 지급 조건
           </h3>
           <div className="space-y-4">
             <div className="flex items-start gap-3">
               <CheckCircle2 size={16} className="text-green-600 mt-0.5" />
               <div>
                 <p className="text-sm font-medium">마일스톤 100% 완료</p>
                 <p className="text-[13px] text-nu-muted mt-0.5 leading-relaxed">모든 할당된 태스크가 완료 상태여야 하며, 최종 승인을 획득해야 합니다.</p>
               </div>
             </div>
             <div className="flex items-start gap-3">
               <CheckCircle2 size={16} className="text-green-600 mt-0.5" />
               <div>
                 <p className="text-sm font-medium">최종 결과물(포트폴리오) 등록</p>
                 <p className="text-[13px] text-nu-muted mt-0.5 leading-relaxed">볼트 완료 보고서 및 분야별 산출물이 플랫폼 아카이브에 등록되어야 합니다.</p>
               </div>
             </div>
           </div>
        </div>

        <div className="bg-nu-pink/5 border-[2px] border-nu-pink/20 p-6">
           <h3 className="font-head text-base font-extrabold text-nu-pink mb-2 flex items-center gap-2">
             <Zap size={16} /> PM 권한 알림
           </h3>
           <p className="text-[13px] text-nu-pink/80 leading-relaxed font-medium">
             보상금 배분율은 볼트 리드(PM)가 와셔들의 기여도를 평가하여 결정합니다.
             최종 지급은 플랫폼 관리자의 검토를 거쳐 실행되며, 기한 내 산출물 미등록 시 보상이 제한될 수 있습니다.
           </p>
        </div>
      </div>
    </div>
  );
}
