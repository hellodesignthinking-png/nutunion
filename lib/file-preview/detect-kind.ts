/**
 * 파일 종류 / MIME / 임베드 URL 변환 — 순수 함수.
 *
 * file-preview-panel 에서 추출. UI 상태와 무관해 server/client 양쪽에서 import 가능.
 */

export type FileKind =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "office"
  | "youtube"
  | "vimeo"
  | "loom"
  | "figma"
  | "tweet"
  | "spotify"
  | "notion"
  | "soundcloud"
  | "gist"
  | "codepen"
  | "tiktok"
  | "instagram"
  | "miro"
  | "slideshare"
  | "github"
  | "html"
  | "gdrive"
  | "hwp"
  | "other";

/** Google Docs/Sheets/Slides/Drawing URL 을 임베드 가능한 /preview URL 로 변환.
 *  편집(`/edit`) URL → 미리보기(`/preview`) URL — 인증 없는 iframe 임베드 가능. */
export function toGdriveEmbed(url: string): string | null {
  // docs.google.com/document/d/{ID}/edit → /preview
  // docs.google.com/spreadsheets/d/{ID}/edit → /preview
  // docs.google.com/presentation/d/{ID}/edit → /preview
  // docs.google.com/drawings/d/{ID}/edit → /preview
  const m = url.match(/docs\.google\.com\/(document|spreadsheets|presentation|drawings)\/d\/([\w-]+)/);
  if (m) {
    return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
  }
  // drive.google.com/file/d/{ID}/view → /preview
  const f = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (f) {
    return `https://drive.google.com/file/d/${f[1]}/preview`;
  }
  return null;
}

/** YouTube 채널/플레이리스트는 embed 불가 — 영상 URL 만 embed 변환 가능. */
export function toYoutubeEmbed(url: string): string | null {
  const watch = url.match(/youtube\.com\/watch\?[^#]*v=([^&#]+)/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`;
  const short = url.match(/youtu\.be\/([^?#]+)/);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;
  const shorts = url.match(/youtube\.com\/shorts\/([^?#]+)/);
  if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
  return null;
}

export function detectKind(url: string, mime?: string | null): FileKind {
  const lowerUrl = (url || "").toLowerCase();
  if (
    lowerUrl.includes("youtube.com/watch") ||
    lowerUrl.includes("youtu.be/") ||
    lowerUrl.includes("youtube.com/@") ||
    lowerUrl.includes("youtube.com/channel/") ||
    lowerUrl.includes("youtube.com/c/") ||
    lowerUrl.includes("youtube.com/shorts/") ||
    lowerUrl.includes("youtube.com/playlist")
  ) {
    return "youtube";
  }
  // Google Docs/Sheets/Slides/Drawing/Drive 파일 → /preview iframe 임베드
  if (
    lowerUrl.includes("docs.google.com/document/") ||
    lowerUrl.includes("docs.google.com/spreadsheets/") ||
    lowerUrl.includes("docs.google.com/presentation/") ||
    lowerUrl.includes("docs.google.com/drawings/") ||
    lowerUrl.includes("drive.google.com/file/d/")
  ) {
    return "gdrive";
  }
  // Vimeo — embed via player.vimeo.com
  if (lowerUrl.includes("vimeo.com/") && !lowerUrl.includes("player.vimeo.com")) return "vimeo";
  if (lowerUrl.includes("player.vimeo.com/video/")) return "vimeo";
  // Loom — /share/{ID} → /embed/{ID}
  if (lowerUrl.includes("loom.com/share/") || lowerUrl.includes("loom.com/embed/")) return "loom";
  // Figma — file/proto/design URLs embeddable via figma.com/embed
  if (
    lowerUrl.includes("figma.com/file/") ||
    lowerUrl.includes("figma.com/proto/") ||
    lowerUrl.includes("figma.com/design/") ||
    lowerUrl.includes("figma.com/board/")
  ) {
    return "figma";
  }
  // Twitter / X status — twitframe.com embed
  if (/^https?:\/\/(www\.)?(twitter|x)\.com\/[^/]+\/status\/\d+/.test(url)) return "tweet";
  // Spotify — open.spotify.com/{type}/{id} → embed
  if (lowerUrl.includes("open.spotify.com/")) return "spotify";
  // Notion — public pages typically block iframes; show OG card
  if (lowerUrl.includes("notion.so/") || lowerUrl.includes("notion.site/")) return "notion";
  // SoundCloud — w.soundcloud.com/player iframe
  if (lowerUrl.includes("soundcloud.com/")) return "soundcloud";
  // GitHub Gist — raw text fetch (script-only embed 대안)
  if (lowerUrl.includes("gist.github.com/")) return "gist";
  // CodePen — pen embed
  if (lowerUrl.includes("codepen.io/") && (lowerUrl.includes("/pen/") || lowerUrl.includes("/embed/"))) return "codepen";
  // TikTok — embed
  if (lowerUrl.includes("tiktok.com/") && (lowerUrl.includes("/video/") || lowerUrl.includes("/@"))) return "tiktok";
  // Instagram — embed
  if (lowerUrl.match(/instagram\.com\/(p|reel|tv)\//)) return "instagram";
  // Miro board — embed
  if (lowerUrl.includes("miro.com/app/board/")) return "miro";
  // SlideShare — embed
  if (lowerUrl.includes("slideshare.net/")) return "slideshare";
  // GitHub blob/repo (gist 제외) — link card
  if (lowerUrl.includes("github.com/")) return "github";
  const cleanUrl = url.split("?")[0];
  const ext = cleanUrl.split(".").pop()?.toLowerCase() || "";
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf") || ext === "pdf") return "pdf";
  if (ext === "html" || ext === "htm" || m === "text/html") return "html";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif"].includes(ext)) return "image";
  if (m.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(ext)) return "video";
  if (m.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "aac", "flac"].includes(ext)) return "audio";
  const textExts = [
    "md", "markdown", "txt", "json", "yml", "yaml", "csv", "tsv", "log",
    "xml", "html", "htm", "css", "js", "jsx", "ts", "tsx", "py", "go",
    "rs", "java", "rb", "sh", "sql", "env", "toml", "ini",
  ];
  if (m.startsWith("text/") || textExts.includes(ext)) return "text";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office";
  if (["hwp", "hwpx"].includes(ext) || m === "application/x-hwp" || m === "application/haansofthwp" || m === "application/vnd.hancom.hwp") return "hwp";
  return "other";
}

export function guessMime(name: string, fallback?: string | null): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    md: "text/markdown", markdown: "text/markdown",
    txt: "text/plain", log: "text/plain",
    json: "application/json",
    yml: "application/yaml", yaml: "application/yaml",
    csv: "text/csv", tsv: "text/tab-separated-values",
    xml: "application/xml",
    html: "text/html", htm: "text/html",
    css: "text/css",
    js: "application/javascript", jsx: "text/jsx",
    ts: "application/typescript", tsx: "text/tsx",
    py: "text/x-python", go: "text/x-go", rs: "text/x-rust",
    java: "text/x-java", rb: "text/x-ruby", sh: "text/x-sh",
    sql: "application/sql", env: "text/plain",
    toml: "application/toml", ini: "text/plain",
  };
  return map[ext] || fallback || "text/plain";
}

export const LANG_MAP: Record<string, string> = {
  ts: "typescript", tsx: "typescript",
  js: "javascript", jsx: "javascript",
  py: "python", go: "go", rs: "rust",
  java: "java", rb: "ruby", php: "php",
  sh: "bash", sql: "sql",
  json: "json", yaml: "yaml", yml: "yaml",
  html: "html", htm: "html", css: "css",
  md: "markdown", markdown: "markdown",
  xml: "xml", toml: "ini", ini: "ini",
  csv: "plaintext", tsv: "plaintext", txt: "plaintext", log: "plaintext",
};

export function detectLang(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return LANG_MAP[ext] || "plaintext";
}

/** 리스트 UI 에서 ✏️ 뱃지용 — R2 텍스트 파일만 편집 가능. */
export function isTextEditableFile(name: string, mime?: string | null, storage_type?: string | null): boolean {
  if (storage_type !== "r2") return false;
  return detectKind(name, mime) === "text";
}
