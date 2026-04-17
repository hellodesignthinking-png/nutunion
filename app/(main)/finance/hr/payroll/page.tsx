import Link from "next/link";
import { getMonthlyPayroll } from "@/lib/finance/payroll-queries";
import { getCompanies } from "@/lib/finance/company-queries";
import { parseYearMonth, prevMonth, nextMonth } from "@/lib/finance/date-utils";
import { fmtKRW } from "@/lib/finance/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "급여 관리" };

interface PageProps {
  searchParams: Promise<{ company?: string; month?: string }>;
}

export default async function PayrollPage({ searchParams }: PageProps) {
  const { company = "all", month } = await searchParams;
  const { ym: currentMonth, y, m } = parseYearMonth(month);

  const [rows, companies] = await Promise.all([
    getMonthlyPayroll(currentMonth, company),
    getCompanies(),
  ]);
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  const paidCount = rows.filter((r) => r.payroll).length;
  const totalNet = rows.reduce((s, r) => s + (r.payroll?.net_pay || 0), 0);
  const totalPay = rows.reduce((s, r) => s + (r.payroll?.total_pay || 0), 0);
  const totalDeduction = rows.reduce((s, r) => s + (r.payroll?.total_deduction || 0), 0);

  const prevM = prevMonth(y, m);
  const nextM = nextMonth(y, m);
  const qs = (opts: { company?: string; month?: string }) => {
    const p = new URLSearchParams();
    if (opts.company) p.set("company", opts.company);
    if (opts.month) p.set("month", opts.month);
    return p.toString() ? `?${p.toString()}` : "";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4 flex gap-4 items-center">
        <Link href="/finance/hr" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← HR
        </Link>
      </div>

      <div className="mb-6">
        <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
          PAYROLL · 급여
        </div>
        <h1 className="text-[24px] sm:text-[32px] font-bold text-nu-ink leading-tight">
          월별 급여 관리
        </h1>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div className="flex gap-1 border-[2.5px] border-nu-ink bg-nu-paper overflow-x-auto">
          {companies.map((c) => (
            <Link
              key={c.id}
              href={`/finance/hr/payroll${qs({ company: c.id, month: currentMonth })}`}
              className={`px-3 py-2 font-mono-nu text-[11px] uppercase tracking-wider whitespace-nowrap no-underline ${
                company === c.id ? "bg-nu-ink text-nu-paper" : "text-nu-graphite hover:text-nu-ink"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1 border-[2.5px] border-nu-ink bg-nu-paper">
          <Link href={`/finance/hr/payroll${qs({ company, month: prevM })}`} className="px-3 py-2 font-mono-nu text-[14px] no-underline hover:bg-nu-ink/5">◀</Link>
          <span className="px-3 py-2 font-mono-nu text-[12px] font-bold tracking-wider">{currentMonth}</span>
          <Link href={`/finance/hr/payroll${qs({ company, month: nextM })}`} className="px-3 py-2 font-mono-nu text-[14px] no-underline hover:bg-nu-ink/5">▶</Link>
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Stat label="지급 완료" value={`${paidCount}/${rows.length}명`} accent={paidCount < rows.length ? "text-orange-600" : "text-green-700"} />
        <Stat label="총 지급액" value={`₩${fmtKRW(totalPay)}`} />
        <Stat label="총 공제" value={`-₩${fmtKRW(totalDeduction)}`} accent="text-red-600" />
        <Stat label="실수령액 합계" value={`₩${fmtKRW(totalNet)}`} accent="text-green-700" />
      </div>

      {/* 테이블 */}
      {rows.length === 0 ? (
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-12 text-center">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite">NO EMPLOYEES</div>
          <p className="text-[13px] text-nu-graphite mt-2">재직 중인 직원이 없습니다</p>
        </div>
      ) : (
        <div className="border-[2.5px] border-nu-ink bg-nu-paper overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-[2px] border-nu-ink">
                  <th className="px-4 py-3 text-left font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink">직원</th>
                  <th className="px-2 py-3 text-left font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink">법인</th>
                  <th className="px-2 py-3 text-right font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink">기본급</th>
                  <th className="px-2 py-3 text-right font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink">지급합계</th>
                  <th className="px-2 py-3 text-right font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink">공제</th>
                  <th className="px-2 py-3 text-right font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink">실수령</th>
                  <th className="px-2 py-3 text-center font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink">상태</th>
                  <th className="px-2 py-3 text-center font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nu-ink/10">
                {rows.map((r) => {
                  const comp = companyMap.get(r.employee.company);
                  const p = r.payroll;
                  const isPaid = !!p;
                  return (
                    <tr key={r.employee.id} className="hover:bg-nu-ink/5">
                      <td className="px-4 py-3">
                        <Link href={`/finance/hr/payroll/${r.employee.id}?month=${currentMonth}`} className="text-[13px] font-bold text-nu-ink no-underline hover:underline">
                          {r.employee.name}
                        </Link>
                        <div className="text-[10px] text-nu-graphite">{r.employee.position} {r.employee.employment_type && `· ${r.employee.employment_type}`}</div>
                      </td>
                      <td className="px-2 py-3">
                        <span className="font-mono-nu text-[9px] uppercase tracking-wider" style={{ color: comp?.color || "#0D0D0D" }}>
                          {comp?.name?.slice(0, 5) || "-"}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right font-mono-nu text-[12px] text-nu-ink">
                        {p ? `₩${fmtKRW(p.base_pay)}` : "-"}
                      </td>
                      <td className="px-2 py-3 text-right font-mono-nu text-[12px] text-nu-blue">
                        {p ? `₩${fmtKRW(p.total_pay)}` : "-"}
                      </td>
                      <td className="px-2 py-3 text-right font-mono-nu text-[12px] text-red-600">
                        {p ? `-₩${fmtKRW(p.total_deduction)}` : "-"}
                      </td>
                      <td className="px-2 py-3 text-right font-mono-nu text-[13px] font-bold text-green-700">
                        {p ? `₩${fmtKRW(p.net_pay)}` : "-"}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {isPaid ? (
                          <span className="font-mono-nu text-[9px] uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5">완료</span>
                        ) : (
                          <span className="font-mono-nu text-[9px] uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5">미지급</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <div className="flex gap-1 justify-center">
                          <Link
                            href={`/finance/hr/payroll/${r.employee.id}?month=${currentMonth}`}
                            className="font-mono-nu text-[9px] uppercase tracking-wider px-2 py-1 border border-nu-ink/30 hover:bg-nu-ink hover:text-nu-paper no-underline"
                          >
                            {isPaid ? "수정" : "계산"}
                          </Link>
                          {isPaid && (
                            <Link
                              href={`/finance/hr/payroll/${r.employee.id}/print?month=${currentMonth}`}
                              target="_blank"
                              className="font-mono-nu text-[9px] uppercase tracking-wider px-2 py-1 bg-nu-pink text-nu-paper no-underline hover:bg-nu-ink"
                            >
                              명세서
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
      <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">{label}</div>
      <div className={`text-[18px] font-bold break-all ${accent || "text-nu-ink"}`}>{value}</div>
    </div>
  );
}
