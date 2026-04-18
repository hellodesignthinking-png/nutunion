import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getTableCounts,
  getCronStatus,
  pingDatabase,
} from "@/lib/finance/status-queries";
import { fmtKRW } from "@/lib/finance/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "운영 상태" };

export default async function StatusPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") redirect("/finance");

  const [ping, tables, cron] = await Promise.all([
    pingDatabase(),
    getTableCounts(),
    getCronStatus(),
  ]);

  const totalRows = tables.reduce((s, t) => s + t.count, 0);
  const nowMs = Date.now();
  const lastAuditAgo = cron.last_audit_log_created
    ? Math.floor((nowMs - new Date(cron.last_audit_log_created).getTime()) / 1000)
    : null;
  const oldestAuditDays = cron.oldest_audit_log
    ? Math.floor((nowMs - new Date(cron.oldest_audit_log).getTime()) / (24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-1">
          Operations · System Status
        </div>
        <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink">운영 상태</h1>
        <p className="text-[12px] text-nu-graphite mt-1">
          DB 연결 · 테이블 규모 · 크론 · 감사 로그 건강도. Admin 전용.
        </p>
      </div>

      {/* DB 연결 */}
      <div className={`mb-6 border-[2.5px] p-4 ${ping.ok ? "border-green-700 bg-green-50" : "border-red-600 bg-red-50"}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">DB</div>
          <div className={`font-mono-nu text-[13px] font-bold ${ping.ok ? "text-green-700" : "text-red-600"}`}>
            {ping.ok ? "● HEALTHY" : "● ERROR"}
          </div>
          <div className="font-mono-nu text-[11px] text-nu-graphite">{ping.duration_ms}ms</div>
          {ping.error && (
            <div className="font-mono-nu text-[11px] text-red-600 ml-auto">{ping.error}</div>
          )}
        </div>
      </div>

      {/* 테이블 카운트 */}
      <div className="mb-6 border-[2.5px] border-nu-ink bg-nu-paper">
        <div className="px-4 py-3 border-b-[2px] border-nu-ink flex justify-between items-center">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
            테이블 규모
          </div>
          <div className="font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">
            총 {fmtKRW(totalRows)} 행
          </div>
        </div>
        <div className="divide-y divide-nu-ink/10">
          {tables.map((t) => {
            const isLarge = t.count > 10000;
            const isEmpty = t.count === 0;
            return (
              <div key={t.table} className="px-4 py-2.5 grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                <div className="font-mono-nu text-[12px] text-nu-ink">{t.table}</div>
                <div className={`font-mono-nu text-[13px] font-bold tabular-nums ${
                  isLarge ? "text-orange-600" : isEmpty ? "text-nu-graphite" : "text-nu-ink"
                }`}>
                  {t.error ? "ERROR" : fmtKRW(t.count)}
                </div>
                <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
                  {t.error ? t.error.slice(0, 40) : isLarge ? "LARGE" : isEmpty ? "EMPTY" : "OK"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 감사 로그 / 크론 건강도 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-3">
            감사 로그
          </div>
          <Row label="총 건수" value={fmtKRW(cron.audit_logs_total)} />
          <Row
            label="최근 기록"
            value={
              lastAuditAgo === null
                ? "(없음)"
                : lastAuditAgo < 60
                ? `${lastAuditAgo}초 전`
                : lastAuditAgo < 3600
                ? `${Math.floor(lastAuditAgo / 60)}분 전`
                : `${Math.floor(lastAuditAgo / 3600)}시간 전`
            }
            warn={lastAuditAgo !== null && lastAuditAgo > 86400}
          />
          <Row
            label="가장 오래된 기록"
            value={oldestAuditDays === null ? "(없음)" : `${oldestAuditDays}일 전`}
            warn={oldestAuditDays !== null && oldestAuditDays > 90}
          />
          {oldestAuditDays !== null && oldestAuditDays > 90 && (
            <div className="mt-3 text-[10px] text-orange-600 bg-orange-50 border border-orange-500 p-2">
              90일 이상 된 로그 존재 — 크론 정상 동작 확인 필요
            </div>
          )}
        </div>

        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-3">
            Rate Limit / AI 사용
          </div>
          <Row
            label="활성 rate limit 키"
            value={fmtKRW(cron.rate_limits_active)}
            warn={cron.rate_limits_active > 10000}
          />
          <Row label="AI 호출 총계" value={fmtKRW(cron.ai_usage_logs_total)} />
        </div>
      </div>

      {/* 운영 가이드 */}
      <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4 text-[11px] text-nu-graphite leading-relaxed">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink mb-2">
          운영 체크리스트
        </div>
        <ul className="list-disc pl-4 space-y-1">
          <li>DB 응답이 1초 이상이면 → Supabase Dashboard → Reports → Query Performance 확인</li>
          <li>가장 오래된 감사 로그가 90일 초과면 → 크론(<code>/api/cron/cleanup-audit-logs</code>) 동작 확인</li>
          <li>활성 rate limit 키가 10,000 초과면 → <code>rate_limits</code> 수동 정리 검토</li>
          <li>테이블 LARGE 경고 (&gt;10k) → 보관 정책 재검토</li>
        </ul>
        <div className="mt-3 font-mono-nu text-[10px] uppercase tracking-wider">
          <a href="/finance/audit" className="text-nu-ink hover:underline mr-3">→ 감사 로그</a>
          <a href="/finance/cost" className="text-nu-ink hover:underline mr-3">→ AI 비용</a>
          <a href="https://supabase.com/dashboard/project/htmrdefcbslgwttjayxt" target="_blank" rel="noopener noreferrer" className="text-nu-ink hover:underline mr-3">→ Supabase</a>
          <a href="https://vercel.com/hellodesignthinking-9738s-projects/nutunion" target="_blank" rel="noopener noreferrer" className="text-nu-ink hover:underline">→ Vercel</a>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-nu-ink/10 last:border-0">
      <span className="font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">
        {label}
      </span>
      <span className={`font-mono-nu text-[13px] font-bold tabular-nums ${warn ? "text-orange-600" : "text-nu-ink"}`}>
        {value}
      </span>
    </div>
  );
}
