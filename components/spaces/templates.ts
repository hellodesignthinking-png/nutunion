import type { BlockType } from "./space-pages-types";

export interface TemplateBlock {
  type: BlockType;
  content?: string;
  data?: Record<string, unknown>;
}

export interface PageTemplate {
  id: string;
  title: string;
  icon: string;
  description: string;
  category: "회의" | "프로젝트" | "개인" | "리서치" | "운영";
  blocks: TemplateBlock[];
}

/**
 * 페이지 템플릿 — 클릭 시 새 페이지 생성 + 블록 자동 채움.
 * Notion 의 템플릿 갤러리와 비슷하지만 한국 워크 컨텍스트에 맞춤.
 */
export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "meeting-notes",
    title: "회의록",
    icon: "📝",
    description: "어젠다 / 결정 / 액션 아이템",
    category: "회의",
    blocks: [
      { type: "h2", content: "회의록" },
      { type: "callout", content: "일시 · 장소 · 참석자", data: { icon: "📅" } },
      { type: "h3", content: "어젠다" },
      { type: "bullet", content: "" },
      { type: "h3", content: "논의" },
      { type: "text", content: "" },
      { type: "h3", content: "결정 사항" },
      { type: "todo", content: "" },
      { type: "h3", content: "액션 아이템" },
      { type: "table", data: {
        columns: [{ name: "할 일" }, { name: "담당자" }, { name: "마감" }],
        rows: [["", "", ""], ["", "", ""]],
      } },
    ],
  },
  {
    id: "project-kickoff",
    title: "프로젝트 킥오프",
    icon: "🚀",
    description: "목표 / 범위 / 마일스톤 / 리스크",
    category: "프로젝트",
    blocks: [
      { type: "h1", content: "프로젝트 킥오프" },
      { type: "callout", content: "프로젝트의 한 줄 의미", data: { icon: "🎯" } },
      { type: "h2", content: "목표" },
      { type: "bullet", content: "" },
      { type: "h2", content: "범위" },
      { type: "h3", content: "포함" },
      { type: "bullet", content: "" },
      { type: "h3", content: "제외" },
      { type: "bullet", content: "" },
      { type: "h2", content: "마일스톤" },
      { type: "table", data: {
        columns: [{ name: "단계" }, { name: "산출물" }, { name: "완료 기한" }],
        rows: [["", "", ""], ["", "", ""], ["", "", ""]],
      } },
      { type: "h2", content: "리스크" },
      { type: "callout", content: "주의할 점", data: { icon: "⚠️", color: "amber" } },
    ],
  },
  {
    id: "weekly-review",
    title: "주간 회고",
    icon: "🔁",
    description: "잘한 것 / 못한 것 / 다음 주",
    category: "개인",
    blocks: [
      { type: "h1", content: "주간 회고" },
      { type: "h2", content: "잘한 것" },
      { type: "bullet", content: "" },
      { type: "h2", content: "못한 것" },
      { type: "bullet", content: "" },
      { type: "h2", content: "배운 것" },
      { type: "bullet", content: "" },
      { type: "h2", content: "다음 주 우선순위" },
      { type: "todo", content: "" },
    ],
  },
  {
    id: "1on1",
    title: "1:1 미팅",
    icon: "👥",
    description: "체크인 / 안건 / 피드백",
    category: "회의",
    blocks: [
      { type: "h2", content: "1:1 미팅" },
      { type: "callout", content: "참석자 · 이전 1:1 이후 변화", data: { icon: "👋" } },
      { type: "h3", content: "체크인" },
      { type: "text", content: "" },
      { type: "h3", content: "이번 주 하이라이트" },
      { type: "bullet", content: "" },
      { type: "h3", content: "막힘 · 도움 필요" },
      { type: "bullet", content: "" },
      { type: "h3", content: "피드백 (양방향)" },
      { type: "quote", content: "" },
      { type: "h3", content: "다음 액션" },
      { type: "todo", content: "" },
    ],
  },
  {
    id: "research-note",
    title: "리서치 노트",
    icon: "🔍",
    description: "질문 / 가설 / 발견 / 결론",
    category: "리서치",
    blocks: [
      { type: "h1", content: "리서치 노트" },
      { type: "h2", content: "핵심 질문" },
      { type: "callout", content: "이 리서치로 답하려는 질문", data: { icon: "❓" } },
      { type: "h2", content: "가설" },
      { type: "numbered", content: "" },
      { type: "h2", content: "방법" },
      { type: "text", content: "" },
      { type: "h2", content: "발견" },
      { type: "bullet", content: "" },
      { type: "h2", content: "결론" },
      { type: "text", content: "" },
      { type: "h2", content: "참고 자료" },
      { type: "bullet", content: "" },
    ],
  },
  {
    id: "decision-log",
    title: "결정 로그",
    icon: "🧭",
    description: "ADR — 맥락 / 옵션 / 결정 / 결과",
    category: "운영",
    blocks: [
      { type: "h2", content: "결정 #" },
      { type: "callout", content: "결정 일자 · 결정자 · 상태", data: { icon: "📌", color: "sky" } },
      { type: "h3", content: "맥락" },
      { type: "text", content: "" },
      { type: "h3", content: "고려한 옵션" },
      { type: "table", data: {
        columns: [{ name: "옵션" }, { name: "장점" }, { name: "단점" }],
        rows: [["", "", ""], ["", "", ""]],
      } },
      { type: "h3", content: "결정" },
      { type: "callout", content: "최종 선택 + 근거", data: { icon: "✅", color: "emerald" } },
      { type: "h3", content: "예상 결과" },
      { type: "bullet", content: "" },
    ],
  },
  {
    id: "blank",
    title: "빈 페이지",
    icon: "📄",
    description: "처음부터 자유롭게",
    category: "개인",
    blocks: [],
  },
];
