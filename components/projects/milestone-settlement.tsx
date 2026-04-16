"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DollarSign,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  TrendingUp,
  Zap,
  Loader2,
} from "lucide-react";

interface MilestoneData {
  id: string;
  title: string;
  status: string;
  sort_order: number;
  reward_percentage?: number;
  tasks?: { id: string; status: string }[];
}

interface MemberData {
  user_id: string;
  role: string;
  reward_ratio?: number;
  profile?: { id: string; nickname: string; avatar_url: string | null };
}

export function MilestoneSettlement({
  projectId,
  userId,
}: {
  projectId: string;
  userId?: string;
}) {
  const [milestones, setMilestones] = useState<MilestoneData[]>([]);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      // Try full query first, fall back to simpler query if columns don't exist
      let msData: any[] | null = null;
      const fullMsQuery = await supabase
        .from("project_milestones")
        .select("id, title, status, sort_order, reward_percentage, tasks:project_tasks(id, status)")
        .eq("project_id", projectId)
        .order("sort_order");
      if (fullMsQuery.error) {
        // Fallback: without reward_percentage or tasks join
        const fallback = await supabase
          .from("project_milestones")
          .select("id, title, status, sort_order")
          .eq("project_id", projectId)
          .order("sort_order");
        msData = fallback.data;
      } else {
        msData = fullMsQuery.data;
      }

      // Members — try with profile join, fallback to basic
      let memData: any[] = [];
      const memRes = await supabase
        .from("project_members")
        .select("user_id, role, reward_ratio, profile:profiles!project_members_user_id_fkey(id, nickname, avatar_url)")
        .eq("project_id", projectId)
        .not("user_id", "is", null);
      if (!memRes.error && memRes.data) {
        memData = memRes.data;
      } else {
        const { data: basicMem } = await supabase.from("project_members").select("user_id, role").eq("project_id", projectId).not("user_id", "is", null);
        memData = (basicMem || []).map((m: any) => ({ ...m, reward_ratio: 0, profile: { id: m.user_id, nickname: "멤버" } }));
      }

      const { data: projData } = await supabase
        .from("projects")
        .select("total_budget")
        .eq("id", projectId)
        .single();

      setMilestones(msData || []);
      // Supabase FK join may return profile as array or object — normalize
      const normalized = memData.map((m: any) => ({
        ...m,
        profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
      }));
      setMembers(normalized);
      setTotalBudget(projData?.total_budget ? Number(projData.total_budget) : 0);
      setLoading(false);
    }
    fetchData();
  }, [projectId]);

  if (loading) {
    return (
      <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-nu-pink" />
      </div>
    );
  }

  // ── Milestone calculations ──
  const getMsStatus = (ms: MilestoneData): "completed" | "active" | "locked" => {
    if (ms.status === "completed") return "completed";
    const tasks = ms.tasks || [];
    if (tasks.length === 0) {
      // If it's the first pending milestone, it's active
      const pendingMs = milestones.filter((m) => m.status !== "completed");
      if (pendingMs.length > 0 && pendingMs[0].id === ms.id) return "active";
      return "locked";
    }
    const hasDone = tasks.some((t) => t.status === "done");
    const hasInProgress = tasks.some((t) => t.status === "in_progress");
    if (hasDone || hasInProgress) return "active";
    const pendingMs = milestones.filter((m) => m.status !== "completed");
    if (pendingMs.length > 0 && pendingMs[0].id === ms.id) return "active";
    return "locked";
  };

  const getMsProgress = (ms: MilestoneData): number => {
    const tasks = ms.tasks || [];
    if (tasks.length === 0) return ms.status === "completed" ? 100 : 0;
    const done = tasks.filter((t) => t.status === "done").length;
    return Math.round((done / tasks.length) * 100);
  };

  // Budget per milestone based on reward_percentage or equal split
  const getMsBudget = (ms: MilestoneData): number => {
    if (!totalBudget) return 0;
    const pct = ms.reward_percentage || (milestones.length > 0 ? 100 / milestones.length : 0);
    return Math.round(totalBudget * (pct / 100));
  };

  const enrichedMilestones = milestones.map((ms, idx) => ({
    ...ms,
    displayStatus: getMsStatus(ms),
    progress: getMsProgress(ms),
    reward: getMsBudget(ms),
    phase: `Phase ${idx + 1}`,
  }));

  const earnedReward = enrichedMilestones
    .filter((m) => m.displayStatus === "completed")
    .reduce((s, m) => s + m.reward, 0);

  const activeMilestone = enrichedMilestones.find((m) => m.displayStatus === "active");

  // ── Member shares ──
  const totalRatio = members.reduce((s, m) => s + (m.reward_ratio || 0), 0);
  const memberShares = members
    .filter((m) => m.profile)
    .map((m) => {
      const share = totalRatio > 0
        ? Math.round(((m.reward_ratio || 0) / totalRatio) * 100)
        : members.length > 0
        ? Math.round(100 / members.length)
        : 0;
      return {
        userId: m.user_id,
        name: m.profile!.nickname || "멤버",
        avatar: m.profile!.avatar_url,
        share,
        role: m.role,
        isMe: m.user_id === userId,
      };
    })
    .sort((a, b) => b.share - a.share);

  const myShare = memberShares.find((m) => m.isMe);
  const mySharePct = myShare?.share || 0;

  if (milestones.length === 0 && members.length === 0) {
    return (
      <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-8 text-center">
        <DollarSign size={28} className="mx-auto text-nu-muted/30 mb-2" />
        <p className="text-sm text-nu-muted">아직 마일스톤이나 멤버가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-nu-ink via-nu-ink to-nu-ink/95 text-nu-paper px-6 py-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-nu-pink/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-nu-pink" />
            <span className="font-mono-nu text-[11px] font-black uppercase tracking-[0.25em] text-nu-pink">
              Settlement_Dashboard
            </span>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <p className="font-head text-3xl font-extrabold">
                {earnedReward.toLocaleString()}원
              </p>
              <p className="text-[13px] text-nu-paper/60 mt-0.5">
                확정 수익 / 총 {totalBudget.toLocaleString()}원
              </p>
            </div>
            {myShare && (
              <div className="ml-auto text-right">
                <p className="font-head text-xl font-bold text-nu-pink">
                  {mySharePct}%
                </p>
                <p className="font-mono-nu text-[11px] text-nu-paper/50 uppercase tracking-widest">
                  My Share
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Milestone Timeline */}
      {enrichedMilestones.length > 0 && (
        <div className="px-6 py-5">
          <h4 className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-muted mb-4 flex items-center gap-2">
            <Clock size={12} /> 마일스톤 로드맵
          </h4>
          <div className="space-y-0">
            {enrichedMilestones.map((ms, idx) => {
              const isLast = idx === enrichedMilestones.length - 1;
              return (
                <div key={ms.id} className="flex gap-4">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                        ms.displayStatus === "completed"
                          ? "bg-nu-pink border-nu-pink text-white"
                          : ms.displayStatus === "active"
                          ? "bg-nu-amber/10 border-nu-amber text-nu-amber animate-pulse"
                          : "bg-nu-ink/5 border-nu-ink/10 text-nu-muted"
                      }`}
                    >
                      {ms.displayStatus === "completed" ? (
                        <CheckCircle2 size={14} />
                      ) : ms.displayStatus === "active" ? (
                        <Zap size={14} />
                      ) : (
                        <Lock size={12} />
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className={`w-0.5 h-12 ${
                          ms.displayStatus === "completed"
                            ? "bg-nu-pink"
                            : "bg-nu-ink/10"
                        }`}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-muted">
                        {ms.phase}
                      </span>
                      {ms.displayStatus === "active" && (
                        <span className="font-mono-nu text-[9px] font-bold uppercase px-1.5 py-0.5 bg-nu-amber/10 text-nu-amber border border-nu-amber/20">
                          IN PROGRESS
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm font-bold ${
                        ms.displayStatus === "locked"
                          ? "text-nu-muted"
                          : "text-nu-ink"
                      }`}
                    >
                      {ms.title}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className={`font-mono-nu text-[12px] font-bold ${
                          ms.displayStatus === "completed"
                            ? "text-nu-pink"
                            : "text-nu-muted"
                        }`}
                      >
                        {ms.displayStatus === "completed" && (
                          <Unlock size={10} className="inline mr-1" />
                        )}
                        {ms.reward.toLocaleString()}원
                      </span>
                      {ms.displayStatus === "active" && (
                        <div className="flex-1 max-w-[120px] h-1.5 bg-nu-ink/5 overflow-hidden">
                          <div
                            className="h-full bg-nu-amber transition-all duration-1000"
                            style={{ width: `${ms.progress}%` }}
                          />
                        </div>
                      )}
                      {ms.displayStatus === "active" && (
                        <span className="font-mono-nu text-[11px] text-nu-amber font-bold">
                          {ms.progress}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contributor Shares */}
      {memberShares.length > 0 && (
        <div className="px-6 py-5 border-t border-nu-ink/5 bg-nu-cream/10">
          <h4 className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-muted mb-4 flex items-center gap-2">
            <TrendingUp size={12} /> 기여도 기반 배분율
          </h4>
          <div className="space-y-3">
            {memberShares.map((c) => (
              <div key={c.userId} className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-head text-xs font-bold overflow-hidden ${
                    c.isMe
                      ? "bg-nu-pink text-white"
                      : "bg-nu-ink/5 text-nu-muted"
                  }`}
                >
                  {c.avatar ? (
                    <img
                      src={c.avatar}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    c.name.charAt(0)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-bold text-nu-ink truncate">
                      {c.name}
                    </span>
                    {c.isMe && (
                      <span className="font-mono-nu text-[9px] bg-nu-pink text-white px-1 py-0.5 font-bold">
                        ME
                      </span>
                    )}
                    {c.role === "lead" && (
                      <span className="font-mono-nu text-[9px] bg-nu-blue/10 text-nu-blue px-1 py-0.5 font-bold border border-nu-blue/20">
                        LEAD
                      </span>
                    )}
                    <span className="ml-auto font-mono-nu text-[11px] font-bold text-nu-ink">
                      {c.share}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-nu-ink/5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-700 ${
                        c.isMe ? "bg-nu-pink" : "bg-nu-blue/40"
                      }`}
                      style={{ width: `${c.share}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {myShare && activeMilestone && (
            <div className="mt-4 p-3 bg-nu-ink/[0.03] border border-nu-ink/5">
              <p className="font-mono-nu text-[11px] text-nu-muted text-center">
                현재 기여도 기준 나의 예상 수익:{" "}
                <span className="font-bold text-nu-pink text-[13px]">
                  {Math.round(
                    activeMilestone.reward * (mySharePct / 100)
                  ).toLocaleString()}
                  원
                </span>
                <span className="block mt-0.5">
                  배분율은 자금·보상 탭에서 조정할 수 있습니다
                </span>
              </p>
            </div>
          )}

          {!myShare && totalRatio === 0 && (
            <div className="mt-4 p-3 bg-nu-ink/[0.03] border border-nu-ink/5">
              <p className="font-mono-nu text-[11px] text-nu-muted text-center">
                아직 배분율이 설정되지 않았습니다. 자금·보상 탭에서 설정해주세요
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
