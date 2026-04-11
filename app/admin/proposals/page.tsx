import { createClient } from "@/lib/supabase/server";
import { AdminProposalList } from "@/components/admin/proposal-list";
import { FileText } from "lucide-react";

export default async function AdminProposalsPage() {
  const supabase = await createClient();

  // Try enriched query first, then fallback
  let proposals: any[] = [];
  let members: any[] = [];

  try {
    const { data, error } = await supabase
      .from("challenge_proposals")
      .select(
        "*, submitter:profiles!challenge_proposals_submitted_by_fkey(nickname, email, avatar_url), pm:profiles!challenge_proposals_assigned_pm_id_fkey(nickname, email), project:projects!challenge_proposals_converted_project_id_fkey(id, title, status)"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    proposals = data || [];
  } catch {
    // Fallback: basic query
    const { data } = await supabase
      .from("challenge_proposals")
      .select("*")
      .order("created_at", { ascending: false });
    proposals = data || [];
  }

  // Fetch potential PMs (users with lead/admin roles or can_create_project)
  try {
    const { data } = await supabase
      .from("profiles")
      .select("id, nickname, email, avatar_url, role, grade, can_create_project")
      .or("role.eq.admin,can_create_project.eq.true,grade.eq.gold,grade.eq.vip")
      .order("nickname");
    members = data || [];
  } catch {
    const { data } = await supabase
      .from("profiles")
      .select("id, nickname, email, avatar_url, role")
      .order("nickname");
    members = data || [];
  }

  // Status counts
  const statusCounts: Record<string, number> = {
    submitted: 0, reviewing: 0, approved: 0, rejected: 0, converted: 0,
  };
  proposals.forEach((p: any) => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        프로젝트 의뢰 관리
      </h1>
      <p className="text-nu-gray text-sm mb-6">
        {proposals.length}건의 의뢰가 등록되어 있습니다
      </p>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-4">
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">전체</p>
          <p className="font-head text-2xl font-extrabold">{proposals.length}</p>
        </div>
        {[
          { key: "submitted", label: "접수", color: "text-blue-600" },
          { key: "reviewing", label: "검토 중", color: "text-orange-600" },
          { key: "approved", label: "승인", color: "text-green-600" },
          { key: "converted", label: "전환됨", color: "text-nu-pink" },
          { key: "rejected", label: "반려", color: "text-red-500" },
        ].map(s => (
          <div key={s.key} className="bg-nu-white border border-nu-ink/[0.08] p-4">
            <p className={`font-mono-nu text-[10px] uppercase tracking-widest mb-1 ${s.color}`}>{s.label}</p>
            <p className="font-head text-2xl font-extrabold">{statusCounts[s.key] || 0}</p>
          </div>
        ))}
      </div>

      <AdminProposalList proposals={proposals} pmCandidates={members} />
    </div>
  );
}
