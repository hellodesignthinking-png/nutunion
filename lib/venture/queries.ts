import { createClient } from "@/lib/supabase/server";
import type {
  VentureInsight, VentureProblem, VentureIdea,
  VenturePrototypeTask, VentureFeedback, VenturePlan,
  StageProgress, VentureStage,
} from "./types";

export async function getVentureOverview(projectId: string): Promise<{
  insights: VentureInsight[];
  problems: VentureProblem[];
  ideas: VentureIdea[];
  tasks: VenturePrototypeTask[];
  feedback: VentureFeedback[];
  currentPlan: VenturePlan | null;
  stageProgress: StageProgress[];
}> {
  const supabase = await createClient();
  const [insights, problems, ideas, tasks, feedback, plan] = await Promise.all([
    supabase.from("venture_insights").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("venture_problems").select("*").eq("project_id", projectId).order("is_selected", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("venture_ideas").select("*").eq("project_id", projectId).order("is_main", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("venture_prototype_tasks").select("*").eq("project_id", projectId).order("sort_order").order("created_at"),
    supabase.from("venture_feedback").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("venture_plans").select("*").eq("project_id", projectId).eq("is_current", true).maybeSingle(),
  ]);

  // 아이디어 투표 합산
  const ideaRows = (ideas.data as VentureIdea[]) ?? [];
  if (ideaRows.length > 0) {
    const { data: votes } = await supabase
      .from("venture_idea_votes")
      .select("idea_id, weight")
      .in("idea_id", ideaRows.map((i) => i.id));
    const map = new Map<string, { count: number; total: number }>();
    for (const v of (votes as { idea_id: string; weight: number }[]) ?? []) {
      const cur = map.get(v.idea_id) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += v.weight;
      map.set(v.idea_id, cur);
    }
    for (const i of ideaRows) {
      const c = map.get(i.id);
      i.vote_count = c?.count ?? 0;
      i.vote_total = c?.total ?? 0;
    }
    // vote_total 기준 재정렬 (is_main 우선 유지)
    ideaRows.sort((a, b) => {
      if (a.is_main !== b.is_main) return a.is_main ? -1 : 1;
      return (b.vote_total ?? 0) - (a.vote_total ?? 0);
    });
  }

  const pb = (problems.data as VentureProblem[]) ?? [];
  const tk = (tasks.data as VenturePrototypeTask[]) ?? [];
  const ins = (insights.data as VentureInsight[]) ?? [];
  const fb = (feedback.data as VentureFeedback[]) ?? [];
  const currentPlan = (plan.data as VenturePlan | null) ?? null;

  const stageProgress = computeStageProgress({
    insights: ins,
    problems: pb,
    ideas: ideaRows,
    tasks: tk,
    feedback: fb,
    currentPlan,
  });

  return {
    insights: ins,
    problems: pb,
    ideas: ideaRows,
    tasks: tk,
    feedback: fb,
    currentPlan,
    stageProgress,
  };
}

export function computeStageProgress(data: {
  insights: VentureInsight[];
  problems: VentureProblem[];
  ideas: VentureIdea[];
  tasks: VenturePrototypeTask[];
  feedback: VentureFeedback[];
  currentPlan: VenturePlan | null;
}): StageProgress[] {
  const empathizeOk = data.insights.length >= 3; // 최소 3건 이상 인터뷰
  const selectedProblem = data.problems.find((p) => p.is_selected);
  const defineOk = !!selectedProblem;
  const mainIdea = data.ideas.find((i) => i.is_main);
  const ideateOk = !!mainIdea && data.ideas.length >= 2;
  const doneTasks = data.tasks.filter((t) => t.status === "done").length;
  const prototypeOk =
    data.tasks.length >= 3 && doneTasks >= Math.ceil(data.tasks.length * 0.5) && data.feedback.length > 0;
  const planOk = !!data.currentPlan;

  return [
    {
      stage: "empathize",
      complete: empathizeOk,
      count: data.insights.length,
      label: `${data.insights.length}건의 인사이트`,
      blocker: empathizeOk ? undefined : "인터뷰 3건 이상 필요",
    },
    {
      stage: "define",
      complete: defineOk,
      count: data.problems.length,
      label: selectedProblem ? `"${selectedProblem.hmw_statement.slice(0, 40)}..."` : `${data.problems.length}개 후보`,
      blocker: empathizeOk
        ? defineOk
          ? undefined
          : "HMW 1개 선정 필요"
        : "공감 단계 먼저 완료",
    },
    {
      stage: "ideate",
      complete: ideateOk,
      count: data.ideas.length,
      label: mainIdea
        ? `Main: "${mainIdea.title}"`
        : `${data.ideas.length}개 경합 중`,
      blocker: defineOk
        ? ideateOk
          ? undefined
          : data.ideas.length < 2
          ? "최소 2개 아이디어 필요"
          : "Main Solution 선정 필요"
        : "정의 단계 먼저 완료",
    },
    {
      stage: "prototype",
      complete: prototypeOk,
      count: data.tasks.length,
      label: `${doneTasks}/${data.tasks.length} 완료 · 피드백 ${data.feedback.length}건`,
      blocker: ideateOk
        ? prototypeOk
          ? undefined
          : "체크리스트 3개+ / 50% 완료 + 피드백 1건+ 필요"
        : "아이디어 단계 먼저 완료",
    },
    {
      stage: "plan",
      complete: planOk,
      count: data.currentPlan ? 1 : 0,
      label: data.currentPlan ? `v${data.currentPlan.version} 생성됨` : "미생성",
      blocker: prototypeOk ? (planOk ? undefined : "AI 초안 생성 필요") : "프로토타입 단계 먼저 완료",
    },
  ];
}

/** 다음으로 넘어갈 수 있는 스테이지 — stage-gate 검증용 */
export function nextAllowedStage(progress: StageProgress[]): VentureStage {
  const order: VentureStage[] = ["empathize", "define", "ideate", "prototype", "plan", "completed"];
  for (let i = 0; i < progress.length; i++) {
    if (!progress[i].complete) return progress[i].stage;
  }
  return "completed";
}
