import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { aiError } from "@/lib/ai/error";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeForPrompt } from "@/lib/ai/sanitize";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
const GEMINI_HEADERS = { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY ?? "" };

const SYSTEM_PROMPT = `당신은 창업 팀의 **문제 정의 컨설턴트** AI 입니다.

팀이 수집한 여러 원천 자료 (YouTube, 기사, Drive 문서, 회의록, 유저 인터뷰 메모) 를 종합해,
**HMW (How Might We) 형식의 문제 정의 후보**를 제안하세요. 각 후보는 반드시 원천 자료를 **인용**해야 합니다.

반드시 아래 JSON 형식으로만 응답:

{
  "synthesis": "전체 자료를 관통하는 공통 통찰 요약 (300~500자, 학술적 톤)",
  "clusters": ["자료에서 반복적으로 드러나는 테마 3~5개"],
  "problems": [
    {
      "hmw_statement": "How Might We [타겟 유저]를 위해 [핵심 고통]을 [원하는 결과] 하도록 ~ (한 문장, 구체적이고 실행 가능하게)",
      "target_user": "구체적인 타겟 유저 한 명 (페르소나 수준)",
      "context": "이 문제가 발생하는 맥락 설명 (2~3문장)",
      "success_metric": "이 문제를 해결했을 때 측정 가능한 성공 지표 한 가지",
      "rationale": "왜 이 HMW 가 유효한지 근거 설명 (3~4문장). 반드시 자료 인용 포함.",
      "citations": [
        {
          "source_id": "자료의 source_id (반드시 제공된 목록에서만)",
          "title": "자료 제목",
          "kind": "youtube|article|drive_doc|...",
          "quote": "원본에서 인용한 문구 (150자 이내)"
        }
      ]
    }
  ]
}

규칙:
- 유효 JSON 만 출력
- problems 는 3~5개 (너무 많으면 선택 피로)
- **모든 HMW 는 최소 1개 citation 필수** — 근거 없는 제안 금지
- source_id 는 반드시 제공된 목록에서만 (존재하지 않는 id 금지)
- HMW 는 구체적이고 실행 가능하게 (추상적 "~를 개선하려면" 금지)
- 기존 insights / meeting memo 도 함께 참고해 정제`;

export const POST = withRouteLog("venture.projectId.synthesize-problems", async (
  _req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) => {
  if (!GEMINI_API_KEY) return aiError("server_error", "venture/synthesize-problems", { internal: "GEMINI_API_KEY missing" });

  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return aiError("auth", "venture/synthesize-problems");

  // host/admin 확인
  const [{ data: project }, { data: profile }, { data: pm }] = await Promise.all([
    supabase.from("projects").select("created_by").eq("id", projectId).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!project) return aiError("not_found", "venture/synthesize-problems");
  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  const isHost = (project as { created_by?: string }).created_by === user.id || pm?.role === "host" || pm?.role === "manager" || pm?.role === "owner";
  if (!isAdminStaff && !isHost) return aiError("forbidden", "venture/synthesize-problems");

  const { success } = rateLimit(`ai:${user.id}`, 15, 60_000);
  if (!success) return aiError("rate_limit", "venture/synthesize-problems");

  // 소스 + 인사이트 수집
  const [{ data: sources }, { data: insights }] = await Promise.all([
    supabase.from("venture_sources").select("id, kind, title, url, excerpt, ai_summary, tags, author_name").eq("project_id", projectId).limit(30),
    supabase.from("venture_insights").select("source, quote, pain_point, target_user, tags").eq("project_id", projectId).limit(30),
  ]);

  const srcList = (sources as Array<{ id: string; kind: string; title: string; url?: string; excerpt?: string; ai_summary?: string; tags?: string[]; author_name?: string }> | null) ?? [];
  const insList = (insights as Array<{ source: string; quote: string; pain_point?: string; target_user?: string; tags?: string[] }> | null) ?? [];

  if (srcList.length === 0 && insList.length === 0) {
    return NextResponse.json(
      { error: "분석할 자료가 없습니다. Source Library에 YouTube/기사/Drive 문서 등을 추가하거나, Empathize 단계 인사이트를 수집해주세요." },
      { status: 400 }
    );
  }

  // 프롬프트 구성
  let userPrompt = `## 프로젝트: ${projectId}\n\n`;

  if (srcList.length > 0) {
    userPrompt += `## Source Library (${srcList.length}건)\n\n`;
    for (const s of srcList) {
      userPrompt += `### [source_id: ${s.id}] ${sanitizeForPrompt(s.title, 200)}\n`;
      userPrompt += `- kind: ${s.kind}\n`;
      if (s.url) userPrompt += `- url: ${s.url}\n`;
      if (s.author_name) userPrompt += `- author: ${sanitizeForPrompt(s.author_name, 100)}\n`;
      if (s.excerpt) userPrompt += `- excerpt: ${sanitizeForPrompt(s.excerpt, 500)}\n`;
      if (s.ai_summary) userPrompt += `- 사업 관점 요약: ${sanitizeForPrompt(s.ai_summary, 1000)}\n`;
      if (s.tags && s.tags.length > 0) userPrompt += `- tags: ${s.tags.map((t) => sanitizeForPrompt(t, 50)).join(", ")}\n`;
      userPrompt += "\n";
    }
  }

  if (insList.length > 0) {
    userPrompt += `## Empathize 인사이트 (${insList.length}건)\n\n`;
    for (const i of insList) {
      userPrompt += `- [${i.source}] "${sanitizeForPrompt(i.quote, 500)}"\n`;
      if (i.pain_point) userPrompt += `  Pain: ${sanitizeForPrompt(i.pain_point, 300)}\n`;
      if (i.target_user) userPrompt += `  Target: ${sanitizeForPrompt(i.target_user, 200)}\n`;
    }
    userPrompt += "\n";
  }

  userPrompt += `\n위 자료를 종합해 HMW 문제 정의 후보 3~5개를 JSON 으로 생성하세요. 모든 후보는 source_id 인용 필수.`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: GEMINI_HEADERS,
      body: JSON.stringify({
        contents: [{ parts: [{ text: SYSTEM_PROMPT }, { text: userPrompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return aiError("ai_unavailable", "venture/synthesize-problems", { internal: `${res.status}: ${errBody.slice(0, 300)}` });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let parsed: {
      synthesis?: string;
      clusters?: string[];
      problems?: Array<{
        hmw_statement: string;
        target_user?: string;
        context?: string;
        success_metric?: string;
        rationale?: string;
        citations?: Array<{ source_id: string; title: string; kind: string; quote: string }>;
      }>;
    };
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return aiError("ai_bad_response", "venture/synthesize-problems");
      parsed = JSON.parse(m[0]);
    }

    // source_id 검증 — AI 환각 방지
    const validIds = new Set(srcList.map((s) => s.id));
    const cleanedProblems = (parsed.problems ?? []).map((p) => ({
      ...p,
      citations: (p.citations ?? []).filter((c) => validIds.has(c.source_id)),
    }));

    return NextResponse.json({
      synthesis: parsed.synthesis ?? "",
      clusters: parsed.clusters ?? [],
      problems: cleanedProblems,
      stats: {
        sources_used: srcList.length,
        insights_used: insList.length,
        problems_generated: cleanedProblems.length,
      },
    });
  } catch (err) {
    log.error(err, "venture.projectId.synthesize-problems.failed");
    return aiError("server_error", "venture/synthesize-problems", { internal: err });
  }
});
