export interface SpacePage {
  id: string;
  parent_page_id: string | null;
  title: string;
  icon: string | null;
  content: string;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpaceBlock {
  id: string;
  type: BlockType;
  content: string;
  data: Record<string, unknown>;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BlockType =
  | "text"
  | "h1" | "h2" | "h3"
  | "bullet"
  | "numbered"
  | "todo"
  | "code"
  | "divider"
  | "quote"
  | "callout"
  | "table"
  | "audio"
  | "embed"
  | "image";

/** 블록 스타일 커스텀 — data.color / data.align 으로 공통 적용 */
export type BlockColor = "default" | "red" | "amber" | "emerald" | "sky" | "violet" | "pink";
export type BlockAlign = "left" | "center" | "right";

export const BLOCK_COLOR_CLASSES: Record<BlockColor, { text: string; bg: string }> = {
  default:  { text: "text-nu-ink",      bg: "" },
  red:      { text: "text-red-700",     bg: "bg-red-50" },
  amber:    { text: "text-amber-800",   bg: "bg-amber-50" },
  emerald:  { text: "text-emerald-700", bg: "bg-emerald-50" },
  sky:      { text: "text-sky-700",     bg: "bg-sky-50" },
  violet:   { text: "text-violet-700",  bg: "bg-violet-50" },
  pink:     { text: "text-nu-pink",     bg: "bg-pink-50" },
};

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  text:     "텍스트",
  h1:       "제목 1",
  h2:       "제목 2",
  h3:       "제목 3",
  bullet:   "글머리표",
  numbered: "번호 매기기",
  todo:     "할 일",
  code:     "코드",
  divider:  "구분선",
  quote:    "인용",
  callout:  "강조 박스",
  table:    "표",
  audio:    "음성 메모",
  embed:    "임베드",
  image:    "이미지",
};

export const SLASH_COMMANDS: Array<{ type: BlockType; label: string; sub: string; keys: string[] }> = [
  { type: "text",     label: "텍스트",     sub: "일반 단락",     keys: ["text", "텍스트", "p"] },
  { type: "h1",       label: "제목 1",     sub: "큰 제목",       keys: ["h1", "제목", "heading"] },
  { type: "h2",       label: "제목 2",     sub: "중간 제목",     keys: ["h2", "제목"] },
  { type: "h3",       label: "제목 3",     sub: "작은 제목",     keys: ["h3", "제목"] },
  { type: "todo",     label: "할 일",      sub: "체크박스",      keys: ["todo", "할일", "task"] },
  { type: "bullet",   label: "글머리표",   sub: "• 항목",        keys: ["bullet", "list", "글머리"] },
  { type: "numbered", label: "번호 매기기", sub: "1. 항목",       keys: ["numbered", "ol", "번호"] },
  { type: "quote",    label: "인용",       sub: "▎인용",         keys: ["quote", "인용"] },
  { type: "callout",  label: "강조 박스",  sub: "💡 콜아웃",     keys: ["callout", "강조"] },
  { type: "code",     label: "코드",       sub: "```코드```",     keys: ["code", "코드"] },
  { type: "divider",  label: "구분선",     sub: "—",             keys: ["divider", "구분", "hr"] },
  { type: "table",    label: "표",         sub: "미니 테이블",   keys: ["table", "표", "데이터"] },
  { type: "audio",    label: "음성 메모",  sub: "🎙 녹음",       keys: ["audio", "음성", "녹음"] },
  { type: "embed",    label: "임베드",     sub: "YouTube/Drive/Figma", keys: ["embed", "임베드", "youtube", "drive", "figma"] },
  { type: "image",    label: "이미지",     sub: "📷 업로드/붙여넣기", keys: ["image", "이미지", "사진", "img"] },
];
