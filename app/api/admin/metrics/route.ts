import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/metrics — Overview 메트릭 + Alerts + Top 활동
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const now = new Date();
  const iso1d = new Date(now.getTime() - 86400000).toISOString();
  const iso7d = new Date(now.getTime() - 7 * 86400000).toISOString();
  const iso30d = new Date(now.getTime() - 30 * 86400000).toISOString();

  const [
    { count: totalUsers }, { count: totalGroups }, { count: totalProjects },
    { count: newUsers7d }, { count: newGroups7d }, { count: newProjects7d },
    { count: dauApprox }, { count: wauApprox }, { count: mauApprox },
    { data: silentGroups }, { data: dueSoon },
    { data: topGroups }, { data: topWashers },
    { data: daily },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("groups").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", iso7d),
    supabase.from("groups").select("id", { count: "exact", head: true }).gte("created_at", iso7d),
    supabase.from("projects").select("id", { count: "exact", head: true }).gte("created_at", iso7d),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("updated_at", iso1d),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("updated_at", iso7d),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("updated_at", iso30d),
    // 7일간 게시물 0개 너트 (alert)
    supabase.from("groups").select("id, name, updated_at").eq("is_active", true).lt("updated_at", iso7d).limit(5),
    // D-3 이하 미완료 마일스톤
    supabase.from("project_milestones")
      .select("id, title, due_date, project_id, project:projects(id, title)")
      .neq("status", "completed")
      .gte("due_date", now.toISOString().slice(0,10))
      .lte("due_date", new Date(now.getTime() + 3*86400000).toISOString().slice(0,10))
      .order("due_date").limit(5),
    // 상위 활동 너트 (최근 7일 게시물 수)
    supabase.from("groups").select("id, name, category").eq("is_active", true).limit(5),
    // 상위 강성 와셔
    supabase.from("profiles").select("id, nickname, activity_score, points").order("activity_score", { ascending: false }).limit(5),
    // 최근 30일 daily_metrics
    supabase.from("daily_metrics").select("*").gte("date", iso30d.slice(0,10)).order("date", { ascending: true }).then(r => r, () => ({ data: [] })),
  ]);

  return NextResponse.json({
    totals: { users: totalUsers ?? 0, groups: totalGroups ?? 0, projects: totalProjects ?? 0 },
    week: { newUsers: newUsers7d ?? 0, newGroups: newGroups7d ?? 0, newProjects: newProjects7d ?? 0 },
    activity: { dau: dauApprox ?? 0, wau: wauApprox ?? 0, mau: mauApprox ?? 0 },
    alerts: {
      silentGroups: silentGroups ?? [],
      dueSoon: dueSoon ?? [],
    },
    top: {
      groups: topGroups ?? [],
      washers: topWashers ?? [],
    },
    daily: (daily as any)?.data ?? daily ?? [],
    ts: now.toISOString(),
  });
}
