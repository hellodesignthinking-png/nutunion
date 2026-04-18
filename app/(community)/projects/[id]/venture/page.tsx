import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVentureOverview } from "@/lib/venture/queries";
import { STAGES } from "@/lib/venture/types";
import { VentureStageTracker } from "@/components/venture/venture-stage-tracker";
import { VentureStageSection } from "@/components/venture/venture-stage-section";
import { VenturePlanCard } from "@/components/venture/venture-plan-card";
import { VentureEnableButton } from "@/components/venture/venture-enable-button";
import { VentureSuggestIdeas } from "@/components/venture/venture-suggest-ideas";
import { VentureAISummary } from "@/components/venture/venture-ai-summary";
import { VentureTimeline } from "@/components/venture/venture-timeline";
import { VentureContributionHeatmap } from "@/components/venture/venture-contribution-heatmap";

export const dynamic = "force-dynamic";
export const metadata = { title: "Venture Builder" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VenturePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/projects/${id}/venture`);

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, description, venture_mode, venture_stage, host_id")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  // 멤버십 / admin 체크
  const [{ data: profile }, { data: pm }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("project_members").select("user_id, role").eq("project_id", id).eq("user_id", user.id).maybeSingle(),
  ]);
  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  const isHost = (project.host_id as string) === user.id || pm?.role === "host" || pm?.role === "manager" || pm?.role === "owner";
  const isMember = !!pm || isAdminStaff;

  if (!isMember) redirect(`/projects/${id}`);

  // 벤처 모드 비활성화 상태
  if (!project.venture_mode) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <Link href={`/projects/${id}`} className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← 볼트로
        </Link>
        <div className="mt-6 border-[2.5px] border-nu-ink bg-nu-paper p-8 text-center shadow-[4px_4px_0_0_rgba(13,13,13,1)]">
          <div className="text-[48px] mb-3">🚀</div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
            Venture Builder Mode
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink mb-3">
            아이디어를 사업으로 빌딩하는 5단계
          </h1>
          <p className="text-[13px] text-nu-graphite mb-6 max-w-lg mx-auto leading-relaxed">
            공감(Empathize) → 정의(Define) → 아이디어(Ideate) → 프로토타입 → 사업계획 순서로 진행합니다.
            AI 가 각 단계의 데이터를 종합해 최종 사업계획서 초안을 자동 작성합니다.
          </p>
          <div className="grid grid-cols-5 gap-1 max-w-xl mx-auto mb-6">
            {STAGES.map((s) => (
              <div key={s.id} className="border-[2px] border-nu-ink/30 py-3">
                <div className="text-[24px]">{s.icon}</div>
                <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          {isHost ? (
            <VentureEnableButton projectId={id} />
          ) : (
            <p className="text-[11px] text-nu-graphite">
              볼트 호스트만 Venture 모드를 활성화할 수 있습니다.
            </p>
          )}
        </div>
      </div>
    );
  }

  // 활성화된 상태
  const overview = await getVentureOverview(id);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4">
        <Link href={`/projects/${id}`} className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← 볼트로
        </Link>
      </div>

      {overview.migrationMissing && (
        <div className="mb-6 border-[2.5px] border-orange-500 bg-orange-50 p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-orange-700 mb-1">
            ⚠ DB 마이그레이션 필요
          </div>
          <p className="text-[13px] text-orange-700 leading-relaxed">
            Venture Builder 테이블(058) 과 성장 기능(059) 마이그레이션이 아직 적용되지 않았습니다.
            Supabase SQL Editor 에서 다음 파일을 실행해주세요:
          </p>
          <ul className="mt-2 text-[12px] text-orange-700 list-disc pl-5">
            <li><code>supabase/migrations/058_venture_builder.sql</code></li>
            <li><code>supabase/migrations/059_growth_features.sql</code></li>
          </ul>
        </div>
      )}

      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-1">
            Venture Builder · {project.title}
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink truncate">
            디자인 씽킹 진행률
          </h1>
        </div>
      </div>

      <VentureStageTracker
        progress={overview.stageProgress}
        currentStage={project.venture_stage as string}
      />

      <div className="mt-8 space-y-8">
        <div>
          <VentureStageSection
            stageId="empathize"
            title="① 공감 — 유저 인사이트"
            description="유저 인터뷰, 관찰, 설문에서 발견한 고통점을 수집합니다."
            items={overview.insights}
            projectId={id}
            kind="insight"
          />
          <VentureAISummary
            projectId={id}
            kind="insights"
            enabled={overview.insights.length >= 3}
            disabledReason="인사이트 3건 이상부터 패턴 분석 가능"
          />
        </div>

        <VentureStageSection
          stageId="define"
          title="② 정의 — HMW (How Might We)"
          description="수집된 인사이트에서 해결할 핵심 문제를 하나로 압축합니다."
          items={overview.problems}
          projectId={id}
          kind="problem"
          locked={!overview.stageProgress[0].complete}
          lockReason={overview.stageProgress[0].blocker}
        />

        <div>
          <VentureStageSection
            stageId="ideate"
            title="③ 아이디어 — 발산 후 수렴"
            description="가능한 해결책을 다양하게 내고, 팀 투표로 Main Solution 을 선정합니다."
            items={overview.ideas}
            projectId={id}
            kind="idea"
            locked={!overview.stageProgress[1].complete}
            lockReason={overview.stageProgress[1].blocker}
            currentUserId={user.id}
          />
          {overview.stageProgress[1].complete && (
            <VentureSuggestIdeas
              projectId={id}
              disabled={!overview.stageProgress[1].complete}
              disabledReason={overview.stageProgress[1].blocker}
            />
          )}
        </div>

        <div>
          <VentureStageSection
            stageId="prototype"
            title="④ 프로토타입 — 실행 & 검증"
            description="MVP 체크리스트 실행과 유저 피드백 수집."
            items={{ tasks: overview.tasks, feedback: overview.feedback }}
            projectId={id}
            kind="prototype"
            locked={!overview.stageProgress[2].complete}
            lockReason={overview.stageProgress[2].blocker}
          />
          {overview.stageProgress[2].complete && (
            <VentureAISummary
              projectId={id}
              kind="feedback"
              enabled={overview.feedback.length >= 1}
              disabledReason="피드백 1건 이상부터 분석 가능"
            />
          )}
        </div>

        <VenturePlanCard
          projectId={id}
          plan={overview.currentPlan}
          locked={!overview.stageProgress[3].complete}
          lockReason={overview.stageProgress[3].blocker}
        />

        <VentureContributionHeatmap projectId={id} />

        <VentureTimeline projectId={id} />
      </div>
    </div>
  );
}
