import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VentureRadar } from "@/components/portfolio/venture-radar";
import { PushSubscribeToggle } from "@/components/shared/push-subscribe-toggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "포트폴리오" };

interface ProjectStat {
  id: string;
  title: string;
  venture_stage: string | null;
  total: number;
}

export default async function ProfilePortfolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/profile/portfolio");

  // 유저가 기여한 프로젝트 요약 (venture 테이블 기반)
  const [{ data: insights }, { data: ideas }, { data: tasks }, { data: feedback }, { data: plans }] = await Promise.all([
    supabase.from("venture_insights").select("project_id").eq("author_id", user.id),
    supabase.from("venture_ideas").select("project_id").eq("author_id", user.id),
    supabase.from("venture_prototype_tasks").select("project_id").eq("assignee_id", user.id),
    supabase.from("venture_feedback").select("project_id").eq("author_id", user.id),
    supabase.from("venture_plans").select("project_id").eq("created_by", user.id),
  ]);

  const projectCounts = new Map<string, number>();
  for (const arr of [insights, ideas, tasks, feedback, plans]) {
    for (const r of (arr as { project_id: string }[] | null) ?? []) {
      projectCounts.set(r.project_id, (projectCounts.get(r.project_id) ?? 0) + 1);
    }
  }

  const projectIds = [...projectCounts.keys()];
  let projectStats: ProjectStat[] = [];
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, venture_stage")
      .in("id", projectIds);
    projectStats = ((projects as { id: string; title: string; venture_stage: string | null }[] | null) ?? [])
      .map((p) => ({ ...p, total: projectCounts.get(p.id) ?? 0 }))
      .sort((a, b) => b.total - a.total);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4">
        <Link href="/profile" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline">
          ← 프로필로
        </Link>
      </div>

      <div className="mb-6">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-1">
          Nut · Portfolio
        </div>
        <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink">내 기여 프로파일</h1>
        <p className="text-[12px] text-nu-graphite mt-1">
          Venture Builder 프로젝트에서의 디자인 씽킹 단계별 기여를 레이더 차트로 보여줍니다.
        </p>
      </div>

      <div className="mb-6">
        <PushSubscribeToggle />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 items-start">
        <VentureRadar userId={user.id} />

        <aside className="border-[2.5px] border-nu-ink bg-nu-paper">
          <div className="px-4 py-3 border-b-[2px] border-nu-ink font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
            참여 볼트 ({projectStats.length})
          </div>
          {projectStats.length === 0 ? (
            <p className="p-6 text-center text-[12px] text-nu-graphite">
              아직 Venture 프로젝트 참여 이력 없음
            </p>
          ) : (
            <ul className="divide-y divide-nu-ink/10">
              {projectStats.slice(0, 20).map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex items-center gap-2">
                  <Link href={`/projects/${p.id}/venture`} className="flex-1 text-[13px] text-nu-ink hover:text-nu-pink no-underline truncate">
                    {p.title}
                  </Link>
                  <span className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
                    {p.venture_stage ?? "-"}
                  </span>
                  <span className="font-mono-nu text-[10px] font-bold text-nu-pink tabular-nums">
                    {p.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <p className="mt-6 text-[11px] text-nu-graphite">
        레이더 점수는 각 단계에서의 실제 기여(인사이트, HMW, 선정 여부, 태스크 완료, 피드백, Plan 버전)를
        가중치로 합산합니다. 선정된 문제/Main Solution 등 핵심 산출물은 3배 가중.
      </p>
    </div>
  );
}
