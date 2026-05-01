/**
 * POST /api/genesis/match-team
 * Genesis AI — plan.suggested_roles → profile 후보 (top 3 per role).
 *
 * Body: { plan: GenesisPlan }
 * Response: { matches: Array<{ role_name, candidates: [{ profile_id, nickname, avatar_url, specialty, match_reasons }] }> }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const maxDuration = 30;

interface Role {
  role_name: string;
  specialty_tags: string[];
  why: string;
}

export const POST = withRouteLog("genesis.match-team", async (request: NextRequest) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const body = await request.json();
    const roles: Role[] = body?.plan?.suggested_roles || [];
    if (!Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // 모든 후보 풀 (최근 500명) — 서버측에서 스코어링
    const { data: candidates, error } = await supabase
      .from("profiles")
      .select("id, nickname, avatar_url, specialty, skill_tags, role_tags, bio")
      .neq("id", user.id)
      .limit(500);

    if (error) {
      log.warn("genesis.match.fetch_failed", { err: error.message });
      return NextResponse.json({ matches: [] });
    }

    function norm(s: any): string {
      return String(s || "").toLowerCase();
    }

    function scoreProfile(p: any, role: Role): { score: number; reasons: string[] } {
      const reasons: string[] = [];
      let score = 0;
      const specialty = norm(p.specialty);
      const skills: string[] = Array.isArray(p.skill_tags) ? p.skill_tags.map(norm) : [];
      const roleTags: string[] = Array.isArray(p.role_tags) ? p.role_tags.map(norm) : [];
      const bio = norm(p.bio);
      const roleName = norm(role.role_name);

      for (const tag of role.specialty_tags || []) {
        const t = norm(tag);
        if (!t) continue;
        if (specialty === t) {
          score += 5;
          reasons.push(`specialty:${tag}`);
        }
        if (skills.includes(t)) {
          score += 4;
          reasons.push(`skill:${tag}`);
        }
        if (roleTags.includes(t)) {
          score += 3;
          reasons.push(`role_tag:${tag}`);
        }
        if (bio.includes(t)) {
          score += 2;
          reasons.push(`bio:${tag}`);
        }
      }
      // role name in bio
      if (roleName && bio.includes(roleName)) {
        score += 2;
        reasons.push(`bio:${role.role_name}`);
      }
      return { score, reasons: Array.from(new Set(reasons)).slice(0, 4) };
    }

    const matches = roles.map((role) => {
      const scored = (candidates || [])
        .map((p) => ({ p, ...scoreProfile(p, role) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      return {
        role_name: role.role_name,
        why: role.why,
        candidates: scored.map((x) => ({
          profile_id: x.p.id,
          nickname: x.p.nickname,
          avatar_url: x.p.avatar_url,
          specialty: x.p.specialty,
          match_reasons: x.reasons,
          score: x.score,
        })),
      };
    });

    log.info("genesis.match.done", {
      user_id: user.id,
      role_count: roles.length,
      total_candidates: matches.reduce((a, m) => a + m.candidates.length, 0),
    });

    return NextResponse.json({ matches });
  } catch (err: any) {
    log.error(err, "genesis.match.failed");
    return NextResponse.json({ error: err?.message || "팀매칭 실패" }, { status: 500 });
  }
});
