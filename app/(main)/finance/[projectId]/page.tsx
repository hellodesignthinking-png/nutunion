import { notFound } from "next/navigation";
import Link from "next/link";
import { getBoltFinance } from "@/lib/finance/queries";
import { createClient } from "@/lib/supabase/server";
import { ProjectFinanceDashboard } from "@/components/projects/project-finance-dashboard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function BoltFinanceDetailPage({ params }: PageProps) {
  const { projectId } = await params;
  const data = await getBoltFinance(projectId);
  if (!data) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isLead = false;
  if (user) {
    const { data: member } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    isLead = member?.role === "lead";
    if (!isLead) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role === "admin" || profile?.role === "staff") {
        isLead = true;
      }
    }
  }

  // 참여 직원 목록: project_members → profiles(email) → employees
  type ParticipantMember = { role: string; profile: { id: string; nickname: string | null; email: string | null; avatar_url: string | null } | null };
  const { data: rawMembers } = await supabase
    .from("project_members")
    .select("role,profile:profiles(id,nickname,email,avatar_url)")
    .eq("project_id", projectId);

  const members: ParticipantMember[] = ((rawMembers || []) as unknown[]).map((m) => {
    const row = m as { role: string; profile: unknown };
    const prof = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return {
      role: row.role,
      profile: prof && typeof prof === "object" && "id" in prof ? prof as ParticipantMember["profile"] : null,
    };
  }).filter((m): m is ParticipantMember => m.profile !== null);

  // 멤버 이메일 → 직원 매칭
  const memberEmails = members.map((m) => m.profile?.email).filter((e): e is string => Boolean(e));
  let memberEmployees: { id: string | number; name: string; position?: string; company?: string; email?: string }[] = [];
  if (memberEmails.length > 0) {
    const { data: emps } = await supabase
      .from("employees")
      .select("id,name,position,company,email")
      .in("email", memberEmails);
    memberEmployees = emps || [];
  }
  const emailToEmployee = new Map(memberEmployees.map((e) => [e.email, e]));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* 브레드크럼 */}
      <div className="mb-4">
        <Link
          href="/finance"
          className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline"
        >
          ← 재무 홈
        </Link>
      </div>

      {/* 볼트 헤더 */}
      <div className="mb-8">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
          BOLT · {data.project.status}
        </div>
        <h1 className="text-[24px] sm:text-[32px] font-bold text-nu-ink leading-tight mb-2">
          {data.project.title}
        </h1>
        {data.project.description && (
          <p className="text-[13px] sm:text-[14px] text-nu-graphite max-w-3xl">
            {data.project.description}
          </p>
        )}
        <div className="flex flex-wrap gap-3 mt-3">
          <Link
            href={`/projects/${projectId}`}
            className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-blue no-underline hover:underline"
          >
            프로젝트 상세 →
          </Link>
          {/* 카카오톡 링크 제거 — 내장 채팅 사용 */}
          {data.project.google_drive_url && (
            <a
              href={data.project.google_drive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite no-underline hover:underline"
            >
              드라이브 ↗
            </a>
          )}
        </div>
      </div>

      {/* 참여 직원 */}
      {members.length > 0 && (
        <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
              👥 참여 멤버 ({members.length})
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map((m, i) => {
              const prof = m.profile!;
              const emp = prof.email ? emailToEmployee.get(prof.email) : undefined;
              const cardContent = (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 border-[2px] border-nu-ink bg-nu-ink/5 flex items-center justify-center text-[14px] font-bold flex-shrink-0">
                      {(emp?.name || prof.nickname || "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-nu-ink truncate">
                        {emp?.name || prof.nickname || "(이름 없음)"}
                      </div>
                      <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
                        {m.role}
                        {emp?.position && ` · ${emp.position}`}
                      </div>
                    </div>
                  </div>
                </>
              );
              return emp ? (
                <Link
                  key={`${prof.id}-${i}`}
                  href={`/finance/hr/employees/${emp.id}`}
                  className="block border-[2px] border-nu-ink/30 p-3 no-underline hover:border-nu-ink hover:bg-nu-ink/5"
                >
                  {cardContent}
                </Link>
              ) : (
                <div key={`${prof.id}-${i}`} className="border-[2px] border-nu-ink/20 p-3 opacity-80">
                  {cardContent}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 기존 ProjectFinanceDashboard 재사용 */}
      <ProjectFinanceDashboard
        projectId={projectId}
        totalBudget={data.totalBudget}
        isLead={isLead}
        milestones={data.milestones}
      />
    </div>
  );
}
