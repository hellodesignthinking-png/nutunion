/**
 * lib/files/file-meta — 파일 이름/MIME 기반 종류 판별 + 아이콘 반환.
 *
 * 사용:
 *   import { getFileKind, getFileIcon } from "@/lib/files/file-meta";
 *   const kind = getFileKind(row.file_name, row.file_type);
 *   const icon = getFileIcon(row.file_name, row.file_type);
 */

export type FileKind =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "spreadsheet"
  | "document"
  | "presentation"
  | "code"
  | "archive"
  | "text"
  | "other";

const EXT_MAP: Record<string, FileKind> = {
  pdf: "pdf",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image", bmp: "image", heic: "image",
  mp4: "video", mov: "video", webm: "video", mkv: "video", avi: "video",
  mp3: "audio", wav: "audio", m4a: "audio", aac: "audio", flac: "audio", ogg: "audio",
  xlsx: "spreadsheet", xls: "spreadsheet", csv: "spreadsheet", numbers: "spreadsheet",
  doc: "document", docx: "document", rtf: "document", odt: "document", hwp: "document", pages: "document",
  ppt: "presentation", pptx: "presentation", key: "presentation", odp: "presentation",
  js: "code", jsx: "code", ts: "code", tsx: "code", py: "code", rb: "code", go: "code",
  rs: "code", java: "code", c: "code", cpp: "code", h: "code", cs: "code",
  sh: "code", bash: "code", zsh: "code", sql: "code", json: "code", yaml: "code", yml: "code",
  html: "code", css: "code", scss: "code", vue: "code", svelte: "code", toml: "code",
  zip: "archive", rar: "archive", tar: "archive", gz: "archive", "7z": "archive",
  txt: "text", md: "text", markdown: "text", log: "text",
};

export function getFileKind(name: string, mime?: string | null): FileKind {
  const m = (mime || "").toLowerCase();
  if (m === "application/pdf" || m.endsWith("/pdf")) return "pdf";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m.includes("spreadsheet") || m.includes("excel") || m === "text/csv") return "spreadsheet";
  if (m.includes("presentation") || m.includes("powerpoint")) return "presentation";
  if (m.includes("wordprocessing") || m.includes("msword") || m.includes("opendocument.text"))
    return "document";
  if (m === "application/zip" || m.includes("compressed") || m.includes("x-tar") || m.includes("gzip"))
    return "archive";

  const ext = (name.split(".").pop() || "").toLowerCase();
  const byExt = EXT_MAP[ext];
  if (byExt) return byExt;

  if (m.startsWith("text/")) return "text";
  return "other";
}

const ICON_MAP: Record<FileKind, string> = {
  pdf: "📄",
  image: "🖼️",
  video: "🎬",
  audio: "🎵",
  spreadsheet: "📊",
  document: "📝",
  presentation: "📽️",
  code: "💻",
  archive: "📦",
  text: "📃",
  other: "📎",
};

export function getFileIcon(name: string, mime?: string | null): string {
  return ICON_MAP[getFileKind(name, mime)];
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatStorageBadge(storage?: string | null): string {
  const s = (storage || "").toLowerCase();
  if (s === "r2") return "R2";
  if (s === "drive" || s === "google_drive" || s === "googledrive") return "Drive";
  if (s === "supabase") return "Supabase";
  return s || "";
}
