"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Brain, Sparkles, TrendingUp, Award, Star, Zap, ChevronDown, ChevronUp, Users } from "lucide-react";

interface MemberData {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  role: string;
  interests: string[];
  strengths: string[];
  contributionCount: number;
  knowledgeAreas: string[];
  level: { name: string; icon: string; color: string };
  xpPercent: number;
}

const LEVELS = [
  { name: "Learner", icon: "🌱", color: "text-green-500", min: 0 },
  { name: "Contributor", icon: "📝", color: "text-nu-blue", min: 5 },
  { name: "Architect", icon: "🏗️", color: "text-nu-amber", min: 15 },
  { name: "Scholar", icon: "🎓", color: "text-purple-500", min: 30 },
  { name: "Sage", icon: "🧠", color: "text-nu-pink", min: 60 },
];

function getLevelForContributions(count: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (count >= l.min) current = l;
  }
  return current;
}

export function HumanCapitalVisual({ groupId }: { groupId: string }) {
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: membersRaw } = await supabase
        .from("group_members")
        .select(`
          user_id,
          role,
          profile:profiles(
            id, nickname, avatar_url, interests, strengths
          )
        `)
        .eq("group_id", groupId)
        .eq("status", "active")
        .limit(12);

      // Get topics for this group
      const { data: topics } = await supabase
        .from("wiki_topics")
        .select("id, name")
        .eq("group_id", groupId);

      const topicIds = (topics || []).map(t => t.id);

      // Get pages and contributions
      let contribCounts: Record<string, number> = {};
      let userTopics: Record<string, Set<string>> = {};

      if (topicIds.length > 0) {
        const { data: pages } = await supabase
          .from("wiki_pages")
          .select("id, topic_id")
          .in("topic_id", topicIds);

        const pageIds = (pages || []).map(p => p.id);
        const pageTopicMap: Record<string, string> = {};
        (pages || []).forEach(p => { pageTopicMap[p.id] = p.topic_id; });

        if (pageIds.length > 0) {
          const { data: contributions } = await supabase
            .from("wiki_contributions")
            .select("user_id, page_id")
            .in("page_id", pageIds);

          (contributions || []).forEach(c => {
            contribCounts[c.user_id] = (contribCounts[c.user_id] || 0) + 1;
            if (!userTopics[c.user_id]) userTopics[c.user_id] = new Set();
            const topicId = pageTopicMap[c.page_id];
            if (topicId) {
              const topicName = (topics || []).find(t => t.id === topicId)?.name;
              if (topicName) userTopics[c.user_id].add(topicName);
            }
          });
        }
      }

      const processed: MemberData[] = (membersRaw || []).map((m: any) => {
        const profile = m.profile;
        const count = contribCounts[m.user_id] || 0;
        const level = getLevelForContributions(count);
        const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
        const xpPercent = nextLevel
          ? ((count - level.min) / (nextLevel.min - level.min)) * 100
          : 100;

        return {
          userId: m.user_id,
          nickname: profile?.nickname || "Unknown",
          avatarUrl: profile?.avatar_url,
          role: m.role,
          interests: profile?.interests || [],
          strengths: profile?.strengths || [],
          contributionCount: count,
          knowledgeAreas: Array.from(userTopics[m.user_id] || []),
          level,
          xpPercent: Math.min(xpPercent, 100),
        };
      });

      // Sort by contribution count
      processed.sort((a, b) => b.contributionCount - a.contributionCount);
      setMembers(processed);
      setLoading(false);
    }
    load();
  }, [groupId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-nu-ink/[0.03] animate-pulse border-[2px] border-nu-ink/[0.08]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((m) => {
        const isExpanded = expandedId === m.userId;
        const initials = m.nickname.charAt(0).toUpperCase();

        return (
          <div key={m.userId} className="group">
            <button
              onClick={() => setExpandedId(isExpanded ? null : m.userId)}
              className="w-full text-left bg-white border-[2px] border-nu-ink/[0.08] hover:border-nu-pink/40 transition-all p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-nu-cream flex items-center justify-center font-head text-sm font-bold text-nu-ink border border-nu-ink/10 group-hover:border-nu-pink transition-colors shrink-0 overflow-hidden">
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-head text-sm font-bold text-nu-ink">{m.nickname}</span>
                    <span className={`font-mono-nu text-[7px] font-bold uppercase tracking-widest ${m.level.color}`}>
                      {m.level.icon} {m.level.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono-nu text-[8px] text-nu-muted">{m.contributionCount} contributions</span>
                    {m.knowledgeAreas.length > 0 && (
                      <span className="font-mono-nu text-[7px] text-nu-pink/60">
                        · {m.knowledgeAreas.slice(0, 2).join(", ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Mini progress bar */}
                <div className="w-12 shrink-0">
                  <div className="h-1 bg-nu-ink/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-nu-pink rounded-full transition-all duration-700"
                      style={{ width: `${m.xpPercent}%` }}
                    />
                  </div>
                </div>

                {isExpanded ? <ChevronUp size={14} className="text-nu-muted" /> : <ChevronDown size={14} className="text-nu-muted" />}
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="bg-nu-cream/30 border-x-[2px] border-b-[2px] border-nu-ink/[0.08] p-4 animate-in slide-in-from-top-1 space-y-3">
                {/* Knowledge Areas */}
                {m.knowledgeAreas.length > 0 && (
                  <div>
                    <p className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <Brain size={10} /> 기여 영역
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {m.knowledgeAreas.map((area, i) => (
                        <span key={i} className="font-mono-nu text-[8px] px-2 py-0.5 bg-nu-pink/10 text-nu-pink border border-nu-pink/15">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interests & Strengths */}
                {(m.interests.length > 0 || m.strengths.length > 0) && (
                  <div>
                    <p className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <Star size={10} /> 관심사 & 역량
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {m.interests.map((interest, i) => (
                        <span key={`i-${i}`} className="font-mono-nu text-[7px] px-1.5 py-0.5 bg-nu-ink/5 text-nu-muted border border-nu-ink/5">
                          {interest}
                        </span>
                      ))}
                      {m.strengths.map((strength, i) => (
                        <span key={`s-${i}`} className="font-mono-nu text-[7px] px-1.5 py-0.5 bg-nu-blue/10 text-nu-blue border border-nu-blue/10">
                          {strength}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress visualization */}
                <div className="pt-2 border-t border-nu-ink/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp size={10} /> Level Progress
                    </span>
                    <span className={`font-mono-nu text-[8px] font-bold ${m.level.color}`}>
                      {m.level.icon} {m.level.name}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-nu-ink/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-nu-pink to-nu-blue rounded-full transition-all duration-1000"
                      style={{ width: `${m.xpPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {members.length === 0 && (
        <div className="border-[2px] border-dashed border-nu-ink/15 p-8 text-center">
          <Users size={28} className="mx-auto mb-3 text-nu-ink/10" />
          <p className="text-sm text-nu-muted font-medium mb-1">멤버 데이터가 없습니다</p>
          <p className="text-xs text-nu-muted/60">위키에 기여하면 여기에 표시됩니다</p>
        </div>
      )}
    </div>
  );
}
