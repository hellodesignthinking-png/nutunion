import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, Filter, TrendingDown, Users } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics — Admin · nutunion" };

async function fetchAnalytics(origin: string, cookie: string) {
  try {
    const res = await fetch(`${origin}/api/admin/analytics`, { headers: { cookie }, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  // Server-side API call via headers — simpler to call Supabase directly here.
  // 중복 로직 방지를 위해 /api 호출은 생략하고 인라인 계산.
  const [signup, applicants, memberUsers, nutJoiners, msDone, profileComplete] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("project_applications").select("applicant_id"),
    supabase.from("project_members").select("user_id"),
    supabase.from("group_members").select("user_id").eq("status", "active"),
    supabase.from("project_milestones").select("id").eq("status", "completed"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).not("bio", "is", null),
  ]);

  const totalSignup = signup.count ?? 0;
  const uniq = (arr: any, key: string) => new Set((arr.data ?? []).map((r: any) => r[key]).filter(Boolean)).size;

  const funnel = [
    { label: "가입",            count: totalSignup },
    { label: "프로필 완성",     count: profileComplete.count ?? 0 },
    { label: "너트 참여",       count: uniq(nutJoiners, "user_id") },
    { label: "볼트 지원",       count: uniq(applicants, "applicant_id") },
    { label: "볼트 합류",       count: uniq(memberUsers, "user_id") },
    { label: "마일스톤 완료",   count: msDone.data?.length ?? 0 },
  ];

  const maxCount = Math.max(1, funnel[0].count);

  return (
    <div className="reader-shell min-h-screen">
      <div className="max-w-[1040px] mx-auto px-4 md:px-6 py-8 space-y-8">
        <Link href="/admin/overview" className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-[color:var(--neutral-500)] hover:text-[color:var(--neutral-900)] no-underline">
          <ArrowLeft size={11} /> Admin Overview
        </Link>

        <header>
          <p className="reader-meta">Analytics</p>
          <h1 className="reader-h1 mt-0.5">Funnel & Cohort</h1>
          <p className="reader-meta mt-1">
            와셔의 가입부터 첫 마일스톤 완료까지의 전환율 · 주차별 리텐션.
          </p>
        </header>

        {/* Funnel */}
        <section>
          <h2 className="reader-h2 mb-4 inline-flex items-center gap-1.5">
            <Filter size={14} /> 퍼널 · {totalSignup.toLocaleString("ko-KR")}명 기준
          </h2>
          <div className="space-y-2">
            {funnel.map((s, i) => {
              const pct = totalSignup ? Math.round((s.count / totalSignup) * 1000) / 10 : 0;
              const widthPct = (s.count / maxCount) * 100;
              const drop = i > 0 && funnel[i - 1].count > 0
                ? Math.round(((funnel[i - 1].count - s.count) / funnel[i - 1].count) * 1000) / 10
                : 0;
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1 text-[13px]">
                    <span className="text-[color:var(--neutral-900)]">{s.label}</span>
                    <span className="font-mono-nu tabular-nums text-[color:var(--neutral-500)]">
                      {s.count.toLocaleString("ko-KR")}명 · {pct}%
                      {drop > 0 && <span className="text-red-600 ml-2">▼ {drop}%</span>}
                    </span>
                  </div>
                  <div className="h-6 bg-[color:var(--neutral-50)] rounded-[var(--ds-radius-sm)] overflow-hidden">
                    <div
                      className="h-full bg-[color:var(--liquid-primary)] transition-all"
                      style={{ width: `${widthPct}%`, opacity: 1 - i * 0.08 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Cohort */}
        <section>
          <h2 className="reader-h2 mb-3 inline-flex items-center gap-1.5">
            <Users size={14} /> 가입 주차별 리텐션
          </h2>
          <p className="reader-meta mb-4">
            updated_at 기준 — 각 주차별 가입 와셔가 N주차에 활동한 비율. 정확한 지표는 Posthog/Umami 도입 시 교체.
          </p>
          <CohortTable />
        </section>

        <footer className="pt-6 border-t border-[color:var(--neutral-100)] text-[11px] text-[color:var(--neutral-500)] font-mono-nu">
          전체 JSON: <code className="text-[color:var(--neutral-900)]">GET /api/admin/analytics</code>
        </footer>
      </div>
    </div>
  );
}

async function CohortTable() {
  const supabase = await createClient();
  const { data: profs } = await supabase
    .from("profiles")
    .select("id, created_at, updated_at")
    .gte("created_at", new Date(Date.now() - 8 * 7 * 86400000).toISOString())
    .order("created_at", { ascending: false });

  function weekKey(d: Date) {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - copy.getDay());
    return copy.toISOString().slice(0, 10);
  }

  const cohorts = new Map<string, { size: number; retention: number[] }>();
  for (const p of profs ?? []) {
    const signed = new Date(p.created_at);
    const key = weekKey(signed);
    const entry = cohorts.get(key) ?? { size: 0, retention: Array(8).fill(0) };
    entry.size += 1;
    const updated = new Date(p.updated_at);
    const weeksAfter = Math.floor((updated.getTime() - signed.getTime()) / (7 * 86400000));
    if (weeksAfter >= 0 && weeksAfter < 8) entry.retention[weeksAfter] += 1;
    cohorts.set(key, entry);
  }

  const rows = [...cohorts.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 8);

  if (rows.length === 0) {
    return <div className="p-6 text-center text-[13px] text-[color:var(--neutral-500)] border border-[color:var(--neutral-100)] rounded-[var(--ds-radius-lg)]">최근 8주 내 가입 데이터가 없어요</div>;
  }

  return (
    <div className="overflow-x-auto border border-[color:var(--neutral-100)] rounded-[var(--ds-radius-lg)]">
      <table className="w-full">
        <thead className="bg-[color:var(--neutral-25)]">
          <tr className="border-b border-[color:var(--neutral-100)]">
            <th className="text-left p-2 font-mono-nu text-[10px] uppercase tracking-widest text-[color:var(--neutral-500)]">주차</th>
            <th className="text-right p-2 font-mono-nu text-[10px] uppercase tracking-widest text-[color:var(--neutral-500)]">규모</th>
            {["W0", "W1", "W2", "W3", "W4", "W5", "W6", "W7"].map((w) => (
              <th key={w} className="text-center p-2 font-mono-nu text-[10px] uppercase text-[color:var(--neutral-500)]">{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([week, v]) => (
            <tr key={week} className="border-b border-[color:var(--neutral-100)] last:border-0">
              <td className="p-2 text-[12px] font-mono-nu text-[color:var(--neutral-900)]">{week}</td>
              <td className="p-2 text-right text-[12px] tabular-nums font-mono-nu">{v.size}</td>
              {v.retention.map((c, i) => {
                const pct = v.size ? Math.round((c / v.size) * 100) : 0;
                return (
                  <td key={i} className="p-2 text-center">
                    <div
                      className="inline-block w-9 h-7 rounded-[var(--ds-radius-sm)] flex items-center justify-center text-[10px] tabular-nums font-mono-nu"
                      style={{
                        background: pct > 0 ? `rgba(255, 61, 136, ${Math.min(1, pct / 80)})` : "transparent",
                        color: pct > 40 ? "#fff" : "var(--neutral-700)",
                        border: pct === 0 ? "1px dashed var(--neutral-100)" : "none",
                      }}
                    >
                      {pct === 0 ? "·" : `${pct}%`}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
