"use client";

import { useState } from "react";
import { DollarSign, Lock, Unlock, CheckCircle2, Clock, TrendingUp, Award, Zap } from "lucide-react";

interface Milestone {
  id: string;
  phase: string;
  label: string;
  reward: number;
  status: "locked" | "active" | "completed";
  progress: number;
}

interface ContributorShare {
  name: string;
  share: number;
  score: number;
  trend: "up" | "same" | "down";
}

export function MilestoneSettlement({ projectTitle }: { projectTitle: string }) {
  const [milestones] = useState<Milestone[]>([
    { id: "1", phase: "Phase 1", label: "기획 & 리서치", reward: 500000, status: "completed", progress: 100 },
    { id: "2", phase: "Phase 2", label: "프로토타입 개발", reward: 800000, status: "active", progress: 65 },
    { id: "3", phase: "Phase 3", label: "베타 런칭 & QA", reward: 700000, status: "locked", progress: 0 },
    { id: "4", phase: "Phase 4", label: "정식 런칭 & 홍보", reward: 1000000, status: "locked", progress: 0 },
  ]);

  const [contributors] = useState<ContributorShare[]>([
    { name: "홍길동", share: 35, score: 92, trend: "up" },
    { name: "이영희", share: 28, score: 78, trend: "up" },
    { name: "김철수", share: 22, score: 65, trend: "same" },
    { name: "박지민", share: 15, score: 54, trend: "down" },
  ]);

  const totalReward = milestones.reduce((s, m) => s + m.reward, 0);
  const earnedReward = milestones.filter(m => m.status === "completed").reduce((s, m) => s + m.reward, 0);
  const activeReward = milestones.find(m => m.status === "active");
  const myShare = contributors[0]; // Simulating current user as first contributor

  return (
    <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-nu-ink via-nu-ink to-nu-ink/95 text-nu-paper px-6 py-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-nu-pink/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-nu-pink" />
            <span className="font-mono-nu text-[9px] font-black uppercase tracking-[0.25em] text-nu-pink">
              Settlement_Dashboard
            </span>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <p className="font-head text-3xl font-extrabold">{(earnedReward).toLocaleString()}원</p>
              <p className="text-[11px] text-nu-paper/60 mt-0.5">확정 수익 / 총 {totalReward.toLocaleString()}원</p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-head text-xl font-bold text-nu-pink">{myShare.share}%</p>
              <p className="font-mono-nu text-[9px] text-nu-paper/50 uppercase tracking-widest">My Share</p>
            </div>
          </div>
        </div>
      </div>

      {/* Milestone Timeline */}
      <div className="px-6 py-5">
        <h4 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-muted mb-4 flex items-center gap-2">
          <Clock size={12} /> 마일스톤 로드맵
        </h4>
        <div className="space-y-0">
          {milestones.map((ms, idx) => {
            const isLast = idx === milestones.length - 1;
            return (
              <div key={ms.id} className="flex gap-4">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                    ms.status === "completed" ? "bg-nu-pink border-nu-pink text-white" :
                    ms.status === "active" ? "bg-nu-amber/10 border-nu-amber text-nu-amber animate-pulse" :
                    "bg-nu-ink/5 border-nu-ink/10 text-nu-muted"
                  }`}>
                    {ms.status === "completed" ? <CheckCircle2 size={14} /> :
                     ms.status === "active" ? <Zap size={14} /> :
                     <Lock size={12} />}
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 h-12 ${ms.status === "completed" ? "bg-nu-pink" : "bg-nu-ink/10"}`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono-nu text-[8px] font-bold uppercase tracking-widest text-nu-muted">{ms.phase}</span>
                    {ms.status === "active" && (
                      <span className="font-mono-nu text-[7px] font-bold uppercase px-1.5 py-0.5 bg-nu-amber/10 text-nu-amber border border-nu-amber/20">
                        IN PROGRESS
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-bold ${ms.status === "locked" ? "text-nu-muted" : "text-nu-ink"}`}>
                    {ms.label}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`font-mono-nu text-[10px] font-bold ${ms.status === "completed" ? "text-nu-pink" : "text-nu-muted"}`}>
                      {ms.status === "completed" ? <Unlock size={10} className="inline mr-1" /> : ""}
                      {ms.reward.toLocaleString()}원
                    </span>
                    {ms.status === "active" && (
                      <div className="flex-1 max-w-[120px] h-1.5 bg-nu-ink/5 overflow-hidden">
                        <div className="h-full bg-nu-amber transition-all duration-1000" style={{ width: `${ms.progress}%` }} />
                      </div>
                    )}
                    {ms.status === "active" && (
                      <span className="font-mono-nu text-[9px] text-nu-amber font-bold">{ms.progress}%</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Contributor Shares */}
      <div className="px-6 py-5 border-t border-nu-ink/5 bg-nu-cream/10">
        <h4 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-muted mb-4 flex items-center gap-2">
          <TrendingUp size={12} /> 기여도 기반 실시간 배분율
        </h4>
        <div className="space-y-3">
          {contributors.map((c, idx) => (
            <div key={c.name} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-head text-xs font-bold ${
                idx === 0 ? "bg-nu-pink text-white" : "bg-nu-ink/5 text-nu-muted"
              }`}>
                {c.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-nu-ink truncate">{c.name}</span>
                  {idx === 0 && <span className="font-mono-nu text-[7px] bg-nu-pink text-white px-1 py-0.5 font-bold">ME</span>}
                  <span className={`ml-auto font-mono-nu text-[9px] font-bold ${
                    c.trend === "up" ? "text-green-600" : c.trend === "down" ? "text-red-500" : "text-nu-muted"
                  }`}>
                    {c.trend === "up" ? "▲" : c.trend === "down" ? "▼" : "—"} {c.share}%
                  </span>
                </div>
                <div className="h-1.5 bg-nu-ink/5 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-700 ${idx === 0 ? "bg-nu-pink" : "bg-nu-blue/40"}`}
                    style={{ width: `${c.share}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-nu-ink/[0.03] border border-nu-ink/5">
          <p className="font-mono-nu text-[9px] text-nu-muted text-center">
            현재 기여도 기준 나의 예상 수익: <span className="font-bold text-nu-pink text-[11px]">{Math.round(activeReward ? activeReward.reward * (myShare.share / 100) : 0).toLocaleString()}원</span>
            <span className="block mt-0.5">활동 점수 {myShare.score}점 · 배분율은 매일 자정 활동 데이터 기반으로 재계산됩니다</span>
          </p>
        </div>
      </div>
    </div>
  );
}
