// Prompt injection & 파일 업로드 sanitization 유틸.

/**
 * 유저가 입력한 자료 텍스트(venture_sources.content_text, insights.quote 등)를
 * AI 프롬프트에 넣기 전 sanitize.
 *
 * 제거/중화:
 *   1. "ignore previous/above instructions" 류 탈옥 토큰
 *   2. role marker (User:, Assistant:, System:) 위장
 *   3. instruction-like triple-fence 블록 주변 노이즈
 *   4. 제어 문자
 *
 * 원본 그대로 AI 가 읽게 두되 악성 명령어만 neutralize.
 */
const INJECTION_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  // 영문 탈옥 시도
  { pattern: /ignore\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions?|prompts?|rules?|directions?)/gi, replacement: "[filtered]" },
  { pattern: /disregard\s+(the\s+)?(previous|above|prior)\s+(instructions?|prompts?)/gi, replacement: "[filtered]" },
  { pattern: /forget\s+(everything|all\s+previous|the\s+instructions?)/gi, replacement: "[filtered]" },
  { pattern: /new\s+instructions?\s*:/gi, replacement: "[filtered]:" },
  // 한국어 탈옥 시도
  { pattern: /이전\s*(지시|명령|프롬프트|규칙)(사항)?\s*(을|를)\s*(무시|잊)/g, replacement: "[filtered]" },
  { pattern: /위의?\s*(지시|명령|프롬프트|규칙)(사항)?\s*(을|를)\s*(무시|잊)/g, replacement: "[filtered]" },
  { pattern: /새(로운)?\s*지시\s*:/g, replacement: "[filtered]:" },
  // Role marker 위장 (라인 시작 기준)
  { pattern: /^\s*(system|assistant|user|human)\s*[:：]/gim, replacement: "[text]:" },
  // Claude/GPT 스타일 제어 토큰
  { pattern: /<\|(?:im_start|im_end|endoftext|end_of_text|fim_prefix|fim_middle|fim_suffix)\|>/gi, replacement: "" },
  // JSON escape token (AI가 JSON 응답 모드일 때 주의)
  { pattern: /\}\s*,?\s*"(?:system|role|instruction)"\s*:/gi, replacement: "} [filtered]:" },
];

/**
 * 텍스트 내 prompt injection 시도를 neutralize.
 * 원본 길이 대비 큰 변화가 없는 한 내용 보존.
 */
export function sanitizeForPrompt(text: string, maxLength = 20_000): string {
  if (!text) return "";
  let out = text.slice(0, maxLength);

  // 제어 문자 제거 (줄바꿈/탭 제외)
  out = out.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  for (const { pattern, replacement } of INJECTION_PATTERNS) {
    out = out.replace(pattern, replacement);
  }

  return out;
}

/**
 * 파일 업로드용 확장자 sanitize.
 * 화이트리스트 기반 — 통과 못하면 "bin" 반환.
 */
const ALLOWED_IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]);
const ALLOWED_DOC_EXTS = new Set(["pdf", "csv", "txt", "md", "json", "xlsx", "docx", "pptx"]);

export function sanitizeExtension(filename: string, kind: "image" | "document" = "image"): string {
  if (!filename) return "bin";
  // 마지막 점 이후만, 소문자, 10자 이하, 영숫자만
  const match = filename.match(/\.([a-zA-Z0-9]{1,10})$/);
  if (!match) return "bin";
  const ext = match[1].toLowerCase();
  const allowed = kind === "image" ? ALLOWED_IMAGE_EXTS : ALLOWED_DOC_EXTS;
  return allowed.has(ext) ? ext : "bin";
}

/**
 * 업로드 경로 안전화 — 경로 인젝션 (../ / null byte) 차단.
 */
export function sanitizePathSegment(seg: string): string {
  return seg.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}
