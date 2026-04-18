// 오픈카톡 / Slack / 일반 대화 로그를 회의록 스타일로 요약하는 프롬프트

import { z } from "zod";

export const ChatDigestSchema = z.object({
  summary: z
    .string()
    .describe("전체 대화를 3~5 문장으로 한국어 요약"),
  topics: z
    .array(
      z.object({
        title: z.string().describe("주제 제목 (한 줄)"),
        summary: z.string().describe("해당 주제 논의 내용 요약 (2~3문장)"),
      })
    )
    .describe("주요 논의 주제 목록 — 3~7개"),
  decisions: z
    .array(z.string())
    .describe("합의/결정 사항 (한 줄 문장). 없으면 빈 배열"),
  action_items: z
    .array(
      z.object({
        assignee: z.string().nullable().describe("담당자 이름 또는 null"),
        task: z.string().describe("해야 할 일"),
        due: z.string().nullable().describe("기한 (YYYY-MM-DD) 또는 null"),
      })
    )
    .describe("실행 항목 (Action Item) — 없으면 빈 배열"),
  participants: z
    .array(z.string())
    .describe("대화 참여자 이름 (닉네임/이모지 제거) — 중복 제거"),
  tone: z
    .string()
    .describe("대화 전반적 분위기 한 줄 (예: '건설적', '긴장감', '갈등')"),
});

export type ChatDigestOutput = z.infer<typeof ChatDigestSchema>;

export const SYSTEM_PROMPT = `당신은 한국어 대화를 회의록으로 정리하는 전문가입니다.

원칙:
1. 원문에 없는 내용을 추정하지 마세요 (환각 금지)
2. 이모지 / 초성 반응 ('ㅋㅋ', '👍') 등은 무시하고 핵심 논의만 추출
3. 닉네임에 이모지/숫자가 붙어 있으면 제거해서 사람 이름만 남깁니다
4. 작성자가 묻어나는 감정적 표현은 중립 문장으로 변환
5. 같은 주제의 반복 발언은 하나로 통합
6. 결정된 것과 제안 단계인 것을 구분 (결정: decisions / 제안: topics 안에 기록)
7. "~해야지", "~할게" 같은 개인적 다짐은 action_items 로 분류
8. 한국어로 답변, 마크다운 없이 평문`;

export function buildUserPrompt(opts: {
  title?: string;
  chatDate?: string;
  entityContext?: string;
  chat: string;
}): string {
  const parts: string[] = [];
  if (opts.title) parts.push(`[회의/주제 제목] ${opts.title}`);
  if (opts.chatDate) parts.push(`[대화 일자] ${opts.chatDate}`);
  if (opts.entityContext) parts.push(`[소속/맥락] ${opts.entityContext}`);
  parts.push("");
  parts.push("[원본 대화]");
  parts.push(opts.chat);
  return parts.join("\n");
}
