import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getApproval } from "@/lib/finance/approval-queries";
import { getCompanies } from "@/lib/finance/company-queries";
import { ApprovalActions } from "@/components/finance/approval-actions";
import { fmtKRW } from "@/lib/finance/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "결재 상세" };

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_STYLES: Record<string, string> = {
  "대기": "bg-orange-50 text-orange-600 border-orange-500",
  "승인": "bg-green-50 text-green-700 border-green-700",
  "반려": "bg-red-50 text-red-600 border-red-500",
};

export default async function ApprovalDetailPage({ params }: PageProps) {
  const { id } = await params;
  const approval = await getApproval(id);
  if (!approval) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isAdminStaff = false;
  let isRequester = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
    isRequester = approval.requester_id === user.id;
  }

  const companies = await getCompanies();
  const company = approval.company ? companies.find((c) => c.id === approval.company) : undefined;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4">
        <Link href="/finance/approvals" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← 결재 목록
        </Link>
      </div>

      {/* 메인 카드 */}
      <div className="border-[2.5px] border-nu-ink bg-nu-paper p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
              {approval.doc_type}
            </div>
            <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink leading-tight">
              {approval.title}
            </h1>
          </div>
          <span className={`flex-shrink-0 font-mono-nu text-[11px] uppercase tracking-wider px-3 py-1 border-[2px] ${STATUS_STYLES[approval.status] || ""}`}>
            {approval.status}
          </span>
        </div>

        {approval.amount && (
          <div className="text-center py-4 mb-5 border-y-[2px] border-nu-ink">
            <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">
              금액
            </div>
            <div className="text-[28px] font-bold text-nu-ink">₩{fmtKRW(approval.amount)}</div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 text-[12px]">
          <Info label="요청자" value={
            approval.requester_name
              ? `${approval.requester_name}${approval.requester_position ? ` · ${approval.requester_position}` : ""}${approval.requester_department ? ` · ${approval.requester_department}` : ""}`
              : "-"
          } />
          <Info label="요청일" value={approval.request_date} />
          {company && <Info label="관련 법인" value={company.name} color={company.color} />}
          {approval.approve_date && <Info label={approval.status === "반려" ? "반려일" : "승인일"} value={approval.approve_date} />}
          {approval.approver_name && <Info label={approval.status === "반려" ? "반려자" : "승인자"} value={approval.approver_name} />}
        </div>

        {approval.content && (
          <div className="mt-5">
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">
              내용
            </div>
            <div className="whitespace-pre-wrap bg-nu-ink/5 p-4 text-[13px] leading-relaxed text-nu-ink">
              {approval.content}
            </div>
          </div>
        )}

        {approval.reject_reason && approval.status === "반려" && (
          <div className="mt-5 border-[2px] border-red-500 bg-red-50 p-4">
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-red-600 mb-2">
              반려 사유
            </div>
            <div className="text-[13px] text-red-700 whitespace-pre-wrap">{approval.reject_reason}</div>
          </div>
        )}
      </div>

      {/* 액션 */}
      <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5">
        <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink mb-4">
          처리
        </div>
        <ApprovalActions
          approvalId={approval.id}
          isPending={approval.status === "대기"}
          isAdminStaff={isAdminStaff}
          isRequester={isRequester}
        />
      </div>
    </div>
  );
}

function Info({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">{label}</div>
      <div className="text-nu-ink font-medium" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}
