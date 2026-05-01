import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Activity, AlertCircle, Clock, DollarSign, Cpu, Lock, ChevronRight,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "운영 Metrics — Admin" };

async function fetchMetrics() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return null;

  const now = new Date();
  const iso24h = new Date(now.getTime() - 86400_000).toISOString();
  const iso7d = new Date(now.getTime() - 7 * 86400_000).toISOString();

  const [
    aiUsage24h, aiUsage7d, aiTopFeatures,
    cronRecent, leaseCount,
    auditLogs7d,
  ] = await Promise.all([
    // AI 24h 호출 + 토큰 합
    supabase.from("ai_usage_logs")
      .select("input_tokens, output_tokens, cost_krw, accepted, error")
      .gte("created_at", iso24h),
    // AI 7d 호출 합
    supabase.from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", iso7d),
    // AI feature 별 7일 호출 분포
    supabase.from("ai_usage_logs")
      .select("feature, model")
      .gte("created_at", iso7d),
    // 최근 cron 호출 — Vercel function logs 미접근, 대신 가장 최근 finance_audit_logs 또는 자체 흔적
    // 대안: ai_usage_logs 에 cron 흔적이 없으면 쿼리 결과로 빈 배열
    supabase.from("automation_logs")
      .select("id, event, status, executed_at")
      .order("executed_at", { ascending: false })
      .limit(10),
    // 활성 lease 수 (lease 테이블 — 마이그 136)
    supabase.from("resource_leases")
      .select("lock_key, acquired_at", { count: "exact" })
      .gte("acquired_at", new Date(Date.now() - 60 * 60_000).toISOString())
      .limit(20),
    // finance audit 7일
    supabase.from("finance_audit_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", iso7d)
      .then((r) => r, () => ({ count: 0 })),
  ]);

  // 집계
  const aiRows = (aiUsage24h.data ?? []) as Array<{ input_tokens: number; output_tokens: number; cost_krw: number | null; accepted: boolean | null; error: string | null }>;
  const aiCalls24h = aiRows.length;
  const aiTokens24h = aiRows.reduce((sum, r) => sum + (r.input_tokens || 0) + (r.output_tokens || 0), 0);
  const aiCostKrw24h = aiRows.reduce((sum, r) => sum + (r.cost_krw || 0), 0);
  const aiErrors24h = aiRows.filter((r) => r.error).length;

  const featureCounts = new Map<string, number>();
  for (const row of (aiTopFeatures.data ?? []) as Array<{ feature: string }>) {
    const k = row.feature || "unknown";
    featureCounts.set(k, (featureCounts.get(k) ?? 0) + 1);
  }
  const topFeatures = Array.from(featureCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return {
    ai: {
      calls24h: aiCalls24h,
      tokens24h: aiTokens24h,
      costKrw24h: aiCostKrw24h,
      errors24h: aiErrors24h,
      calls7d: aiUsage7d.count ?? 0,
      topFeatures,
    },
    automation: cronRecent.data ?? [],
    leaseCount: leaseCount.count ?? 0,
    activeLeases: (leaseCount.data ?? []) as Array<{ lock_key: string; acquired_at: string }>,
    auditCount7d: auditLogs7d.count ?? 0,
  };
}

export default async function MetricsPage() {
  const m = await fetchMetrics();
  if (!m) redirect("/dashboard");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="font-head text-2xl font-extrabold text-nu-ink">운영 Metrics</h1>
        <p className="text-sm text-nu-muted mt-1">AI 사용량 · cron 상태 · lease 활성 수 · 감사 로그</p>
      </div>

      {/* AI 24h */}
      <section className="border-[3px] border-nu-ink bg-white shadow-[3px_3px_0_0_#0D0F14]">
        <header className="px-4 py-2 border-b-[2px] border-nu-ink/15 bg-nu-cream/30 flex items-center gap-2">
          <Cpu size={14} className="text-nu-pink" />
          <h2 className="font-head text-base font-extrabold text-nu-ink">AI 사용량</h2>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-nu-ink/10">
          <Stat label="24h 호출" value={m.ai.calls24h} sub={`7일 ${m.ai.calls7d}회`} />
          <Stat label="24h 토큰" value={m.ai.tokens24h.toLocaleString()} />
          <Stat label="24h 비용" value={`₩${m.ai.costKrw24h.toLocaleString()}`} accent={m.ai.costKrw24h > 50_000 ? "text-red-700" : "text-nu-ink"} />
          <Stat label="24h 오류" value={m.ai.errors24h} accent={m.ai.errors24h > 0 ? "text-red-700" : "text-nu-muted"} />
        </div>
        {m.ai.topFeatures.length > 0 && (
          <div className="px-4 py-3 border-t border-nu-ink/10">
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">7일 Top features</div>
            <div className="flex flex-wrap gap-1.5">
              {m.ai.topFeatures.map(([feat, count]) => (
                <span key={feat} className="font-mono-nu text-[11px] px-2 py-0.5 border border-nu-ink/20 bg-nu-cream/30">
                  {feat} <strong className="text-nu-ink">{count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* lease + automation */}
      <div className="grid md:grid-cols-2 gap-6">
        <section className="border-[3px] border-nu-ink bg-white shadow-[3px_3px_0_0_#0D0F14]">
          <header className="px-4 py-2 border-b-[2px] border-nu-ink/15 bg-nu-cream/30 flex items-center gap-2">
            <Lock size={14} className="text-emerald-700" />
            <h2 className="font-head text-base font-extrabold text-nu-ink">활성 Lease (1h)</h2>
          </header>
          <div className="px-4 py-3">
            <div className="font-head text-2xl font-extrabold text-nu-ink mb-2">{m.leaseCount}</div>
            {m.activeLeases.length > 0 ? (
              <ul className="text-[12px] space-y-1">
                {m.activeLeases.slice(0, 6).map((l) => (
                  <li key={l.lock_key} className="flex justify-between gap-2 border-b border-nu-ink/5 py-1">
                    <span className="font-mono-nu truncate">{l.lock_key}</span>
                    <span className="font-mono-nu text-nu-muted shrink-0">
                      {new Date(l.acquired_at).toLocaleTimeString("ko", { hour12: false })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-nu-muted">활성 lease 없음 (정상)</p>
            )}
            <p className="text-[11px] text-nu-muted mt-2">
              {m.leaseCount > 5 && (
                <span className="text-amber-700 inline-flex items-center gap-1">
                  <AlertCircle size={11} /> 동시 lease 많음 — 좀비 가능성 점검
                </span>
              )}
            </p>
          </div>
        </section>

        <section className="border-[3px] border-nu-ink bg-white shadow-[3px_3px_0_0_#0D0F14]">
          <header className="px-4 py-2 border-b-[2px] border-nu-ink/15 bg-nu-cream/30 flex items-center gap-2">
            <Activity size={14} className="text-indigo-700" />
            <h2 className="font-head text-base font-extrabold text-nu-ink">최근 자동화</h2>
          </header>
          <div className="px-4 py-3">
            {m.automation.length > 0 ? (
              <ul className="text-[12px] space-y-1.5">
                {m.automation.map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 border-b border-nu-ink/5 py-1">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono-nu text-[11px] truncate">{a.event}</div>
                      <div className="font-mono-nu text-[10px] text-nu-muted">{new Date(a.executed_at).toLocaleString("ko")}</div>
                    </div>
                    <span className={`font-mono-nu text-[10px] px-2 py-0.5 border ${a.status === "ok" || a.status === "success" ? "border-emerald-700 text-emerald-700" : "border-red-700 text-red-700"}`}>
                      {a.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-nu-muted">최근 자동화 기록 없음</p>
            )}
          </div>
        </section>
      </div>

      {/* 감사 + Vercel 안내 */}
      <section className="border-[3px] border-nu-ink bg-white shadow-[3px_3px_0_0_#0D0F14]">
        <header className="px-4 py-2 border-b-[2px] border-nu-ink/15 bg-nu-cream/30 flex items-center gap-2">
          <Clock size={14} className="text-amber-700" />
          <h2 className="font-head text-base font-extrabold text-nu-ink">감사 / Cron</h2>
        </header>
        <div className="grid grid-cols-2 divide-x divide-nu-ink/10">
          <Stat label="Finance 감사 7일" value={m.auditCount7d} />
          <div className="px-4 py-3">
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">Vercel Cron 상태</div>
            <a
              href="https://vercel.com/hellodesignthinking-9738s-projects/nutunion/settings/cron-jobs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-nu-pink hover:underline inline-flex items-center gap-1"
            >
              대시보드에서 보기 <ChevronRight size={12} />
            </a>
            <p className="text-[11px] text-nu-muted mt-1">14개 cron 등록됨 (모두 daily — Hobby 호환)</p>
          </div>
        </div>
      </section>

      <div className="text-[11px] text-nu-muted">
        <DollarSign size={11} className="inline" /> 비용은 USD_TO_KRW 환율 기반 추정.
        실시간 정확도는 Vercel · 공급자 콘솔 참고.
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent = "text-nu-ink" }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="px-4 py-3">
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{label}</div>
      <div className={`font-head text-2xl font-extrabold mt-1 ${accent}`}>{value}</div>
      {sub && <div className="text-[11px] text-nu-muted mt-0.5">{sub}</div>}
    </div>
  );
}
