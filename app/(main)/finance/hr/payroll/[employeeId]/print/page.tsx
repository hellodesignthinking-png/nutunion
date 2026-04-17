import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPayrollRecord } from "@/lib/finance/payroll-queries";
import { getCompanies } from "@/lib/finance/company-queries";
import { parseYearMonth } from "@/lib/finance/date-utils";
import { fmtKRW } from "@/lib/finance/format";
import { PrintButton } from "@/components/finance/print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "급여명세서" };

interface PageProps {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ month?: string }>;
}

export default async function PayslipPrintPage({ params, searchParams }: PageProps) {
  const { employeeId } = await params;
  const { month } = await searchParams;
  const { ym: currentMonth } = parseYearMonth(month);

  const supabase = await createClient();
  const [empRes, companies, payroll] = await Promise.all([
    supabase.from("employees").select("*").eq("id", employeeId).single(),
    getCompanies(),
    getPayrollRecord(employeeId, currentMonth),
  ]);

  if (!empRes.data || !payroll) notFound();
  const employee = empRes.data;
  const company = companies.find((c) => c.id === employee.company);

  const payItems = [
    ["기본급", payroll.base_pay],
    ["연장근로수당", payroll.overtime_pay],
    ["상여금", payroll.bonus_pay],
    ["연차수당", payroll.annual_leave_pay],
  ].filter(([, v]) => Number(v) > 0);

  const deductionItems: [string, number][] = [
    ["국민연금", payroll.national_pension],
    ["건강보험", payroll.health_insurance],
    ["장기요양보험", payroll.long_term_care],
    ["고용보험", payroll.employment_insurance],
    ["소득세", payroll.income_tax],
    ["지방소득세", payroll.local_income_tax],
  ];

  return (
    <div className="min-h-screen bg-nu-paper print:bg-white">
      {/* 인쇄 버튼 (화면에서만) */}
      <div className="print:hidden max-w-3xl mx-auto px-4 pt-4 flex justify-end">
        <PrintButton />
      </div>

      {/* 명세서 */}
      <div className="max-w-3xl mx-auto px-8 py-10 bg-white print:p-0 print:max-w-none print:mx-0">
        <div className="border-[3px] border-nu-ink p-8 print:border-black">
          {/* 헤더 */}
          <div className="text-center mb-8 pb-6 border-b-[2px] border-nu-ink print:border-black">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
              PAYSLIP
            </div>
            <h1 className="text-[24px] font-bold text-nu-ink tracking-[6px]">
              급 여 명 세 서
            </h1>
            <p className="text-[14px] text-nu-graphite mt-2">
              {currentMonth}월분
            </p>
          </div>

          {/* 지급·수령자 정보 */}
          <div className="grid grid-cols-2 gap-6 mb-8 text-[12px]">
            <div>
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">
                지급 법인
              </div>
              <div className="font-bold text-nu-ink text-[14px]">{company?.name || "-"}</div>
              {company?.biz_no && <div className="text-nu-graphite mt-1">사업자번호: {company.biz_no}</div>}
              {company?.representative && <div className="text-nu-graphite">대표: {company.representative}</div>}
              {company?.address && <div className="text-nu-graphite">{company.address}</div>}
            </div>
            <div>
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">
                수령자
              </div>
              <div className="font-bold text-nu-ink text-[14px]">{employee.name}</div>
              <div className="text-nu-graphite mt-1">{employee.position} {employee.department && `· ${employee.department}`}</div>
              {employee.employment_type && <div className="text-nu-graphite">{employee.employment_type}</div>}
              {employee.bank_name && employee.bank_account && (
                <div className="text-nu-graphite mt-1">계좌: {employee.bank_name} {employee.bank_account}</div>
              )}
            </div>
          </div>

          {/* 실수령액 강조 */}
          <div className="border-[2px] border-nu-ink p-5 mb-6 text-center print:border-black">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
              NET PAY · 실수령액
            </div>
            <div className="text-[36px] font-bold text-nu-ink">
              ₩{fmtKRW(payroll.net_pay)}
            </div>
          </div>

          {/* 지급/공제 테이블 */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink border-b-[2px] border-nu-ink pb-2 mb-3 print:border-black">
                PAYMENTS · 지급
              </div>
              {payItems.map(([l, v]) => (
                <div key={String(l)} className="flex justify-between py-1.5 text-[12px] border-b border-nu-ink/10">
                  <span className="text-nu-graphite">{l}</span>
                  <span className="font-mono-nu text-nu-ink">₩{fmtKRW(Number(v))}</span>
                </div>
              ))}
              {payroll.overtime_hours && Number(payroll.overtime_hours) > 0 && (
                <div className="text-[10px] text-nu-graphite mt-2">연장근로 {payroll.overtime_hours}시간</div>
              )}
              <div className="flex justify-between py-2 mt-2 text-[13px] font-bold border-t-[2px] border-nu-ink print:border-black">
                <span>합계</span>
                <span className="text-nu-blue">₩{fmtKRW(payroll.total_pay)}</span>
              </div>
            </div>

            <div>
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink border-b-[2px] border-nu-ink pb-2 mb-3 print:border-black">
                DEDUCTIONS · 공제
              </div>
              {deductionItems.map(([l, v]) => (
                <div key={l} className="flex justify-between py-1.5 text-[12px] border-b border-nu-ink/10">
                  <span className="text-nu-graphite">{l}</span>
                  <span className="font-mono-nu text-red-600">-₩{fmtKRW(v)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 mt-2 text-[13px] font-bold border-t-[2px] border-nu-ink print:border-black">
                <span>합계</span>
                <span className="text-red-600">-₩{fmtKRW(payroll.total_deduction)}</span>
              </div>
            </div>
          </div>

          {/* 메모 */}
          {payroll.memo && (
            <div className="mt-6 p-3 bg-nu-ink/5 text-[11px] text-nu-graphite print:bg-gray-50">
              비고: {payroll.memo}
            </div>
          )}

          {/* 푸터 */}
          <div className="mt-8 pt-4 border-t border-nu-ink/10 text-center text-[10px] text-nu-graphite">
            {payroll.paid_date && <span>지급일: {payroll.paid_date}</span>}
            {payroll.paid_date && <span className="mx-2">·</span>}
            <span>발행일: {new Date().toLocaleDateString("ko-KR")}</span>
            <span className="mx-2">·</span>
            <span>{company?.name || "nutunion"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
