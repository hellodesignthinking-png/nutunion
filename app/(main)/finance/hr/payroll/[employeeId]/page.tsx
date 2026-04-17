import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPayrollRecord } from "@/lib/finance/payroll-queries";
import { getCompanies } from "@/lib/finance/company-queries";
import { parseYearMonth, prevMonth, nextMonth } from "@/lib/finance/date-utils";
import { PayrollForm } from "@/components/finance/payroll-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "급여 계산" };

interface PageProps {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ month?: string }>;
}

export default async function EmployeePayrollPage({ params, searchParams }: PageProps) {
  const { employeeId } = await params;
  const { month } = await searchParams;
  const { ym: currentMonth, y, m } = parseYearMonth(month);

  const supabase = await createClient();
  const [empRes, companies, existing] = await Promise.all([
    supabase.from("employees").select("*").eq("id", employeeId).single(),
    getCompanies(),
    getPayrollRecord(employeeId, currentMonth),
  ]);

  if (!empRes.data) notFound();
  const employee = empRes.data;
  const company = companies.find((c) => c.id === employee.company);

  const prevM = prevMonth(y, m);
  const nextM = nextMonth(y, m);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4 flex gap-4 items-center flex-wrap">
        <Link href={`/finance/hr/payroll?month=${currentMonth}`} className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← 급여 목록
        </Link>
        <Link href={`/finance/hr/employees/${employeeId}`} className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          직원 상세
        </Link>
      </div>

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-1">
            {employee.name} · {company?.name} · {employee.position}
          </div>
          <h1 className="text-[24px] sm:text-[28px] font-bold text-nu-ink">
            {currentMonth} 급여 {existing ? "수정" : "계산"}
          </h1>
        </div>
        <div className="flex items-center gap-1 border-[2.5px] border-nu-ink bg-nu-paper">
          <Link href={`/finance/hr/payroll/${employeeId}?month=${prevM}`} className="px-3 py-2 font-mono-nu text-[14px] no-underline hover:bg-nu-ink/5">◀</Link>
          <span className="px-4 py-2 font-mono-nu text-[12px] font-bold tracking-wider">{currentMonth}</span>
          <Link href={`/finance/hr/payroll/${employeeId}?month=${nextM}`} className="px-3 py-2 font-mono-nu text-[14px] no-underline hover:bg-nu-ink/5">▶</Link>
        </div>
      </div>

      {existing && (
        <div className="mb-4 p-3 border-[2px] border-nu-blue bg-nu-blue/10 text-[12px] text-nu-ink flex justify-between items-center flex-wrap gap-2">
          <span>✓ {currentMonth}월 급여가 이미 저장되어 있습니다. 수정 후 저장하면 덮어쓰기 됩니다.</span>
          <Link
            href={`/finance/hr/payroll/${employeeId}/print?month=${currentMonth}`}
            target="_blank"
            className="font-mono-nu text-[10px] uppercase tracking-wider px-3 py-1 bg-nu-pink text-nu-paper no-underline hover:bg-nu-ink"
          >
            📄 명세서 인쇄
          </Link>
        </div>
      )}

      <PayrollForm employee={employee} yearMonth={currentMonth} existing={existing} />
    </div>
  );
}
