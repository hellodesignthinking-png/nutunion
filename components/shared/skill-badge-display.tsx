"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Award, Lock, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { checkAndAwardBadges } from "@/lib/badge-checker";

const CATEGORY_LABELS: Record<string, string> = {
  tool: "도구",
  role: "역할",
  domain: "분야",
  special: "특별",
};

interface SkillBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement_count: number;
  created_at: string;
}

interface UserBadgeWithDetails {
  id: string;
  badge_id: string;
  awarded_at: string;
  endorser_count: number;
  badge: SkillBadge;
  isEarned: true;
}

interface UnearmedBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement_count: number;
  created_at: string;
  endorser_count: number;
  isEarned: false;
}

type BadgeDisplay = UserBadgeWithDetails | UnearmedBadge;

export function SkillBadgeDisplay({
  userId,
  showAll = false,
}: {
  userId: string;
  showAll?: boolean;
}) {
  const [badges, setBadges] = useState<BadgeDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [justAwarded, setJustAwarded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadBadges() {
      const supabase = createClient();
      setLoading(true);

      try {
        // Check and auto-award badges based on user activity
        await checkAndAwardBadges(userId);

        // Load earned badges
        const { data: earnedData, error: earnedError } = await supabase
          .from("user_badges")
          .select(
            `
            id,
            badge_id,
            awarded_at,
            endorser_ids,
            skill_badges!badge_id(
              id,
              name,
              description,
              icon,
              category,
              requirement_count,
              created_at
            )
          `
          )
          .eq("user_id", userId);

        if (earnedError) throw earnedError;

        const earnedBadges: UserBadgeWithDetails[] =
          earnedData && earnedData.length > 0
            ? earnedData.map((item: any) => ({
                id: item.id,
                badge_id: item.badge_id,
                awarded_at: item.awarded_at,
                endorser_count: item.endorser_ids?.length || 0,
                badge: item.skill_badges,
                isEarned: true,
              }))
            : [];

        let allBadges: BadgeDisplay[] = earnedBadges;

        // If showAll, fetch all skill badges and merge
        if (showAll) {
          const { data: allSkillBadges, error: badgesError } = await supabase
            .from("skill_badges")
            .select("*")
            .order("created_at", { ascending: false });

          if (badgesError) throw badgesError;

          const earnedBadgeIds = new Set(earnedBadges.map((b) => b.badge_id));

          const unearned = allSkillBadges
            ? allSkillBadges
                .filter((badge: SkillBadge) => !earnedBadgeIds.has(badge.id))
                .map((badge: SkillBadge) => ({
                  ...badge,
                  endorser_count: 0,
                  isEarned: false,
                }))
            : [];

          allBadges = [...earnedBadges, ...unearned] as BadgeDisplay[];
        }

        setBadges(allBadges);

        // Check for recently awarded badges (within 24 hours)
        const now = Date.now();
        const recent = new Set<string>();
        earnedBadges.forEach((badge) => {
          const awardedTime = new Date(badge.awarded_at).getTime();
          if (now - awardedTime < 24 * 60 * 60 * 1000) {
            recent.add(badge.id);
          }
        });
        setJustAwarded(recent);
      } catch (err: any) {
        console.error("Failed to load badges:", err);
        toast.error("배지 로드 실패");
      } finally {
        setLoading(false);
      }
    }

    loadBadges();
  }, [userId, showAll]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    badges.forEach((badge) => {
      const badgeCategory = badge.isEarned ? badge.badge.category : badge.category;
      if (badgeCategory) cats.add(badgeCategory);
    });
    return Array.from(cats).sort();
  }, [badges]);

  const filteredBadges = useMemo(() => {
    return selectedCategory
      ? badges.filter((badge) => {
          const badgeCategory = badge.isEarned ? badge.badge.category : badge.category;
          return badgeCategory === selectedCategory;
        })
      : badges;
  }, [badges, selectedCategory]);

  const earnedCount = useMemo(
    () => badges.filter((b) => b.isEarned).length,
    [badges]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin text-nu-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Award size={18} className="text-nu-pink" />
        <span className="font-head text-sm font-bold text-nu-ink">
          스킬 배지
        </span>
        <span className="font-mono-nu text-[9px] bg-nu-pink/10 text-nu-pink px-2 py-0.5 font-bold uppercase tracking-widest">
          {earnedCount}/{badges.length}
        </span>
      </div>

      {/* Category Filters */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 font-mono-nu text-[9px] font-bold uppercase tracking-widest transition-all border border-nu-ink/[0.08] ${
              selectedCategory === null
                ? "bg-nu-pink text-white border-nu-pink"
                : "bg-white text-nu-ink hover:border-nu-pink/30"
            }`}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 font-mono-nu text-[9px] font-bold uppercase tracking-widest transition-all border border-nu-ink/[0.08] ${
                selectedCategory === cat
                  ? "bg-nu-pink text-white border-nu-pink"
                  : "bg-white text-nu-ink hover:border-nu-pink/30"
              }`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      )}

      {/* Badges Grid */}
      {filteredBadges.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredBadges.map((badge) => {
            const isEarned = badge.isEarned;
            const badgeData = isEarned ? badge.badge : badge;
            const awardedAt = isEarned ? badge.awarded_at : null;
            const endorserCount = badge.endorser_count;
            const isJustAwarded = justAwarded.has(badge.id);

            // Calculate progress for unearned badges
            const progressPercent = !isEarned
              ? (endorserCount / badgeData.requirement_count) * 100
              : 100;

            return (
              <div
                key={badge.id}
                className={`border-2 p-4 transition-all duration-300 ${
                  isEarned
                    ? `border-nu-pink ${
                        isJustAwarded
                          ? "bg-nu-pink/5 shadow-lg shadow-nu-pink/20 animate-pulse"
                          : "bg-white border-nu-ink/[0.08]"
                      }`
                    : "bg-nu-cream/30 border-nu-ink/[0.04]"
                }`}
              >
                {/* Icon and Status */}
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`text-2xl ${
                      isEarned ? "" : "opacity-40 grayscale"
                    }`}
                  >
                    {badgeData.icon || "⭐"}
                  </div>
                  {isEarned ? (
                    <div className="flex items-center gap-1">
                      <Award size={12} className="text-nu-pink" />
                      <span className="font-mono-nu text-[7px] font-bold text-nu-pink uppercase">
                        Earned
                      </span>
                    </div>
                  ) : (
                    <Lock
                      size={12}
                      className="text-nu-ink/30"
                    />
                  )}
                </div>

                {/* Badge Name */}
                <h3 className="font-head text-xs font-bold text-nu-ink mb-1">
                  {badgeData.name}
                </h3>

                {/* Description */}
                <p className="text-[9px] text-nu-graphite mb-3 leading-relaxed">
                  {badgeData.description}
                </p>

                {/* Award Date or Progress */}
                {isEarned && awardedAt ? (
                  <div className="mb-3">
                    <span className="font-mono-nu text-[8px] text-nu-muted">
                      {new Date(awardedAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                ) : !isEarned ? (
                  <div className="mb-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-nu text-[8px] font-bold text-nu-ink">
                        진행도
                      </span>
                      <span className="font-mono-nu text-[8px] text-nu-muted">
                        {endorserCount}/{badgeData.requirement_count}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-nu-ink/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-nu-pink transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="font-mono-nu text-[7px] text-nu-muted">
                      {badgeData.requirement_count - endorserCount} 보증 남음
                    </p>
                  </div>
                ) : null}

                {/* Endorser Count */}
                {endorserCount > 0 && (
                  <div className="flex items-center gap-1 pt-2 border-t border-nu-ink/5">
                    <Users size={12} className="text-nu-muted" />
                    <span className="font-mono-nu text-[8px] text-nu-muted font-bold">
                      {endorserCount} {isEarned ? "보증자" : "보증"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-[11px] text-nu-muted">
            {showAll
              ? "아직 배지가 없습니다"
              : "취득한 배지가 없습니다"}
          </p>
        </div>
      )}

      {/* Empty State for showAll */}
      {showAll && badges.length === 0 && (
        <div className="py-8 border-2 border-dashed border-nu-ink/10 text-center">
          <Award size={32} className="mx-auto text-nu-muted/30 mb-2" />
          <p className="text-[11px] text-nu-muted">
            사용 가능한 배지가 없습니다
          </p>
        </div>
      )}
    </div>
  );
}
