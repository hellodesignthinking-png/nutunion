import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuditLogs, getAuditStatsLast7Days } from "@/lib/finance/audit-queries";
import { getCompanies } from "@/lib/finance/company-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "감사 로그" };

interface PageProps {
  searchParams: Promise<{
    entity?: string;
    action?: string;
    actor?: string;
    company?: string;
    since?: string;
    page?: string;
  }>;
}

const ENTITY_TYPES = [
  { val: "", label: "전체" },
  { val: "transaction", label: "거래" },
  { val: "employee", label: "직원" },
  { val: "payroll", label: "급여" },
  { val: "approval", label: "결재" },
  { val: "contract", label: "계약서" },
  { val: "receipt", label: "영수증" },
];

const ACTION_TYPES = [
  { val: "", label: "전체" },
  { val: "create", label: "등록" },
  { val: "update", label: "수정" },
  { val: "delete", label: "삭제" },
  { val: "batch_delete", label: "일괄삭제" },
  { val: "approve", label: "승인" },
  { val: "reject", label: "반려" },
  { val: "cancel", label: "취소" },
  { val: "send", label: "발송" },
  { val: "sign", label: "서명" },
];

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-50 text-green-700 border-green-700",
  update: "bg-blue-50 text-blue-700 border-blue-700",
  delete: "bg-red-50 text-red-600 border-red-500",
  batch_delete: "bg-red-50 text-red-600 border-red-500",
  approve: "bg-green-50 text-green-700 border-green-700",
  reject: "bg-orange-50 text-orange-600 border-orange-500",
  cancel: "bg-nu-ink/5 text-nu-graphite border-nu-ink/30",
  send: "bg-blue-50 text-blue-700 border-blue-700",
  sign: "bg-green-50 text-green-700 border-green-700",
};

const PAGE_SIZE = 50;

export default async function AuditLogsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    redirect("/finance");
  }

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [{ logs, total }, stats, companies] = await Promise.all([
    getAuditLogs({
      entityType: sp.entity || undefined,
      action: sp.action || undefined,
      actorEmail: sp.actor || undefined,
      company: sp.company || undefined,
      since: sp.since || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    getAuditStatsLast7Days(),
    getCompanies(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilter = !!(sp.entity || sp.action || sp.actor || sp.company || sp.since);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return `/finance/audit${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-1">
          Security · Audit Trail
        </div>
        <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink">감사 로그</h1>
        <p className="text-[12px] text-nu-graphite mt-1">
          재무/인사/결재 시스템의 모든 데이터 변경 기록. Admin 전용.
        </p>
      </div>

      {/* 최근 7일 통계 */}
      {stats.length > 0 && (
        <div className="mb-6 border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-3">
            최근 7일 활동
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.map((s) => {
              const label = ENTITY_TYPES.find((e) => e.val === s.entityType)?.label ?? s.entityType;
              return (
                <Link
                  key={s.entityType}
                  href={buildHref({ entity: s.entityType, page: undefined })}
                  className="border-[2px] border-nu-ink px-3 py-1.5 font-mono-nu text-[11px] text-nu-ink hover:bg-nu-ink hover:text-nu-paper no-underline"
                >
                  {label} · <span className="font-bold">{s.count}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 필터 */}
      <form method="get" className="mb-6 border-[2.5px] border-nu-ink bg-nu-paper p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <label className="block">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">엔터티</div>
          <select
            name="entity"
            defaultValue={sp.entity ?? ""}
            className="w-full border-[2px] border-nu-ink bg-nu-paper px-2 py-1.5 text-[12px] outline-none"
          >
            {ENTITY_TYPES.map((e) => <option key={e.val} value={e.val}>{e.label}</option>)}
          </select>
        </label>

        <label className="block">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">액션</div>
          <select
            name="action"
            defaultValue={sp.action ?? ""}
            className="w-full border-[2px] border-nu-ink bg-nu-paper px-2 py-1.5 text-[12px] outline-none"
          >
            {ACTION_TYPES.map((a) => <option key={a.val} value={a.val}>{a.label}</option>)}
          </select>
        </label>

        <label className="block">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">법인</div>
          <select
            name="company"
            defaultValue={sp.company ?? ""}
            className="w-full border-[2px] border-nu-ink bg-nu-paper px-2 py-1.5 text-[12px] outline-none"
          >
            <option value="">전체</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label className="block">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">작성자 이메일</div>
          <input
            name="actor"
            type="text"
            defaultValue={sp.actor ?? ""}
            placeholder="부분 일치"
            className="w-full border-[2px] border-nu-ink bg-nu-paper px-2 py-1.5 text-[12px] outline-none"
          />
        </label>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-3 py-1.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink"
          >
            적용
          </button>
          {hasFilter && (
            <Link
              href="/finance/audit"
              className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-3 py-1.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5 no-underline"
            >
              초기화
            </Link>
          )}
        </div>
      </form>

      {/* 로그 테이블 */}
      <div className="border-[2.5px] border-nu-ink bg-nu-paper overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b-[2px] border-nu-ink flex-wrap gap-2">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
            {total}건 {hasFilter && "(필터 적용됨)"}
          </div>
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite">
            Page {page} / {totalPages}
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="p-10 text-center">
            <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite">
              NO AUDIT LOGS
            </div>
          </div>
        ) : (
          <div className="divide-y divide-nu-ink/10">
            {logs.map((log) => {
              const company = log.company ? companies.find((c) => c.id === log.company) : null;
              const entityLabel = ENTITY_TYPES.find((e) => e.val === log.entity_type)?.label ?? log.entity_type;
              return (
                <div key={log.id} className="px-4 py-3 grid grid-cols-1 md:grid-cols-[150px_100px_80px_1fr_160px] gap-3 items-start">
                  <div>
                    <div className="font-mono-nu text-[11px] text-nu-ink">
                      {new Date(log.created_at).toLocaleString("ko-KR", {
                        year: "numeric", month: "2-digit", day: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div>
                    <span className={`inline-block font-mono-nu text-[10px] uppercase tracking-wider border-[2px] px-2 py-0.5 ${ACTION_COLORS[log.action] ?? "border-nu-ink/30 text-nu-graphite"}`}>
                      {ACTION_TYPES.find((a) => a.val === log.action)?.label ?? log.action}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite">
                      {entityLabel}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] text-nu-ink break-words">
                      {log.summary ?? `${entityLabel} ${log.action}`}
                    </div>
                    {company && (
                      <div className="font-mono-nu text-[9px] uppercase tracking-wider mt-0.5" style={{ color: company.color || "#888" }}>
                        {company.name}
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-nu-graphite text-right">
                    <div className="font-medium">{log.actor_email ?? "(시스템)"}</div>
                    {log.actor_role && (
                      <div className="font-mono-nu text-[9px] uppercase tracking-wider">{log.actor_role}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 px-4 py-3 border-t-[2px] border-nu-ink">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="border-[2px] border-nu-ink bg-nu-paper text-nu-ink px-3 py-1 font-mono-nu text-[10px] uppercase tracking-wider hover:bg-nu-ink hover:text-nu-paper no-underline"
              >
                ← 이전
              </Link>
            )}
            <span className="font-mono-nu text-[11px] text-nu-graphite px-2">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="border-[2px] border-nu-ink bg-nu-paper text-nu-ink px-3 py-1 font-mono-nu text-[10px] uppercase tracking-wider hover:bg-nu-ink hover:text-nu-paper no-underline"
              >
                다음 →
              </Link>
            )}
          </div>
        )}
      </div>

      <p className="mt-4 text-[10px] text-nu-graphite">
        로그는 append-only 입니다. 수정/삭제 불가. 90일 이상 지난 로그는 별도 cron 으로 정리 가능.
      </p>
    </div>
  );
}
