"use client";

import { useState } from "react";
import Link from "next/link";
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
  Save,
  Zap,
} from "lucide-react";
import { MilestoneList } from "@/components/projects/milestone-list";
import { ProjectActivityFeed } from "@/components/projects/project-activity-feed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const tabs = [
  { key: "overview", label: "Overview", icon: Target },
  { key: "milestones", label: "Milestones", icon: Layers },
  { key: "rewards", label: "Rewards", icon: Wallet },
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
            {/* Project Snapshot (Archived content) */}
            {(project as any)?.snapshot_content && (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-8 mb-8">
                <div className="flex items-center gap-2 mb-6">
                   <FileText size={18} className="text-nu-muted" />
                   <h3 className="font-head text-lg font-extrabold text-nu-ink tracking-tight uppercase">Project Archive Snapshot</h3>
                </div>
                <div className="prose prose-sm max-w-none prose-nu font-sans whitespace-pre-wrap text-nu-gray leading-relaxed text-sm bg-nu-cream/10 p-6 border border-nu-ink/5">
                   {(project as any).snapshot_content}
                </div>
                <p className="font-mono-nu text-[10px] text-nu-muted mt-4">이 내용은 스냅샷 생성 시점의 상태를 보존하고 있습니다 (Immutable Archive)</p>
              </div>
            )}
            
            {/* ZeroSite Launch Promotion */}
            {canEdit && (
              <div className="bg-nu-white border-[2px] border-nu-pink/20 p-6 relative overflow-hidden group">
                 <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-nu-pink text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5">ZeroSite Integration</span>
                        {(project as any)?.zerosite_launch_status === "pending" && (
                          <span className="bg-nu-amber/10 text-nu-amber border border-nu-amber/20 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5">런칭 심사 중</span>
                        )}
                      </div>
                      <h3 className="font-head text-xl font-extrabold text-nu-ink mb-1 flex items-center gap-2">
                        오프라인 프로그램 출시 제안
                      </h3>
                      <p className="text-xs text-nu-gray leading-relaxed max-w-lg">
                        이 프로젝트의 결과물을 제로싸이트 공간의 정규 프로그램으로 출시해보세요.<br />
                        커리큘럼과 팀 정보를 기반으로 운영팀에게 원클릭 제안서를 발송합니다.
                      </p>
                    </div>
                    {!(project as any)?.zerosite_launch_status || (project as any)?.zerosite_launch_status === "idle" ? (
                      <Button 
                        onClick={async () => {
                          if (!confirm("제로싸이트 운영팀에 이 프로젝트를 오프라인 프로그램으로 제안하시겠습니까?")) return;
                          const supabase = createClient();
                          const { error } = await supabase.from("projects").update({ zerosite_launch_status: "pending" }).eq("id", projectId);
                          if (error) toast.error("제안 발송 실패: " + error.message);
                          else {
                            toast.success("제안서가 운영팀에 성공적으로 전달되었습니다.");
                            window.location.reload();
                          }
                        }}
                        className="bg-nu-ink text-nu-paper hover:bg-nu-pink transition-all font-mono-nu text-[10px] uppercase tracking-widest px-6 py-6 h-auto shrink-0 shadow-lg shadow-nu-pink/10"
                      >
                        Launch to ZeroSite <ChevronRight size={14} className="ml-1" />
                      </Button>
                    ) : (
                      <div className="bg-nu-cream/50 border border-nu-ink/5 px-6 py-4 text-center shrink-0">
                         <p className="font-mono-nu text-[10px] text-nu-muted uppercase mb-1">Current Status</p>
                         <p className="font-head text-base font-extrabold text-nu-ink capitalize">{(project as any)?.zerosite_launch_status}</p>
                      </div>
                    )}
                 </div>
                 <Target size={120} className="absolute -left-10 -bottom-10 text-nu-pink/5 rotate-12 group-hover:rotate-0 transition-transform duration-700" />
              </div>
            )}

            {/* Project Analytics Dash (External) */}
            {project?.milestone_dashboard_url && (
              <div className="bg-nu-ink text-nu-paper p-6 relative overflow-hidden group">
                 <div className="relative z-10">
                   <h3 className="font-head text-lg font-extrabold mb-1 flex items-center gap-2">
                     <Layers size={18} className="text-nu-pink" /> 실시간 프로젝트 대시보드
                   </h3>
                   <p className="text-[11px] text-nu-paper/60 mb-4 uppercase tracking-widest font-mono-nu">Real-time Milestone & Analytics</p>
                   <a href={project.milestone_dashboard_url} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-2 bg-nu-pink text-white px-5 py-2.5 font-mono-nu text-[10px] uppercase tracking-widest no-underline hover:bg-nu-pink/90 transition-all">
                     외부 대시보드 열기 <ExternalLink size={14} />
                   </a>
                 </div>
                 <Layers size={120} className="absolute -right-10 -bottom-10 text-nu-paper/5 rotate-12 group-hover:rotate-0 transition-transform duration-700" />
              </div>
            )}
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

      {/* Rewards Tab */}
      {activeTab === "rewards" && (
        <ProjectRewardsTab 
          project={project} 
          members={userMembers} 
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

/* ── Rewards Tab Component ───────────────────────────────────────────── */
function ProjectRewardsTab({ project, members, canEdit }: any) {
  const [total, setTotal] = useState(project?.reward_total || 0);
  const [currency, setCurrency] = useState(project?.reward_currency || "KRW");
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
           <h3 className="font-head text-lg font-extrabold mb-4 flex items-center gap-2">
             <DollarSign size={18} className="text-green-600" /> 총 보상 예산
           </h3>
           <div className="flex items-end gap-3 bg-nu-cream/40 p-5 border border-nu-ink/5">
             <div className="flex-1">
               <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">TOTAL REWARD BUDGET</p>
               <h4 className="font-head text-3xl font-extrabold">
                 {parseInt(total).toLocaleString("ko-KR")}
                 <span className="text-base font-normal ml-1">{currency}</span>
               </h4>
             </div>
           </div>
           {canEdit && (
             <div className="mt-4 p-4 border border-nu-ink/10 bg-nu-white">
                <p className="text-[11px] text-nu-muted mb-2 font-mono-nu">수정 (PM 전용)</p>
                <div className="flex gap-2">
                  <Input 
                    type="number" 
                    value={total} 
                    onChange={(e) => setTotal(e.target.value)}
                    className="h-10 text-sm border-nu-ink/20"
                  />
                  <select 
                    value={currency} 
                    onChange={(e) => setCurrency(e.target.value)}
                    className="h-10 px-3 border border-nu-ink/20 text-sm bg-white"
                  >
                    <option value="KRW">KRW</option>
                    <option value="USD">USD</option>
                    <option value="NUT">NUT (Point)</option>
                  </select>
                  <Button className="h-10 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors px-6">적용</Button>
                </div>
             </div>
           )}
        </div>

        <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
          <h3 className="font-head text-lg font-extrabold mb-4 flex items-center gap-2">
            <Users size={18} /> 배분율 설정
          </h3>
          <div className="space-y-4">
             {members.map((m: any) => (
                <div key={m.id} className="flex flex-col gap-2 p-4 bg-nu-cream/20 border border-nu-ink/5">
                   <div className="flex items-center justify-between">
                     <span className="text-sm font-bold text-nu-ink">{m.profile?.nickname}</span>
                     <span className="font-mono-nu text-sm font-bold text-green-600">{m.reward_ratio || 0}%</span>
                   </div>
                   <div className="flex items-center gap-4">
                     <div className="flex-1 h-2 bg-nu-cream border border-nu-ink/5 overflow-hidden">
                       <div className="h-full bg-green-500" style={{ width: `${m.reward_ratio || 0}%` }} />
                     </div>
                     {canEdit && (
                       <Input 
                         type="number" 
                         defaultValue={m.reward_ratio || 0}
                         className="w-16 h-8 text-[11px] text-center border-nu-ink/20"
                         max={100}
                         min={0}
                       />
                     )}
                   </div>
                   <p className="text-[10px] text-nu-muted">
                     예상 지급액: {Math.round((total * (m.reward_ratio || 0)) / 100).toLocaleString()} {currency}
                   </p>
                </div>
             ))}
             {members.length === 0 && <p className="text-xs text-nu-muted">참여 멤버가 없습니다.</p>}
          </div>
          {canEdit && (
            <Button className="w-full mt-6 bg-nu-ink text-nu-paper hover:bg-nu-pink py-7 font-mono-nu text-[11px] uppercase tracking-widest flex items-center gap-2">
              <Save size={16} /> 배분 변경사항 저장
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
           <h3 className="font-head text-lg font-extrabold mb-4 flex items-center gap-2">
             <Activity size={18} /> 리워드 지급 조건
           </h3>
           <div className="space-y-4">
             <div className="flex items-start gap-3">
               <CheckCircle2 size={16} className="text-green-600 mt-0.5" />
               <div>
                 <p className="text-sm font-medium">마일스톤 100% 완료</p>
                 <p className="text-[11px] text-nu-muted mt-0.5 leading-relaxed">모든 할당된 태스크가 완료 상태여야 하며, 최종 승인을 획득해야 합니다.</p>
               </div>
             </div>
             <div className="flex items-start gap-3">
               <CheckCircle2 size={16} className="text-green-600 mt-0.5" />
               <div>
                 <p className="text-sm font-medium">최종 결과물(포트폴리오) 등록</p>
                 <p className="text-[11px] text-nu-muted mt-0.5 leading-relaxed">프로젝트 완료 보고서 및 분야별 산출물이 플랫폼 아카이브에 등록되어야 합니다.</p>
               </div>
             </div>
           </div>
        </div>
        
        <div className="bg-nu-pink/5 border-[2px] border-nu-pink/20 p-6">
           <h3 className="font-head text-base font-extrabold text-nu-pink mb-2 flex items-center gap-2">
             <Zap size={16} /> PM 권한 알림
           </h3>
           <p className="text-[11px] text-nu-pink/80 leading-relaxed font-medium">
             보상금 배분율은 프로젝트 리드(PM)가 멤버들의 기여도를 평가하여 결정합니다.
             최종 지급은 플랫폼 관리자의 검토를 거쳐 실행되며, 기한 내 산출물 미등록 시 보상이 제한될 수 있습니다.
           </p>
        </div>
      </div>
    </div>
  );
}
