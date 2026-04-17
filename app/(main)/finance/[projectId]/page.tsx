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

  // 현재 유저가 볼트의 리드인지 확인 (거래 추가 권한)
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

    // admin/staff도 리드 권한 부여
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
          {data.project.kakao_chat_url && (
            <a
              href={data.project.kakao_chat_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite no-underline hover:underline"
            >
              카카오톡 ↗
            </a>
          )}
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
