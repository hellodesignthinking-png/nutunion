"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Trophy, Crown, Flame, Star, Brain, TrendingUp,
  Award, Medal, Target, Sparkles, Users, GitBranch
} from "lucide-react";

interface ContributorData {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  totalEdits: number;
  totalPages: number;
  streak: number;
  level: number;
  xp: number;
  badges: string[];
  dailyContribs: number[]; // last 28 days
}

const LEVELS = [
  { name: "Learner", min: 0, icon: "🌱", color: "text-green-500" },
  { name: "Contributor", min: 50, icon: "📝", color: "text-nu-blue" },
  { name: "Architect", min: 150, icon: "🏗️", color: "text-nu-amber" },
  { name: "Scholar", min: 350, icon: "🎓", color: "text-purple-500" },
  { name: "Sage", min: 700, icon: "🧠", color: "text-nu-pink" },
  { name: "Oracle", min: 1200, icon: "👁️", color: "text-red-500" },
];

const BADGE_DEFS: Record<string, { label: string; icon: string; description: string }> = {
  first_page:    { label: "First Page", icon: "📄", description: "첫 번째 탭 페이지 작성" },
  ten_edits:     { label: "Editor", icon: "✏️", description: "10개 이상의 편집" },
  streak_7:      { label: "7-Day Streak", icon: "🔥", description: "7일 연속 기여" },
  cross_topic:   { label: "Bridge Builder", icon: "🌉", description: "3개 이상 주제에 기여" },
  popular_page:  { label: "Popular", icon: "⭐", description: "인기 페이지 작성자" },
  link_master:   { label: "Connector", icon: "🔗", description: "10개 이상의 지식 연결 생성" },
};

function getLevel(xp: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.min) current = l;
  }
  return current;
}

function getNextLevel(xp: number) {
  for (const l of LEVELS) {
    if (xp < l.min) return l;
  }
  return null;
}

export function ContributionLeaderboard({ groupId }: { groupId: string }) {
  const [contributors, setContributors] = useState<ContributorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Get members
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id, profile:profiles(id, nickname, avatar_url)")
        .eq("group_id", groupId)
        .eq("status", "active");

      // Get topics for this group
      const { data: topics } = await supabase
        .from("wiki_topics")
        .select("id")
        .eq("group_id", groupId);

      const topicIds = (topics || []).map(t => t.id);

      // Get all contributions with real date data
      let contributions: any[] = [];
      let pages: any[] = [];
      if (topicIds.length > 0) {
        const { data: pagesData } = await supabase
          .from("wiki_pages")
          .select("id, created_by, topic_id")
          .in("topic_id", topicIds);
        pages = pagesData || [];

        const pageIds = pages.map(p => p.id);
        if (pageIds.length > 0) {
          const { data: contribs } = await supabase
            .from("wiki_contributions")
            .select("user_id, page_id, created_at")
            .in("page_id", pageIds);
          contributions = contribs || [];
        }
      }

      // Build contributor data
      const contribMap: Record<string, ContributorData> = {};
      (members || []).forEach((m: any) => {
        const profile = m.profile;
        contribMap[m.user_id] = {
          userId: m.user_id,
          nickname: profile?.nickname || "Unknown",
          avatarUrl: profile?.avatar_url,
          totalEdits: 0,
          totalPages: 0,
          streak: 0,
          level: 0,
          xp: 0,
          badges: [],
          dailyContribs: new Array(28).fill(0),
        };
      });

      // Count pages created by each user
      pages.forEach(p => {
        if (contribMap[p.created_by]) {
          contribMap[p.created_by].totalPages++;
        }
      });

      // Count contributions per user + daily activity
      const now = Date.now();
      const DAY_MS = 86400000;
      const userTopics: Record<string, Set<string>> = {};
      const userDates: Record<string, Set<string>> = {};

      contributions.forEach(c => {
        if (contribMap[c.user_id]) {
          contribMap[c.user_id].totalEdits++;

          // Daily sparkline (last 28 days)
          const daysAgo = Math.floor((now - new Date(c.created_at).getTime()) / DAY_MS);
          if (daysAgo >= 0 && daysAgo < 28) {
            contribMap[c.user_id].dailyContribs[27 - daysAgo]++;
          }

          // Track topics per user for cross_topic badge
          const page = pages.find(p => p.id === c.page_id);
          if (page) {
            if (!userTopics[c.user_id]) userTopics[c.user_id] = new Set();
            userTopics[c.user_id].add(page.topic_id);
          }

          // Track dates for streak calculation
          if (!userDates[c.user_id]) userDates[c.user_id] = new Set();
          userDates[c.user_id].add(new Date(c.created_at).toISOString().slice(0, 10));
        }
      });

      // Calculate real streaks, XP, and badges
      Object.values(contribMap).forEach(c => {
        c.xp = c.totalEdits * 10 + c.totalPages * 25;
        // Find the highest level whose min XP the user has reached
        let levelIdx = 0;
        for (let i = LEVELS.length - 1; i >= 0; i--) {
          if (c.xp >= LEVELS[i].min) { levelIdx = i; break; }
        }
        c.level = levelIdx;

        // Real streak calculation
        const dates = Array.from(userDates[c.userId] || []).sort().reverse();
        let streak = 0;
        const today = new Date().toISOString().slice(0, 10);
        let checkDate = today;
        for (let i = 0; i < 60; i++) {
          if (dates.includes(checkDate)) {
            streak++;
            const d = new Date(checkDate);
            d.setDate(d.getDate() - 1);
            checkDate = d.toISOString().slice(0, 10);
          } else if (i === 0) {
            // Allow today to be missing (not yet contributed today)
            const d = new Date(checkDate);
            d.setDate(d.getDate() - 1);
            checkDate = d.toISOString().slice(0, 10);
          } else {
            break;
          }
        }
        c.streak = streak;

        // Award badges based on real data
        if (c.totalPages >= 1) c.badges.push("first_page");
        if (c.totalEdits >= 10) c.badges.push("ten_edits");
        if (c.streak >= 7) c.badges.push("streak_7");
        const topicCount = userTopics[c.userId]?.size || 0;
        if (topicCount >= 3) c.badges.push("cross_topic");
        if (c.totalEdits >= 20) c.badges.push("popular_page");
      });

      const sorted = Object.values(contribMap).sort((a, b) => b.xp - a.xp);
      setContributors(sorted);
      setLoading(false);
    }
    load();
  }, [groupId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="h-20 bg-nu-ink/[0.03] animate-pulse border-[2px] border-nu-ink/[0.08]" />
        ))}
      </div>
    );
  }

  const topThree = contributors.slice(0, 3);
  const rest = contributors.slice(3);

  return (
    <div className="space-y-8">
      {/* Podium */}
      <div className="bg-gradient-to-br from-nu-ink via-nu-ink to-nu-graphite text-white p-8 border-[2px] border-nu-ink">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-head text-xl font-extrabold flex items-center gap-3">
            <Trophy size={22} className="text-yellow-400" /> Knowledge Champions
          </h3>
          <span className="font-mono-nu text-[9px] text-white/40 uppercase tracking-widest">
            Season {new Date().getFullYear()}.Q{Math.ceil((new Date().getMonth() + 1) / 3)}
          </span>
        </div>

        <div className="flex items-end justify-center gap-4 min-h-[200px]">
          {/* 2nd place */}
          {topThree[1] && (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center font-head text-lg font-bold mb-2 overflow-hidden">
                {topThree[1].avatarUrl ? (
                  <img src={topThree[1].avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : topThree[1].nickname.charAt(0)}
              </div>
              <span className="text-xs font-bold mb-1">{topThree[1].nickname}</span>
              <div className="w-20 bg-white/10 border-t-2 border-white/20 flex flex-col items-center pt-3 pb-2" style={{ height: 80 }}>
                <Medal size={16} className="text-gray-300" />
                <span className="font-mono-nu text-[10px] text-white/60 mt-1">{topThree[1].xp} XP</span>
              </div>
            </div>
          )}

          {/* 1st place */}
          {topThree[0] && (
            <div className="flex flex-col items-center -mt-4">
              <Crown size={20} className="text-yellow-400 mb-1 animate-bounce" />
              <div className="w-16 h-16 rounded-full bg-yellow-400/20 border-2 border-yellow-400 flex items-center justify-center font-head text-xl font-bold mb-2 shadow-lg shadow-yellow-400/20 overflow-hidden">
                {topThree[0].avatarUrl ? (
                  <img src={topThree[0].avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : topThree[0].nickname.charAt(0)}
              </div>
              <span className="text-sm font-bold mb-1">{topThree[0].nickname}</span>
              <div className="w-24 bg-yellow-400/10 border-t-2 border-yellow-400/40 flex flex-col items-center pt-3 pb-2" style={{ height: 110 }}>
                <Trophy size={18} className="text-yellow-400" />
                <span className="font-mono-nu text-xs text-yellow-400 font-bold mt-1">{topThree[0].xp} XP</span>
                <span className="font-mono-nu text-[8px] text-white/40 mt-0.5">
                  {getLevel(topThree[0].xp).icon} {getLevel(topThree[0].xp).name}
                </span>
              </div>
            </div>
          )}

          {/* 3rd place */}
          {topThree[2] && (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center font-head text-base font-bold mb-2 overflow-hidden">
                {topThree[2].avatarUrl ? (
                  <img src={topThree[2].avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : topThree[2].nickname.charAt(0)}
              </div>
              <span className="text-xs font-bold mb-1">{topThree[2].nickname}</span>
              <div className="w-20 bg-white/10 border-t-2 border-white/15 flex flex-col items-center pt-3 pb-2" style={{ height: 60 }}>
                <Award size={14} className="text-amber-600" />
                <span className="font-mono-nu text-[10px] text-white/60 mt-1">{topThree[2].xp} XP</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed list */}
      <div className="space-y-2">
        {contributors.map((c, i) => {
          const level = getLevel(c.xp);
          const nextLvl = getNextLevel(c.xp);
          const progress = nextLvl ? ((c.xp - LEVELS[LEVELS.indexOf(level)].min) / (nextLvl.min - LEVELS[LEVELS.indexOf(level)].min)) * 100 : 100;
          const isExpanded = selectedMember === c.userId;

          return (
            <div key={c.userId}>
              <button
                onClick={() => setSelectedMember(isExpanded ? null : c.userId)}
                className="w-full text-left bg-white border-[2px] border-nu-ink/[0.08] hover:border-nu-pink/40 transition-all p-4 group"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono-nu text-[10px] text-nu-muted w-6 text-right font-bold">
                    {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
                  </span>

                  <div className="w-10 h-10 rounded-full bg-nu-cream border border-nu-ink/10 flex items-center justify-center font-head text-sm font-bold text-nu-ink group-hover:border-nu-pink transition-colors overflow-hidden">
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : c.nickname.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-head text-sm font-bold text-nu-ink">{c.nickname}</span>
                      <span className={`font-mono-nu text-[8px] font-bold uppercase tracking-widest ${level.color}`}>
                        {level.icon} {level.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono-nu text-[9px] text-nu-muted">
                      <span>{c.totalEdits} edits</span>
                      <span>•</span>
                      <span>{c.xp} XP</span>
                      {c.streak > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-orange-500 flex items-center gap-0.5">
                            <Flame size={10} /> {c.streak}d streak
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* XP Progress Bar */}
                  <div className="w-24 hidden md:block">
                    <div className="h-1.5 bg-nu-ink/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-nu-pink to-nu-blue rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    {nextLvl && (
                      <p className="font-mono-nu text-[7px] text-nu-muted text-right mt-0.5">
                        {nextLvl.min - c.xp} XP to {nextLvl.name}
                      </p>
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded badge detail */}
              {isExpanded && (
                <div className="bg-nu-cream/30 border-x-[2px] border-b-[2px] border-nu-ink/[0.08] p-5 animate-in slide-in-from-top-2">
                  <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-3 flex items-center gap-1">
                    <Award size={12} /> Earned Badges
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {c.badges.length > 0 ? c.badges.map(b => {
                      const def = BADGE_DEFS[b];
                      if (!def) return null;
                      return (
                        <div key={b} className="flex items-center gap-2 bg-white border border-nu-ink/10 px-3 py-2 group/badge">
                          <span className="text-lg">{def.icon}</span>
                          <div>
                            <p className="font-head text-[10px] font-bold text-nu-ink">{def.label}</p>
                            <p className="font-mono-nu text-[7px] text-nu-muted">{def.description}</p>
                          </div>
                        </div>
                      );
                    }) : (
                      <p className="text-xs text-nu-muted italic">아직 획득한 배지가 없습니다. 탭에 기여하면 배지를 얻을 수 있어요!</p>
                    )}
                  </div>

                  {/* Contribution sparkline */}
                  <div className="mt-4 pt-4 border-t border-nu-ink/5">
                    <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-2 flex items-center gap-1">
                      <TrendingUp size={12} /> 최근 4주 기여 추세
                    </p>
                    <div className="flex items-end gap-1 h-12">
                      {c.dailyContribs.map((count, day) => {
                        const maxC = Math.max(...c.dailyContribs, 1);
                        const h = (count / maxC) * 100;
                        return (
                          <div
                            key={day}
                            className={`flex-1 rounded-t-sm transition-colors ${count > 0 ? "bg-nu-pink/40 hover:bg-nu-pink" : "bg-nu-ink/[0.04]"}`}
                            style={{ height: `${Math.max(h, 4)}%` }}
                            title={`${28 - day}일 전: ${count}건`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
