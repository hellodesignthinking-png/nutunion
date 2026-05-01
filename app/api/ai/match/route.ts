import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * AI 매칭 API — 하이브리드 구현:
 *
 *   1차: pgvector 임베딩 코사인 유사도 (profile_embeddings / project_embeddings)
 *   2차: 실패 시 keyword/태그 기반 fallback (즉시 동작)
 *
 * 사용:
 *   GET /api/ai/match?kind=nuts&limit=3   — 나와 어울릴 너트 추천
 *   GET /api/ai/match?kind=bolts&limit=3  — 내 프로필에 맞는 볼트 추천
 *   GET /api/ai/match?kind=washers&projectId=xxx — 이 볼트에 어울릴 와셔
 */
export const GET = withRouteLog("ai.match", async (req: Request) => {
  const url = new URL(req.url);
  const kind = (url.searchParams.get("kind") || "bolts") as "nuts" | "bolts" | "washers";
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") || "3")));
  const projectId = url.searchParams.get("projectId");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    if (kind === "nuts") return NextResponse.json(await matchNuts(supabase, user.id, limit));
    if (kind === "bolts") return NextResponse.json(await matchBolts(supabase, user.id, limit));
    if (kind === "washers") return NextResponse.json(await matchWashers(supabase, projectId!, limit));
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  } catch (err: any) {
    log.error(err, "ai.match.failed");
    return NextResponse.json({ error: err.message || "Match failed", items: [] }, { status: 500 });
  }
});

async function matchNuts(supabase: any, userId: string, limit: number) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("specialty, skill_tags, interests")
    .eq("id", userId)
    .single();

  // 이미 가입한 너트 제외
  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);
  const excludeIds = (memberships || []).map((m: any) => m.group_id);

  // Keyword fallback (pgvector 미적용 환경에서도 즉시 동작)
  let q = supabase
    .from("groups")
    .select("id, name, description, category, image_url")
    .eq("is_active", true)
    .limit(limit * 3);
  if (profile?.specialty) q = q.eq("category", profile.specialty);
  if (excludeIds.length > 0) q = q.not("id", "in", `(${excludeIds.join(",")})`);

  const { data } = await q;
  const items = (data || []).slice(0, limit).map((g: any) => ({
    ...g,
    match_score: profile?.specialty && g.category === profile.specialty ? 0.9 : 0.6,
    reason: profile?.specialty && g.category === profile.specialty
      ? `${profile.specialty} 분야 관심사 일치`
      : "비슷한 주제",
  }));

  return { items, method: "keyword", kind: "nuts" };
}

async function matchBolts(supabase: any, userId: string, limit: number) {
  // 1차: pgvector RPC (있으면)
  try {
    const { data: emb } = await supabase
      .from("profile_embeddings")
      .select("embedding")
      .eq("profile_id", userId)
      .maybeSingle();
    if (emb?.embedding) {
      const { data: matches } = await supabase.rpc("match_projects_by_embedding", {
        query_embedding: emb.embedding,
        match_count: limit,
        exclude_user: userId,
      });
      if (matches && matches.length > 0) {
        return {
          items: matches.map((m: any) => ({
            ...m,
            match_score: Math.max(0, 1 - (m.distance ?? 1)),
            reason: `임베딩 유사도 ${((1 - (m.distance ?? 1)) * 100).toFixed(0)}%`,
          })),
          method: "pgvector",
          kind: "bolts",
        };
      }
    }
  } catch {}

  // 2차: keyword fallback
  const { data: profile } = await supabase
    .from("profiles")
    .select("specialty, skill_tags")
    .eq("id", userId)
    .single();

  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);
  const excludeIds = (memberships || []).map((m: any) => m.project_id);

  let q = supabase
    .from("projects")
    .select("id, title, description, category, image_url, status, recruiting, needed_roles")
    .eq("status", "active")
    .eq("recruiting", true)
    .limit(limit * 3);
  if (profile?.specialty) q = q.eq("category", profile.specialty);
  if (excludeIds.length > 0) q = q.not("id", "in", `(${excludeIds.join(",")})`);

  const { data } = await q;

  // 스킬 태그 겹침 기반 점수 가산
  const mySkills = new Set((profile?.skill_tags || []).map((s: string) => s.toLowerCase()));
  const items = (data || [])
    .map((p: any) => {
      const roleSkills: string[] = p.needed_roles || [];
      const overlap = roleSkills.filter((s) => mySkills.has(s.toLowerCase())).length;
      const baseScore = profile?.specialty && p.category === profile.specialty ? 0.7 : 0.4;
      const score = Math.min(1, baseScore + overlap * 0.08);
      return {
        ...p,
        match_score: score,
        reason: overlap > 0
          ? `스킬 ${overlap}개 일치${profile?.specialty && p.category === profile.specialty ? " · 분야 일치" : ""}`
          : (profile?.specialty && p.category === profile.specialty ? "관심 분야 일치" : "모집 중인 볼트"),
      };
    })
    .sort((a: any, b: any) => b.match_score - a.match_score)
    .slice(0, limit);

  return { items, method: "keyword", kind: "bolts" };
}

async function matchWashers(supabase: any, projectId: string, limit: number) {
  if (!projectId) throw new Error("projectId required");

  // type 컬럼 fallback (migration 084 미적용 환경)
  let projectCols = "category, needed_roles, role_slots, type";
  let { data: project } = await supabase
    .from("projects")
    .select(projectCols)
    .eq("id", projectId)
    .single();
  if (!project) {
    const fb = await supabase.from("projects").select("category, needed_roles, role_slots").eq("id", projectId).single();
    project = fb.data;
  }

  // 이미 참여/지원한 유저 제외
  const [{ data: members }, { data: apps }] = await Promise.all([
    supabase.from("project_members").select("user_id").eq("project_id", projectId),
    supabase.from("project_applications").select("applicant_id").eq("project_id", projectId),
  ]);
  const excludeIds = new Set<string>([
    ...(members || []).map((m: any) => m.user_id),
    ...(apps || []).map((a: any) => a.applicant_id),
  ].filter(Boolean));

  // 볼트 유형별 선호 role_tags — 매칭 가점 대상
  const PREF_BY_TYPE: Record<string, string[]> = {
    hex:      ["pm", "designer", "developer", "writer", "researcher", "mentor"],
    anchor:   ["operator", "manager", "staff", "accountant", "chef", "marketer"],
    carriage: ["po", "engineer", "designer", "support", "data", "marketer"],
    eye:      ["pm", "accountant", "operator", "investor", "sponsor"],
    wing:     ["marketer", "designer", "writer", "pm", "support"],
  };
  const boltType = (project as any)?.type || "hex";
  const preferredTags = new Set(PREF_BY_TYPE[boltType] || []);

  // Candidates: role_tags 포함 컬럼 (graceful — 없으면 빈 배열)
  let q = supabase
    .from("profiles")
    .select("id, nickname, avatar_url, specialty, skill_tags, role_tags, bio, activity_score")
    .order("activity_score", { ascending: false, nullsFirst: false })
    .limit(limit * 5);
  if (project?.category) q = q.eq("specialty", project.category);

  let candRes = await q;
  if (candRes.error && /role_tags/.test(candRes.error.message || "")) {
    // migration 086 미적용
    candRes = await supabase
      .from("profiles")
      .select("id, nickname, avatar_url, specialty, skill_tags, bio, activity_score")
      .order("activity_score", { ascending: false, nullsFirst: false })
      .limit(limit * 5);
  }
  const candidates = candRes.data || [];

  const neededSkills = new Set((project?.needed_roles || []).map((s: string) => s.toLowerCase()));
  const items = candidates
    .filter((c: any) => !excludeIds.has(c.id))
    .map((c: any) => {
      const skills = c.skill_tags || [];
      const roleTags: string[] = c.role_tags || [];
      const overlap = skills.filter((s: string) => neededSkills.has(s.toLowerCase())).length;
      const roleOverlap = roleTags.filter((t) => preferredTags.has(t));
      const roleBonus = Math.min(0.3, roleOverlap.length * 0.1); // 태그당 +0.1, 최대 +0.3
      const baseScore = project?.category && c.specialty === project.category ? 0.6 : 0.3;
      const score = Math.min(
        1,
        baseScore + overlap * 0.1 + Math.min(0.2, (c.activity_score || 0) / 500) + roleBonus,
      );

      // 이유 설명 구성
      const reasonBits: string[] = [];
      if (roleOverlap.length > 0) {
        reasonBits.push(`${boltType} 에 적합한 역할 ${roleOverlap.join("·")}`);
      }
      if (overlap > 0) reasonBits.push(`스킬 ${overlap}개 일치`);
      reasonBits.push(`활동 ${c.activity_score || 0}`);

      return {
        id: c.id,
        nickname: c.nickname,
        avatar_url: c.avatar_url,
        specialty: c.specialty,
        skill_tags: skills,
        role_tags: roleTags,
        bio: c.bio,
        match_score: score,
        reason: reasonBits.join(" · "),
      };
    })
    .sort((a: any, b: any) => b.match_score - a.match_score)
    .slice(0, limit);

  return { items, method: "keyword", kind: "washers" };
}
