import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { aiError } from "@/lib/ai/error";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
const GEMINI_HEADERS = { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY ?? "" };

const SYSTEM_PROMPT = `당신은 창업 기획자가 수집한 원천 자료를 사업 관점에서 분석하는 AI 입니다.

주어진 자료(영상 스크립트 / 기사 / 문서 / 메모 / 링크 설명)를 읽고,
**창업 문제 정의(HMW)와 아이디어 도출에 활용 가능한 사업 관점 요약**을 생성하세요.

반드시 아래 JSON 형식으로만 응답:

{
  "business_summary": "이 자료가 말하는 것을 사업 기회의 관점에서 300~500자로 요약. 단순 내용 요약이 아니라 '어떤 유저가 어떤 상황에서 어떤 고통을 겪는지', '어떤 기회/트렌드가 드러나는지'를 부각.",
  "pain_points": ["자료에서 추출된 유저 pain point 2~4개"],
  "opportunities": ["엿보이는 사업 기회 2~3개"],
  "quotes": ["원본에서 직접 인용할 만한 문구 2~3개 (각 100자 이내)"],
  "tags": ["핵심 키워드 3~5개"]
}

규칙:
- 유효 JSON 만 출력
- 한국어, 학술적 톤
- 근거 없는 추정 금지 — 자료에 명시된 내용만 기반
- quotes 는 원본 문장 그대로 (왜곡 금지)`;

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ projectId: string; sourceId: string }> }
) {
  if (!GEMINI_API_KEY) return aiError("server_error", "venture/sources/summarize", { internal: "GEMINI_API_KEY missing" });

  const { projectId, sourceId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return aiError("auth", "venture/sources/summarize");

  const { success } = rateLimit(`ai:${user.id}`, 30, 60_000);
  if (!success) return aiError("rate_limit", "venture/sources/summarize");

  // 소스 조회
  const { data: source } = await supabase
    .from("venture_sources")
    .select("*")
    .eq("id", sourceId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!source) return aiError("not_found", "venture/sources/summarize");

  const s = source as {
    kind: string;
    title: string;
    url?: string | null;
    content_text?: string | null;
    excerpt?: string | null;
    author_name?: string | null;
  };

  // 처리 중 상태
  await supabase.from("venture_sources").update({ summary_status: "processing", summary_error: null }).eq("id", sourceId);

  // 프롬프트 구성
  const userPrompt = [
    `## 자료 종류\n${s.kind}`,
    `## 제목\n${s.title}`,
    s.author_name ? `## 작성자\n${s.author_name}` : "",
    s.url ? `## URL\n${s.url}` : "",
    s.excerpt ? `## 발췌\n${s.excerpt}` : "",
    s.content_text ? `## 본문\n${s.content_text.slice(0, 20000)}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: GEMINI_HEADERS,
      body: JSON.stringify({
        contents: [{ parts: [{ text: SYSTEM_PROMPT }, { text: userPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      await supabase.from("venture_sources").update({
        summary_status: "failed",
        summary_error: `Gemini ${res.status}`,
      }).eq("id", sourceId);
      return aiError("ai_unavailable", "venture/sources/summarize", { internal: errBody.slice(0, 300) });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed: { business_summary?: string; pain_points?: string[]; opportunities?: string[]; quotes?: string[]; tags?: string[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) {
        await supabase.from("venture_sources").update({ summary_status: "failed", summary_error: "parse" }).eq("id", sourceId);
        return aiError("ai_bad_response", "venture/sources/summarize");
      }
      parsed = JSON.parse(m[0]);
    }

    const existingTags = Array.isArray((source as { tags?: string[] }).tags) ? (source as { tags: string[] }).tags : [];
    const mergedTags = [...new Set([...existingTags, ...(parsed.tags ?? [])])].slice(0, 10);

    await supabase.from("venture_sources").update({
      ai_summary: parsed.business_summary ?? null,
      tags: mergedTags,
      summary_status: "ready",
      summary_error: null,
    }).eq("id", sourceId);

    return NextResponse.json({
      success: true,
      summary: parsed.business_summary,
      pain_points: parsed.pain_points ?? [],
      opportunities: parsed.opportunities ?? [],
      quotes: parsed.quotes ?? [],
      tags: mergedTags,
    });
  } catch (err) {
    log.error(err, "venture.projectId.sources.sourceId.summarize.failed");
    await supabase.from("venture_sources").update({
      summary_status: "failed",
      summary_error: err instanceof Error ? err.message.slice(0, 300) : "unknown",
    }).eq("id", sourceId);
    return aiError("server_error", "venture/sources/summarize", { internal: err });
  }
}
