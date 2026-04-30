/**
 * POST /api/ai/transcribe
 *
 * 오디오 파일 → 텍스트 (OpenAI Whisper API).
 *
 * Body: multipart/form-data
 *  - audio: File (m4a/mp3/webm/wav/mp4 등 — Whisper 자체 지원 포맷)
 *  - language?: 'ko' | 'en' | ... (생략 시 자동 감지)
 *  - prompt?: string (한국어 인명·전문용어 힌트)
 *
 * 환경변수: OPENAI_API_KEY
 *
 * 응답: { text: string, language: string, duration: number }
 *
 * 제약:
 *  - Whisper API 단일 파일 25MB 제한
 *  - Vercel function 4.5MB body 제한 → 큰 오디오는 R2 업로드 후 file_url 모드 사용
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "STT 가 구성되지 않았어요 (OPENAI_API_KEY 필요)", code: "NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const ct = req.headers.get("content-type") || "";
  let audioBlob: Blob | null = null;
  let language: string | undefined;
  let prompt: string | undefined;
  let fileName = "audio.webm";

  // 사전 크기 체크 — multipart body 가 25MB 를 넘으면 formData() 가 전부 메모리에 올린 뒤
  // 거절하는 대신, Content-Length 만 보고 즉시 413. Vercel body limit 4.5MB 와 별개로 가드.
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength > 0 && contentLength > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `25MB 이하 오디오만 지원해요 (현재 ${(contentLength / 1024 / 1024).toFixed(1)}MB)`,
        hint: "큰 파일은 R2 에 먼저 업로드한 뒤 { file_url } JSON 모드로 보내세요",
        code: "PAYLOAD_TOO_LARGE",
      },
      { status: 413 },
    );
  }

  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const f = fd.get("audio");
    if (!(f instanceof Blob)) {
      return NextResponse.json({ error: "audio 파일이 필요해요" }, { status: 400 });
    }
    audioBlob = f;
    fileName = (f as File).name || fileName;
    language = (fd.get("language") as string) || undefined;
    prompt = (fd.get("prompt") as string) || undefined;
  } else {
    // JSON: { file_url, language, prompt } — R2 에 이미 올라간 큰 파일 처리
    const body = await req.json().catch(() => null);
    const fileUrl: string | undefined = body?.file_url;
    if (!fileUrl) return NextResponse.json({ error: "file_url 필요" }, { status: 400 });
    const r = await fetch(fileUrl);
    if (!r.ok) return NextResponse.json({ error: `원본 fetch 실패 ${r.status}` }, { status: 400 });
    audioBlob = await r.blob();
    fileName = body?.file_name || fileUrl.split("/").pop() || fileName;
    language = body?.language;
    prompt = body?.prompt;
  }

  if (!audioBlob) {
    return NextResponse.json({ error: "audio 가 비었어요" }, { status: 400 });
  }
  if (audioBlob.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `25MB 이하 오디오만 지원해요 (현재 ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB)` },
      { status: 413 },
    );
  }

  // OpenAI Whisper transcription API
  const upstream = new FormData();
  upstream.append("file", new File([audioBlob], fileName, { type: audioBlob.type || "audio/webm" }));
  upstream.append("model", "whisper-1");
  upstream.append("response_format", "verbose_json");
  if (language) upstream.append("language", language);
  if (prompt) upstream.append("prompt", prompt);

  try {
    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });
    const text = await resp.text();
    if (!resp.ok) {
      log.warn("ai.transcribe.upstream_error", { status: resp.status, body_preview: text.slice(0, 200) });
      return NextResponse.json(
        { error: `Whisper 응답 ${resp.status}`, details: text.slice(0, 500) },
        { status: 502 },
      );
    }
    const json = JSON.parse(text);
    log.info("ai.transcribe.ok", {
      user_id: auth.user.id,
      bytes: audioBlob.size,
      language: json.language,
      duration: json.duration,
    });
    return NextResponse.json({
      text: json.text || "",
      language: json.language || language || null,
      duration: json.duration ?? null,
      segments: Array.isArray(json.segments) ? json.segments.length : 0,
    });
  } catch (e: any) {
    log.error(e, "ai.transcribe.failed", { user_id: auth.user.id });
    return NextResponse.json({ error: e?.message || "전사 실패" }, { status: 500 });
  }
}
