import Link from "next/link";
import { getEmployees } from "@/lib/finance/hr-queries";
import { getCompanies } from "@/lib/finance/company-queries";
import { EmployeeCreateModal } from "@/components/finance/employee-create-modal";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ company?: string; status?: string; q?: string }>;
}

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

const STATUS_COLORS: Record<string, string> = {
  "재직": "text-green-700 bg-green-50",
  "휴직": "text-orange-600 bg-orange-50",
  "퇴직": "text-nu-graphite bg-nu-ink/5",
};

const TYPE_COLORS: Record<string, string> = {
  "정규직": "border-nu-ink text-nu-ink",
  "계약직": "border-nu-blue text-nu-blue",
  "인턴": "border-nu-pink text-nu-pink",
  "알바": "border-orange-500 text-orange-600",
};

export default async function EmployeesPage({ searchParams }: PageProps) {
  const { company = "all", status, q } = await searchParams;
  const [employees, companies] = await Promise.all([
    getEmployees({ company, status, search: q }),
    getCompanies(),
  ]);
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  const byStatus = { 재직: 0, 휴직: 0, 퇴직: 0 };
  employees.forEach((e) => {
    if (e.status && byStatus[e.status as keyof typeof byStatus] !== undefined) {
      byStatus[e.status as keyof typeof byStatus]++;
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-3 flex gap-4 items-center">
        <Link href="/finance/hr" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← HR
        </Link>
      </div>

      <div className="mb-6 flex justify-between items-start flex-wrap gap-3">
        <div>
          <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
            EMPLOYEES · 직원 목록
          </div>
          <h1 className="text-[24px] sm:text-[32px] font-bold text-nu-ink leading-tight">
            직원 관리
          </h1>
        </div>
        <EmployeeCreateModal
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
          defaultCompany={company}
        />
      </div>

      {/* 검색 */}
      <form action="/finance/hr/employees" method="get" className="mb-4">
        {company && <input type="hidden" name="company" value={company} />}
        {status && <input type="hidden" name="status" value={status} />}
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q || ""}
            placeholder="이름, 부서, 직급, 이메일 검색..."
            className="flex-1 border-[2.5px] border-nu-ink bg-nu-paper px-4 py-2.5 text-[14px] text-nu-ink outline-none focus:bg-white"
          />
          <button
            type="submit"
            className="border-[2.5px] border-nu-ink bg-nu-ink text-nu-paper px-5 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-pink hover:border-nu-pink"
          >
            검색
          </button>
          {q && (
            <Link
              href={`/finance/hr/employees?company=${company}${status ? `&status=${status}` : ""}`}
              className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-graphite px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest no-underline"
            >
              ✕
            </Link>
          )}
        </div>
      </form>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div className="flex gap-1 border-[2.5px] border-nu-ink bg-nu-paper overflow-x-auto">
          {companies.map((c) => {
            const p = new URLSearchParams();
            p.set("company", c.id);
            if (status) p.set("status", status);
            if (q) p.set("q", q);
            return (
              <Link
                key={c.id}
                href={`/finance/hr/employees?${p.toString()}`}
                className={`px-3 py-2 font-mono-nu text-[11px] uppercase tracking-wider whitespace-nowrap no-underline ${
                  company === c.id ? "bg-nu-ink text-nu-paper" : "text-nu-graphite hover:text-nu-ink"
                }`}
              >
                {c.name}
              </Link>
            );
          })}
        </div>

        <div className="flex gap-1 border-[2.5px] border-nu-ink bg-nu-paper">
          {["all", "재직", "휴직", "퇴직"].map((s) => {
            const p = new URLSearchParams();
            p.set("company", company);
            if (s !== "all") p.set("status", s);
            if (q) p.set("q", q);
            return (
              <Link
                key={s}
                href={`/finance/hr/employees?${p.toString()}`}
                className={`px-3 py-2 font-mono-nu text-[11px] uppercase tracking-wider no-underline ${
                  (status || "all") === s ? "bg-nu-ink text-nu-paper" : "text-nu-graphite hover:text-nu-ink"
                }`}
              >
                {s === "all" ? "전체" : s}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-3">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite">재직</div>
          <div className="text-[18px] font-bold text-green-700">{byStatus.재직}명</div>
        </div>
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-3">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite">휴직</div>
          <div className="text-[18px] font-bold text-orange-600">{byStatus.휴직}명</div>
        </div>
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-3">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite">퇴직</div>
          <div className="text-[18px] font-bold text-nu-graphite">{byStatus.퇴직}명</div>
        </div>
      </div>

      {/* 직원 목록 */}
      {employees.length === 0 ? (
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-12 text-center">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite">NO EMPLOYEES</div>
          <p className="text-[13px] text-nu-graphite mt-2">해당 조건의 직원이 없습니다</p>
        </div>
      ) : (
        <div className="border-[2.5px] border-nu-ink bg-nu-paper overflow-hidden">
          <div className="divide-y divide-nu-ink/10">
            {employees.map((e) => {
              const comp = companyMap.get(e.company);
              const isAlba = e.employment_type === "알바";
              return (
                <Link
                  key={e.id}
                  href={`/finance/hr/employees/${e.id}`}
                  className="flex items-center gap-4 px-4 py-4 hover:bg-nu-ink/5 no-underline"
                >
                  <div
                    className="w-10 h-10 flex items-center justify-center text-[14px] font-bold border-[2px] border-nu-ink flex-shrink-0"
                    style={{ background: `${comp?.color || "#0D0D0D"}22`, color: comp?.color || "#0D0D0D" }}
                  >
                    {e.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-nu-ink">{e.name}</span>
                      {e.position && <span className="text-[11px] text-nu-graphite">· {e.position}</span>}
                      {e.department && <span className="text-[11px] text-nu-graphite">· {e.department}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
                        {comp?.name}
                      </span>
                      {e.employment_type && (
                        <span className={`font-mono-nu text-[9px] uppercase tracking-wider px-1.5 py-0.5 border ${TYPE_COLORS[e.employment_type] || "border-nu-graphite text-nu-graphite"}`}>
                          {e.employment_type}
                        </span>
                      )}
                      {e.status && (
                        <span className={`font-mono-nu text-[9px] uppercase tracking-wider px-1.5 py-0.5 ${STATUS_COLORS[e.status] || ""}`}>
                          {e.status}
                        </span>
                      )}
                      {e.contract_status === "sent" && !e.contract_signed && (
                        <span className="font-mono-nu text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-orange-50 text-orange-600">
                          📨 서명대기
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {isAlba ? (
                      <>
                        <div className="text-[13px] font-bold text-nu-ink">₩{fmt(e.hourly_wage || 0)}<span className="text-[10px] text-nu-graphite">/h</span></div>
                        {e.work_days && <div className="text-[9px] text-nu-graphite">{e.work_days}</div>}
                      </>
                    ) : (
                      <>
                        <div className="text-[13px] font-bold text-nu-ink">₩{fmt(e.annual_salary || 0)}</div>
                        <div className="text-[9px] text-nu-graphite">연봉</div>
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
