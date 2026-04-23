// Venture 모드 활성화 시 분야별 프리셋 시드.
//
// 중요 (2026-04 업데이트):
//   이전에는 venture_problems/ideas/tasks 에 플레이스홀더 포함 예시 행을 실제로 insert 했으나,
//   `[타겟 유저]` 같은 치환 전 문구가 사용자 UI 에 "진짜 데이터"처럼 표시되는 문제로 인해
//   **기본적으로 DB insert 를 하지 않음**. 템플릿은 UI 에서 "제안 예시" 로 표시만 함.
//
//   기존 스키마 호환을 위해 함수 시그니처는 유지하되, seeded=false 반환 + history 만 기록.

import type { SupabaseClient } from "@supabase/supabase-js";
import { TEMPLATES, type TemplateCategory } from "./templates";

export async function seedVentureTemplate(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  category: TemplateCategory = "generic"
): Promise<{ seeded: boolean; counts: { tasks: number; problems: number; ideas: number }; errors: string[] }> {
  const template = TEMPLATES[category] ?? TEMPLATES.generic;

  // history 에만 "카테고리 선택" 기록 — 실제 problem/idea/task 는 insert 하지 않음
  const { error: histErr } = await supabase.from("venture_stage_history").insert({
    project_id: projectId,
    from_stage: null,
    to_stage: "empathize",
    changed_by: userId,
    note: `${template.icon} ${template.label} 카테고리 선택 · 실제 데이터는 사용자가 직접 입력`,
  });

  const errors: string[] = [];
  if (histErr) errors.push(`history: ${histErr.message}`);

  return {
    seeded: false,
    counts: { tasks: 0, problems: 0, ideas: 0 },
    errors,
  };
}
