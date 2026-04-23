import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight, Sparkles } from "lucide-react";
import { MatchReason } from "@/components/ai/match-reason";

/**
 * Recommendations v1 — 규칙 기반 너트·볼트 추천.
 * specialty + skill_tags + membership exclusion + availability 기반.
 * Phase 3 에서 pgvector 로 교체되지만 인터페이스는 유지.
 */

async function recommendNuts(userId: string, specialty: string | null, skills: string[]) {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);
  const excluded = (memberships || []).map((m: any) => m.group_id);

  let q = supabase.from("groups")
    .select("id, name, description, category, image_url")
    .eq("is_active", true)
    .limit(30);
  if (specialty) q = q.eq("category", specialty);
  if (excluded.length > 0) q = q.not("id", "in", `(${excluded.join(",")})`);

  const { data } = await q;
  const skillsLower = skills.map((s) => s.toLowerCase());
  return (data || [])
    .map((g: any) => {
      const text = (g.name + " " + (g.description || "")).toLowerCase();
      const skillHits = skillsLower.filter((s) => text.includes(s)).length;
      const score =
        (specialty && g.category === specialty ? 30 : 0) +
        skillHits * 10;
      const reason = skillHits > 0
        ? `스킬 ${skillHits}개 매칭`
        : specialty && g.category === specialty
          ? `${specialty} 분야`
          : "새 너트";
      return { ...g, score, reason };
    })
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 3);
}

async function recommendBolts(userId: string, specialty: string | null, skills: string[]) {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);
  const excluded = (memberships || []).map((m: any) => m.project_id);

  let q = supabase.from("projects")
    .select("id, title, description, category, status, recruiting, end_date")
    .eq("status", "active")
    .eq("recruiting", true)
    .limit(20);
  if (specialty) q = q.eq("category", specialty);
  if (excluded.length > 0) q = q.not("id", "in", `(${excluded.join(",")})`);

  const { data } = await q;
  const skillsLower = skills.map((s) => s.toLowerCase());
  const now = Date.now();
  return (data || [])
    .map((p: any) => {
      const text = (p.title + " " + (p.description || "")).toLowerCase();
      const skillHits = skillsLower.filter((s) => text.includes(s)).length;
      const daysLeft = p.end_date ? Math.ceil((new Date(p.end_date).getTime() - now) / 86400000) : 999;
      const score =
        skillHits * 20 +
        (specialty && p.category === specialty ? 15 : 0) +
        (daysLeft <= 7 ? 10 : 0);
      const reason = skillHits > 0
        ? `스킬 ${skillHits}개 매칭${daysLeft <= 7 ? " · 마감 임박" : ""}`
        : specialty && p.category === specialty
          ? `${specialty} 분야 모집 중`
          : "모집 중 볼트";
      return { ...p, score, reason };
    })
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 2);
}

export async function DashboardRecommendations({ userId, specialty, skills }: { userId: string; specialty: string | null; skills: string[] }) {
  const [nuts, bolts] = await Promise.all([
    recommendNuts(userId, specialty, skills),
    recommendBolts(userId, specialty, skills),
  ]);

  if (nuts.length === 0 && bolts.length === 0) return null;

  return (
    <section className="reader-shell mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="reader-h2 inline-flex items-center gap-1.5">
          <Sparkles size={14} className="text-[color:var(--reader-accent)]" />
          추천
        </h2>
        <span className="reader-meta">스킬·분야 매칭</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 너트 추천 */}
        {nuts.length > 0 && (
          <div>
            <p className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-[color:var(--reader-text-muted)] mb-2">
              어울릴 너트
            </p>
            <ul className="list-none m-0 p-0 space-y-2">
              {nuts.map((n: any) => (
                <li key={n.id}>
                  <Link href={`/groups/${n.id}`} className="reader-card block no-underline hover:border-[color:var(--reader-accent)] transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[14px] font-semibold text-[color:var(--reader-text)] truncate">
                        {n.name}
                      </span>
                      <span className="text-[10px] font-mono-nu uppercase text-[color:var(--reader-text-muted)] shrink-0">
                        {n.category}
                      </span>
                    </div>
                    {n.description && (
                      <p className="reader-meta line-clamp-1 !text-[12px]">{n.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-[color:var(--reader-accent)]"><MatchReason targetType="nut" targetId={n.id} baseReason={n.reason} /></span>
                      <ArrowRight size={11} className="text-[color:var(--reader-text-muted)]" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 볼트 추천 */}
        {bolts.length > 0 && (
          <div>
            <p className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-[color:var(--reader-text-muted)] mb-2">
              지원해볼 볼트
            </p>
            <ul className="list-none m-0 p-0 space-y-2">
              {bolts.map((b: any) => (
                <li key={b.id}>
                  <Link href={`/projects/${b.id}`} className="reader-card block no-underline hover:border-[color:var(--reader-accent)] transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[14px] font-semibold text-[color:var(--reader-text)] truncate">
                        {b.title}
                      </span>
                      <span className="text-[10px] font-mono-nu uppercase text-[color:var(--reader-text-muted)] shrink-0">
                        {b.category}
                      </span>
                    </div>
                    {b.description && (
                      <p className="reader-meta line-clamp-1 !text-[12px]">{b.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-[color:var(--reader-accent)]"><MatchReason targetType="bolt" targetId={b.id} baseReason={b.reason} /></span>
                      <ArrowRight size={11} className="text-[color:var(--reader-text-muted)]" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
