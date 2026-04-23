import { createClient } from "@/lib/supabase/server";
import type { VentureStage } from "@/lib/venture/types";

interface Props {
  projectId: string;
  projectCreatedAt: string;
  currentStage: VentureStage | null;
  counts: {
    insights: number;
    problems: number;
    selectedProblems: number;
    ideas: number;
    mainIdea: boolean;
    tasks: number;
    doneTasks: number;
    feedback: number;
    hasPlan: boolean;
  };
}

interface DailyActivity {
  day: string;
  insight_count: number;
  problem_count: number;
  idea_count: number;
  task_count: number;
  feedback_count: number;
  source_count: number;
  contributor_count: number;
}

interface StageHistoryRow {
  from_stage: string | null;
  to_stage: string;
  changed_at: string;
  is_revert: boolean | null;
}

const STAGES: { id: VentureStage; phase: string; ko: string; sub: "발산" | "수렴" }[] = [
  { id: "empathize", phase: "DISCOVER", ko: "공감", sub: "발산" },
  { id: "define",    phase: "DEFINE",   ko: "정의", sub: "수렴" },
  { id: "ideate",    phase: "DEVELOP",  ko: "아이디어", sub: "발산" },
  { id: "prototype", phase: "DELIVER",  ko: "프로토타입", sub: "수렴" },
];

/**
 * 시간축 기반 Double Diamond + 일별 Activity Heatmap.
 *
 * 구성:
 *   1. 상단: 각 단계의 실제 소요 기간을 반영한 diamond (가로 폭 = 기간 일수)
 *   2. 중앙: 데이터 버블 (크기 = 건수)
 *   3. 하단: 일별 활동 heatmap (점 크기 = 그날 이벤트 수, 색 농도 = 참여자 수)
 */
export async function VentureTimelineDiamond({ projectId, projectCreatedAt, currentStage, counts }: Props) {
  const supabase = await createClient();

  // 1. stage_history 조회 → 각 단계의 시작 시점 계산
  const { data: historyRows } = await supabase
    .from("venture_stage_history")
    .select("from_stage, to_stage, changed_at, is_revert")
    .eq("project_id", projectId)
    .order("changed_at", { ascending: true });

  const history: StageHistoryRow[] = ((historyRows as StageHistoryRow[] | null) ?? [])
    .filter((h) => !h.is_revert); // revert 는 경계 계산에서 제외 (정방향 흐름만)

  // 2. 일별 activity — RPC 호출, 실패 시 빈 배열
  let daily: DailyActivity[] = [];
  try {
    const { data } = await supabase.rpc("venture_daily_activity", {
      p_project_id: projectId,
      p_days: 60,
    });
    daily = (data as DailyActivity[] | null) ?? [];
  } catch {
    // 064 migration 미적용 — 다이아몬드만 표시
  }

  // 3. Source count
  let sourceCount = 0;
  try {
    const { count } = await supabase
      .from("venture_sources")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);
    sourceCount = count ?? 0;
  } catch { /* noop */ }

  const startDate = new Date(projectCreatedAt);
  const now = new Date();
  const totalDays = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / 86_400_000));

  // 각 단계의 시작/끝 시간 계산
  type StageSpan = { stage: VentureStage; start: Date; end: Date; days: number };
  const spans: StageSpan[] = [];
  let lastStart = startDate;
  let lastStage: VentureStage = "empathize";

  for (const h of history) {
    if (lastStage !== h.to_stage) {
      const end = new Date(h.changed_at);
      spans.push({
        stage: lastStage,
        start: lastStart,
        end,
        days: Math.max(1, Math.ceil((end.getTime() - lastStart.getTime()) / 86_400_000)),
      });
      lastStart = end;
      lastStage = h.to_stage as VentureStage;
    }
  }
  // 현재 진행 중인 마지막 단계
  spans.push({
    stage: lastStage,
    start: lastStart,
    end: now,
    days: Math.max(1, Math.ceil((now.getTime() - lastStart.getTime()) / 86_400_000)),
  });

  // 각 메인 stage 에 대한 누적 기간 (STAGES 4개 기준으로 집계)
  const stageDays: Record<VentureStage, number> = {
    empathize: 0, define: 0, ideate: 0, prototype: 0, plan: 0, completed: 0,
  };
  for (const s of spans) stageDays[s.stage] = (stageDays[s.stage] ?? 0) + s.days;

  // plan 을 deliver 쪽에 합산 (시각적으로 prototype+plan = DELIVER)
  const discoverDays = stageDays.empathize;
  const defineDays = stageDays.define;
  const developDays = stageDays.ideate;
  const deliverDays = stageDays.prototype + stageDays.plan;

  const phaseCounts = [
    counts.insights + sourceCount,
    counts.problems,
    counts.ideas,
    counts.tasks + counts.feedback + (counts.hasPlan ? 1 : 0),
  ];

  const phaseDaysArr = [discoverDays, defineDays, developDays, deliverDays];
  const totalKnown = phaseDaysArr.reduce((a, b) => a + b, 0);

  // 방문했거나 데이터가 있는 단계에만 비율 할당 — 0건 + 0일 단계는 최소폭(5%)
  // 실제 진행한 단계는 소요 기간에 비례
  const minPct = 5;
  const rawPcts = phaseDaysArr.map((d, i) => {
    if (d === 0 && phaseCounts[i] === 0) return minPct; // 아예 시작도 안 한 단계
    return totalKnown > 0 ? Math.max((d / totalKnown) * 100, 10) : 25;
  });
  const rawSum = rawPcts.reduce((a, b) => a + b, 0);
  const pcts = rawPcts.map((p) => (p / rawSum) * 100);
  const maxCount = Math.max(1, ...phaseCounts);
  const bubbleR = (n: number) => (n === 0 ? 14 : 18 + Math.floor((n / maxCount) * 20));

  const phaseActive = (idx: number) => {
    if (currentStage === "empathize" && idx === 0) return true;
    if (currentStage === "define" && idx === 1) return true;
    if (currentStage === "ideate" && idx === 2) return true;
    if ((currentStage === "prototype" || currentStage === "plan") && idx === 3) return true;
    return false;
  };

  // 일별 activity — 누적 그래프 데이터
  const maxDaily = Math.max(1, ...daily.map((d) =>
    d.insight_count + d.problem_count + d.idea_count + d.task_count + d.feedback_count + d.source_count
  ));

  // 실제 참여자 수 — 모든 venture_* 테이블에서 author_id 전체 distinct 집계
  let totalContributorCount = 0;
  try {
    const [iRes, pRes, idRes, tRes, fRes, sRes] = await Promise.all([
      supabase.from("venture_insights").select("author_id").eq("project_id", projectId),
      supabase.from("venture_problems").select("author_id").eq("project_id", projectId),
      supabase.from("venture_ideas").select("author_id").eq("project_id", projectId),
      supabase.from("venture_prototype_tasks").select("assignee_id").eq("project_id", projectId),
      supabase.from("venture_feedback").select("author_id").eq("project_id", projectId),
      supabase.from("venture_sources").select("added_by").eq("project_id", projectId),
    ]);
    const ids = new Set<string>();
    for (const arr of [
      (iRes.data as { author_id: string | null }[] | null) ?? [],
      (pRes.data as { author_id: string | null }[] | null) ?? [],
      (idRes.data as { author_id: string | null }[] | null) ?? [],
      (fRes.data as { author_id: string | null }[] | null) ?? [],
    ]) for (const r of arr) if (r.author_id) ids.add(r.author_id);
    for (const r of (tRes.data as { assignee_id: string | null }[] | null) ?? []) if (r.assignee_id) ids.add(r.assignee_id);
    for (const r of (sRes.data as { added_by: string | null }[] | null) ?? []) if (r.added_by) ids.add(r.added_by);
    totalContributorCount = ids.size;
  } catch { /* noop */ }

  // 일별 activity 참여 이벤트 수 (같은 사람이 여러 날 참여 시 중복 포함 — "engagement" 지표)
  const totalEngagement = daily.reduce((sum, d) => sum + d.contributor_count, 0);

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink">
            🔷 Double Diamond × Timeline
          </div>
          <div className="font-bold text-[14px] text-nu-ink mt-0.5">
            시작 {startDate.toLocaleDateString("ko-KR")} · {totalDays}일 진행
            <span className="ml-2 font-mono-nu text-[11px] text-nu-graphite font-normal">
              참여자 {totalContributorCount}명 · 누적 {phaseCounts.reduce((a,b)=>a+b,0)}건
            </span>
          </div>
        </div>
        <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite text-right">
          가로 폭 = 실제 소요 기간<br />
          원 크기 = 데이터 건수
        </div>
      </div>

      {/* SVG 타임라인 다이아몬드 */}
      <div className="p-4 overflow-x-auto">
        <svg
          viewBox="0 0 800 280"
          className="w-full h-auto"
          style={{ maxWidth: "900px", minWidth: "520px" }}
          role="img"
          aria-label="Timeline Double Diamond"
        >
          {/* 기준선 */}
          <line x1="0" y1="110" x2="800" y2="110" stroke="#0D0D0D" strokeWidth="1" strokeDasharray="4 4" opacity="0.15" />

          {/* 4 phase 레이아웃: 가로폭 = 실제 비율 */}
          {(() => {
            let cursorX = 20;
            const totalW = 760;
            return STAGES.map((st, i) => {
              const segW = (pcts[i] / 100) * totalW;
              const x0 = cursorX;
              const x1 = cursorX + segW;
              cursorX = x1;
              const cx = (x0 + x1) / 2;
              const count = phaseCounts[i];
              const r = bubbleR(count);
              const active = phaseActive(i);
              const phaseDays = [discoverDays, defineDays, developDays, deliverDays][i];

              return (
                <g key={st.id}>
                  {/* 반쪽 다이아몬드 — 발산은 / \, 수렴은 \ / */}
                  {st.sub === "발산" ? (
                    // 좌측 발산: 시작 좁음 → 중앙 넓음
                    <path
                      d={`M ${x0} 110 L ${cx} 40 L ${x1} 110 L ${cx} 180 Z`}
                      fill={active ? "rgba(255,61,136,0.06)" : "transparent"}
                      stroke={active ? "#FF3D88" : count > 0 ? "#0D0D0D" : "rgba(13,13,13,0.3)"}
                      strokeWidth={active ? 3 : 2}
                    />
                  ) : (
                    <path
                      d={`M ${x0} 110 L ${cx} 40 L ${x1} 110 L ${cx} 180 Z`}
                      fill={active ? "rgba(255,61,136,0.06)" : "transparent"}
                      stroke={active ? "#FF3D88" : count > 0 ? "#0D0D0D" : "rgba(13,13,13,0.3)"}
                      strokeWidth={active ? 3 : 2}
                    />
                  )}

                  {/* 상단 phase 라벨 */}
                  <text x={cx} y={18} textAnchor="middle" fill={active ? "#FF3D88" : "#0D0D0D"} fontSize="11" fontWeight="700" letterSpacing="2" fontFamily="monospace">
                    {st.phase}
                  </text>
                  <text x={cx} y={32} textAnchor="middle" fill={active ? "#FF3D88" : "#4A4A4A"} fontSize="10" fontWeight="500" fontFamily="monospace">
                    {st.ko} · {st.sub}
                  </text>

                  {/* 데이터 버블 */}
                  <circle
                    cx={cx}
                    cy={110}
                    r={r}
                    fill={active ? "#FF3D88" : count > 0 ? "#0D0D0D" : "#FAF8F5"}
                    stroke="#0D0D0D"
                    strokeWidth={active ? 3 : 2}
                  />
                  <text
                    x={cx}
                    y={110}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={active || count > 0 ? "#FAF8F5" : "#0D0D0D"}
                    fontSize={r >= 26 ? "16" : "13"}
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {count}
                  </text>

                  {/* 하단 기간 + 진행중 배지 */}
                  <text x={cx} y={200} textAnchor="middle" fill={active ? "#FF3D88" : "#4A4A4A"} fontSize="11" fontWeight="700" fontFamily="monospace">
                    {phaseDays}일
                  </text>
                  {active && (
                    <>
                      <circle cx={cx} cy={110} r={r + 6} fill="none" stroke="#FF3D88" strokeWidth="2" opacity="0.5">
                        <animate attributeName="r" values={`${r+4};${r+14};${r+4}`} dur="2.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.6;0.0;0.6" dur="2.5s" repeatCount="indefinite" />
                      </circle>
                      <text x={cx} y={215} textAnchor="middle" fill="#FF3D88" fontSize="9" fontWeight="700" letterSpacing="2" fontFamily="monospace">
                        ▶ 진행 중
                      </text>
                    </>
                  )}
                </g>
              );
            });
          })()}

          {/* 상단 space 라벨 */}
          <line x1="20" y1="228" x2={20 + (pcts[0]+pcts[1])/100 * 760} y2="228" stroke="#0D0D0D" strokeWidth="1.5" />
          <line x1={20 + (pcts[0]+pcts[1])/100 * 760 + 20} y1="228" x2="780" y2="228" stroke="#0D0D0D" strokeWidth="1.5" />
          <text x={20 + (pcts[0]+pcts[1])/100 * 760 / 2} y="244" textAnchor="middle" fill="#6B6B6B" fontSize="9" letterSpacing="3" fontFamily="monospace">
            PROBLEM SPACE
          </text>
          <text x={(20 + (pcts[0]+pcts[1])/100 * 760 + 800) / 2} y="244" textAnchor="middle" fill="#6B6B6B" fontSize="9" letterSpacing="3" fontFamily="monospace">
            SOLUTION SPACE
          </text>

          {/* 날짜 눈금 — 시작 / 오늘 */}
          <text x="20" y="266" textAnchor="start" fill="#6B6B6B" fontSize="9" fontFamily="monospace">
            {startDate.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
          </text>
          <text x="780" y="266" textAnchor="end" fill="#FF3D88" fontSize="9" fontWeight="700" fontFamily="monospace">
            ▼ 오늘
          </text>
          <line x1="780" y1="268" x2="780" y2="280" stroke="#FF3D88" strokeWidth="1.5" />
        </svg>
      </div>

      {/* 일별 Activity Heatmap */}
      {daily.length > 0 && (
        <div className="border-t-[2px] border-nu-ink bg-nu-cream/20 px-4 py-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite font-bold">
              📈 일별 활동 누적 (최근 60일)
            </div>
            <div className="font-mono-nu text-[10px] text-nu-graphite">
              참여자 {totalContributorCount}명 · 연 {totalEngagement}회 활동 · 누적 {phaseCounts.reduce((a,b)=>a+b,0)}건
            </div>
          </div>
          <ActivityHeatmap daily={daily} maxValue={maxDaily} />
        </div>
      )}

      {/* 단계별 상세 카드 4칸 */}
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x-[1.5px] md:divide-x-[2px] divide-y md:divide-y-0 divide-nu-ink/10 border-t-[2px] border-nu-ink">
        {STAGES.map((st, i) => {
          const active = phaseActive(i);
          const detail = [
            `인사이트 ${counts.insights} · 소스 ${sourceCount}`,
            `HMW ${counts.problems} · 선정 ${counts.selectedProblems}`,
            counts.mainIdea ? `아이디어 ${counts.ideas} · 메인 ✓` : `아이디어 ${counts.ideas}`,
            `태스크 ${counts.doneTasks}/${counts.tasks} · 피드백 ${counts.feedback}${counts.hasPlan ? " · 사업계획 ✓" : ""}`,
          ][i];
          const phaseDays = [discoverDays, defineDays, developDays, deliverDays][i];
          return (
            <div key={st.id} className={`p-3 ${active ? "bg-nu-pink/5" : "bg-nu-paper"}`}>
              <div className={`font-mono-nu text-[9px] uppercase tracking-[0.3em] ${active ? "text-nu-pink" : "text-nu-graphite"}`}>
                {st.phase}
              </div>
              <div className="font-bold text-[13px] text-nu-ink mt-0.5">
                {st.ko} <span className="font-mono-nu text-[10px] text-nu-graphite">· {st.sub}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`font-bold text-[20px] tabular-nums ${phaseCounts[i] === 0 ? "text-nu-ink/30" : active ? "text-nu-pink" : "text-nu-ink"}`}>
                  {phaseCounts[i]}
                </span>
                <span className="font-mono-nu text-[9px] text-nu-graphite">건 · {phaseDays}일</span>
              </div>
              <div className="font-mono-nu text-[10px] text-nu-graphite mt-1 leading-tight">
                {detail}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── 일별 Activity Heatmap ──────────────────────────────
function ActivityHeatmap({ daily, maxValue }: { daily: DailyActivity[]; maxValue: number }) {
  return (
    <div className="flex items-end gap-[2px] h-16 overflow-x-auto">
      {daily.map((d) => {
        const total =
          d.insight_count + d.problem_count + d.idea_count +
          d.task_count + d.feedback_count + d.source_count;
        const h = total === 0 ? 2 : Math.max(3, (total / maxValue) * 56);
        const intensity = d.contributor_count === 0 ? 0 : Math.min(1, d.contributor_count / 4);
        return (
          <div
            key={d.day}
            className="flex-1 min-w-[4px] relative group"
            style={{ height: "100%" }}
            title={`${d.day}: ${total}건 · ${d.contributor_count}명 참여`}
          >
            <div
              className="absolute bottom-0 left-0 right-0"
              style={{
                height: `${h}px`,
                backgroundColor:
                  total === 0
                    ? "rgba(13,13,13,0.1)"
                    : `rgba(255,61,136,${0.4 + intensity * 0.6})`,
              }}
            />
            {total > 0 && d.contributor_count >= 3 && (
              <div
                className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-nu-ink rounded-full"
                title={`${d.contributor_count}명 참여`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
