import Link from "next/link";
import { getApprovals } from "@/lib/finance/approval-queries";
import { getCompanies } from "@/lib/finance/company-queries";
import { ApprovalCreateModal } from "@/components/finance/approval-create-modal";
import { fmtKRW, fmtRelativeTime } from "@/lib/finance/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "결재" };

interface PageProps {
  searchParams: Promise<{ status?: string; company?: string }>;
}

const STATUS_STYLES: Record<string, string> = {
  "대기": "bg-orange-50 text-orange-600 border-orange-500",
  "승인": "bg-green-50 text-green-700 border-green-700",
  "반려": "bg-red-50 text-red-600 border-red-500",
};

export default async function ApprovalsPage({ searchParams }: PageProps) {
  const { status, company = "all" } = await searchParams;
  const [approvals, companies] = await Promise.all([
    getApprovals({ status, company }),
    getCompanies(),
  ]);
  const companyMap = new Map(companies.map((c) => [c.id, c]));

  const pendingCount = approvals.filter((a) => a.status === "대기").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6 flex justify-between items-start flex-wrap gap-3">
        <div>
          <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
            APPROVALS · 결재
          </div>
          <h1 className="text-[24px] sm:text-[32px] font-bold text-nu-ink leading-tight">
            결재 관리
            {pendingCount > 0 && (
              <span className="ml-3 text-[16px] font-mono-nu text-orange-600">대기 {pendingCount}건</span>
            )}
          </h1>
        </div>
        <ApprovalCreateModal
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
          defaultCompany={company}
        />
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div className="flex gap-1 border-[2.5px] border-nu-ink bg-nu-paper">
          {[
            { k: "", label: "전체" },
            { k: "대기", label: `대기 ${pendingCount > 0 ? `(${pendingCount})` : ""}` },
            { k: "승인", label: "승인" },
            { k: "반려", label: "반려" },
          ].map((s) => {
            const p = new URLSearchParams();
            if (s.k) p.set("status", s.k);
            if (company !== "all") p.set("company", company);
            return (
              <Link
                key={s.k || "all"}
                href={`/finance/approvals${p.toString() ? `?${p}` : ""}`}
                className={`px-4 py-2 font-mono-nu text-[11px] uppercase tracking-wider no-underline ${
                  (status || "") === s.k ? "bg-nu-ink text-nu-paper" : "text-nu-graphite hover:text-nu-ink"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>

        <div className="flex gap-1 border-[2.5px] border-nu-ink bg-nu-paper overflow-x-auto">
          {companies.map((c) => {
            const p = new URLSearchParams();
            if (status) p.set("status", status);
            p.set("company", c.id);
            return (
              <Link
                key={c.id}
                href={`/finance/approvals?${p}`}
                className={`px-3 py-2 font-mono-nu text-[11px] uppercase tracking-wider whitespace-nowrap no-underline ${
                  company === c.id ? "bg-nu-ink text-nu-paper" : "text-nu-graphite hover:text-nu-ink"
                }`}
              >
                {c.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 목록 */}
      {approvals.length === 0 ? (
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-12 text-center">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite">
            {status || company !== "all" ? "NO RESULTS" : "NO APPROVALS"}
          </div>
          <p className="text-[13px] text-nu-graphite mt-2">
            {status || company !== "all" ? "조건에 맞는 결재가 없습니다" : "+ 결재 요청으로 시작하세요"}
          </p>
        </div>
      ) : (
        <div className="border-[2.5px] border-nu-ink bg-nu-paper overflow-hidden">
          <div className="divide-y divide-nu-ink/10">
            {approvals.map((a) => {
              const comp = a.company ? companyMap.get(a.company) : undefined;
              return (
                <Link
                  key={a.id}
                  href={`/finance/approvals/${a.id}`}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-nu-ink/5 no-underline"
                >
                  <span className={`flex-shrink-0 font-mono-nu text-[10px] uppercase tracking-wider px-2 py-1 border-[2px] ${STATUS_STYLES[a.status] || ""}`}>
                    {a.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold text-nu-ink truncate">{a.title}</div>
                    <div className="flex flex-wrap gap-2 items-center mt-1 text-[10px] text-nu-graphite">
                      <span className="font-mono-nu uppercase tracking-wider">{a.doc_type}</span>
                      {a.requester_name && <span>· {a.requester_name}{a.requester_position && ` ${a.requester_position}`}</span>}
                      {comp && <span>· <span style={{ color: comp.color }}>{comp.name}</span></span>}
                      <span>· {fmtRelativeTime(a.created_at || a.request_date)}</span>
                    </div>
                  </div>
                  {a.amount && (
                    <div className="flex-shrink-0 text-right">
                      <div className="font-mono-nu text-[14px] font-bold text-nu-ink">₩{fmtKRW(a.amount)}</div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
