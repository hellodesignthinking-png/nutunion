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
  Loader2,
  Columns3,
  BarChart3,
  Puzzle,
  Sticker,
  Settings,
  HelpCircle,
  Archive,
  Sparkles,
  Brain,
  Share2,
  MessageSquare,
} from "lucide-react";
import { MilestoneList } from "@/components/projects/milestone-list";
import { ProjectActivityFeed } from "@/components/projects/project-activity-feed";
import { ProjectRoadmap } from "@/components/projects/project-roadmap";
import { ProjectResourceHub } from "@/components/projects/project-resource-hub";
import { ProjectFinanceDashboard } from "@/components/projects/project-finance-dashboard";
import { ProjectFinanceSnapshot, type FinanceSnapshot } from "@/components/projects/project-finance-snapshot";
import { ProjectBurndownChart } from "@/components/projects/project-burndown-chart";
import { ProjectMeetings } from "@/components/projects/project-meetings";
import { ProjectCalendar } from "@/components/projects/project-calendar";
import { ProjectRadarChart } from "@/components/projects/project-vitals";
import { ProjectKanbanBoard } from "@/components/projects/project-kanban-board";
import { ProjectInsights } from "@/components/projects/project-insights";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnchorDashboard } from "@/components/bolt/anchor/anchor-dashboard";
import { CarriageDashboard } from "@/components/bolt/carriage/carriage-dashboard";
import { EyeDashboard } from "@/components/bolt/eye/eye-dashboard";
import { WingDashboard } from "@/components/bolt/wing/wing-dashboard";
import { TorqueView } from "@/components/bolt/torque/TorqueView";
import { BoltCalendar } from "@/components/bolt/bolt-calendar";
import { ConsultingAddonManager } from "@/components/bolt/consulting-addon-manager";
import { ProjectModulesBoard } from "@/components/projects/project-modules-board";
import { ProjectOsPanel } from "@/components/projects/project-os-panel";
import { ProjectShareModal } from "@/components/projects/project-share-modal";
import { ProjectChatPanel } from "@/components/projects/project-chat-panel";
import { SpacePages } from "@/components/spaces/space-pages";
import { MeetingArchiveTimeline } from "@/components/meetings/meeting-archive-timeline";

// 메뉴 통일 (2026-04) — 단일 탭바 한 줄로 모든 기능 접근.
// 순서: 홈 → 할일(칸반/마일스톤) → 회의록 → 자료실 → 탭(위키) → 자금 → 활동 → 설정
// insights/modules/calendar 는 각 영역 내부에서 접근 (탭바 노출 안 함).
const baseTabs = [
  { key: "overview",   label: "홈",       icon: Target },
  { key: "os",         label: "OS",       icon: Brain },
  { key: "chat",       label: "채팅",     icon: MessageSquare },
  { key: "kanban",     label: "할 일",    icon: CheckSquare },
  { key: "milestones", label: "마일스톤", icon: Layers },
  { key: "meetings",   label: "일정",     icon: FileText },
  { key: "resources",  label: "자료실",   icon: FolderOpen },
  { key: "wiki",       label: "탭",       icon: Sticker },
  { key: "finance",    label: "정산",     icon: Wallet },
  { key: "activity",   label: "활동",     icon: Activity },
  { key: "settings",   label: "설정",     icon: Settings, leadOnly: true },
  // 숨김 탭 — URL ?tab= 또는 내부 링크로만 접근
  { key: "insights",   label: "인사이트", icon: BarChart3, hidden: true },
  { key: "modules",    label: "모듈",     icon: Puzzle },
  { key: "calendar",   label: "캘린더",   icon: Calendar,  hidden: true },
];

const roleConfig: Record<string, { label: string; className: string }> = {
  lead:     { label: "리드",    className: "bg-nu-pink text-white" },
  member:   { label: "와셔",    className: "bg-nu-ink/10 text-nu-graphite" },
  observer: { label: "옵저버",  className: "bg-nu-cream text-nu-muted border border-nu-ink/10" },
};

const catColors: Record<string, string> = {
  space:    "bg-nu-blue",
  culture:  "bg-nu-amber",
  platform: "bg-nu-ink",
  vibe:     "bg-nu-pink",
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
  archivedMeetingsData,
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
  archivedMeetingsData?: string;
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
  const archivedMeetings = archivedMeetingsData ? JSON.parse(archivedMeetingsData) : [];

  // ── Live task stats (refreshable on client) ──
  const [shareOpen, setShareOpen] = useState(false);
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

  // Build tabs — hidden 탭은 탭바에 표시 안 함
  const tabCounts: Record<string, number | null> = {
    overview:   null,
    kanban:     liveTotalTasks || null,
    milestones: milestones?.length || null,
    meetings:   null,   // 실시간 로딩 — ProjectMeetings 에서 관리
    resources:  null,
    finance:    null,
    activity:   updates?.length || null,
    insights:   null,
    modules:    null,
  };
  const tabs = baseTabs
    .filter((t) => !(t as any).hidden)
    .filter((t) => !((t as any).leadOnly && !canEdit))
    .map((t) => ({ ...t, count: tabCounts[t.key] ?? null }));

  // Calculate milestone progress
  const totalMilestones = milestones?.length || 0;
  const completedMilestones = milestones?.filter((m: any) => m.status === "completed")?.length || 0;
  const milestoneProgressPct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
  const isCompleted = milestoneProgressPct === 100;

  return (
    <>

      {/* 내부 탭바 제거됨 (2026-04) — ProjectTopNav 가 상단 sticky 가로 메뉴로 대체.
          전체 화면 활용 위해 본문 위 vertical space 절약. 카운트 배지가 필요하면
          상단 nav 옆에 mini-stat 으로 노출하거나 본문 헤더에 표시. */}
      <div className="max-w-6xl mx-auto mb-4" />

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

            {/* ── Progress Dashboard ── */}
            <div className="bg-nu-white border-[2px] border-nu-ink p-6">
              <h3 className="font-head text-lg font-extrabold mb-5 flex items-center gap-2">
                <Target size={18} /> 볼트 현황
              </h3>

              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="text-center p-4 bg-nu-cream/50 border border-nu-ink/5">
                  <p className="font-head text-3xl font-extrabold text-nu-ink">{liveProgressPct}%</p>
                  <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-1">태스크 완료율</p>
                </div>
                <div className="text-center p-4 bg-nu-cream/50 border border-nu-ink/5">
                  <p className="font-head text-3xl font-extrabold text-nu-ink">{milestoneProgressPct}%</p>
                  <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-1">마일스톤</p>
                </div>
                <div className="text-center p-4 bg-green-50 border border-green-200">
                  <p className="font-head text-3xl font-extrabold text-green-600">{liveTaskStats.done}</p>
                  <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-1">완료</p>
                </div>
                {project?.total_budget ? (
                  <div className="text-center p-4 bg-nu-blue/5 border border-nu-blue/20 cursor-pointer hover:bg-nu-blue/10 transition-colors" onClick={() => setActiveTab("finance")}>
                    <p className="font-head text-xl font-extrabold text-nu-ink">
                      {parseInt(project.total_budget).toLocaleString("ko-KR")}
                    </p>
                    <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-1">예산 ({project.budget_currency || "KRW"})</p>
                  </div>
                ) : (
                  <div className="text-center p-4 bg-nu-cream/50 border border-nu-ink/5">
                    <p className="font-head text-3xl font-extrabold text-nu-amber">{liveTaskStats.in_progress}</p>
                    <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-1">진행 중</p>
                  </div>
                )}
              </div>

              {/* 태스크 현황 바 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">태스크</span>
                  <span className="font-mono-nu text-[11px] font-bold">{liveTaskStats.done}/{liveTotalTasks}</span>
                </div>
                <div className="h-2.5 bg-nu-cream rounded-full overflow-hidden flex">
                  <div className="h-full bg-green-600 transition-all" style={{ width: `${liveTotalTasks > 0 ? (liveTaskStats.done / liveTotalTasks) * 100 : 0}%` }} />
                  <div className="h-full bg-nu-amber transition-all" style={{ width: `${liveTotalTasks > 0 ? (liveTaskStats.in_progress / liveTotalTasks) * 100 : 0}%` }} />
                </div>
                <div className="flex items-center gap-4 mt-1.5">
                  <span className="flex items-center gap-1 text-[11px] text-nu-muted"><span className="w-2 h-2 bg-green-600 rounded-full" /> 완료 {liveTaskStats.done}</span>
                  <span className="flex items-center gap-1 text-[11px] text-nu-muted"><span className="w-2 h-2 bg-nu-amber rounded-full" /> 진행 {liveTaskStats.in_progress}</span>
                  <span className="flex items-center gap-1 text-[11px] text-nu-muted"><span className="w-2 h-2 bg-nu-cream rounded-full border border-nu-ink/10" /> 대기 {liveTaskStats.todo}</span>
                </div>
              </div>

              {/* 마일스톤 현황 바 */}
              {totalMilestones > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">마일스톤</span>
                    <span className="font-mono-nu text-[11px] font-bold">{completedMilestones}/{totalMilestones}</span>
                  </div>
                  <div className="h-2.5 bg-nu-cream rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${isCompleted ? "bg-green-600" : "bg-nu-pink"}`}
                      style={{ width: `${milestoneProgressPct}%` }}
                    />
                  </div>
                </div>
              )}
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

            {/* 이번 주 일정 미리보기 (최대 3개) — 캘린더 탭 링크 */}
            {events.length > 0 && (
              <button
                onClick={() => setActiveTab("calendar")}
                className="w-full bg-nu-white border border-nu-ink/[0.08] p-4 text-left hover:border-nu-pink/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted font-bold flex items-center gap-1.5">
                    <Calendar size={11} /> 일정 ({events.length})
                  </span>
                  <ChevronRight size={12} className="text-nu-muted" />
                </div>
                <div className="space-y-1.5">
                  {events.slice(0, 3).map((evt: any) => (
                    <div key={evt.id} className="flex items-center gap-2 text-[12px] text-nu-graphite">
                      <span className="font-mono-nu text-nu-pink font-bold shrink-0">
                        {new Date(evt.start_at).toLocaleDateString("ko", { month: "numeric", day: "numeric" })}
                      </span>
                      <span className="truncate">{evt.title}</span>
                    </div>
                  ))}
                </div>
              </button>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Quick Actions 그리드 제거 (2026-04) — 상단 탭바와 중복이라 혼란 야기. */}

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
              <div className="space-y-2.5">
                {userMembers.map((m: any) => {
                  const rc = roleConfig[m.role] || { label: m.role, className: "bg-nu-ink/5 text-nu-graphite" };
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-head text-xs font-bold shrink-0 ${
                        m.role === "lead" ? "bg-nu-pink text-white" : "bg-nu-cream text-nu-ink"
                      }`}>
                        {(m.profile?.nickname || "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.profile?.nickname}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${rc.className}`}>
                            {rc.label}
                          </span>
                          {m._from_nut && m.crew?.name && (
                            <span className="inline-flex items-center gap-0.5 font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-amber/10 text-nu-amber border border-nu-amber/20 shrink-0">
                              🥜 {m.crew.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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

          </div>
        </div>
      )}

      {/* Insights 탭 — Quick Actions 또는 ?tab=insights 로 접근 */}
      {activeTab === "insights" && (
        <ProjectInsights
          projectId={projectId}
          totalBudget={project?.total_budget ? parseInt(project.total_budget) : 0}
        />
      )}

      {/* Modules 탭 — 자유 모듈 보드 (노션처럼) + 컨설팅 애드온 관리 (consulting 타입 전용) */}
      {activeTab === "modules" && (
        <div className="max-w-6xl mx-auto py-6 space-y-8">
          <ProjectModulesBoard projectId={projectId} canEdit={canEdit} />
          {project?.type === "torque" && (
            <div className="border-t-2 border-nu-ink/10 pt-6">
              <ConsultingAddonManager projectId={projectId} canEdit={canEdit} />
            </div>
          )}
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


      {/* Meetings Tab — 너트와 동일한 캘린더 뷰 (월/주/목록) + 미팅 상세는 모달/별도 페이지 */}
      {activeTab === "meetings" && (
        <div className="max-w-6xl mx-auto space-y-8">
          <ProjectCalendar
            projectId={projectId}
            isAdmin={canEdit}
            isMember={isMember}
            initialMeetings={archivedMeetings}
          />
          {/* 회의록 아카이브 — 마감된 회의 타임라인 */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
                <BookOpen size={18} className="text-nu-pink" /> 📚 회의록 아카이브
              </h2>
            </div>
            <MeetingArchiveTimeline
              meetings={archivedMeetings}
              variant="project"
              baseHref={`/projects/${projectId}/meetings`}
            />
          </section>
          {/* 회의록 관리 (AI 요약/녹음/마감 등 풀 기능) — 캘린더 아래에 같이 노출 */}
          <details className="group bg-white border-[2px] border-nu-ink/10">
            <summary className="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-nu-cream/40 transition-colors list-none">
              <span className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink">
                📋 회의록 관리 (AI 요약 · 녹음 · 마감)
              </span>
              <span className="font-mono-nu text-[10px] text-nu-muted group-open:rotate-90 transition-transform">▶</span>
            </summary>
            <div className="p-4 border-t-[2px] border-nu-ink/10">
              <ProjectMeetings
                projectId={projectId}
                canEdit={canEdit}
                userId={userId}
              />
            </div>
          </details>
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

      {/* Activity Tab */}
      {activeTab === "activity" && (
        <div className="max-w-6xl mx-auto">
          <ProjectActivityFeed
            projectId={projectId}
            initialUpdates={updates}
            canPost={isMember}
            userId={userId}
          />
        </div>
      )}

      {/* OS Tab — AI PM 브리핑 + 결정 로그 + 리스크 (협업 OS 핵심) */}
      {activeTab === "os" && (
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h1 className="font-head text-2xl font-extrabold text-nu-ink">프로젝트 OS</h1>
              <p className="text-[12px] text-nu-muted mt-0.5">
                AI 가 분석한 우선순위 · 결정 로그 · 리스크 + 외부 공유 링크 4단 권한.
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 inline-flex items-center gap-1.5"
              >
                <Share2 size={12} /> 외부 공유
              </button>
            )}
          </div>
          <ProjectOsPanel projectId={projectId} canEdit={canEdit} />
        </div>
      )}

      <ProjectShareModal projectId={projectId} open={shareOpen} onClose={() => setShareOpen(false)} />

      {/* Chat Tab — 프로젝트 전용 채널, 메시지 → 태스크/결정/리스크 변환 */}
      {activeTab === "chat" && (
        <div className="max-w-4xl mx-auto">
          <div className="mb-3">
            <h1 className="font-head text-2xl font-extrabold text-nu-ink">프로젝트 채팅</h1>
            <p className="text-[12px] text-nu-muted mt-0.5">
              메시지에 '결정', '마감', '리스크' 같은 키워드가 있으면 변환 칩이 자동 표시됩니다.
            </p>
          </div>
          <ProjectChatPanel projectId={projectId} userId={userId} isMember={isMember} />
        </div>
      )}

      {/* ── Wiki/Tap Tab — SpacePages 본문 우선, 보조 도구는 한 줄 액션바 ────── */}
      {activeTab === "wiki" && (
        <div className="max-w-4xl mx-auto space-y-4">
          {/* 헤더 + 보조 액션 한 줄 */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-nu-pink" />
              <h2 className="font-head text-xl font-extrabold text-nu-ink">페이지</h2>
              <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
                멤버 누구나 추가·편집·삭제
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                href={`/projects/${projectId}/tap`}
                className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink/20 text-nu-graphite hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-1.5 no-underline transition-colors"
              >
                <BookOpen size={11} /> 탭 풀 에디터
              </Link>
              {canEdit && (
                <Link
                  href={`/projects/${projectId}/tap?compose=ai`}
                  className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-pink text-nu-pink hover:bg-nu-pink hover:text-nu-paper inline-flex items-center gap-1.5 no-underline transition-colors"
                >
                  <Sparkles size={11} /> AI 초안
                </Link>
              )}
            </div>
          </div>

          {/* 📄 SpacePages — 노션 스타일 인라인 에디터 */}
          {userId && (
            <SpacePages
              ownerType="bolt"
              ownerId={projectId}
              ownerName={project?.title || "볼트"}
              currentUserId={userId}
            />
          )}

          {/* 사용법 + 마감 체크리스트 — 접힌 details 한 곳에 모아 노이즈 최소화 */}
          <details className="border-[2px] border-nu-ink/15 bg-nu-cream/20">
            <summary className="cursor-pointer px-3 py-2 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:bg-nu-cream/40 select-none flex items-center gap-2">
              <Sticker size={11} className="text-nu-pink" /> 탭 사용법 · 마감 체크리스트
            </summary>
            <div className="border-t border-nu-ink/10 p-4 space-y-4">
              <div>
                <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink font-bold mb-1">시작하는 방법</p>
                <ul className="text-[12px] text-nu-graphite space-y-0.5 list-none p-0 m-0">
                  <li>• 위 <b>+ 새 페이지</b> 로 인라인 페이지 추가</li>
                  <li>• <b>탭 풀 에디터</b> 로 아카이브 / 위키 / 대시보드 모드 진입</li>
                  <li>• 회의 녹음 → AI 가 회의록 초안 자동 생성</li>
                  <li>• 볼트 마감 시 영구 아카이브로 승격</li>
                </ul>
              </div>
              {canEdit && (
                <div className="border-t border-nu-ink/10 pt-3">
                  <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink font-bold mb-1.5 flex items-center gap-1.5">
                    <Archive size={11} /> 마감 → 영구 아카이브 4단계
                  </p>
                  <ul className="text-[12px] text-nu-graphite space-y-0.5 list-none p-0 m-0">
                    <li><b>1.</b> 회고 작성 — 탭 에디터 아카이브 모드</li>
                    <li><b>2.</b> 산출물 정리 — <button onClick={() => setActiveTab("resources")} className="underline text-nu-blue hover:text-nu-ink">자료실</button>에 최종본 업로드</li>
                    <li><b>3.</b> 배운 점 기록 — 탭 위키 모드로 인사이트 정리</li>
                    <li><b>4.</b> 마감 확정 — 상단 [볼트 마감] 버튼 → 영구 아카이브 승격</li>
                  </ul>
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {/* ── Settings Tab — 호스트 전용. Thread 모듈도 여기서 관리 ────── */}
      {activeTab === "settings" && canEdit && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="border-[3px] border-nu-ink bg-nu-paper p-6">
            <h3 className="font-head text-xl font-extrabold text-nu-ink mb-2 flex items-center gap-2">
              <Settings size={20} /> 볼트 설정
            </h3>
            <p className="text-[13px] text-nu-graphite mb-5">
              볼트 정보·역할 슬롯·권한·툴 연결 등은 전용 설정 페이지에서 관리하세요.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/projects/${projectId}/settings`}
                className="h-10 px-5 border-[2.5px] border-nu-ink bg-nu-ink text-nu-paper font-mono-nu text-[11px] font-bold uppercase tracking-widest no-underline hover:bg-nu-pink hover:border-nu-pink inline-flex items-center gap-2"
              >
                <Settings size={14} /> 전체 설정 페이지
              </Link>
              <button
                onClick={() => setActiveTab("modules")}
                className="h-10 px-5 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-2"
              >
                <Puzzle size={14} /> 모듈 (Thread)
              </button>
            </div>
          </div>

          {/* Thread 모듈 — 인라인 안내 + 관리 진입 */}
          <ThreadModuleHelp projectId={projectId} />
        </div>
      )}
    </>
  );
}

/* ── Thread 모듈 안내 카드 ───────────────────────────────────────────── */
function ThreadModuleHelp({ projectId }: { projectId: string }) {
  return (
    <div className="border-[3px] border-nu-ink bg-nu-cream/40 p-6">
      <div className="flex items-start gap-3 mb-3">
        <Puzzle size={20} className="text-nu-pink mt-0.5 shrink-0" />
        <div>
          <h3 className="font-head text-lg font-extrabold text-nu-ink mb-1 flex items-center gap-2">
            Thread (모듈)
            <span className="font-mono-nu text-[9px] uppercase tracking-[0.25em] px-1.5 py-0.5 bg-nu-amber/20 text-nu-amber border border-nu-amber/30">BETA</span>
          </h3>
          <p className="text-[13px] text-nu-graphite leading-relaxed">
            <strong>Thread</strong> = 이 볼트에 끼우는 <strong>기능 모듈</strong>(게시판·캘린더·투표 등).
            볼트마다 필요한 기능만 골라 설치하세요.
          </p>
        </div>
      </div>
      <div className="border-l-[3px] border-nu-pink pl-4 mb-4 text-[12px] text-nu-graphite space-y-1">
        <p>· 기본 탭바(홈/할일/회의록/자료실/탭/자금/활동)는 모든 볼트 공통입니다.</p>
        <p>· Thread 는 <strong>추가 기능</strong>이 필요할 때만 설치하세요. 게시판이 필요한 볼트, 투표가 필요한 볼트 등.</p>
        <p>· 설치 후에는 홈 탭 하단에 모듈 영역이 나타납니다.</p>
      </div>
      <Link
        href={`/projects/${projectId}/threads`}
        className="h-10 px-5 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] font-bold uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper inline-flex items-center gap-2"
      >
        <Puzzle size={14} /> Thread 관리 페이지
      </Link>
    </div>
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
                       <span className="font-mono-nu text-[10px] text-nu-muted uppercase">{roleConfig[m.role]?.label || m.role}</span>
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
