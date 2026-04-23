import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { aiError } from "@/lib/ai/error";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeForPrompt } from "@/lib/ai/sanitize";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
const GEMINI_HEADERS = { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY ?? "" };

const SYSTEM_PROMPT = `당신은 창업 팀의 **솔루션 발산 촉진자** AI 입니다.

선정된 HMW 문제 정의와 수집된 원천 자료를 종합해, 실행 가능한 **아이디어 후보**를 제안하세요.
각 아이디어는 반드시 source 인용과 linked_problem_id 를 명시해야 합니다.

반드시 아래 JSON 형식으로만 응답:

{
  "divergence_note": "발산 방향 요약 (200~400자). 어떤 관점에서 다양하게 탐색했는지 설명.",
  "ideas": [
    {
      "title": "아이디어 제목 (한 문장, 제품/서비스 이름 수준)",
      "description": "핵심 동작 설명 (3~5문장). 유저 관점에서 '어떤 상황에서 → 어떻게 → 결과' 서술.",
      "linked_problem_id": "이 아이디어가 해결하는 problem 의 id (반드시 제공된 목록에서만)",
      "rationale": "왜 이 아이디어가 문제를 해결하는지 논리 (3~4문장). 자료 인용 포함.",
      "differentiation": "기존 솔루션 대비 차별점 (1~2문장)",
      "risk": "실행 시 주요 리스크 1가지",
      "mvp_hint": "MVP 로 검증할 가장 작은 버전 제안 (1~2문장)",
      "citations": [
        { "source_id": "...", "title": "...", "kind": "...", "quote": "..." }
      ]
    }
  ]
}

규칙:
- 유효 JSON 만 출력
- ideas 는 4~6개 (발산 단계이므로 다양하게)
- **linked_problem_id 는 필수** — 제공된 목록에서만 선택
- 최소 1개 citation 포함 권장 — 근거 있는 아이디어
- 각 아이디어는 서로 **접근 방식이 달라야** 함 (비슷한 솔루션 중복 금지)
- "AI 챗봇", "추천 시스템" 같은 막연한 제안 금지 — 구체적 동작 명시`;

const BodySchema = z.object({
  problem_ids: z.array(z.string().uuid()).min(1).max(5).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  if (!GEMINI_API_KEY) return aiError("server_error", "venture/synthesize-ideas", { internal: "GEMINI_API_KEY missing" });

  const { projectId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return aiError("auth", "venture/synthesize-ideas");

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return aiError("bad_input", "venture/synthesize-ideas");

  const { success } = rateLimit(`ai:${user.id}`, 15, 60_000);
  if (!success) return aiError("rate_limit", "venture/synthesize-ideas");

  // 멤버십 확인
  const { data: pm } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  if (!pm && !isAdminStaff) return aiError("forbidden", "venture/synthesize-ideas");

  // 대상 problems — 선택 ID 있으면 그것만, 없으면 is_selected=true 또는 최근 5개
  let problemsQuery = supabase
    .from("venture_problems")
    .select("id, hmw_statement, target_user, context, success_metric")
    .eq("project_id", projectId);

  if (parsed.data.problem_ids && parsed.data.problem_ids.length > 0) {
    problemsQuery = problemsQuery.in("id", parsed.data.problem_ids);
  } else {
    problemsQuery = problemsQuery.order("is_selected", { ascending: false }).order("created_at", { ascending: false }).limit(5);
  }

  const [{ data: problems }, { data: sources }] = await Promise.all([
    problemsQuery,
    supabase.from("venture_sources").select("id, kind, title, url, excerpt, ai_summary, tags").eq("project_id", projectId).limit(20),
  ]);

  const probList = (problems as Array<{ id: string; hmw_statement: string; target_user?: string; context?: string; success_metric?: string }> | null) ?? [];
  const srcList = (sources as Array<{ id: string; kind: string; title: string; url?: string; excerpt?: string; ai_summary?: string; tags?: string[] }> | null) ?? [];

  if (probList.length === 0) {
    return NextResponse.json(
      { error: "문제 정의(HMW)가 필요합니다. Define 단계에서 먼저 HMW 를 작성하거나 AI 생성해주세요." },
      { status: 400 }
    );
  }

  let userPrompt = `## 선정된 HMW 문제 (${probList.length}건)\n\n`;
  for (const p of probList) {
    userPrompt += `### [problem_id: ${p.id}]\n`;
    userPrompt += `- HMW: ${sanitizeForPrompt(p.hmw_statement, 500)}\n`;
    if (p.target_user) userPrompt += `- 타겟: ${sanitizeForPrompt(p.target_user, 200)}\n`;
    if (p.context) userPrompt += `- 맥락: ${sanitizeForPrompt(p.context, 500)}\n`;
    if (p.success_metric) userPrompt += `- 성공 지표: ${sanitizeForPrompt(p.success_metric, 200)}\n`;
    userPrompt += "\n";
  }

  if (srcList.length > 0) {
    userPrompt += `## Source Library (${srcList.length}건) — 인용 근거\n\n`;
    for (const s of srcList) {
      userPrompt += `### [source_id: ${s.id}] ${sanitizeForPrompt(s.title, 200)}\n`;
      userPrompt += `- kind: ${s.kind}\n`;
      if (s.url) userPrompt += `- url: ${s.url}\n`;
      if (s.excerpt) userPrompt += `- excerpt: ${sanitizeForPrompt(s.excerpt, 500)}\n`;
      if (s.ai_summary) userPrompt += `- 요약: ${sanitizeForPrompt(s.ai_summary, 1000)}\n`;
      userPrompt += "\n";
    }
  }

  userPrompt += `\n위 HMW 와 자료를 기반으로 실행 가능한 아이디어 후보 4~6개를 JSON 으로 생성하세요. 각 아이디어는 linked_problem_id 필수.`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: GEMINI_HEADERS,
      body: JSON.stringify({
        contents: [{ parts: [{ text: SYSTEM_PROMPT }, { text: userPrompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return aiError("ai_unavailable", "venture/synthesize-ideas", { internal: `${res.status}: ${errBody.slice(0, 300)}` });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let result: {
      divergence_note?: string;
      ideas?: Array<{
        title: string;
        description: string;
        linked_problem_id?: string;
        rationale?: string;
        differentiation?: string;
        risk?: string;
        mvp_hint?: string;
        citations?: Array<{ source_id: string; title: string; kind: string; quote: string }>;
      }>;
    };
    try {
      result = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return aiError("ai_bad_response", "venture/synthesize-ideas");
      result = JSON.parse(m[0]);
    }

    // source_id / problem_id 검증
    const validSrcIds = new Set(srcList.map((s) => s.id));
    const validProbIds = new Set(probList.map((p) => p.id));
    const cleaned = (result.ideas ?? []).map((i) => ({
      ...i,
      linked_problem_id: i.linked_problem_id && validProbIds.has(i.linked_problem_id) ? i.linked_problem_id : null,
      citations: (i.citations ?? []).filter((c) => validSrcIds.has(c.source_id)),
    }));

    return NextResponse.json({
      divergence_note: result.divergence_note ?? "",
      ideas: cleaned,
      stats: {
        problems_used: probList.length,
        sources_used: srcList.length,
        ideas_generated: cleaned.length,
      },
    });
  } catch (err) {
    return aiError("server_error", "venture/synthesize-ideas", { internal: err });
  }
}
