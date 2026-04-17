import Link from "next/link";
import { getMonthlyAttendance } from "@/lib/finance/hr-queries";
import { getCompanies } from "@/lib/finance/company-queries";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ company?: string; month?: string }>;
}

const TYPES = ["출근", "연차", "반차(오전)", "반차(오후)", "병가", "외근", "출장", "재택근무"];

export default async function AttendancePage({ searchParams }: PageProps) {
  const { company = "all", month } = await searchParams;
  const now = new Date();
  const currentMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [rows, companies] = await Promise.all([
    getMonthlyAttendance(currentMonth, company),
    getCompanies(),
  ]);
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  const [y, m] = currentMonth.split("-").map(Number);
  const prevM = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const nextM = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const qs = (opts: { company?: string; month?: string }) => {
    const p = new URLSearchParams();
    if (opts.company) p.set("company", opts.company);
    if (opts.month) p.set("month", opts.month);
    return p.toString() ? `?${p.toString()}` : "";
  };

  // 합계
  const totals: Record<string, number> = {};
  rows.forEach((r) => {
    Object.entries(r.counts).forEach(([t, c]) => {
      totals[t] = (totals[t] || 0) + c;
    });
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-3 flex gap-4 items-center">
        <Link href="/finance/hr" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← HR
        </Link>
      </div>

      <div className="mb-6">
        <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
          ATTENDANCE · 근태 현황
        </div>
        <h1 className="text-[24px] sm:text-[32px] font-bold text-nu-ink leading-tight">
          월별 근태
        </h1>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div className="flex gap-1 border-[2.5px] border-nu-ink bg-nu-paper overflow-x-auto">
          {companies.map((c) => (
            <Link
              key={c.id}
              href={`/finance/hr/attendance${qs({ company: c.id, month: currentMonth })}`}
              className={`px-3 py-2 font-mono-nu text-[11px] uppercase tracking-wider whitespace-nowrap no-underline ${
                company === c.id ? "bg-nu-ink text-nu-paper" : "text-nu-graphite hover:text-nu-ink"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1 border-[2.5px] border-nu-ink bg-nu-paper">
          <Link href={`/finance/hr/attendance${qs({ company, month: prevM })}`} className="px-3 py-2 font-mono-nu text-[14px] no-underline hover:bg-nu-ink/5">◀</Link>
          <span className="px-3 py-2 font-mono-nu text-[12px] font-bold tracking-wider">{currentMonth}</span>
          <Link href={`/finance/hr/attendance${qs({ company, month: nextM })}`} className="px-3 py-2 font-mono-nu text-[14px] no-underline hover:bg-nu-ink/5">▶</Link>
        </div>
      </div>

      {/* 합계 */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-6">
        {TYPES.map((t) => (
          <div key={t} className="border-[2.5px] border-nu-ink bg-nu-paper p-3 text-center">
            <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">{t}</div>
            <div className={`text-[16px] font-bold ${totals[t] > 0 ? "text-nu-ink" : "text-nu-graphite/40"}`}>
              {totals[t] || 0}
            </div>
          </div>
        ))}
      </div>

      {/* 직원별 테이블 */}
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
                  <th className="px-2 py-3 text-left font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink whitespace-nowrap">법인</th>
                  {TYPES.map((t) => (
                    <th key={t} className="px-2 py-3 text-center font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite whitespace-nowrap">{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-nu-ink/10">
                {rows.map((r) => {
                  const comp = companyMap.get(r.employee.company);
                  return (
                    <tr key={r.employee.id} className="hover:bg-nu-ink/5">
                      <td className="px-4 py-3">
                        <Link href={`/finance/hr/employees/${r.employee.id}`} className="text-[13px] font-bold text-nu-ink no-underline hover:underline">
                          {r.employee.name}
                        </Link>
                        {r.employee.position && (
                          <div className="text-[10px] text-nu-graphite">{r.employee.position}</div>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <span className="font-mono-nu text-[9px] uppercase tracking-wider px-2 py-0.5 border border-nu-ink/30" style={{ color: comp?.color || "#0D0D0D" }}>
                          {comp?.name?.slice(0, 5) || "-"}
                        </span>
                      </td>
                      {TYPES.map((t) => (
                        <td key={t} className={`px-2 py-3 text-center font-mono-nu text-[13px] ${(r.counts[t] || 0) > 0 ? "font-bold text-nu-ink" : "text-nu-graphite/30"}`}>
                          {r.counts[t] || "-"}
                        </td>
                      ))}
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
