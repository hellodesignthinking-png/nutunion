import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VentureStageBadge } from "@/components/venture/venture-stage-badge";
import { STAGES } from "@/lib/venture/types";

interface Bolt {
  id: string;
  title: string;
  venture_mode: boolean;
  venture_stage: string | null;
  closed_at: string | null;
}

/**
 * 대시보드용 위젯 — 내가 멤버인 Venture 모드 볼트 + 단계 + 빠른 액션.
 * 서버 컴포넌트 (즉시 렌더).
 */
export async function MyVentureBoltsWidget({ userId }: { userId: string }) {
  const supabase = await createClient();

  // 멤버인 프로젝트 id 목록
  const { data: memberRows } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", userId);
  const projectIds = [...new Set(((memberRows as { project_id: string }[] | null) ?? []).map((r) => r.project_id))];
  if (projectIds.length === 0) return <EmptyState />;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, venture_mode, venture_stage, closed_at")
    .in("id", projectIds)
    .eq("venture_mode", true)
    .order("created_at", { ascending: false })
    .limit(6);

  const bolts = ((projects as Bolt[] | null) ?? []).filter(Boolean);
  if (bolts.length === 0) return <EmptyState />;

  // 각 볼트의 내 기여 건수 (최근 7일)
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();

  const [insights, ideas, feedback] = await Promise.all([
    supabase.from("venture_insights").select("project_id").eq("author_id", userId).in("project_id", bolts.map((b) => b.id)).gte("created_at", sinceIso),
    supabase.from("venture_ideas").select("project_id").eq("author_id", userId).in("project_id", bolts.map((b) => b.id)).gte("created_at", sinceIso),
    supabase.from("venture_feedback").select("project_id").eq("author_id", userId).in("project_id", bolts.map((b) => b.id)).gte("created_at", sinceIso),
  ]);

  const contribMap = new Map<string, number>();
  for (const arr of [insights.data, ideas.data, feedback.data]) {
    for (const r of (arr as { project_id: string }[] | null) ?? []) {
      contribMap.set(r.project_id, (contribMap.get(r.project_id) ?? 0) + 1);
    }
  }

  return (
    <div className="border-[2.5px] border-nu-ink bg-nu-paper">
      <div className="flex items-center justify-between px-4 py-3 border-b-[2px] border-nu-ink">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink">
            🚀 My Ventures
          </div>
          <div className="font-bold text-[14px] text-nu-ink mt-0.5">
            참여 중인 Venture 볼트 ({bolts.length})
          </div>
        </div>
        <Link
          href="/ventures/showcase"
          className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline"
        >
          성공 사례 →
        </Link>
      </div>

      <ul className="divide-y divide-nu-ink/10">
        {bolts.map((b) => {
          const contribs = contribMap.get(b.id) ?? 0;
          const stageIdx = STAGES.findIndex((s) => s.id === b.venture_stage);
          const progressPct = b.closed_at
            ? 100
            : stageIdx >= 0
            ? ((stageIdx + 1) / STAGES.length) * 100
            : 0;

          return (
            <li key={b.id}>
              <Link
                href={`/projects/${b.id}/venture`}
                className="block px-4 py-3 hover:bg-nu-ink/5 no-underline"
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-[13px] text-nu-ink truncate">{b.title}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <VentureStageBadge
                        ventureMode={b.venture_mode}
                        ventureStage={b.venture_stage}
                        completed={!!b.closed_at}
                        size="sm"
                      />
                      {contribs > 0 && (
                        <span className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
                          최근 7일 내 기여 {contribs}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* 진행률 바 */}
                <div className="h-1 bg-nu-ink/10">
                  <div className="h-full bg-nu-pink" style={{ width: `${progressPct}%` }} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-[2px] border-dashed border-nu-ink/30 bg-nu-paper p-5 text-center">
      <div className="text-[32px] mb-1">🚀</div>
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">
        My Ventures
      </div>
      <p className="text-[12px] text-nu-graphite mb-3">
        아직 참여 중인 Venture 볼트가 없습니다.
      </p>
      <Link
        href="/projects"
        className="inline-block h-8 px-3 border-[2px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[10px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper"
      >
        볼트 탐색하기
      </Link>
    </div>
  );
}
