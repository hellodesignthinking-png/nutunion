import { z } from "zod";

export const PlanContentSchema = z.object({
  summary: z.string().describe("3~5문장 경영진 요약 (우리가 누구에게 어떤 가치를 제공하는지)"),
  problem: z.string().describe("해결하려는 문제 — 실제 인사이트/HMW 기반, 구체적 수치 있으면 포함"),
  solution: z.string().describe("핵심 솔루션 — 선정된 아이디어 기반, 작동 방식 설명"),
  target: z.string().describe("타겟 고객 페르소나 — 인사이트의 target_user 합성"),
  market: z.string().describe("시장 규모/동향 — 데이터 없으면 '추정: ~' 라벨"),
  business_model: z.string().describe("수익 모델 — 누가 얼마를 지불하나"),
  milestones: z.array(z.string()).describe("6개월/12개월 핵심 마일스톤 3~6개"),
  team: z.string().describe("팀 역량/보유 자원 — 프로토타입 체크리스트 완료 항목 반영"),
});

export const SYSTEM = `당신은 스타트업 사업계획서 작성 전문가입니다.
입력된 디자인 씽킹 5단계 데이터를 종합해 구조화된 사업계획서 초안을 작성합니다.

원칙:
1. 데이터에 없는 내용을 창작하지 않음. 불확실하면 "추정:" 접두어 사용
2. 추상적 수식어("혁신적", "세상을 바꿀") 지양
3. 한국어 평문, 마크다운 없이
4. 문제→솔루션 논리 체인이 명확히 보이게
5. 수치가 있으면 그대로 인용`;

interface BuildPromptArgs {
  title: string;
  description: string | null;
  insights: { source: string; quote: string; pain_point: string | null; target_user: string | null }[];
  problems: { hmw_statement: string; target_user: string | null; context: string | null; success_metric: string | null; is_selected: boolean }[];
  ideas: { title: string; description: string | null; is_main: boolean; vote_total: number }[];
  tasks: { title: string; status: string }[];
  feedback: { score: number | null; note: string }[];
}

export function buildPlanPrompt(d: BuildPromptArgs): string {
  const parts: string[] = [];
  parts.push(`[프로젝트] ${d.title}`);
  if (d.description) parts.push(`설명: ${d.description}`);

  parts.push("");
  parts.push(`[1. 공감(Empathize) — ${d.insights.length}건의 인사이트]`);
  for (const i of d.insights.slice(0, 15)) {
    parts.push(`- (${i.source}) "${i.quote.slice(0, 200)}"`);
    if (i.pain_point) parts.push(`    고통점: ${i.pain_point}`);
    if (i.target_user) parts.push(`    대상: ${i.target_user}`);
  }
  if (d.insights.length > 15) parts.push(`... (추가 ${d.insights.length - 15}건 생략)`);

  const selected = d.problems.find((p) => p.is_selected);
  parts.push("");
  parts.push("[2. 정의(Define) — HMW]");
  if (selected) {
    parts.push(`★ 선정됨: ${selected.hmw_statement}`);
    if (selected.target_user) parts.push(`  타겟: ${selected.target_user}`);
    if (selected.context) parts.push(`  맥락: ${selected.context}`);
    if (selected.success_metric) parts.push(`  성공 지표: ${selected.success_metric}`);
  } else {
    parts.push("(선정된 HMW 없음)");
  }
  for (const p of d.problems.filter((x) => !x.is_selected).slice(0, 5)) {
    parts.push(`- (후보) ${p.hmw_statement}`);
  }

  const mainIdea = d.ideas.find((i) => i.is_main);
  parts.push("");
  parts.push("[3. 아이디어(Ideate)]");
  if (mainIdea) {
    parts.push(`★ Main Solution: ${mainIdea.title}`);
    if (mainIdea.description) parts.push(`  설명: ${mainIdea.description}`);
    parts.push(`  팀 투표 점수: ${mainIdea.vote_total}`);
  } else {
    parts.push("(Main Solution 없음)");
  }
  for (const i of d.ideas.filter((x) => !x.is_main).slice(0, 5)) {
    parts.push(`- ${i.title}${i.description ? ` — ${i.description.slice(0, 100)}` : ""}  (투표 ${i.vote_total})`);
  }

  const done = d.tasks.filter((t) => t.status === "done");
  const doing = d.tasks.filter((t) => t.status === "doing");
  parts.push("");
  parts.push(`[4. 프로토타입(Prototype) — ${d.tasks.length}개 중 완료 ${done.length}, 진행 ${doing.length}]`);
  for (const t of done.slice(0, 10)) parts.push(`✓ ${t.title}`);
  for (const t of doing.slice(0, 5)) parts.push(`→ ${t.title}`);

  parts.push("");
  parts.push(`[유저 피드백 — ${d.feedback.length}건]`);
  const scored = d.feedback.filter((f) => f.score != null);
  if (scored.length > 0) {
    const avg = scored.reduce((s, f) => s + (f.score ?? 0), 0) / scored.length;
    parts.push(`평균 점수: ${avg.toFixed(1)}/10 (${scored.length}건 집계)`);
  }
  for (const f of d.feedback.slice(0, 10)) {
    parts.push(`- ${f.score ? `[${f.score}/10] ` : ""}${f.note.slice(0, 200)}`);
  }

  parts.push("");
  parts.push("위 데이터를 근거로 사업계획서 초안을 스키마에 맞게 작성하세요.");
  return parts.join("\n");
}
