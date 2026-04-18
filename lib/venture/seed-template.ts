// Venture 모드 활성화 시 각 단계에 프리셋 항목을 자동 시드.
// 온보딩 가속 — 빈 화면 공포 제거.

import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_PROTOTYPE_TASKS = [
  "타겟 유저 10명 리스트업",
  "핵심 가치 한 줄 (Value Proposition) 작성",
  "최소 기능 MVP 스케치/와이어프레임",
  "MVP 실사용 테스트 세션 3회 예약",
  "초기 피드백 수집 양식 준비 (점수 + 노트)",
];

/**
 * Venture 모드 활성화 직후 호출.
 * 이미 데이터가 있으면 건너뛴다 (재활성화 시 중복 방지).
 */
export async function seedVentureTemplate(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<{ seeded: boolean; counts: { tasks: number } }> {
  // 이미 태스크 있으면 skip
  const { count: existingTasks } = await supabase
    .from("venture_prototype_tasks")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if ((existingTasks ?? 0) > 0) {
    return { seeded: false, counts: { tasks: 0 } };
  }

  const taskRows = DEFAULT_PROTOTYPE_TASKS.map((title, idx) => ({
    project_id: projectId,
    title,
    status: "todo" as const,
    sort_order: idx + 1,
    assignee_id: null,
  }));

  const { error } = await supabase.from("venture_prototype_tasks").insert(taskRows);
  if (error) {
    return { seeded: false, counts: { tasks: 0 } };
  }

  // 시스템 노트로 히스토리에 남김 (선택) — 실패해도 무시
  try {
    await supabase.from("venture_stage_history").insert({
      project_id: projectId,
      from_stage: null,
      to_stage: "empathize",
      changed_by: userId,
      note: `템플릿 시드: 프로토타입 체크리스트 ${taskRows.length}개 자동 생성`,
    });
  } catch {
    // noop
  }

  return { seeded: true, counts: { tasks: taskRows.length } };
}
