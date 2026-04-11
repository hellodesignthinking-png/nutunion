"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Users, ChevronRight, Sparkles } from "lucide-react";

const CAT_COLORS: Record<string, string> = {
  space: "bg-nu-blue", culture: "bg-nu-amber", platform: "bg-nu-ink", vibe: "bg-nu-pink",
};
const CAT_LABELS: Record<string, string> = {
  space: "공간", culture: "문화", platform: "플랫폼", vibe: "바이브",
};

interface RelatedGroup {
  id: string;
  name: string;
  category: string;
  description: string | null;
  memberCount: number;
  matchScore: number;
}

export function RelatedGroups({ groupId, category }: { groupId: string; category: string }) {
  const [groups, setGroups] = useState<RelatedGroup[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Fetch all groups with their member IDs (excluding current)
      const { data: allGroups } = await supabase
        .from("groups")
        .select("id, name, category, description, group_members(user_id), crew_posts(id), meetings(id)")
        .eq("is_active", true)
        .neq("id", groupId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!allGroups) return;

      // Get current group's member IDs for shared member calculation
      const { data: currentGroupMembers } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);

      const currentGroupMemberIds = new Set(
        currentGroupMembers?.map((m: any) => m.user_id) || []
      );

      // Score each group based on multiple factors
      const scored = allGroups.map((g: any) => {
        let matchScore = 0;

        // Factor 1: Same category (+40 points)
        if (g.category === category) {
          matchScore += 40;
        }

        // Factor 2: Shared members (+20 points per shared member, max 40)
        const groupMemberIds = new Set(
          g.group_members?.map((m: any) => m.user_id) || []
        );
        let sharedMemberCount = 0;
        for (const memberId of currentGroupMemberIds) {
          if (groupMemberIds.has(memberId)) {
            sharedMemberCount++;
          }
        }
        const sharedMemberScore = Math.min(sharedMemberCount * 20, 40);
        matchScore += sharedMemberScore;

        // Factor 3: Activity level (0-20 points)
        // Normalize meetings + posts count
        const activityCount = (g.meetings?.length || 0) + (g.crew_posts?.length || 0);
        // Simple normalization: assume max 50 activities for full points
        const activityScore = Math.min((activityCount / 50) * 20, 20);
        matchScore += activityScore;

        return {
          id: g.id,
          name: g.name,
          category: g.category,
          description: g.description,
          memberCount: g.group_members?.length || 0,
          matchScore,
        };
      });

      scored.sort((a: RelatedGroup, b: RelatedGroup) => b.matchScore - a.matchScore);
      setGroups(scored.slice(0, 3));
    }
    load();
  }, [groupId, category]);

  if (groups.length === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-8 pb-16">
      <div className="border-t-[2px] border-nu-ink/[0.06] pt-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-nu-ink text-nu-paper flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="font-head text-lg font-extrabold text-nu-ink">추천 소모임</h2>
            <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
              Similar communities you might like
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="group bg-nu-white border-[2px] border-nu-ink/[0.08] p-5 no-underline hover:border-nu-pink/40 transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`font-mono-nu text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 text-white ${CAT_COLORS[g.category] || "bg-nu-gray"}`}>
                  {CAT_LABELS[g.category] || g.category}
                </span>
                <span className="ml-auto font-mono-nu text-[9px] text-nu-pink font-bold">
                  {Math.round(g.matchScore)}% match
                </span>
              </div>
              <h3 className="font-head text-sm font-bold text-nu-ink mb-1 group-hover:text-nu-pink transition-colors">
                {g.name}
              </h3>
              {g.description && (
                <p className="text-[11px] text-nu-muted line-clamp-2 mb-3">{g.description}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 font-mono-nu text-[9px] text-nu-muted">
                  <Users size={10} /> {g.memberCount}명
                </span>
                <ChevronRight size={14} className="text-nu-muted group-hover:text-nu-pink transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
