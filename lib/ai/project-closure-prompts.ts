// 프로젝트 마감 시 AI 가 종합 요약을 만드는 프롬프트 + 스키마

import { z } from "zod";

export const ClosureSchema = z.object({
  summary: z
    .string()
    .describe("프로젝트 전체 여정을 5~8 문장으로 내러티브 요약 (목표→과정→결과)"),
  achievements: z
    .array(z.string())
    .describe("주요 성과 (결과물, 지표, 달성 항목). 3~7 개. 구체적 사실만."),
  challenges: z
    .array(z.string())
    .describe("직면한 과제와 해결 방식. 0~5 개."),
  lessons: z
    .array(z.string())
    .describe("배운 점 / 다음 프로젝트에 남길 교훈. 0~5 개."),
  key_contributors: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().nullable(),
        contribution: z.string().describe("핵심 기여 한 줄"),
      })
    )
    .describe("핵심 기여자 (닉네임/역할/기여). 0~10 명."),
  final_outputs: z
    .array(z.string())
    .describe("최종 산출물 목록 (문서/제품/링크/정책 등). 0~10 개."),
  headline: z
    .string()
    .describe("프로젝트를 한 줄로 축약 (타이틀처럼 짧게)"),
});

export type ClosureOutput = z.infer<typeof ClosureSchema>;

export const SYSTEM_PROMPT = `당신은 프로젝트 회고 전문가입니다.
주어진 프로젝트 데이터를 바탕으로 마감(종료) 보고서를 작성합니다.

원칙:
1. 데이터에 없는 내용을 창작/추정하지 않기 (환각 금지)
2. 수치가 있으면 수치를 그대로 인용
3. "성공/실패" 라벨링 대신 객관적 진술 사용
4. 추상적 미사여구 지양 (예: "뜻깊은 여정" 같은 표현 금지)
5. 참여자 이름은 닉네임 그대로 사용
6. 한국어 평문 (마크다운 없이)
7. challenges / lessons / key_contributors 는 근거가 없으면 빈 배열`;

interface Milestone {
  title: string;
  status: string;
  due_date: string | null;
  description?: string | null;
}

interface Member {
  nickname: string;
  role?: string | null;
  joined_at?: string;
}

interface Digest {
  title: string;
  chat_date: string | null;
  summary: string;
  decisions: string[];
}

export function buildClosurePrompt(opts: {
  title: string;
  description: string | null;
  category: string | null;
  created_at: string;
  milestones: Milestone[];
  members: Member[];
  digests: Digest[];
  extra?: string;
}): string {
  const parts: string[] = [];

  parts.push("[프로젝트 기본 정보]");
  parts.push(`제목: ${opts.title}`);
  if (opts.category) parts.push(`분야: ${opts.category}`);
  parts.push(`시작일: ${opts.created_at.slice(0, 10)}`);
  parts.push(`총 기간: ${daysBetween(opts.created_at, new Date().toISOString())}일`);
  if (opts.description) parts.push(`설명: ${opts.description}`);

  parts.push("");
  parts.push(`[참여 멤버 — 총 ${opts.members.length}명]`);
  if (opts.members.length === 0) {
    parts.push("(기록 없음)");
  } else {
    for (const m of opts.members) {
      parts.push(`- ${m.nickname}${m.role ? ` (${m.role})` : ""}`);
    }
  }

  parts.push("");
  const completedMs = opts.milestones.filter((m) => m.status === "completed").length;
  parts.push(`[마일스톤 — 총 ${opts.milestones.length}개, 완료 ${completedMs}개]`);
  if (opts.milestones.length === 0) {
    parts.push("(기록 없음)");
  } else {
    for (const m of opts.milestones) {
      parts.push(`- [${m.status}] ${m.title}${m.due_date ? ` (~${m.due_date})` : ""}`);
      if (m.description) parts.push(`    · ${m.description.slice(0, 200)}`);
    }
  }

  parts.push("");
  parts.push(`[회의록 요약 — 총 ${opts.digests.length}건]`);
  if (opts.digests.length === 0) {
    parts.push("(기록 없음)");
  } else {
    for (const d of opts.digests.slice(0, 20)) {
      parts.push(`- ${d.chat_date ?? "날짜미상"}: ${d.title}`);
      parts.push(`    요약: ${d.summary.slice(0, 300)}`);
      if (d.decisions.length > 0) {
        parts.push(`    결정: ${d.decisions.slice(0, 3).join(" / ")}`);
      }
    }
    if (opts.digests.length > 20) {
      parts.push(`... (추가 ${opts.digests.length - 20}건 생략)`);
    }
  }

  if (opts.extra) {
    parts.push("");
    parts.push("[추가 메모 — 마감자가 직접 입력]");
    parts.push(opts.extra);
  }

  parts.push("");
  parts.push("위 정보를 바탕으로 마감 보고서를 스키마에 맞게 작성하세요.");
  return parts.join("\n");
}

function daysBetween(iso1: string, iso2: string): number {
  const ms = Math.abs(new Date(iso2).getTime() - new Date(iso1).getTime());
  return Math.round(ms / (24 * 60 * 60 * 1000));
}
