import { createClient as createServerClient } from "@/lib/supabase/server";

export interface NextBestAction {
  label: string;
  description?: string;
  href: string;
  priority: number;     // 낮을수록 긴급
  emoji?: string;
}

/**
 * 와셔의 지금 당장 해야 할 행동 1개를 계산.
 * 우선순위(낮을수록 긴급):
 *  1. 내 볼트에 지원자 대기 (PM/Lead)
 *  2. 마일스톤 D-3 이하
 *  3. 받은 미확인 너트 초대
 *  4. 프로필 완성도 < 70%
 *  5. 이번 주 강성 증가량 0
 *  6. (fallback) 탭 회고 작성 유도
 */
export async function computeNextBestAction(userId: string): Promise<NextBestAction | null> {
  const supabase = await createServerClient();

  // 1) 내가 PM/Lead 인 볼트의 pending 지원자
  const { data: ledBolts } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId)
    .in("role", ["lead", "pm"]);
  if (ledBolts && ledBolts.length > 0) {
    const projectIds = ledBolts.map((m: any) => m.project_id);
    const { count } = await supabase
      .from("project_applications")
      .select("id", { count: "exact", head: true })
      .in("project_id", projectIds)
      .eq("status", "pending");
    if (count && count > 0) {
      const firstId = projectIds[0];
      return {
        label: `${count}명이 볼트에 지원했어요`,
        description: "검토하고 승인/반려해주세요",
        href: `/projects/${firstId}/applications`,
        priority: 1,
        emoji: "📋",
      };
    }
  }

  // 2) D-3 이내 마감 마일스톤
  const todayStr = new Date().toISOString().slice(0, 10);
  const threeDays = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const { data: myBolts } = await supabase
    .from("project_members")
    .select("project_id, project:projects(id, title)")
    .eq("user_id", userId);
  const boltIds = (myBolts || []).map((m: any) => m.project_id);
  if (boltIds.length > 0) {
    const { data: upcomingMs } = await supabase
      .from("project_milestones")
      .select("id, title, due_date, project_id")
      .in("project_id", boltIds)
      .neq("status", "completed")
      .gte("due_date", todayStr)
      .lte("due_date", threeDays)
      .order("due_date", { ascending: true })
      .limit(1);
    if (upcomingMs && upcomingMs.length > 0) {
      const m = upcomingMs[0];
      const bolt: any = (myBolts || []).find((b: any) => b.project_id === m.project_id)?.project;
      const days = Math.ceil((new Date(m.due_date!).getTime() - Date.now()) / 86400000);
      return {
        label: `'${bolt?.title || "볼트"}' 마일스톤 ${days === 0 ? "오늘" : `D-${days}`}`,
        description: m.title,
        href: `/projects/${m.project_id}`,
        priority: 2,
        emoji: "⏰",
      };
    }
  }

  // 3) 미확인 너트 초대
  const { data: invites } = await supabase
    .from("group_members")
    .select("group_id, group:groups(id, name)")
    .eq("user_id", userId)
    .eq("status", "pending")
    .limit(1);
  if (invites && invites.length > 0) {
    const g: any = invites[0].group;
    return {
      label: `${g?.name || "너트"}에서 초대를 보냈어요`,
      description: "수락하거나 거절해주세요",
      href: `/groups/${invites[0].group_id}`,
      priority: 3,
      emoji: "✉️",
    };
  }

  // 4) 프로필 완성도 < 70%
  const { data: profile } = await supabase
    .from("profiles")
    .select("bio, specialty, skill_tags, avatar_url, slogan, availability")
    .eq("id", userId)
    .maybeSingle();
  if (profile) {
    const fields = [
      !!profile.bio,
      !!profile.specialty,
      Array.isArray(profile.skill_tags) && profile.skill_tags.length >= 3,
      !!profile.avatar_url,
      !!profile.slogan,
      !!profile.availability && profile.availability !== "observing",
    ];
    const filled = fields.filter(Boolean).length;
    const pct = Math.round((filled / fields.length) * 100);
    if (pct < 70) {
      return {
        label: `프로필 완성도 ${pct}%`,
        description: "완성하면 매칭 확률이 올라가요",
        href: "/profile",
        priority: 4,
        emoji: "✨",
      };
    }
  }

  // 5) 이번 주 강성 증가량 0
  try {
    const { data: st } = await supabase
      .from("stiffness_breakdown")
      .select("delta_this_week, events_this_week")
      .eq("user_id", userId)
      .maybeSingle();
    if (st && (st.events_this_week ?? 0) === 0) {
      return {
        label: "이번 주 아직 활동이 없어요",
        description: "추천 볼트에서 첫 발을 떼보세요",
        href: "/projects?match=weekly",
        priority: 5,
        emoji: "🚀",
      };
    }
  } catch {}

  // 6) Fallback — 탭 회고
  if (boltIds.length > 0) {
    return {
      label: "탭 아카이브에 회고를 남겨보세요",
      description: "팀의 경험을 영구 보관",
      href: `/projects/${boltIds[0]}/tap`,
      priority: 6,
      emoji: "📚",
    };
  }

  // 완전 신규 유저
  return {
    label: "첫 너트를 찾아보세요",
    description: "관심 분야 커뮤니티에서 시작해요",
    href: "/groups",
    priority: 6,
    emoji: "👋",
  };
}
