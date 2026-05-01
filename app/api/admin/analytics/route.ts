import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/analytics — 퍼널 + 코호트 계산.
 *
 * 퍼널 (누적):
 *   signup → profile_complete → first_nut_join → first_bolt_apply → first_bolt_member → first_milestone_done
 *
 * 코호트: 가입 주차별 → N주차 retention (stiffness 변동 또는 updated_at 최근성)
 */
export const GET = withRouteLog("admin.analytics", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  // ── Funnel ─────────────────────────────────────────
  const [
    { count: signup },
    { count: profile_complete },
    { data: applicants },
    { data: memberUsers },
    { data: msDone },
    { data: nutJoiners },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).not("bio", "is", null).not("specialty", "is", null),
    supabase.from("project_applications").select("applicant_id"),
    supabase.from("project_members").select("user_id"),
    supabase.from("project_milestones").select("id").eq("status", "completed"),
    supabase.from("group_members").select("user_id").eq("status", "active"),
  ]);

  const uniq = (arr: any[] | null, key: string) => new Set((arr ?? []).map((r: any) => r[key]).filter(Boolean)).size;

  const funnel = [
    { step: "signup",                label: "가입",         count: signup ?? 0 },
    { step: "profile_complete",      label: "프로필 완성",  count: profile_complete ?? 0 },
    { step: "first_nut_join",        label: "너트 참여",    count: uniq(nutJoiners, "user_id") },
    { step: "first_bolt_apply",      label: "볼트 지원",    count: uniq(applicants, "applicant_id") },
    { step: "first_bolt_member",     label: "볼트 합류",    count: uniq(memberUsers, "user_id") },
    { step: "first_milestone_done",  label: "마일스톤 완료", count: msDone?.length ?? 0 },
  ].map((s, i, all) => ({
    ...s,
    pct_of_signup: signup ? Math.round((s.count / signup) * 1000) / 10 : 0,
    drop_from_prev: i > 0 && all[i - 1].count > 0 ? Math.round(((all[i - 1].count - s.count) / all[i - 1].count) * 1000) / 10 : 0,
  }));

  // ── Cohort — 가입 주차별 retention ────────────────────
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, created_at, updated_at")
    .gte("created_at", new Date(Date.now() - 8 * 7 * 86400000).toISOString())
    .order("created_at", { ascending: true });

  // ISO week key
  function weekKey(d: Date) {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - copy.getDay()); // Sunday
    return copy.toISOString().slice(0, 10);
  }

  const cohorts = new Map<string, { size: number; retention: number[] }>();
  for (const p of profs ?? []) {
    const signed = new Date(p.created_at);
    const key = weekKey(signed);
    const entry = cohorts.get(key) ?? { size: 0, retention: [0, 0, 0, 0, 0, 0, 0, 0] };
    entry.size += 1;
    // 각 주차별로 updated_at 이 해당 주차 범위에 있는지
    const updated = new Date(p.updated_at);
    const weeksAfter = Math.floor((updated.getTime() - signed.getTime()) / (7 * 86400000));
    if (weeksAfter >= 0 && weeksAfter < 8) entry.retention[weeksAfter] += 1;
    cohorts.set(key, entry);
  }

  const cohortRows = [...cohorts.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 8)
    .map(([week, v]) => ({
      week,
      size: v.size,
      retention_pct: v.retention.map((c) => (v.size ? Math.round((c / v.size) * 100) : 0)),
    }));

  return NextResponse.json({
    funnel,
    cohorts: cohortRows,
    generated_at: new Date().toISOString(),
  });
});
