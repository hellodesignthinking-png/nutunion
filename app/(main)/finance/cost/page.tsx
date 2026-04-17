import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAiUsageSummary,
  getAiUsageByUser,
  getAiUsageByContent,
  getAiUsageDaily,
  COST_PER_INPUT_TOKEN,
  COST_PER_OUTPUT_TOKEN,
  USD_TO_KRW,
} from "@/lib/finance/cost-queries";
import { fmtKRW } from "@/lib/finance/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI 비용" };

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

const CONTENT_LABELS: Record<string, string> = {
  blog: "블로그",
  sns: "SNS",
  newsletter: "뉴스레터",
  ad: "광고",
  press: "보도자료",
  campaign: "캠페인",
};

const PERIODS = [
  { val: "7d", label: "7일", days: 7 },
  { val: "30d", label: "30일", days: 30 },
  { val: "90d", label: "90일", days: 90 },
];

export default async function AiCostPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/finance");
  }

  const sp = await searchParams;
  const period = PERIODS.find((p) => p.val === sp.period) ?? PERIODS[1];
  const sinceIso = new Date(Date.now() - period.days * 24 * 60 * 60 * 1000).toISOString();

  const [summary, byUser, byContent, daily] = await Promise.all([
    getAiUsageSummary(sinceIso),
    getAiUsageByUser(sinceIso),
    getAiUsageByContent(sinceIso),
    getAiUsageDaily(sinceIso),
  ]);

  // 일별 차트 스케일 계산
  const maxDailyTokens = Math.max(1, ...daily.map((d) => d.input_tokens + d.output_tokens));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-1">
            Finance · AI Cost Monitor
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink">AI 비용</h1>
          <p className="text-[12px] text-nu-graphite mt-1">
            AI Gateway 토큰 사용량 및 비용 추정. Claude Sonnet 4.5 기준
            (input ${COST_PER_INPUT_TOKEN * 1_000_000}, output ${COST_PER_OUTPUT_TOKEN * 1_000_000} / 1M tokens)
          </p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Link
              key={p.val}
              href={`/finance/cost?period=${p.val}`}
              className={`border-[2px] border-nu-ink px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-wider no-underline ${
                p.val === period.val
                  ? "bg-nu-ink text-nu-paper"
                  : "bg-nu-paper text-nu-ink hover:bg-nu-ink hover:text-nu-paper"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat
          label="총 호출"
          value={summary.totalCalls.toLocaleString()}
          subtitle={`성공 ${summary.successCalls} · 실패 ${summary.failedCalls}`}
        />
        <Stat
          label="입력 토큰"
          value={summary.totalInputTokens.toLocaleString()}
        />
        <Stat
          label="출력 토큰"
          value={summary.totalOutputTokens.toLocaleString()}
        />
        <Stat
          label="추정 비용"
          value={`₩${fmtKRW(summary.estimatedKrw)}`}
          subtitle={`$${summary.estimatedUsd.toFixed(2)} @ ₩${USD_TO_KRW}`}
          accent
        />
      </div>

      {/* 일별 트렌드 */}
      {daily.length > 0 && (
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4 mb-6">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-3">
            일별 토큰 사용량
          </div>
          <div className="flex items-end gap-1 h-32 overflow-x-auto">
            {daily.map((d) => {
              const total = d.input_tokens + d.output_tokens;
              const h = Math.max(2, (total / maxDailyTokens) * 120);
              const inputH = (d.input_tokens / Math.max(1, total)) * h;
              const outputH = h - inputH;
              return (
                <div key={d.date} className="flex flex-col items-center gap-1 min-w-[40px]">
                  <div className="font-mono-nu text-[8px] text-nu-graphite" title={`입력 ${d.input_tokens.toLocaleString()} · 출력 ${d.output_tokens.toLocaleString()}`}>
                    {total > 999 ? `${Math.round(total / 1000)}k` : total}
                  </div>
                  <div className="flex flex-col w-6">
                    <div style={{ height: `${outputH}px` }} className="bg-nu-pink" />
                    <div style={{ height: `${inputH}px` }} className="bg-nu-ink" />
                  </div>
                  <div className="font-mono-nu text-[8px] text-nu-graphite">
                    {d.date.slice(5)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3 font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-nu-ink inline-block" /> 입력
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-nu-pink inline-block" /> 출력
            </span>
          </div>
        </div>
      )}

      {/* 사용자별 / 콘텐츠별 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 사용자별 */}
        <div className="border-[2.5px] border-nu-ink bg-nu-paper">
          <div className="px-4 py-3 border-b-[2px] border-nu-ink font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
            사용자별 ({byUser.length})
          </div>
          {byUser.length === 0 ? (
            <div className="p-6 text-center font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">
              NO DATA
            </div>
          ) : (
            <div className="divide-y divide-nu-ink/10">
              {byUser.slice(0, 15).map((u) => (
                <div key={u.actor_email ?? "null"} className="px-4 py-2.5 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                  <div className="min-w-0">
                    <div className="text-[12px] text-nu-ink truncate">{u.actor_email ?? "(시스템)"}</div>
                    <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite mt-0.5">
                      {u.calls}회 · in {u.input_tokens.toLocaleString()} · out {u.output_tokens.toLocaleString()}
                    </div>
                  </div>
                  <div className="font-mono-nu text-[12px] text-nu-ink font-bold whitespace-nowrap">
                    ${u.estimated_usd.toFixed(3)}
                  </div>
                  <div className="font-mono-nu text-[10px] text-nu-graphite whitespace-nowrap">
                    ₩{fmtKRW(Math.round(u.estimated_usd * USD_TO_KRW))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 콘텐츠 유형별 */}
        <div className="border-[2.5px] border-nu-ink bg-nu-paper">
          <div className="px-4 py-3 border-b-[2px] border-nu-ink font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
            콘텐츠 유형별
          </div>
          {byContent.length === 0 ? (
            <div className="p-6 text-center font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">
              NO DATA
            </div>
          ) : (
            <div className="divide-y divide-nu-ink/10">
              {byContent.map((c) => {
                const label = CONTENT_LABELS[c.content_type ?? ""] ?? c.content_type ?? "(없음)";
                return (
                  <div key={c.content_type ?? "null"} className="px-4 py-2.5 grid grid-cols-[1fr_auto] gap-3 items-center">
                    <div>
                      <div className="text-[12px] text-nu-ink">{label}</div>
                      <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite mt-0.5">
                        in {c.input_tokens.toLocaleString()} · out {c.output_tokens.toLocaleString()}
                      </div>
                    </div>
                    <div className="font-mono-nu text-[13px] text-nu-ink font-bold whitespace-nowrap">
                      {c.calls}회
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 text-[10px] text-nu-graphite leading-relaxed">
        · 비용은 <strong>추정치</strong> 이며 AI Gateway / Anthropic 의 실제 청구액과 다를 수 있습니다.
        실제 비용은 <a href="https://vercel.com/dashboard/ai-gateway" target="_blank" rel="noopener noreferrer" className="underline">Vercel AI Gateway 대시보드</a> 에서 확인하세요.
        <br />
        · 환율은 ₩{USD_TO_KRW}/USD 고정. 실시간 환율이 필요하면 `lib/finance/cost-queries.ts` 의 `USD_TO_KRW` 를 수정하세요.
        <br />
        · 이 페이지는 admin/staff 전용이며 RLS 로 보호됩니다.
      </div>
    </div>
  );
}

function Stat({ label, value, subtitle, accent }: { label: string; value: string; subtitle?: string; accent?: boolean }) {
  return (
    <div className={`border-[2.5px] ${accent ? "border-nu-pink bg-nu-pink/5" : "border-nu-ink bg-nu-paper"} p-4`}>
      <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">
        {label}
      </div>
      <div className={`text-[20px] font-bold leading-tight ${accent ? "text-nu-pink" : "text-nu-ink"}`}>
        {value}
      </div>
      {subtitle && (
        <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite mt-1">
          {subtitle}
        </div>
      )}
    </div>
  );
}
