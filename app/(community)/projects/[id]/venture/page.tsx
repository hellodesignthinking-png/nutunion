import Link from "next/link";
import { redirect } from "next/navigation";
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
import { VentureTagCloud } from "@/components/venture/venture-tag-cloud";
import { VentureSourceLibrary } from "@/components/venture/venture-source-library";
import { VentureTimelineDiamond } from "@/components/venture/venture-timeline-diamond";
import { VenturePrototypeGallery } from "@/components/venture/venture-prototype-gallery";
import { VentureArchive } from "@/components/venture/venture-archive";
import { VentureSynthesizeProblemsPanel, VentureSynthesizeIdeasPanel } from "@/components/venture/venture-synthesize-panel";

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

  // 먼저 기본 컬럼만 조회 (venture_mode/venture_stage 가 없는 DB 에서도 동작)
  const { data: projectBase, error: projectErr } = await supabase
    .from("projects")
    .select("id, title, description, created_by, created_at")
    .eq("id", id)
    .maybeSingle();

  // 404 대신 진단 페이지 렌더 (사용자에게 원인 표시)
  if (projectErr || !projectBase) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link href="/projects" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← 볼트 목록
        </Link>
        <div className="mt-6 border-[2.5px] border-orange-500 bg-orange-50 p-6">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-orange-700 mb-2">
            ⚠ Venture Page · Project Load Failed
          </div>
          <h1 className="text-[20px] font-bold text-nu-ink mb-2">볼트를 불러오지 못했습니다</h1>
          <div className="text-[12px] text-nu-graphite leading-relaxed space-y-1 font-mono-nu">
            <div><span className="text-nu-ink">Project ID:</span> <code>{id}</code></div>
            <div><span className="text-nu-ink">User ID:</span> <code>{user.id}</code></div>
            <div><span className="text-nu-ink">Query error:</span> <code>{projectErr?.message ?? "(none)"}</code></div>
            <div><span className="text-nu-ink">Project row:</span> <code>{projectBase === null ? "null (RLS 차단 또는 ID 없음)" : "found"}</code></div>
          </div>
          <p className="text-[12px] text-nu-graphite mt-4 leading-relaxed">
            가능한 원인:
          </p>
          <ul className="text-[12px] text-nu-graphite mt-1 list-disc pl-5 space-y-1">
            <li>URL 의 project ID 가 DB 에 존재하지 않음</li>
            <li>RLS 정책이 이 볼트 조회를 차단함 (멤버 아님)</li>
            <li>세션 쿠키 누락 — 로그아웃 후 재로그인 시도</li>
          </ul>
        </div>
      </div>
    );
  }

  // venture 컬럼 별도 조회 — 실패해도 기본값으로 진행 (마이그레이션 미적용 graceful)
  let ventureMode = false;
  let ventureStage: string | null = null;
  let driveFolderId: string | null = null;
  let driveFolderUrl: string | null = null;
  try {
    const { data: vrow } = await supabase
      .from("projects")
      .select("venture_mode, venture_stage, google_drive_folder_id, google_drive_url")
      .eq("id", id)
      .maybeSingle();
    if (vrow) {
      const r = vrow as { venture_mode?: boolean; venture_stage?: string | null; google_drive_folder_id?: string | null; google_drive_url?: string | null };
      ventureMode = !!r.venture_mode;
      ventureStage = r.venture_stage ?? null;
      driveFolderId = r.google_drive_folder_id ?? null;
      driveFolderUrl = r.google_drive_url ?? null;
    }
  } catch {
    // 컬럼 없음 — venture mode 비활성 상태로 렌더
  }

  const project = {
    ...projectBase,
    venture_mode: ventureMode,
    venture_stage: ventureStage,
  } as { id: string; title: string; description: string | null; created_by: string; venture_mode: boolean; venture_stage: string | null };

  // 멤버십 / admin 체크
  const [{ data: profile }, { data: pm }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("project_members").select("user_id, role").eq("project_id", id).eq("user_id", user.id).maybeSingle(),
  ]);
  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  const isHost = (project.created_by as string) === user.id || pm?.role === "host" || pm?.role === "manager" || pm?.role === "owner";
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

      {/* Double Diamond + Timeline — 진행 현황 시각화 (상단) */}
      <div className="mb-6">
        <VentureTimelineDiamond
          projectId={id}
          projectCreatedAt={(projectBase as { created_at?: string }).created_at ?? new Date().toISOString()}
          currentStage={project.venture_stage as typeof STAGES[number]["id"] | null}
          counts={{
            insights: overview.insights.length,
            problems: overview.problems.length,
            selectedProblems: overview.problems.filter((p) => p.is_selected).length,
            ideas: overview.ideas.length,
            mainIdea: overview.ideas.some((i) => i.is_main),
            tasks: overview.tasks.length,
            doneTasks: overview.tasks.filter((t) => t.status === "done").length,
            feedback: overview.feedback.length,
            hasPlan: !!overview.currentPlan,
          }}
        />
      </div>

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
          <VentureTagCloud projectId={id} />
          <div className="mt-4">
            <VentureSourceLibrary
              projectId={id}
              canEdit={isMember}
              driveFolderId={driveFolderId}
              driveFolderUrl={driveFolderUrl}
            />
          </div>
        </div>

        <div>
          <VentureStageSection
            stageId="define"
            title="② 정의 — HMW (How Might We)"
            description="수집된 인사이트와 Source Library 를 종합해 해결할 핵심 문제를 하나로 압축합니다."
            items={overview.problems}
            projectId={id}
            kind="problem"
            locked={!overview.stageProgress[0].complete}
            lockReason={overview.stageProgress[0].blocker}
          />
          <div className="mt-3">
            <VentureSynthesizeProblemsPanel projectId={id} canEdit={isHost || isAdminStaff} />
          </div>
        </div>

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
          <div className="mt-3">
            <VentureSynthesizeIdeasPanel projectId={id} canEdit={isMember} />
          </div>
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
          <div className="mt-3">
            <VenturePrototypeGallery
              projectId={id}
              canEdit={isMember}
              currentStage={project.venture_stage}
            />
          </div>
        </div>

        <VenturePlanCard
          projectId={id}
          plan={overview.currentPlan}
          locked={!overview.stageProgress[3].complete}
          lockReason={overview.stageProgress[3].blocker}
        />

        <VentureContributionHeatmap projectId={id} />

        <VentureTimeline projectId={id} />

        {/* 전체 활동 아카이브 — 시간순 통합 피드 + 참여자 기여 */}
        <VentureArchive projectId={id} projectTitle={project.title} canManage={isHost || isAdminStaff} />
      </div>
    </div>
  );
}
