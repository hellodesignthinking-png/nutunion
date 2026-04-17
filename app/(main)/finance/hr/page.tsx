import Link from "next/link";
import { getHRDashboard } from "@/lib/finance/hr-queries";
import { getCompanies } from "@/lib/finance/company-queries";

export const dynamic = "force-dynamic";

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

export default async function FinanceHRPage() {
  const [data, companies] = await Promise.all([getHRDashboard(), getCompanies()]);
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-3 flex gap-4 items-center">
        <Link href="/finance" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← 재무 홈
        </Link>
      </div>

      <div className="mb-8">
        <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
          HR · 인사관리
        </div>
        <h1 className="text-[24px] sm:text-[32px] font-bold text-nu-ink leading-tight">
          인사 대시보드
        </h1>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">재직 직원</div>
          <div className="text-[22px] font-bold text-nu-ink">
            {data.activeEmployees}
            <span className="text-[13px] text-nu-graphite ml-1">/ {data.totalEmployees}명</span>
          </div>
        </div>
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">이달 급여</div>
          <div className="text-[18px] font-bold text-green-700 break-all">
            ₩{fmt(data.thisMonthPayrollTotal)}
          </div>
          <div className="text-[10px] text-nu-graphite mt-1">{data.thisMonthPayrollCount}명 지급</div>
        </div>
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">오늘 휴가</div>
          <div className="text-[22px] font-bold text-nu-pink">{data.onLeaveToday}<span className="text-[13px] text-nu-graphite ml-1">명</span></div>
        </div>
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">계약 대기</div>
          <div className="text-[22px] font-bold text-orange-600">{data.pendingContracts}<span className="text-[13px] text-nu-graphite ml-1">건</span></div>
        </div>
      </div>

      {/* 섹션 네비 */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link href="/finance/hr/employees" className="border-[2.5px] border-nu-ink bg-nu-paper px-5 py-3 font-mono-nu text-[12px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors">
          👥 직원 목록
        </Link>
        <Link href="/finance/hr/attendance" className="border-[2.5px] border-nu-ink bg-nu-paper px-5 py-3 font-mono-nu text-[12px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors">
          📅 근태 현황
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 법인별 */}
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink mb-4">
            법인별 인원 / 연봉
          </div>
          {Object.keys(data.byCompany).length === 0 ? (
            <div className="text-[13px] text-nu-graphite">등록된 직원이 없습니다</div>
          ) : (
            <div className="flex flex-col gap-3">
              {Object.entries(data.byCompany).map(([cid, v]) => {
                const comp = companyMap.get(cid);
                return (
                  <Link key={cid} href={`/finance/hr/employees?company=${cid}`} className="flex justify-between items-center py-2 border-b border-nu-ink/10 no-underline hover:bg-nu-ink/5 -mx-2 px-2">
                    <div>
                      <div className="text-[13px] font-bold text-nu-ink">{comp?.name || cid}</div>
                      <div className="text-[10px] text-nu-graphite">재직 {v.active}명 / 전체 {v.total}명</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-bold text-green-700">₩{fmt(v.totalSalary)}</div>
                      <div className="text-[10px] text-nu-graphite">연봉 합계</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 고용형태별 */}
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink mb-4">
            고용형태 분포
          </div>
          {Object.keys(data.byEmploymentType).length === 0 ? (
            <div className="text-[13px] text-nu-graphite">없음</div>
          ) : (
            <div className="flex flex-col gap-3">
              {Object.entries(data.byEmploymentType).map(([type, count]) => {
                const pct = data.totalEmployees > 0 ? (count / data.totalEmployees) * 100 : 0;
                return (
                  <div key={type}>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="text-nu-ink font-medium">{type}</span>
                      <span className="text-nu-graphite font-mono-nu">{count}명 · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-nu-ink/10 overflow-hidden">
                      <div className="h-full bg-nu-pink" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 구 시스템 링크 */}
      <div className="mt-12 pt-6 border-t border-nu-ink/10 text-center">
        <p className="text-[12px] text-nu-graphite mb-3">
          직원 등록·수정, 급여 지급 처리, 연차 신청은 구 재무시스템에서 사용하실 수 있습니다.
        </p>
        <a
          href="https://nutunion-finance.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-6 py-3 font-mono-nu text-[12px] uppercase tracking-widest no-underline"
        >
          구 재무시스템 열기 ↗
        </a>
      </div>
    </div>
  );
}
