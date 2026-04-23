import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations — Admin · nutunion" };

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const host = h.get("host") ?? "nutunion.co.kr";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  let data: any = null;
  try {
    const res = await fetch(`${origin}/api/health/integrations`, { headers: { cookie }, cache: "no-store" });
    if (res.ok) data = await res.json();
  } catch {}

  const byCategory = (data?.services ?? []).reduce((acc: any, s: any) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="reader-shell min-h-screen">
      <div className="max-w-[960px] mx-auto px-4 md:px-6 py-8 space-y-6">
        <Link href="/admin/overview" className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-[color:var(--neutral-500)] hover:text-[color:var(--neutral-900)] no-underline">
          <ArrowLeft size={11} /> Admin
        </Link>

        <header>
          <p className="reader-meta">Admin</p>
          <h1 className="reader-h1 mt-0.5">Integrations Health</h1>
          <p className="reader-meta mt-1">외부 서비스 연결 상태 · 각 항목은 환경변수 기준이며 실제 연결 검증은 아래 테스트 링크로.</p>
        </header>

        {/* 요약 */}
        {data?.summary && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="전체" value={data.summary.total} />
            <StatCard label="설정됨" value={data.summary.configured} tone="green" />
            <StatCard label="미설정" value={data.summary.missing} tone="amber" />
            <StatCard label="daily_metrics rows" value={data.db?.daily_metrics_rows ?? "—"} />
          </section>
        )}

        {/* 카테고리별 */}
        {Object.entries(byCategory).map(([category, services]: any) => (
          <section key={category}>
            <h2 className="reader-h2 mb-2">{category}</h2>
            <div className="space-y-2">
              {services.map((s: any) => (
                <div key={s.name} className={`flex items-start gap-3 p-3 rounded-[var(--ds-radius-lg)] border ${s.envPresent ? "border-[color:var(--neutral-100)] bg-[color:var(--neutral-0)]" : "border-amber-200 bg-amber-50"}`}>
                  <div className="mt-0.5 shrink-0">
                    {s.envPresent ? <CheckCircle2 size={16} className="text-green-600" /> : <AlertCircle size={16} className="text-amber-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[14px] text-[color:var(--neutral-900)]">{s.name}</div>
                    <div className="text-[12px] text-[color:var(--neutral-500)] mt-0.5">{s.note}</div>
                  </div>
                  <span className={`font-mono-nu text-[10px] uppercase tracking-widest shrink-0 ${s.envPresent ? "text-green-700" : "text-amber-700"}`}>
                    {s.envPresent ? "설정됨" : "미설정"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="pt-6 border-t border-[color:var(--neutral-100)]">
          <h2 className="reader-h2 mb-3">빠른 테스트 링크</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/payment-test" className="px-3 py-2 border border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] text-[12px] text-[color:var(--neutral-700)] no-underline hover:bg-[color:var(--neutral-50)]">결제 1,000원 테스트 →</Link>
            <Link href="/api/health/integrations" className="px-3 py-2 border border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] text-[12px] text-[color:var(--neutral-700)] no-underline hover:bg-[color:var(--neutral-50)]">원시 JSON →</Link>
            <Link href="/admin/analytics" className="px-3 py-2 border border-[color:var(--neutral-200)] rounded-[var(--ds-radius-md)] text-[12px] text-[color:var(--neutral-700)] no-underline hover:bg-[color:var(--neutral-50)]">Funnel & Cohort →</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "green" | "amber" }) {
  const color = tone === "green" ? "text-green-700" : tone === "amber" ? "text-amber-700" : "text-[color:var(--neutral-900)]";
  return (
    <div className="p-3 rounded-[var(--ds-radius-lg)] border border-[color:var(--neutral-100)] bg-[color:var(--neutral-0)]">
      <div className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-[color:var(--neutral-500)]">{label}</div>
      <div className={`text-[22px] font-semibold tabular-nums ${color} mt-0.5`}>{value}</div>
    </div>
  );
}
