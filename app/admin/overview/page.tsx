import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Users, Rocket, AlertTriangle, TrendingUp, Activity, Clock, Sparkles, CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin — nutunion" };

async function fetchMetrics() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return null;

  const now = new Date();
  const iso1d = new Date(now.getTime() - 86400000).toISOString();
  const iso7d = new Date(now.getTime() - 7 * 86400000).toISOString();
  const today = now.toISOString().slice(0, 10);
  const d3 = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10);

  const [
    { count: totalUsers }, { count: totalGroups }, { count: totalProjects },
    { count: newUsers7d },
    { count: dau }, { count: wau },
    { data: silentGroups }, { data: dueSoon },
    { data: topWashers },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("groups").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", iso7d),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("updated_at", iso1d),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("updated_at", iso7d),
    supabase.from("groups").select("id, name").eq("is_active", true).lt("updated_at", iso7d).limit(5),
    supabase.from("project_milestones")
      .select("id, title, due_date, project_id, project:projects(id, title)")
      .neq("status", "completed").gte("due_date", today).lte("due_date", d3)
      .order("due_date").limit(5),
    supabase.from("profiles").select("id, nickname, activity_score").order("activity_score", { ascending: false, nullsFirst: false }).limit(5),
  ]);

  return {
    totals: { users: totalUsers ?? 0, groups: totalGroups ?? 0, projects: totalProjects ?? 0 },
    week: { newUsers: newUsers7d ?? 0 },
    activity: { dau: dau ?? 0, wau: wau ?? 0 },
    silentGroups: silentGroups ?? [],
    dueSoon: dueSoon ?? [],
    topWashers: topWashers ?? [],
  };
}

export default async function AdminOverviewPage() {
  const m = await fetchMetrics();
  if (!m) redirect("/dashboard");

  return (
    <div className="reader-shell min-h-screen">
      <div className="max-w-[1040px] mx-auto px-4 md:px-6 py-8 space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-[color:var(--reader-text-muted)]">Admin</p>
            <h1 className="reader-h1 mt-0.5">Today's Pulse</h1>
          </div>
          <nav className="flex items-center gap-1.5 text-[12px]">
            {[
              { href: "/admin/payment-test", label: "결제" },
              { href: "/admin/users", label: "와셔" },
              { href: "/admin/moderation", label: "신고" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="px-2.5 py-1.5 border border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] no-underline text-[color:var(--neutral-700)] hover:bg-[color:var(--neutral-50)]">
                {l.label}
              </Link>
            ))}
          </nav>
        </header>

        {/* Today's Pulse */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "DAU", value: m.activity.dau, icon: <Activity size={12} /> },
            { label: "WAU", value: m.activity.wau, icon: <Activity size={12} /> },
            { label: "신규 (7일)", value: m.week.newUsers, icon: <Sparkles size={12} /> },
            { label: "총 와셔", value: m.totals.users, icon: <Users size={12} /> },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-[var(--ds-radius-lg)] border border-[color:var(--neutral-100)] bg-[color:var(--neutral-0)]">
              <div className="font-mono-nu text-[9px] uppercase tracking-[0.25em] text-[color:var(--neutral-500)] mb-1 flex items-center gap-1">
                {s.icon} {s.label}
              </div>
              <div className="text-[28px] font-semibold tabular-nums text-[color:var(--neutral-900)]">
                {s.value.toLocaleString("ko-KR")}
              </div>
            </div>
          ))}
        </section>

        {/* 총계 */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "활성 너트", value: m.totals.groups, href: "/admin/groups", icon: <Users size={12} /> },
            { label: "활성 볼트", value: m.totals.projects, href: "/admin/projects", icon: <Rocket size={12} /> },
            { label: "결제 테스트", value: "→", href: "/admin/payment-test", icon: <CreditCard size={12} /> },
          ].map((s) => (
            <Link key={s.label} href={s.href} className="p-4 rounded-[var(--ds-radius-lg)] border border-[color:var(--neutral-100)] bg-[color:var(--neutral-0)] no-underline hover:border-[color:var(--liquid-primary)] transition-colors">
              <div className="font-mono-nu text-[9px] uppercase tracking-[0.25em] text-[color:var(--neutral-500)] mb-1 flex items-center gap-1">
                {s.icon} {s.label}
              </div>
              <div className="text-[20px] font-semibold tabular-nums text-[color:var(--neutral-900)]">
                {typeof s.value === "number" ? s.value.toLocaleString("ko-KR") : s.value}
              </div>
            </Link>
          ))}
        </section>

        {/* Alerts */}
        <section>
          <h2 className="reader-h2 mb-3 inline-flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-nu-amber" /> 즉시 조치 필요
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-[var(--ds-radius-lg)] border border-[color:var(--neutral-100)] bg-[color:var(--neutral-0)]">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-amber font-bold mb-2">
                🟨 7일+ 조용한 너트 · {m.silentGroups.length}
              </div>
              {m.silentGroups.length === 0 ? (
                <p className="text-[12px] text-[color:var(--neutral-500)]">모든 너트가 활성 상태예요</p>
              ) : (
                <ul className="list-none m-0 p-0 space-y-1">
                  {m.silentGroups.map((g: any) => (
                    <li key={g.id}>
                      <Link href={`/groups/${g.id}`} className="text-[13px] text-[color:var(--neutral-900)] hover:text-[color:var(--liquid-primary)] no-underline">
                        · {g.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 rounded-[var(--ds-radius-lg)] border border-[color:var(--neutral-100)] bg-[color:var(--neutral-0)]">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-red-700 font-bold mb-2 flex items-center gap-1">
                <Clock size={11} /> 마일스톤 D-3 이하 · {m.dueSoon.length}
              </div>
              {m.dueSoon.length === 0 ? (
                <p className="text-[12px] text-[color:var(--neutral-500)]">임박 마감 없음 ✓</p>
              ) : (
                <ul className="list-none m-0 p-0 space-y-1">
                  {m.dueSoon.map((ms: any) => {
                    const p = Array.isArray(ms.project) ? ms.project[0] : ms.project;
                    const days = Math.ceil((new Date(ms.due_date).getTime() - Date.now()) / 86400000);
                    return (
                      <li key={ms.id}>
                        <Link href={`/projects/${ms.project_id}`} className="text-[13px] text-[color:var(--neutral-900)] hover:text-[color:var(--liquid-primary)] no-underline">
                          · {p?.title} — <span className="text-red-600">{days === 0 ? "오늘" : `D-${days}`}</span> · {ms.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Top 와셔 */}
        <section>
          <h2 className="reader-h2 mb-3 inline-flex items-center gap-1.5">
            <TrendingUp size={14} className="text-[color:var(--liquid-primary)]" /> 상위 강성 와셔
          </h2>
          <ol className="list-none m-0 p-0 space-y-1">
            {m.topWashers.map((w: any, i: number) => (
              <li key={w.id}>
                <Link href={`/portfolio/${w.id}`} className="flex items-center gap-3 p-3 rounded-[var(--ds-radius-lg)] border border-[color:var(--neutral-100)] bg-[color:var(--neutral-0)] no-underline hover:border-[color:var(--liquid-primary)] transition-colors">
                  <span className="w-6 text-[11px] font-mono-nu text-[color:var(--neutral-500)] tabular-nums">#{i + 1}</span>
                  <span className="flex-1 text-[14px] font-medium text-[color:var(--neutral-900)]">{w.nickname}</span>
                  <span className="text-[12px] text-[color:var(--liquid-primary)] font-mono-nu tabular-nums">
                    강성 {(w.activity_score ?? 0).toLocaleString("ko-KR")}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <footer className="pt-6 border-t border-[color:var(--neutral-100)]">
          <p className="text-[11px] text-[color:var(--neutral-500)] font-mono-nu">
            Built with <code className="text-[color:var(--neutral-900)]">/api/admin/metrics</code> · Daily roll-up: <code>compute_daily_metrics()</code>
          </p>
        </footer>
      </div>
    </div>
  );
}
