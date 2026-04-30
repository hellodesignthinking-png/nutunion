/**
 * lib/wiki/content-extractor.ts
 *
 * Extract real content from a WikiResource for the wiki synthesis engine.
 * Each handler returns plain text/markdown. Failures are non-fatal —
 * the synthesis route falls back to metadata when extraction fails.
 *
 * Supported types:
 *   - youtube  → transcript (youtube-transcript) → fallback oEmbed title+author
 *   - article / link / notion → HTML fetch + regex-based text extraction
 *   - pdf       → pdf-parse on URL bytes
 *   - docs      → Google Drive export(text/plain)
 *   - sheet     → Google Drive export(text/csv) → markdown table
 *   - slide     → Google Drive export(text/plain)
 *   - drive     → mimeType-based dispatch (Doc/Sheet/Slide/PDF)
 *   - other     → URL fetch + best-effort
 */

import { getGoogleClient } from "@/lib/google/auth";
import { google } from "googleapis";

// Hard caps to keep prompt size reasonable. Gemini 2.5 Flash supports 1M ctx,
// but we still cap each resource so one giant doc doesn't drown the others.
const PER_RESOURCE_CHAR_CAP = 6000;
const ARTICLE_CHAR_CAP = 10000;
const YOUTUBE_CHAR_CAP = 8000;

export type WikiResource = {
  id: string;
  title: string;
  url: string | null;
  resource_type: string | null;
  auto_summary?: string | null;
  description?: string | null;
};

export type ExtractionResult = {
  type: string;
  content: string;
  source_url: string;
  word_count: number;
  truncated: boolean;
  /** "transcript" | "scrape" | "drive_export" | "pdf_parse" | "metadata" */
  method: string;
};

export type ExtractionFailure = {
  ok: false;
  reason: string;
  type: string;
  source_url: string;
};

export type ExtractionOutcome =
  | ({ ok: true } & ExtractionResult)
  | ExtractionFailure;

/* ─────────────────────────────────────────────────────────────
 * Predict whether extraction can run for a resource — used by UI
 * to render status chips before the user kicks off synthesis.
 * ──────────────────────────────────────────────────────────── */
export type ExtractionCapability =
  | "extractable" // we can pull real content
  | "metadata"    // we'll only get title/desc
  | "needs_google"; // user must connect Google first

export function predictCapability(
  resource: WikiResource,
  hasGoogleConnected: boolean,
): ExtractionCapability {
  const t = (resource.resource_type || "").toLowerCase();
  const url = (resource.url || "").toLowerCase();

  if (t === "youtube" || url.includes("youtube.com") || url.includes("youtu.be")) {
    return "extractable"; // transcript or oEmbed
  }
  if (t === "pdf" || url.endsWith(".pdf")) return "extractable";
  if (t === "docs" || t === "sheet" || t === "slide" || t === "drive" ||
      url.includes("docs.google.com") || url.includes("drive.google.com")) {
    return hasGoogleConnected ? "extractable" : "needs_google";
  }
  if (t === "article" || t === "link" || t === "notion" || t === "other") {
    return "extractable"; // best-effort HTML scrape
  }
  return "metadata";
}

/* ─────────────────────────────────────────────────────────────
 * Main entrypoint
 * ──────────────────────────────────────────────────────────── */
export async function extractContent(
  resource: WikiResource,
  userId: string,
): Promise<ExtractionOutcome> {
  const url = resource.url || "";
  const type = (resource.resource_type || "").toLowerCase();
  const lower = url.toLowerCase();

  if (!url) {
    return { ok: false, reason: "no_url", type, source_url: "" };
  }

  try {
    // YouTube
    if (type === "youtube" || lower.includes("youtube.com") || lower.includes("youtu.be")) {
      return await extractYouTube(url);
    }

    // PDF
    if (type === "pdf" || lower.endsWith(".pdf") || lower.includes("/pdf?")) {
      return await extractPdf(url);
    }

    // Google Workspace
    if (type === "docs" || lower.includes("docs.google.com/document")) {
      return await extractGoogleDoc(url, userId);
    }
    if (type === "sheet" || lower.includes("docs.google.com/spreadsheets")) {
      return await extractGoogleSheet(url, userId);
    }
    if (type === "slide" || lower.includes("docs.google.com/presentation")) {
      return await extractGoogleSlide(url, userId);
    }
    if (type === "drive" || lower.includes("drive.google.com")) {
      return await extractDriveAuto(url, userId);
    }

    // Article / link / notion / other → HTML scrape
    return await extractHtml(url);
  } catch (err: any) {
    const msg = err?.message || String(err);
    return {
      ok: false,
      reason: msg.includes("GOOGLE_NOT_CONNECTED")
        ? "google_not_connected"
        : msg.includes("GOOGLE_TOKEN_EXPIRED")
        ? "google_token_expired"
        : msg.slice(0, 200),
      type,
      source_url: url,
    };
  }
}

/* ─── helpers ───────────────────────────────────────────────── */

function clean(text: string, cap: number): { content: string; truncated: boolean } {
  const collapsed = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (collapsed.length <= cap) return { content: collapsed, truncated: false };
  return { content: collapsed.slice(0, cap) + "\n\n…(이하 생략)", truncated: true };
}

function wordsOf(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function youTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "").split("/")[0] || null;
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?#]+)/);
    if (m) return m[2];
    return null;
  } catch {
    return null;
  }
}

function googleFileId(url: string): { id: string; kind: "document" | "spreadsheet" | "presentation" | "drive" } | null {
  try {
    const u = new URL(url);
    // /document/d/ID/...   /spreadsheets/d/ID/...   /presentation/d/ID/...
    const m = u.pathname.match(/\/(document|spreadsheets|presentation)\/d\/([^/?#]+)/);
    if (m) {
      const kind = m[1] === "spreadsheets" ? "spreadsheet"
        : m[1] === "document" ? "document" : "presentation";
      return { id: m[2], kind };
    }
    // drive.google.com/file/d/ID/view
    const f = u.pathname.match(/\/file\/d\/([^/?#]+)/);
    if (f) return { id: f[1], kind: "drive" };
    // ?id=
    const idParam = u.searchParams.get("id");
    if (idParam) return { id: idParam, kind: "drive" };
    return null;
  } catch {
    return null;
  }
}

/* ─── YouTube ──────────────────────────────────────────────── */
async function extractYouTube(url: string): Promise<ExtractionOutcome> {
  const id = youTubeId(url);
  if (!id) {
    return { ok: false, reason: "youtube_id_not_found", type: "youtube", source_url: url };
  }

  // 1) Try transcript via youtube-transcript
  try {
    const mod = await import("youtube-transcript");
    const YouTubeTranscript: any = (mod as any).YoutubeTranscript ?? (mod as any).default ?? mod;
    const langPriority = ["ko", "en"];
    let segments: { text: string }[] | null = null;
    for (const lang of langPriority) {
      try {
        segments = await YouTubeTranscript.fetchTranscript(id, { lang });
        if (segments && segments.length) break;
      } catch { /* try next lang */ }
    }
    if (!segments || !segments.length) {
      try { segments = await YouTubeTranscript.fetchTranscript(id); } catch { /* ignore */ }
    }
    if (segments && segments.length) {
      const raw = segments.map(s => s.text).join(" ");
      const { content, truncated } = clean(raw, YOUTUBE_CHAR_CAP);
      return {
        ok: true,
        type: "youtube",
        content: `[YouTube transcript]\n${content}`,
        source_url: url,
        word_count: wordsOf(content),
        truncated,
        method: "transcript",
      };
    }
  } catch { /* fall through */ }

  // 2) Fallback: oEmbed for title + author
  try {
    const oe = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { headers: { "User-Agent": "Mozilla/5.0 nutunion-wiki-bot" } },
    );
    if (oe.ok) {
      const j: any = await oe.json();
      const text = `[YouTube — transcript unavailable]\n제목: ${j.title || "(제목 없음)"}\n채널: ${j.author_name || "(채널 미상)"}\n` +
        `(자막을 가져올 수 없어 메타데이터만 제공됩니다)`;
      return {
        ok: true,
        type: "youtube",
        content: text,
        source_url: url,
        word_count: wordsOf(text),
        truncated: false,
        method: "metadata",
      };
    }
  } catch { /* ignore */ }

  return { ok: false, reason: "youtube_no_transcript_no_metadata", type: "youtube", source_url: url };
}

/* ─── HTML article ────────────────────────────────────────── */
async function extractHtml(url: string): Promise<ExtractionOutcome> {
  let html = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; nutunion-wiki-bot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ko,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}`, type: "article", source_url: url };
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return { ok: false, reason: `not_html:${ct.slice(0, 40)}`, type: "article", source_url: url };
    }
    html = await res.text();
  } catch (e: any) {
    return { ok: false, reason: `fetch_failed:${e?.message?.slice(0, 80) || "unknown"}`, type: "article", source_url: url };
  }

  const text = htmlToText(html);
  if (!text || text.length < 50) {
    return { ok: false, reason: "html_no_text", type: "article", source_url: url };
  }
  const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "").trim();
  const composed = (title ? `[제목] ${title}\n\n` : "") + text;
  const { content, truncated } = clean(composed, ARTICLE_CHAR_CAP);
  return {
    ok: true,
    type: "article",
    content,
    source_url: url,
    word_count: wordsOf(content),
    truncated,
    method: "scrape",
  };
}

function htmlToText(html: string): string {
  // 1) Strip noisy blocks first
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ");

  // 2) Prefer <article>, <main>, [role="main"]
  const article = h.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || h.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || h.match(/<[^>]*role=["']main["'][^>]*>([\s\S]*?)<\/[a-z]+>/i)?.[1]
    || h;

  // 3) Convert block-level tags to newlines, then strip remaining tags
  const text = article
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-zA-Z]+;/g, " ");

  return text;
}

/* ─── PDF ──────────────────────────────────────────────────── */
async function extractPdf(url: string): Promise<ExtractionOutcome> {
  let buffer: Buffer;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "nutunion-wiki-bot/1.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}`, type: "pdf", source_url: url };
    }
    const ab = await res.arrayBuffer();
    buffer = Buffer.from(ab);
  } catch (e: any) {
    return { ok: false, reason: `fetch_failed:${e?.message?.slice(0, 80) || "unknown"}`, type: "pdf", source_url: url };
  }

  try {
    // pdf-parse loads its test fixture at module top-level if NODE_ENV != test —
    // import the inner implementation file to avoid that side effect.
    const pdfParse: any = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const result = await pdfParse(buffer, { max: 50 }); // first 50 pages
    const raw: string = result?.text || "";
    if (!raw.trim()) {
      return { ok: false, reason: "pdf_no_text", type: "pdf", source_url: url };
    }
    const { content, truncated } = clean(raw, PER_RESOURCE_CHAR_CAP);
    return {
      ok: true,
      type: "pdf",
      content,
      source_url: url,
      word_count: wordsOf(content),
      truncated,
      method: "pdf_parse",
    };
  } catch (e: any) {
    return { ok: false, reason: `pdf_parse_failed:${e?.message?.slice(0, 80) || "unknown"}`, type: "pdf", source_url: url };
  }
}

/* ─── Google Workspace ────────────────────────────────────── */
async function extractGoogleDoc(url: string, userId: string): Promise<ExtractionOutcome> {
  const ref = googleFileId(url);
  if (!ref) return { ok: false, reason: "google_doc_id_not_found", type: "docs", source_url: url };
  return await driveExport(ref.id, "text/plain", "docs", url, userId);
}

async function extractGoogleSheet(url: string, userId: string): Promise<ExtractionOutcome> {
  const ref = googleFileId(url);
  if (!ref) return { ok: false, reason: "google_sheet_id_not_found", type: "sheet", source_url: url };
  const out = await driveExport(ref.id, "text/csv", "sheet", url, userId);
  if (!("ok" in out) || !out.ok) return out;
  // Format CSV as a readable text block (markdown table for first ~30 rows).
  const formatted = csvToReadable(out.content);
  return { ...out, content: formatted, word_count: wordsOf(formatted) };
}

async function extractGoogleSlide(url: string, userId: string): Promise<ExtractionOutcome> {
  const ref = googleFileId(url);
  if (!ref) return { ok: false, reason: "google_slide_id_not_found", type: "slide", source_url: url };
  return await driveExport(ref.id, "text/plain", "slide", url, userId);
}

async function extractDriveAuto(url: string, userId: string): Promise<ExtractionOutcome> {
  const ref = googleFileId(url);
  if (!ref) return { ok: false, reason: "drive_id_not_found", type: "drive", source_url: url };

  const auth = await getGoogleClient(userId);
  const drive = google.drive({ version: "v3", auth });
  let mime = "";
  let name = "";
  try {
    const meta = await drive.files.get({ fileId: ref.id, fields: "mimeType,name" });
    mime = meta.data.mimeType || "";
    name = meta.data.name || "";
  } catch (e: any) {
    return { ok: false, reason: `drive_meta_failed:${e?.message?.slice(0, 80) || "unknown"}`, type: "drive", source_url: url };
  }

  if (mime === "application/vnd.google-apps.document") {
    return await driveExport(ref.id, "text/plain", "docs", url, userId, name);
  }
  if (mime === "application/vnd.google-apps.spreadsheet") {
    const out = await driveExport(ref.id, "text/csv", "sheet", url, userId, name);
    if (!("ok" in out) || !out.ok) return out;
    const formatted = csvToReadable(out.content);
    return { ...out, content: formatted, word_count: wordsOf(formatted) };
  }
  if (mime === "application/vnd.google-apps.presentation") {
    return await driveExport(ref.id, "text/plain", "slide", url, userId, name);
  }
  if (mime === "application/pdf") {
    // Download bytes via Drive API then run pdf-parse
    try {
      const res = await drive.files.get(
        { fileId: ref.id, alt: "media" },
        { responseType: "arraybuffer" } as any,
      );
      const buf = Buffer.from(res.data as unknown as ArrayBuffer);
      const pdfParse: any = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const out = await pdfParse(buf, { max: 50 });
      const raw: string = out?.text || "";
      if (!raw.trim()) return { ok: false, reason: "pdf_no_text", type: "drive", source_url: url };
      const { content, truncated } = clean(raw, PER_RESOURCE_CHAR_CAP);
      return {
        ok: true,
        type: "drive",
        content: (name ? `[파일명] ${name}\n\n` : "") + content,
        source_url: url,
        word_count: wordsOf(content),
        truncated,
        method: "pdf_parse",
      };
    } catch (e: any) {
      return { ok: false, reason: `drive_pdf_failed:${e?.message?.slice(0, 80) || "unknown"}`, type: "drive", source_url: url };
    }
  }

  return { ok: false, reason: `drive_unsupported_mime:${mime}`, type: "drive", source_url: url };
}

async function driveExport(
  fileId: string,
  mimeType: string,
  type: string,
  sourceUrl: string,
  userId: string,
  name?: string,
): Promise<ExtractionOutcome> {
  let auth;
  try {
    auth = await getGoogleClient(userId);
  } catch (e: any) {
    const msg = e?.message || "";
    return {
      ok: false,
      reason: msg.includes("GOOGLE_NOT_CONNECTED")
        ? "google_not_connected"
        : msg.includes("GOOGLE_TOKEN_EXPIRED")
        ? "google_token_expired"
        : `google_auth_failed:${msg.slice(0, 80)}`,
      type,
      source_url: sourceUrl,
    };
  }
  const drive = google.drive({ version: "v3", auth });

  try {
    const res = await drive.files.export(
      { fileId, mimeType },
      { responseType: "text" } as any,
    );
    const raw = typeof res.data === "string" ? res.data : String(res.data || "");
    if (!raw.trim()) {
      return { ok: false, reason: "drive_empty_export", type, source_url: sourceUrl };
    }
    const cap = type === "sheet" ? PER_RESOURCE_CHAR_CAP : ARTICLE_CHAR_CAP;
    const { content, truncated } = clean(raw, cap);
    return {
      ok: true,
      type,
      content: (name ? `[파일명] ${name}\n\n` : "") + content,
      source_url: sourceUrl,
      word_count: wordsOf(content),
      truncated,
      method: "drive_export",
    };
  } catch (e: any) {
    const msg = e?.message || "";
    return { ok: false, reason: `drive_export_failed:${msg.slice(0, 100)}`, type, source_url: sourceUrl };
  }
}

function csvToReadable(csv: string): string {
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return "";
  const head = lines.slice(0, 30); // first 30 rows
  const parsed = head.map(parseCsvRow);
  const colCount = Math.max(...parsed.map(r => r.length));
  const headerRow = parsed[0] || [];
  const headers = Array.from({ length: colCount }, (_, i) => headerRow[i] || `col${i + 1}`);
  const out: string[] = [];
  out.push("| " + headers.map(h => sanitizeCell(h)).join(" | ") + " |");
  out.push("|" + headers.map(() => "---").join("|") + "|");
  for (let i = 1; i < parsed.length; i++) {
    const row = parsed[i];
    const cells = Array.from({ length: colCount }, (_, j) => sanitizeCell(row[j] || ""));
    out.push("| " + cells.join(" | ") + " |");
  }
  if (lines.length > 30) {
    out.push(`\n…(전체 ${lines.length}행 중 30행만 표시)`);
  }
  return out.join("\n");
}

function sanitizeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 120);
}

function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { cells.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}
