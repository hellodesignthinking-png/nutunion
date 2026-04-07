"use client";

import { useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { MilestoneList } from "@/components/projects/milestone-list";
import { ProjectActivityFeed } from "@/components/projects/project-activity-feed";

const tabs = [
  { key: "overview", label: "Overview", icon: Target },
  { key: "milestones", label: "Milestones", icon: Layers },
  { key: "activity", label: "Activity", icon: Activity },
];

const roleLabels: Record<string, string> = {
  lead: "리드",
  member: "멤버",
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
}) {
  const [activeTab, setActiveTab] = useState("overview");

  const milestones  = JSON.parse(milestonesData);
  const updates     = JSON.parse(updatesData);
  const userMembers = JSON.parse(userMembersData);
  const crewMembers = JSON.parse(crewMembersData);
  const events      = JSON.parse(eventsData);
  const project     = projectData ? JSON.parse(projectData) : null;

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-nu-ink/[0.08] mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`font-mono-nu text-[11px] uppercase tracking-widest px-6 py-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? "border-nu-pink text-nu-ink font-bold"
                : "border-transparent text-nu-muted hover:text-nu-graphite"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
        {canEdit && (
          <Link
            href={`/projects/${projectId}/settings`}
            className="font-mono-nu text-[11px] uppercase tracking-widest px-6 py-3 border-b-2 border-transparent text-nu-muted hover:text-nu-graphite no-underline ml-auto flex items-center gap-2"
          >
            Settings
          </Link>
        )}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Progress */}
            <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
              <h3 className="font-head text-lg font-extrabold mb-4 flex items-center gap-2">
                <Target size={18} /> 진행 상황
              </h3>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono-nu text-[11px] text-nu-muted">
                    전체 진행률
                  </span>
                  <span className="font-mono-nu text-[13px] font-bold">
                    {progressPct}%
                  </span>
                </div>
                <div className="h-3 bg-nu-cream rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-nu-cream/50">
                  <p className="font-head text-2xl font-extrabold text-nu-ink">
                    {taskStats.todo}
                  </p>
                  <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
                    To Do
                  </p>
                </div>
                <div className="text-center p-3 bg-nu-yellow/10">
                  <p className="font-head text-2xl font-extrabold text-nu-amber">
                    {taskStats.in_progress}
                  </p>
                  <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
                    In Progress
                  </p>
                </div>
                <div className="text-center p-3 bg-green-50">
                  <p className="font-head text-2xl font-extrabold text-green-600">
                    {taskStats.done}
                  </p>
                  <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
                    Done
                  </p>
                </div>
              </div>
            </div>

            {/* Milestone summary */}
            <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
              <h3 className="font-head text-lg font-extrabold mb-4 flex items-center gap-2">
                <Layers size={18} /> 마일스톤 요약
              </h3>
              {milestones.length === 0 ? (
                <p className="text-nu-gray text-sm">
                  아직 마일스톤이 없습니다
                </p>
              ) : (
                <div className="space-y-3">
                  {milestones.map((ms: any) => {
                    const tasks = ms.tasks || [];
                    const done = tasks.filter(
                      (t: any) => t.status === "done"
                    ).length;
                    const pct =
                      tasks.length > 0
                        ? Math.round((done / tasks.length) * 100)
                        : 0;
                    return (
                      <div
                        key={ms.id}
                        className="flex items-center gap-3 p-3 bg-nu-cream/30"
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${msStatusColors[ms.status] || "bg-nu-gray"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {ms.title}
                          </p>
                          <p className="font-mono-nu text-[10px] text-nu-muted">
                            {done}/{tasks.length} tasks
                            {ms.due_date &&
                              ` · ${new Date(ms.due_date).toLocaleDateString("ko", { month: "short", day: "numeric" })}`}
                          </p>
                        </div>
                        <div className="w-16 shrink-0">
                          <div className="h-1.5 bg-nu-cream rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-600 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Linked events */}
            {events.length > 0 && (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
                <h3 className="font-head text-lg font-extrabold mb-4 flex items-center gap-2">
                  <Calendar size={18} /> 연결된 일정
                </h3>
                <div className="space-y-3">
                  {events.map((evt: any) => (
                    <div
                      key={evt.id}
                      className="flex items-center gap-4 p-3 bg-nu-cream/30"
                    >
                      <div className="w-12 h-12 bg-nu-pink/10 flex flex-col items-center justify-center shrink-0">
                        <span className="font-head text-base font-extrabold text-nu-pink leading-none">
                          {new Date(evt.start_at).getDate()}
                        </span>
                        <span className="font-mono-nu text-[8px] uppercase text-nu-pink/70">
                          {new Date(evt.start_at).toLocaleDateString("ko", {
                            month: "short",
                          })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {evt.title}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-nu-muted mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(evt.start_at).toLocaleTimeString("ko", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {evt.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={10} />
                              {evt.location}
                            </span>
                          )}
                          {evt.group?.name && (
                            <span className="text-nu-pink">
                              {evt.group.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* ── Tool Hub ───────────────────────────────────── */}
            {project && (project.tool_slack || project.tool_notion || project.tool_drive || project.tool_kakao) && (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
                <h3 className="font-head text-base font-extrabold flex items-center gap-2 mb-4">
                  <ExternalLink size={15} /> 툴 허브
                </h3>
                <div className="space-y-2">
                  {project.tool_slack && (
                    <a href={project.tool_slack} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 border border-nu-ink/[0.08] hover:border-[#4A154B]/40 hover:bg-[#4A154B]/5 transition-colors no-underline group">
                      <div className="w-6 h-6 bg-[#4A154B] flex items-center justify-center shrink-0">
                        <MessageCircle size={11} className="text-white" />
                      </div>
                      <span className="text-sm text-nu-ink group-hover:text-[#4A154B]">#Slack 채널</span>
                      <ChevronRight size={12} className="ml-auto text-nu-muted" />
                    </a>
                  )}
                  {project.tool_notion && (
                    <a href={project.tool_notion} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 border border-nu-ink/[0.08] hover:border-nu-ink/30 hover:bg-nu-ink/5 transition-colors no-underline group">
                      <div className="w-6 h-6 bg-nu-ink flex items-center justify-center shrink-0">
                        <BookOpen size={11} className="text-white" />
                      </div>
                      <span className="text-sm text-nu-ink">Notion 보드</span>
                      <ChevronRight size={12} className="ml-auto text-nu-muted" />
                    </a>
                  )}
                  {project.tool_drive && (
                    <a href={project.tool_drive} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 border border-nu-ink/[0.08] hover:border-[#1967D2]/30 hover:bg-[#1967D2]/5 transition-colors no-underline group">
                      <div className="w-6 h-6 bg-[#1967D2] flex items-center justify-center shrink-0">
                        <FileText size={11} className="text-white" />
                      </div>
                      <span className="text-sm text-nu-ink group-hover:text-[#1967D2]">Google Drive</span>
                      <ChevronRight size={12} className="ml-auto text-nu-muted" />
                    </a>
                  )}
                  {project.tool_kakao && (
                    <a href={project.tool_kakao} target="_blank" rel="noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 border border-nu-ink/[0.08] hover:border-[#FAE100]/50 hover:bg-[#FAE100]/10 transition-colors no-underline group">
                      <div className="w-6 h-6 bg-[#FAE100] flex items-center justify-center shrink-0">
                        <MessageCircle size={11} className="text-nu-ink" />
                      </div>
                      <span className="text-sm text-nu-ink">카카오 채널</span>
                      <ChevronRight size={12} className="ml-auto text-nu-muted" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* ── Budget Panel ────────────────────────────────── */}
            {project?.total_budget && (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
                <h3 className="font-head text-base font-extrabold flex items-center gap-2 mb-4">
                  <Wallet size={15} /> 예산 & 보상
                </h3>
                <div className="bg-nu-cream/40 px-4 py-3 mb-4">
                  <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">총 사업비</p>
                  <p className="font-head text-2xl font-extrabold text-nu-ink">
                    {parseInt(project.total_budget).toLocaleString("ko-KR")}
                    <span className="font-mono-nu text-base font-normal text-nu-muted ml-1">{project.budget_currency || "KRW"}</span>
                  </p>
                </div>
                {userMembers.some((m: any) => m.reward_ratio) && (
                  <div className="space-y-2">
                    <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-2">팀원별 배분</p>
                    {userMembers.map((m: any) => m.reward_ratio ? (
                      <div key={m.id} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-nu-cream flex items-center justify-center font-head text-[10px] font-bold shrink-0">
                          {(m.profile?.nickname || "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm flex-1 truncate">{m.profile?.nickname}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-20 h-1.5 bg-nu-cream overflow-hidden">
                            <div className="h-full bg-green-500" style={{ width: `${m.reward_ratio}%` }} />
                          </div>
                          <span className="font-mono-nu text-[10px] text-nu-muted shrink-0">{m.reward_ratio}%</span>
                        </div>
                      </div>
                    ) : null)}
                  </div>
                )}
              </div>
            )}

            {/* User Members */}
            <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
              <h3 className="font-head text-base font-extrabold flex items-center gap-2 mb-4">
                <Users size={16} /> 멤버 ({userMembers.length})
              </h3>
              <div className="space-y-3">
                {userMembers.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-nu-cream flex items-center justify-center font-head text-xs font-bold text-nu-ink">
                      {(m.profile?.nickname || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {m.profile?.nickname}
                      </p>
                      <p className="text-[10px] text-nu-muted">
                        {roleLabels[m.role] || m.role}
                      </p>
                    </div>
                  </div>
                ))}
                {userMembers.length === 0 && (
                  <p className="text-nu-gray text-xs">멤버가 없습니다</p>
                )}
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
                    <Link
                      key={m.id}
                      href={`/groups/${m.crew_id}`}
                      className="flex items-center gap-3 no-underline hover:bg-nu-cream/30 p-1 -m-1 transition-colors"
                    >
                      <div
                        className={`w-8 h-8 flex items-center justify-center font-head text-xs font-bold text-white ${catColors[m.crew?.category] || "bg-nu-gray"}`}
                      >
                        {(m.crew?.name || "C").charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-nu-ink">
                          {m.crew?.name}
                        </p>
                        <p className="text-[10px] text-nu-muted capitalize">
                          {m.crew?.category}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Milestones Tab */}
      {activeTab === "milestones" && (
        <MilestoneList
          projectId={projectId}
          initialMilestones={milestones}
          canEdit={canEdit}
        />
      )}

      {/* Activity Tab */}
      {activeTab === "activity" && (
        <ProjectActivityFeed
          projectId={projectId}
          initialUpdates={updates}
          canPost={isMember}
          userId={userId}
        />
      )}
    </>
  );
}
