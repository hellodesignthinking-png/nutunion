/**
 * POST /api/files/summarize
 *
 * 자료실 파일을 AI 가 읽고 3줄 요약 + 예상 Q&A 3개 생성 → DB 에 저장.
 *
 * Body: { table: "file_attachments" | "project_resources", id: string, force?: boolean }
 *
 * 동작:
 *  1) 자료실 행 + 파일 URL 조회
 *  2) 이미 요약 있으면 (force=false) 그대로 반환
 *  3) 파일 형식별 텍스트 추출:
 *     - text/markdown/json/csv: fetch 후 그대로
 *     - PDF: pdf-parse
 *     - DOCX/PPTX/XLSX: 일단 미지원 (Drive 변환 후 가능 — 후순위)
 *  4) AI 호출 (generateObject) → { summary[3], qa[3] }
 *  5) DB 저장
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateObjectForUser } from "@/lib/ai/vault";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

type Table = "file_attachments" | "project_resources";

const SummarySchema = z.object({
  summary: z.array(z.string()).min(1).max(5),
  qa: z.array(z.object({ q: z.string(), a: z.string() })).max(5),
});

const SYSTEM = [
  "당신은 자료실 문서를 동료들이 빠르게 파악할 수 있도록 정리하는 정보 큐레이터입니다.",
  "출력:",
  "  summary: 핵심을 3줄로 (각 줄 60자 이내, 명사구 위주, 첫 줄에 가장 중요한 것)",
  "  qa: 동료가 가장 많이 물어볼 질문 3개와 그에 대한 답을 본문에서 발췌",
  "톤: 한국어, 간결, 추측 금지 — 본문에 없는 내용은 적지 말 것.",
].join("\n");

const TEXT_EXTS = ["txt", "md", "markdown", "csv", "json", "yml", "yaml", "log", "html", "htm"];
const MAX_INPUT_CHARS = 30_000;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const table: Table | undefined = body?.table;
  const id: string | undefined = body?.id;
  const force = body?.force === true;
  if (!id || (table !== "file_attachments" && table !== "project_resources")) {
    return NextResponse.json({ error: "table + id required" }, { status: 400 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from(table)
    .select(table === "file_attachments"
      ? "id, file_name, file_url, file_type, ai_summary, ai_summary_generated_at"
      : "id, name, url, mime_type, ai_summary, ai_summary_generated_at")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) {
    if (/ai_summary/.test(fetchErr.message) || /column .* does not exist/i.test(fetchErr.message)) {
      return NextResponse.json(
        { error: "AI 요약 기능 미활성 (마이그레이션 134 필요)", code: "MIGRATION_MISSING" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: "자료를 찾을 수 없습니다" }, { status: 404 });

  // 캐시된 요약 있으면 즉시 반환
  if (!force && (row as any).ai_summary) {
    return NextResponse.json({ ai_summary: (row as any).ai_summary, cached: true });
  }

  const fileUrl: string = (row as any).file_url || (row as any).url;
  const fileName: string = (row as any).file_name || (row as any).name || "file";
  const ext = (fileName.split(".").pop() || "").toLowerCase();

  // 텍스트 추출
  let text = "";
  try {
    if (TEXT_EXTS.includes(ext)) {
      const r = await fetch(fileUrl);
      if (!r.ok) throw new Error(`fetch ${r.status}`);
      text = await r.text();
    } else if (ext === "pdf") {
      // pdf-parse 동적 import — 무거운 디펜덴시
      const r = await fetch(fileUrl);
      if (!r.ok) throw new Error(`fetch ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buf);
      text = parsed.text || "";
    } else {
      return NextResponse.json(
        { error: `이 형식은 자동 요약을 지원하지 않아요 (${ext}). PDF·텍스트·마크다운만 가능` },
        { status: 415 },
      );
    }
  } catch (e: any) {
    log.warn("files.summarize.extract_failed", { error: e?.message, ext });
    return NextResponse.json({ error: `텍스트 추출 실패: ${e?.message || "unknown"}` }, { status: 502 });
  }

  text = text.trim();
  if (!text) return NextResponse.json({ error: "추출된 텍스트가 비었어요" }, { status: 422 });
  if (text.length > MAX_INPUT_CHARS) text = text.slice(0, MAX_INPUT_CHARS);

  // AI 호출
  try {
    const ai = await generateObjectForUser(auth.user.id, SummarySchema, {
      system: SYSTEM,
      prompt: `# 파일명: ${fileName}\n\n# 본문\n${text}\n\n위 본문을 분석해 summary 3줄 + qa 3개를 만들어줘.`,
      maxOutputTokens: 1500,
      tier: "fast",
    });

    const obj = (ai.object || {}) as { summary?: string[]; qa?: Array<{ q: string; a: string }> };
    const aiSummary = {
      summary: Array.isArray(obj.summary) ? obj.summary : [],
      qa: Array.isArray(obj.qa) ? obj.qa : [],
      model_used: ai.model_used,
    };

    await supabase
      .from(table)
      .update({
        ai_summary: aiSummary,
        ai_summary_generated_at: new Date().toISOString(),
      })
      .eq("id", id);

    log.info("files.summarize.ok", {
      user_id: auth.user.id,
      ext,
      chars: text.length,
      model: ai.model_used,
    });

    return NextResponse.json({ ai_summary: aiSummary, cached: false });
  } catch (e: any) {
    log.error(e, "files.summarize.ai_failed");
    return NextResponse.json({ error: e?.message || "AI 요약 실패" }, { status: 502 });
  }
}
