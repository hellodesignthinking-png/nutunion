"use server";
import { createClient } from "@/lib/supabase/server";

interface ActivityCounts {
  meeting_count: number;
  resource_count: number;
  post_count: number;
  project_count: number;
  endorsement_count: number;
}

/**
 * Badge auto-award conditions mapped to actual seed badge names.
 * Matches names in skill_badges table from migration 018.
 */
const BADGE_CONDITIONS: {
  name: string;
  condition: (counts: ActivityCounts) => boolean;
}[] = [
  { name: "프로젝트 리더", condition: (c) => c.project_count >= 3 },
  { name: "팀 플레이어", condition: (c) => c.endorsement_count >= 10 },
  { name: "커뮤니케이터", condition: (c) => c.post_count >= 15 },
];

/**
 * Check user's activity counts and automatically award badges.
 * Designed to be resilient — if tables don't exist, silently returns.
 */
export async function checkAndAwardBadges(userId: string) {
  try {
    const supabase = await createClient();

    // 1. Query activity counts — each wrapped individually for resilience
    let meetingCount = 0;
    let resourceCount = 0;
    let postCount = 0;
    let projectCount = 0;
    let endorsementCount = 0;

    // Meetings: use meetings table (organizer) since meeting_attendees may not exist
    try {
      const { count } = await supabase
        .from("meetings")
        .select("id", { count: "exact", head: true })
        .eq("organizer_id", userId);
      meetingCount = count || 0;
    } catch { /* table may not exist */ }

    // Resources
    try {
      const { count } = await supabase
        .from("file_attachments")
        .select("id", { count: "exact", head: true })
        .eq("uploaded_by", userId);
      resourceCount = count || 0;
    } catch { /* */ }

    // Posts
    try {
      const { count } = await supabase
        .from("crew_posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", userId);
      postCount = count || 0;
    } catch { /* */ }

    // Projects
    try {
      const { count } = await supabase
        .from("project_members")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", userId);
      projectCount = count || 0;
    } catch { /* */ }

    // Endorsements
    try {
      const { count } = await supabase
        .from("endorsements")
        .select("id", { count: "exact", head: true })
        .eq("endorsed_id", userId);
      endorsementCount = count || 0;
    } catch { /* table may not exist */ }

    const activityCounts: ActivityCounts = {
      meeting_count: meetingCount,
      resource_count: resourceCount,
      post_count: postCount,
      project_count: projectCount,
      endorsement_count: endorsementCount,
    };

    // 2. Get all skill badges
    const { data: allBadges, error: badgesError } = await supabase
      .from("skill_badges")
      .select("id, name");

    if (badgesError || !allBadges || allBadges.length === 0) {
      // skill_badges table doesn't exist or is empty
      return [];
    }

    const badgeNameMap = new Map(allBadges.map((b: any) => [b.name, b.id]));

    // 3. Get already awarded badges
    const { data: awardedBadges } = await supabase
      .from("user_badges")
      .select("badge_id")
      .eq("user_id", userId);

    const awardedBadgeIds = new Set(
      awardedBadges?.map((ub: any) => ub.badge_id) || []
    );

    // 4. Check conditions and award
    const results: { badge_name: string; awarded: boolean }[] = [];

    for (const { name, condition } of BADGE_CONDITIONS) {
      if (condition(activityCounts)) {
        const badgeId = badgeNameMap.get(name);
        if (badgeId && !awardedBadgeIds.has(badgeId)) {
          const { error } = await supabase.from("user_badges").insert({
            user_id: userId,
            badge_id: badgeId,
            awarded_at: new Date().toISOString(),
            endorser_ids: [],
          });
          if (!error) {
            results.push({ badge_name: name, awarded: true });
          }
        }
      }
    }

    return results;
  } catch (error) {
    // Silently fail — badge checking should never break the app
    console.warn("Badge checker error (non-critical):", error);
    return [];
  }
}
