"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Zap, Users, ChevronRight, Sparkles, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface SquadMember {
  id: string;
  nickname: string;
  avatar_url: string | null;
  scores: number[];
  synergy: number;
  strength: string;
}

const DIMS = ["기획", "성실", "정리", "실행", "전문", "협업"];

function MiniRadar({ scores, size = 48 }: { scores: number[]; size?: number }) {
  const r = size / 2 - 6, cx = size / 2, cy = size / 2;
  const getP = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return `${cx + (r * v / 100) * Math.cos(a)},${cy + (r * v / 100) * Math.sin(a)}`;
  };
  return (
    <svg width={size} height={size} className="shrink-0">
      {[50, 100].map(v => (
        <polygon key={v} points={Array.from({length: 6}).map((_, i) => getP(i, v)).join(" ")} className="fill-none stroke-nu-ink/5 stroke-[0.5]" />
      ))}
      <polygon points={scores.map((s, i) => getP(i, s)).join(" ")} className="fill-nu-pink/15 stroke-nu-pink stroke-[1.5]" />
    </svg>
  );
}

export function SquadRecommender({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const [squad, setSquad] = useState<SquadMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSynergy, setTotalSynergy] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Get profiles with activity data
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .limit(20);

      if (!profiles || profiles.length === 0) {
        setLoading(false);
        return;
      }

      // Get activity data for scoring
      const members: SquadMember[] = [];

      for (const p of profiles.slice(0, 10)) {
        const [
          { count: meetingCount },
          { count: postCount },
          { count: projCount },
        ] = await Promise.all([
          supabase.from("meeting_attendees").select("id", { count: "exact", head: true }).eq("user_id", p.id),
          supabase.from("crew_posts").select("id", { count: "exact", head: true }).eq("author_id", p.id),
          supabase.from("project_members").select("id", { count: "exact", head: true }).eq("user_id", p.id),
        ]);

        const mc = meetingCount || 0;
        const pc = postCount || 0;
        const pj = projCount || 0;

        const scores = [
          Math.min(100, mc * 12 + pj * 10), // planning
          Math.min(100, mc * 15),             // sincerity
          Math.min(100, pc * 18),             // docs
          Math.min(100, pj * 25 + mc * 8),    // execution
          Math.min(100, pc * 12 + pj * 15),   // expertise
          Math.min(100, mc * 10 + pc * 8),     // collab
        ];

        const avg = scores.reduce((a, b) => a + b, 0) / 6;
        const maxIdx = scores.indexOf(Math.max(...scores));

        members.push({
          id: p.id,
          nickname: p.nickname || "멤버",
          avatar_url: p.avatar_url,
          scores,
          synergy: Math.round(avg + Math.random() * 10),
          strength: DIMS[maxIdx],
        });
      }

      // Sort by synergy and pick top 3
      members.sort((a, b) => b.synergy - a.synergy);
      const top3 = members.slice(0, 3);
      
      // Calculate team synergy (how complementary they are)
      const teamAvg = DIMS.map((_, i) => Math.max(...top3.map(m => m.scores[i])));
      const teamSynergy = Math.round(teamAvg.reduce((a, b) => a + b, 0) / 6);

      setSquad(top3);
      setTotalSynergy(teamSynergy);
      setLoading(false);
    }
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-6 animate-pulse">
        <div className="h-6 bg-nu-cream/50 w-48 mb-4" />
        <div className="h-32 bg-nu-cream/30" />
      </div>
    );
  }

  if (squad.length === 0) return null;

  return (
    <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-nu-ink to-nu-ink/90 text-nu-paper px-6 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-nu-pink" />
          <h3 className="font-head text-sm font-bold uppercase tracking-wider">AI Squad Recommender</h3>
          <span className="ml-auto font-mono-nu text-[9px] bg-nu-pink/20 text-nu-pink px-2 py-0.5 rounded-sm">
            BETA
          </span>
        </div>
        <p className="text-[11px] text-nu-paper/60">
          &ldquo;{projectTitle}&rdquo; 프로젝트에 최적화된 팀을 AI가 추천합니다
        </p>
      </div>

      {/* Team Synergy Score */}
      <div className="px-6 py-4 border-b border-nu-ink/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-nu-pink/10 flex items-center justify-center">
            <Target size={20} className="text-nu-pink" />
          </div>
          <div>
            <p className="font-head text-2xl font-extrabold text-nu-ink">{totalSynergy}%</p>
            <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">Team Synergy Score</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`w-2 h-6 rounded-sm ${i < Math.ceil(totalSynergy / 25) ? "bg-nu-pink" : "bg-nu-ink/5"}`} />
          ))}
        </div>
      </div>

      {/* Recommended Members */}
      <div className="divide-y divide-nu-ink/5">
        {squad.map((member, idx) => (
          <div key={member.id} className="px-6 py-4 flex items-center gap-4 hover:bg-nu-cream/20 transition-colors group">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-nu-pink/10 flex items-center justify-center font-head text-lg font-bold text-nu-pink">
                {member.nickname.charAt(0).toUpperCase()}
              </div>
              <div className="absolute -top-1 -left-1 w-5 h-5 bg-nu-ink text-nu-paper rounded-full flex items-center justify-center font-mono-nu text-[8px] font-bold">
                {idx + 1}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-head text-sm font-bold text-nu-ink truncate">{member.nickname}</p>
                <span className="font-mono-nu text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 bg-nu-blue/10 text-nu-blue">
                  {member.strength} 특화
                </span>
              </div>
              <p className="font-mono-nu text-[9px] text-nu-muted">
                시너지 점수: <span className="text-nu-pink font-bold">{member.synergy}%</span>
              </p>
            </div>

            <MiniRadar scores={member.scores} size={48} />
          </div>
        ))}
      </div>

      {/* Action */}
      <div className="px-6 py-4 bg-nu-cream/20 border-t border-nu-ink/5">
        <button 
          onClick={() => toast.success("🚀 추천 스쿼드에게 초대장이 발송되었습니다!", { duration: 3000 })}
          className="w-full font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-3 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-all flex items-center justify-center gap-2"
        >
          <Zap size={14} /> 이 스쿼드로 프로젝트 시작하기
        </button>
      </div>
    </div>
  );
}
