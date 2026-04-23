import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

// Pro 플랜이면 300s 까지 작동, Hobby 는 최대 60s 로 자동 제한
export const maxDuration = 300;

// 최대 오디오 크기 — 너무 크면 Gemini 타임아웃 유발
const MAX_AUDIO_BYTES = 150 * 1024 * 1024; // 150MB — Gemini Files API 는 수 GB 까지 지원하지만 처리 시간 고려

// env 이름 3중 fallback — 프로젝트 전체 통일 위한 호환 처리
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GOOGLE_AI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_HEADERS = { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY ?? "" };

/** Google Drive share 링크를 direct download URL 로 변환
 *   - drive.google.com/file/d/{id}/view[?...]  →  drive.google.com/uc?export=download&id={id}
 *   - drive.google.com/open?id={id}            →  동일
 *   - 그 외 URL (Supabase / R2 / 이미 uc?export) 은 그대로
 */
function normalizeDriveUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.host !== "drive.google.com") return raw;
    // /file/d/{id}/...
    const match = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const id = match?.[1] || u.searchParams.get("id");
    if (!id) return raw;
    return `https://drive.google.com/uc?export=download&id=${id}`;
  } catch {
    return raw;
  }
}

/** 허용된 오디오 URL — Supabase Storage + Google Drive + Cloudflare R2 */
function isAllowedAudioUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.host;
    // Supabase Storage
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supa && host === new URL(supa).host) return true;
    // Google Drive (download, preview, direct file links)
    if (host === "drive.google.com" || host.endsWith(".googleusercontent.com")) return true;
    if (host === "www.googleapis.com") return true;
    // Cloudflare R2 (public + signed)
    if (host.endsWith(".r2.cloudflarestorage.com")) return true;
    if (host.endsWith(".r2.dev")) return true;
    // 커스텀 R2 퍼블릭 도메인 (env)
    const r2Public = process.env.R2_PUBLIC_HOST;
    if (r2Public && host === r2Public) return true;
    return false;
  } catch {
    return false;
  }
}

const SYSTEM_PROMPT = `당신은 NutUnion 플랫폼의 AI 회의록 정리 어시스턴트이자 **성장 촉진자**입니다.
사용자가 제공하는 회의 내용을 분석하여 구조화된 회의록을 생성하고,
회원들의 토론과 논의에서 성장 포인트를 발견합니다.

반드시 아래 JSON 형식으로만 응답하세요:

{
  "summary": "회의 전체를 2-3문장으로 요약",
  "discussions": ["논의된 주요 사항 목록"],
  "decisions": ["결정된 사항 목록"],
  "actionItems": [{"task": "할 일", "assignee": "담당자 (null 가능)"}],
  "nextTopics": ["다음 미팅 주제 제안 2-3개"],
  "growthInsights": ["이번 회의에서 팀이 성장한 포인트 (예: 새로운 시각, 합의 도출, 문제 해결)"],
  "learningRecommendations": ["논의 내용 기반 학습 권장 주제/자료"],
  "discussionQuality": {
    "depth": "얼마나 깊이 논의했는지 (피상적/적절/심도 있음)",
    "participation": "참여도 평가",
    "actionability": "실행 가능성 평가"
  }
}

규칙:
- 반드시 유효한 JSON만 출력
- 한국어로 작성
- 논의사항은 핵심만 간결하게
- 액션아이템은 구체적으로 (누가 무엇을 언제까지)
- growthInsights: 팀의 성장을 격려하는 톤으로 작성
- learningRecommendations: 토론에서 나온 주제 기반 학습 자료/주제 제안
- discussionQuality: 토론의 질을 반성할 수 있도록 피드백
- 내용이 부족하면 있는 만큼만 정리`;

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY가 설정되지 않았습니다. Vercel 환경변수에 GEMINI_API_KEY를 추가해주세요." },
      { status: 500 }
    );
  }

  try {
    const startTime = Date.now();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

    const { success } = rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!success) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const body = await request.json();
    const { notes, agendas, meetingTitle, audioBase64, audioUrl, audioMimeType, previousDigest } = body;

    // Files API 로 업로드한 file URI (base64 inline 보다 훨씬 빠른 경로)
    let audioFileUri: string | null = null;
    let audioFileMime: string | null = audioMimeType || null;
    let finalAudioBase64 = audioBase64;
    let audioBytes = 0;

    // base64 모드 → 버퍼로 변환 + 크기 체크 + Files API 업로드
    if (finalAudioBase64 && audioMimeType) {
      const buf = Buffer.from(finalAudioBase64, "base64");
      audioBytes = buf.length;
      if (audioBytes > MAX_AUDIO_BYTES) {
        return NextResponse.json(
          { error: `녹음 파일이 너무 큽니다 (${Math.round(audioBytes / 1024 / 1024)}MB) — 최대 ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)}MB. 파일을 분할하거나 핵심 구간만 잘라서 다시 시도해주세요.` },
          { status: 413 },
        );
      }
      try {
        audioFileUri = await uploadAudioToGemini(buf, audioMimeType);
        audioFileMime = audioMimeType;
        finalAudioBase64 = null; // Files API 사용 시 inline 제거
      } catch (e: any) {
        console.warn("[meeting-summary] Files API 업로드 실패, inline base64 로 진행", e?.message);
      }
    }

    // URL 모드 → 다운로드 + Files API 업로드 (inline base64 회피)
    if (!finalAudioBase64 && !audioFileUri && audioUrl) {
      if (!isAllowedAudioUrl(audioUrl)) {
        return NextResponse.json(
          { error: "허용되지 않은 오디오 URL. Supabase / Google Drive / R2 링크만 지원합니다." },
          { status: 400 },
        );
      }
      const downloadUrl = normalizeDriveUrl(audioUrl);
      const resp = await fetch(downloadUrl, {
        headers: { "User-Agent": "nutunion/1.0" },
        redirect: "follow",
      });
      if (!resp.ok) {
        return NextResponse.json(
          { error: `오디오 파일 다운로드 실패 (${resp.status}). Google Drive 라면 "링크 있는 사용자 누구나 보기" 로 공유 설정 확인.` },
          { status: 400 },
        );
      }
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.startsWith("text/html") && !downloadUrl.includes("googleusercontent")) {
        return NextResponse.json(
          { error: "Google Drive 파일이 비공개 상태입니다. '링크 있는 모든 사용자 보기' 로 공유 설정 후 다시 시도해주세요." },
          { status: 400 },
        );
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      audioBytes = buf.length;
      if (audioBytes > MAX_AUDIO_BYTES) {
        return NextResponse.json(
          { error: `녹음 파일이 너무 큽니다 (${Math.round(audioBytes / 1024 / 1024)}MB) — 최대 ${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)}MB. 파일을 분할하거나 핵심 구간만 잘라서 다시 시도해주세요.` },
          { status: 413 },
        );
      }
      const mime = audioMimeType || contentType || "audio/webm";
      try {
        // 1차: Files API — 처리 속도/시간 우위
        audioFileUri = await uploadAudioToGemini(buf, mime);
        audioFileMime = mime;
      } catch (e: any) {
        console.warn("[meeting-summary] Files API 업로드 실패, inline base64 fallback", e?.message);
        // 2차 fallback: inline base64
        finalAudioBase64 = buf.toString("base64");
        audioFileMime = mime;
      }
    }

    if (!notes && !finalAudioBase64 && !audioFileUri && !audioUrl) {
      return NextResponse.json(
        { error: "회의 내용 또는 녹음 파일이 필요합니다" },
        { status: 400 }
      );
    }

    // Build the prompt
    let userPrompt = `## 회의 정보\n- 제목: ${meetingTitle || "회의"}\n`;

    // Inject previous digest context (token-saving: compressed context from last week)
    if (previousDigest) {
      userPrompt += `\n## 📌 이전 주간 다이제스트 (이 맥락을 기반으로 이어서 분석하세요)\n${previousDigest}\n`;
    }

    if (agendas && agendas.length > 0) {
      userPrompt += `- 안건: ${(agendas as { topic?: string }[]).map((a) => a.topic ?? "").filter(Boolean).join(", ")}\n`;
    }

    if (notes) {
      userPrompt += `\n## 실시간 노트 (회의 중 참석자가 직접 타이핑한 내용)\n${notes}\n`;
    }

    if (finalAudioBase64 || audioFileUri) {
      userPrompt += `\n## 녹음 파일\n회의 녹음이 첨부되었습니다. 녹음을 기반으로 세부 맥락을 복원하세요.\n`;
    }

    const hasBoth = !!(notes && (finalAudioBase64 || audioFileUri));
    if (hasBoth) {
      userPrompt += `\n## 통합 지침\n녹음 기반 내용과 실시간 노트를 교차 검증하여 완벽한 회의록을 작성하세요. 서로 다른 표현은 더 정확한 쪽을 채택하고, 노트에는 없지만 녹음에서 언급된 중요한 맥락/뉘앙스/의사결정 근거는 반드시 포함하세요. 노트는 "참석자가 중요하게 여긴 포인트"를 반영하므로 요약의 골격으로 활용하세요.\n`;
    }

    userPrompt += `\n다음 JSON 스키마로 회의록을 생성하세요: summary(한 단락 요약), discussions(논의 사항 배열), decisions(결정 사항 배열), actionItems([{ task, assignee? }]), nextTopics(다음 회의 주제 제안 배열), growthInsights(배운 점/회고 인사이트 배열).`;
    if (previousDigest) {
      userPrompt += `\n이전 주간 다이제스트의 맥락을 참고하여 연속성 있게 작성하세요. 이미 결정된 사항은 반복하지 마세요.`;
    }

    // Build Gemini API request
    type GeminiPart =
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
      | { fileData: { fileUri: string; mimeType: string } };
    const parts: GeminiPart[] = [];

    // System instruction as first text part
    parts.push({ text: SYSTEM_PROMPT });

    // Audio: Files API URI 우선, 없으면 inline base64
    if (audioFileUri && audioFileMime) {
      parts.push({ fileData: { fileUri: audioFileUri, mimeType: audioFileMime } });
    } else if (finalAudioBase64 && (audioFileMime || audioMimeType)) {
      parts.push({
        inlineData: {
          mimeType: audioFileMime || audioMimeType,
          data: finalAudioBase64,
        },
      });
    }

    // User prompt
    parts.push({ text: userPrompt });

    const geminiBody = {
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 8192,  // 2048 → 8192 (장문 회의록 응답이 중간에 끊기지 않게)
        responseMimeType: "application/json",
      },
    };

    // Retry logic with exponential backoff
    let response: Response | null = null;
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await fetch(GEMINI_URL, {
          method: "POST",
          headers: GEMINI_HEADERS,
          body: JSON.stringify(geminiBody),
        });
        if (response.ok) break;
        lastError = `HTTP ${response.status}`;
        // Retry on 429 (rate limit) or 5xx (server error)
        if (response.status === 429 || response.status >= 500) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
        break; // Don't retry on 4xx client errors
      } catch (fetchErr: unknown) {
        lastError = fetchErr instanceof Error ? fetchErr.message : "Network error";
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : lastError;
      console.error("Gemini API error after retries:", errorText);
      return NextResponse.json(
        { error: `Gemini API 오류: ${lastError}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Extract the text from Gemini response
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON — 4단계 fallback (Gemini 가 종종 깨진 JSON 반환)
    let result = tryParseJson(text);
    if (!result) {
      // 단계 2: markdown code block 추출
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) result = tryParseJson(jsonMatch[1]);
    }
    if (!result) {
      // 단계 3: 첫 { ... } 블록
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch) result = tryParseJson(braceMatch[0]);
    }
    if (!result) {
      // 단계 4: 필드별 regex 추출 — 끊긴 응답에서도 최대한 건짐
      const partial = extractPartialFields(text);
      if (partial.summary || partial.discussions.length || partial.decisions.length) {
        console.warn("[meeting-summary] partial recovery 성공");
        result = { ...partial, _fallback: true, _partial: true };
      } else {
        // 단계 5: 진짜 최후 — raw text 를 summary 에
        console.error("[meeting-summary] 완전 실패. raw 텍스트로 폴백. 일부:", text.slice(0, 500));
        result = {
          summary: text.slice(0, 2000) || "AI 가 응답했지만 구조화 파싱에 실패했습니다.",
          discussions: [],
          decisions: [],
          actionItems: [],
          nextTopics: [],
          growthInsights: [],
          learningRecommendations: [],
          discussionQuality: null,
          _fallback: true,
        };
      }
    }

    // summary 가 JSON 문자열인 케이스 감지 & 재파싱 (fallback 복구)
    if (typeof result.summary === "string" && /^\s*\{/.test(result.summary) && /"summary"\s*:/.test(result.summary)) {
      const reparsed = tryParseJson(result.summary) || extractPartialFields(result.summary);
      if (reparsed && reparsed.summary && typeof reparsed.summary === "string" && !reparsed.summary.startsWith("{")) {
        result = { ...reparsed, _fallback: false, _recovered: true };
      }
    }

    // Validate and normalize the result structure
    let finalSummary = result.summary;
    if (typeof finalSummary === "object" && finalSummary !== null) {
      finalSummary = Array.isArray(finalSummary) ? finalSummary.join("\\n") : JSON.stringify(finalSummary);
    }
    if (!finalSummary || typeof finalSummary !== "string") {
      finalSummary = "회의 요약을 생성할 수 없습니다.";
    }

    const normalized = {
      summary: finalSummary,
      discussions: Array.isArray(result.discussions) ? result.discussions : [],
      decisions: Array.isArray(result.decisions) ? result.decisions : [],
      actionItems: Array.isArray(result.actionItems)
        ? (result.actionItems as { task?: string; content?: string; assignee?: string | null }[]).map((item) => ({
            task: item.task || item.content || "",
            assignee: item.assignee ?? null,
          }))
        : [],
      nextTopics: Array.isArray(result.nextTopics) ? result.nextTopics : [],
      // Growth facilitation
      growthInsights: Array.isArray(result.growthInsights) ? result.growthInsights : [],
      learningRecommendations: Array.isArray(result.learningRecommendations) ? result.learningRecommendations : [],
      discussionQuality: result.discussionQuality || null,
      // Performance metadata
      _meta: {
        model: GEMINI_MODEL,
        responseTimeMs: Date.now() - startTime,
        usedDigest: !!previousDigest,
        inputTokenEstimate: Math.ceil((userPrompt.length + SYSTEM_PROMPT.length) / 4),
      },
    };

    return NextResponse.json(normalized);
  } catch (error: unknown) {
    console.error("Meeting summary error:", error);
    const msg = error instanceof Error ? error.message : "회의록 생성 중 오류가 발생했습니다";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * JSON 파싱 시도 — 원본 그대로 / 흔한 LLM 에러 복구 / 실패 시 null.
 * Gemini 가 종종 trailing comma, 이스케이프 안 된 newline, 홑따옴표 등을 포함해 반환.
 */
function tryParseJson(raw: string): any | null {
  if (!raw || typeof raw !== "string") return null;
  const attempts: string[] = [];

  // 1) 원본 그대로
  attempts.push(raw);

  // 2) 앞뒤 공백/백틱 제거
  attempts.push(raw.trim().replace(/^`+|`+$/g, ""));

  // 3) 흔한 LLM 출력 정리: trailing comma 제거, smart quote 치환
  let cleaned = raw
    .replace(/[\u201C\u201D\u2018\u2019]/g, '"') // 곡선 따옴표 → 직선
    .replace(/,(\s*[}\]])/g, "$1")               // trailing comma
    .replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3'); // 키에 홑따옴표 → 쌍따옴표
  attempts.push(cleaned);

  // 4) 줄바꿈 이스케이프 (문자열 값 안의 실 \n 을 \\n 으로)
  //    간단 휴리스틱: "...": "...중간에 실 newline..." 패턴을 탐지
  try {
    const noCrlfInStrings = cleaned.replace(
      /"((?:[^"\\]|\\.)*)"/g,
      (_, inner: string) => '"' + inner.replace(/\r?\n/g, "\\n") + '"',
    );
    attempts.push(noCrlfInStrings);
  } catch { /* noop */ }

  // 5) 마지막 완전한 } 까지만 자르기 (끊긴 응답 대응)
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace > 0) {
    attempts.push(cleaned.slice(0, lastBrace + 1));
  }

  for (const s of attempts) {
    try {
      const v = JSON.parse(s);
      if (v && typeof v === "object") return v;
    } catch { /* next attempt */ }
  }
  return null;
}

/**
 * 끊긴 JSON 에서 개별 필드만 정규식으로 복구 (best-effort).
 * Gemini 응답이 maxOutputTokens 로 잘렸거나 escape 에러여도 summary/discussions 등 주요 필드는 살림.
 */
function extractPartialFields(text: string): {
  summary: string;
  discussions: string[];
  decisions: string[];
  actionItems: { task: string; assignee: string | null }[];
  nextTopics: string[];
  growthInsights: string[];
  learningRecommendations: string[];
  discussionQuality: null;
} {
  const out = {
    summary: "",
    discussions: [] as string[],
    decisions: [] as string[],
    actionItems: [] as { task: string; assignee: string | null }[],
    nextTopics: [] as string[],
    growthInsights: [] as string[],
    learningRecommendations: [] as string[],
    discussionQuality: null,
  };

  // summary — 문자열 필드
  const summaryMatch = text.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch) {
    out.summary = summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
  }

  // 배열 필드 추출 — "key": [ "...", "..." ]
  const extractArr = (key: string): string[] => {
    const re = new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)(?:\\]|\\]\\s*,|$)`, "m");
    const m = text.match(re);
    if (!m) return [];
    const body = m[1];
    const items: string[] = [];
    const itemRe = /"((?:[^"\\]|\\.)*)"/g;
    let im: RegExpExecArray | null;
    while ((im = itemRe.exec(body)) !== null) {
      const cleaned = im[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
      if (cleaned.trim()) items.push(cleaned);
    }
    return items;
  };

  out.discussions = extractArr("discussions");
  out.decisions = extractArr("decisions");
  out.nextTopics = extractArr("nextTopics");
  out.growthInsights = extractArr("growthInsights");
  out.learningRecommendations = extractArr("learningRecommendations");

  // actionItems — 객체 배열
  const aiMatch = text.match(/"actionItems"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
  if (aiMatch) {
    const body = aiMatch[1];
    const objRe = /\{[^{}]*\}/g;
    let om: RegExpExecArray | null;
    while ((om = objRe.exec(body)) !== null) {
      const taskM = om[0].match(/"task"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const asnM = om[0].match(/"assignee"\s*:\s*(?:"((?:[^"\\]|\\.)*)"|null)/);
      if (taskM) {
        out.actionItems.push({
          task: taskM[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
          assignee: asnM?.[1] ? asnM[1].replace(/\\"/g, '"') : null,
        });
      }
    }
  }

  return out;
}

/**
 * Gemini Files API 업로드 — base64 인라인보다 훨씬 빠른 경로.
 * inline: ~30MB JSON payload → slow
 * Files API: 바이너리 직접 업로드 → 몇 초, 이후 요청엔 URI 만 전달
 *
 * 공식 문서: https://ai.google.dev/gemini-api/docs/files
 * 업로드된 파일은 48시간 자동 삭제, 요약 1회용으론 충분.
 */
async function uploadAudioToGemini(buf: Buffer, mime: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
  const url = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`;

  // 1) Resumable upload 시작 (metadata)
  const initRes = await fetch(url, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(buf.length),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: `meeting-${Date.now()}` } }),
  });
  if (!initRes.ok) {
    throw new Error(`Files API start 실패 (${initRes.status}): ${(await initRes.text()).slice(0, 200)}`);
  }
  const uploadUrl = initRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("업로드 URL 수신 실패");

  // 2) 실제 바이너리 업로드 + finalize
  const upRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(buf.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: buf as any,
  });
  if (!upRes.ok) {
    throw new Error(`Files API upload 실패 (${upRes.status}): ${(await upRes.text()).slice(0, 200)}`);
  }
  const result = await upRes.json();
  const fileUri: string | undefined = result?.file?.uri;
  if (!fileUri) throw new Error("업로드 결과에 uri 없음");

  // 3) 파일이 PROCESSING 상태일 수 있음 — ACTIVE 될 때까지 잠깐 폴링 (최대 15초)
  const fileName: string = result.file.name;
  const maxWait = 15_000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const st = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`,
    );
    if (st.ok) {
      const info = await st.json();
      if (info.state === "ACTIVE") break;
      if (info.state === "FAILED") throw new Error("Files API 처리 실패");
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  return fileUri;
}
