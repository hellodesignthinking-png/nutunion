import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FundingRow } from "@/components/funding/funding-row";

export const dynamic = "force-dynamic";
export const metadata = { title: "펀딩 포털" };

interface Submission {
  id: string;
  project_id: string;
  plan_id: string;
  submitter_id: string | null;
  status: string;
  amount_req: number | null;
  contact_email: string | null;
  pitch: string | null;
  review_note: string | null;
  submitted_at: string;
  decided_at: string | null;
  project?: { title: string };
  plan?: { version: number; content: Record<string, unknown> };
}

const STATUS_ORDER = ["submitted", "reviewing", "funded", "rejected", "withdrawn", "draft"];

export default async function AdminFundingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) redirect("/dashboard");

  const { data: subs } = await supabase
    .from("funding_submissions")
    .select("*, project:projects(title), plan:venture_plans(version, content)")
    .order("submitted_at", { ascending: false });

  const items = (subs as Submission[]) ?? [];
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: items.filter((i) => i.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-1">
          Admin · Funding Portal
        </div>
        <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink">펀딩 제출 관리</h1>
        <p className="text-[12px] text-nu-graphite mt-1">
          총 {items.length}건 — Venture 모드 프로젝트의 사업계획서 제출 및 심사
        </p>
      </div>

      {items.length === 0 ? (
        <div className="border-[2px] border-dashed border-nu-ink/30 bg-nu-paper p-12 text-center">
          <p className="text-[13px] text-nu-graphite">제출된 사업계획서가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((g) => (
            <section key={g.status}>
              <h2 className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite mb-3 border-b-[2px] border-nu-ink pb-2">
                {STATUS_LABEL[g.status]} · {g.items.length}건
              </h2>
              <div className="space-y-3">
                {g.items.map((s) => <FundingRow key={s.id} submission={s} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-8 text-[11px] text-nu-graphite">
        <Link href="/admin" className="hover:text-nu-ink">← 관리자 홈</Link>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  submitted: "🆕 신규 제출",
  reviewing: "🔍 심사 중",
  funded: "✅ 펀딩 결정",
  rejected: "❌ 반려",
  withdrawn: "↩ 철회",
  draft: "📝 초안",
};
