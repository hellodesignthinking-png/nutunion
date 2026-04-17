import { notFound } from "next/navigation";
import Link from "next/link";
import { getEmployeeDetail, getEmployeePayrollHistory } from "@/lib/finance/hr-queries";
import { getCompanies } from "@/lib/finance/company-queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ employeeId: string }>;
}

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

const ATT_COLORS: Record<string, string> = {
  "출근": "text-green-700 bg-green-50",
  "퇴근": "text-nu-blue bg-blue-50",
  "연차": "text-red-600 bg-red-50",
  "반차(오전)": "text-orange-600 bg-orange-50",
  "반차(오후)": "text-orange-600 bg-orange-50",
  "병가": "text-red-600 bg-red-50",
  "외근": "text-nu-pink bg-pink-50",
  "출장": "text-nu-pink bg-pink-50",
  "재택근무": "text-green-700 bg-green-50",
};

export default async function EmployeeDetailPage({ params }: PageProps) {
  const { employeeId } = await params;

  const [detail, history, companies] = await Promise.all([
    getEmployeeDetail(employeeId),
    getEmployeePayrollHistory(employeeId),
    getCompanies(),
  ]);

  if (!detail) notFound();
  const { employee, monthlyAttendance, thisMonthPayroll } = detail;
  const company = companies.find((c) => c.id === employee.company);
  const isAlba = employee.employment_type === "알바";

  const leaveRemaining = Math.max(0, (employee.annual_leave_total || 15) - (employee.annual_leave_used || 0));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4">
        <Link href={`/finance/hr/employees${employee.company ? `?company=${employee.company}` : ""}`} className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← 직원 목록
        </Link>
      </div>

      {/* 프로필 헤더 */}
      <div className="border-[2.5px] border-nu-ink bg-nu-paper p-6 mb-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="w-16 h-16 flex items-center justify-center text-[24px] font-bold border-[2.5px] border-nu-ink flex-shrink-0"
            style={{ background: `${company?.color || "#0D0D0D"}22`, color: company?.color || "#0D0D0D" }}
          >
            {employee.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite">
              EMPLOYEE
            </div>
            <h1 className="text-[24px] sm:text-[28px] font-bold text-nu-ink leading-tight mt-1">
              {employee.name}
            </h1>
            <div className="flex gap-2 items-center flex-wrap mt-2">
              <span className="text-[12px] text-nu-graphite">{company?.name}</span>
              {employee.position && <span className="text-[12px] text-nu-graphite">· {employee.position}</span>}
              {employee.department && <span className="text-[12px] text-nu-graphite">· {employee.department}</span>}
              {employee.employment_type && (
                <span className="font-mono-nu text-[9px] uppercase tracking-wider px-2 py-0.5 border border-nu-ink">
                  {employee.employment_type}
                </span>
              )}
              {employee.status && (
                <span className={`font-mono-nu text-[9px] uppercase tracking-wider px-2 py-0.5 ${employee.status === "재직" ? "bg-green-50 text-green-700" : "bg-nu-ink/5 text-nu-graphite"}`}>
                  {employee.status}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            {isAlba ? (
              <>
                <div className="text-[22px] font-bold text-nu-ink">₩{fmt(employee.hourly_wage || 0)}<span className="text-[12px] text-nu-graphite">/h</span></div>
                {employee.work_days && <div className="text-[11px] text-nu-graphite mt-1">{employee.work_days}</div>}
                {employee.daily_hours && <div className="text-[11px] text-nu-graphite">{employee.daily_hours}시간/일</div>}
              </>
            ) : (
              <>
                <div className="text-[22px] font-bold text-nu-ink">₩{fmt(employee.annual_salary || 0)}</div>
                <div className="text-[11px] text-nu-graphite mt-1">연봉</div>
                <div className="text-[11px] text-nu-graphite">월 ₩{fmt(Math.round((employee.annual_salary || 0) / 12))}</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink mb-4">기본 정보</div>
          <div className="flex flex-col gap-2 text-[13px]">
            {employee.email && <InfoRow label="이메일" value={employee.email} />}
            {employee.phone && <InfoRow label="연락처" value={employee.phone} />}
            {employee.join_date && <InfoRow label="입사일" value={employee.join_date} />}
            {employee.end_date && <InfoRow label="퇴사일" value={employee.end_date} />}
            {employee.bank_name && <InfoRow label="계좌" value={`${employee.bank_name} ${employee.bank_account || ""}`} />}
            {employee.contract_status && (
              <InfoRow
                label="계약상태"
                value={
                  employee.contract_signed
                    ? "✓ 완료"
                    : employee.contract_status === "sent"
                    ? "📨 서명대기"
                    : "미발송"
                }
              />
            )}
          </div>
        </div>

        {/* 연차 */}
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink mb-4">연차 현황</div>
          <div className="text-center py-4">
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">잔여</div>
            <div className={`text-[36px] font-bold ${leaveRemaining <= 3 ? "text-red-600" : "text-green-700"}`}>
              {leaveRemaining}<span className="text-[14px] text-nu-graphite ml-1">일</span>
            </div>
            <div className="flex justify-around mt-4 text-[12px]">
              <div>
                <div className="font-mono-nu text-[9px] uppercase text-nu-graphite">부여</div>
                <div className="font-bold text-nu-ink">{employee.annual_leave_total || 15}일</div>
              </div>
              <div>
                <div className="font-mono-nu text-[9px] uppercase text-nu-graphite">사용</div>
                <div className="font-bold text-red-600">{employee.annual_leave_used || 0}일</div>
              </div>
              <div>
                <div className="font-mono-nu text-[9px] uppercase text-nu-graphite">잔여</div>
                <div className="font-bold text-green-700">{leaveRemaining}일</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 이번 달 근태 */}
      <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5 mb-6">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink mb-4">
          이번 달 근태
        </div>
        {Object.keys(monthlyAttendance).length === 0 ? (
          <div className="text-[13px] text-nu-graphite">근태 기록 없음</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {Object.entries(monthlyAttendance).map(([type, count]) => (
              <div key={type} className={`p-3 text-center ${ATT_COLORS[type] || "bg-nu-ink/5 text-nu-graphite"}`}>
                <div className="text-[18px] font-bold">{count}</div>
                <div className="font-mono-nu text-[9px] uppercase tracking-wider mt-1">{type}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 이번 달 급여 */}
      {thisMonthPayroll && (
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5 mb-6">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink mb-4">
            이번 달 급여 · {thisMonthPayroll.year_month}
          </div>
          <div className="text-center py-4 border-b border-nu-ink/10 mb-4">
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">실수령액</div>
            <div className="text-[32px] font-bold text-green-700 mt-1">₩{fmt(thisMonthPayroll.net_pay || 0)}</div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">지급</div>
              {[
                ["기본급", thisMonthPayroll.base_pay],
                ["연장근로", thisMonthPayroll.overtime_pay],
                ["상여금", thisMonthPayroll.bonus_pay],
                ["연차수당", thisMonthPayroll.annual_leave_pay],
              ].filter(([, v]) => Number(v) > 0).map(([l, v]) => (
                <div key={String(l)} className="flex justify-between text-[12px] py-1">
                  <span className="text-nu-graphite">{l}</span>
                  <span className="text-nu-blue font-mono-nu">₩{fmt(Number(v))}</span>
                </div>
              ))}
              <div className="flex justify-between text-[13px] font-bold pt-2 border-t border-nu-ink/10 mt-1">
                <span>합계</span><span className="text-nu-blue">₩{fmt(thisMonthPayroll.total_pay)}</span>
              </div>
            </div>
            <div>
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">공제</div>
              {[
                ["국민연금", thisMonthPayroll.national_pension],
                ["건강보험", thisMonthPayroll.health_insurance],
                ["장기요양", thisMonthPayroll.long_term_care],
                ["고용보험", thisMonthPayroll.employment_insurance],
                ["소득세", thisMonthPayroll.income_tax],
                ["지방소득세", thisMonthPayroll.local_income_tax],
              ].map(([l, v]) => (
                <div key={String(l)} className="flex justify-between text-[12px] py-1">
                  <span className="text-nu-graphite">{l}</span>
                  <span className="text-red-600 font-mono-nu">-₩{fmt(Number(v))}</span>
                </div>
              ))}
              <div className="flex justify-between text-[13px] font-bold pt-2 border-t border-nu-ink/10 mt-1">
                <span>합계</span><span className="text-red-600">-₩{fmt(thisMonthPayroll.total_deduction)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 급여 이력 */}
      {history.length > 0 && (
        <div className="border-[2.5px] border-nu-ink bg-nu-paper overflow-hidden">
          <div className="px-4 py-3 border-b-[2px] border-nu-ink font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
            급여 이력 (최근 12개월)
          </div>
          <div className="divide-y divide-nu-ink/10">
            {history.map((p) => (
              <div key={`${p.year_month}-${p.id}`} className="flex justify-between items-center px-4 py-3">
                <div>
                  <div className="text-[13px] font-bold text-nu-ink">{p.year_month}</div>
                  <div className="text-[10px] text-nu-graphite">기본급 ₩{fmt(p.base_pay)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-bold text-green-700">₩{fmt(p.net_pay)}</div>
                  <div className="text-[10px] text-red-600">-₩{fmt(p.total_deduction)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite w-20 flex-shrink-0 pt-1">{label}</span>
      <span className="text-nu-ink flex-1 break-all">{value}</span>
    </div>
  );
}
