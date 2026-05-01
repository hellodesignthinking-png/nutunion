import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { generateTextWithFallback, listConfiguredProviders } from "@/lib/ai/model";

// Extend serverless function timeout (default 10s is too short for AI synthesis)
export const maxDuration = 60;

import { aiError } from "@/lib/ai/error";
import { runWikiSynthesis, WikiSynthesisError } from "@/lib/ai/wiki-synthesis-core";

// ── Diagnostic GET endpoint ─ production에서는 차단 ──────────────
export async function GET(request: NextRequest) {
  // 프로덕션 / Vercel 배포 환경에서는 진단 엔드포인트 비활성화
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "diagnostic disabled in production" }, { status: 404 });
  }
  // 인증 + 관리자만
  const supa = await createClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supa.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "staff") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }
  const groupId = new URL(request.url).searchParams.get("groupId");
  const checks: Record<string, string> = {};

  try {
    // model.ts 가 보고하는 사용 가능한 provider chain
    const providers = listConfiguredProviders();
    checks.providers = providers.length > 0 ? providers.join(", ") : "MISSING (Gateway/Direct provider 모두 미설정)";

    // 가벼운 quick-test — model.ts/Gateway 통과
    try {
      const ai = await generateTextWithFallback({
        prompt: "Reply with: OK",
        maxOutputTokens: 5,
        tier: "fast",
      });
      checks.ai_quick_test = `ok via ${ai.model_used}: ${(ai.text || "(empty)").slice(0, 60)}`;
    } catch (e: unknown) {
      checks.ai_quick_test = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    checks.auth = user ? `ok (${user.id.slice(0, 8)})` : "NOT_LOGGED_IN";

    if (!user || !groupId) {
      return NextResponse.json({ checks, hint: "Add ?groupId=xxx while logged in" });
    }

    // Check group & host
    const { data: g, error: ge } = await supabase.from("groups").select("host_id").eq("id", groupId).single();
    checks.group = ge ? `ERROR: ${ge.message}` : g ? "ok" : "NOT_FOUND";
    checks.is_host = g?.host_id === user.id ? "yes" : "no";

    // Check tables
    for (const t of ["wiki_synthesis_logs", "wiki_weekly_resources", "wiki_topics", "wiki_pages", "meetings", "file_attachments"]) {
      const { count, error } = await supabase.from(t).select("id", { count: "exact", head: true });
      checks[`table_${t}`] = error ? `ERROR: ${error.message}` : `ok (${count} rows)`;
    }

    // Test insert + delete on wiki_synthesis_logs
    const { error: insertErr } = await supabase.from("wiki_synthesis_logs").insert({
      group_id: groupId,
      week_start: "2025-01-01",
      week_end: "2025-01-01",
      synthesis_type: "weekly_consolidation",
      input_summary: { _diag: true },
      output_data: {},
      created_by: user.id,
    });
    checks.insert_synthesis_log = insertErr ? `ERROR: ${insertErr.message}` : "ok";

    // Clean up
    if (!insertErr) {
      await supabase.from("wiki_synthesis_logs").delete()
        .eq("group_id", groupId)
        .eq("created_by", user.id)
        .eq("week_start", "2025-01-01");
      checks.cleanup = "ok";
    }

    // 위 ai_quick_test 가 동일 역할 — 중복 제거. 호환을 위해 alias 만 남김.
    checks.gemini_api = checks.ai_quick_test || "(skipped)";

    return NextResponse.json({ checks });
  } catch (e: unknown) {
    const fatal = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ checks, fatal }, { status: 500 });
  }
}

const SYSTEM_PROMPT = `당신은 NutUnion 너트의 **회의록 기반 통합 탭 강화 엔진** AI입니다.

## 핵심 철학
너트(팀)는 하나의 주제(예: "바이브코딩", "로컬 브랜딩")로 모인 사람들입니다.
팀의 궁극적 목표는 매주 회의와 토론을 반복하며 **하나의 완성된 통합 문서(탭)**를 만들어가는 것입니다.
이 문서는 단순한 회의록 정리가 아니라, 팀이 오랜 시간 고민하고 토론한 결과물로서 **논문·백서 수준의 깊이**를 가져야 합니다.

각 주제별 탭(섹션)은 이 거대한 통합 문서의 **챕터**입니다. 모든 챕터가 완성되면 하나의 완성된 탭으로 아카이브됩니다.

## 콘텐츠 작성 원칙 (가장 중요)
1. **깊이 있는 분석**: 단순 요약이 아니라, "왜 이 결론에 도달했는지", "어떤 논쟁이 있었는지", "팀이 어떤 관점을 채택했는지"를 서술하세요.
2. **맥락과 근거**: 모든 주장에는 출처를 명시하세요. "제3차 정기회의에서 A가 제안", "참고자료 '제목'에 따르면" 등.
3. **논쟁과 합의 과정**: 팀 내 다른 의견이 있었다면 그 과정을 기록하세요. 최종 합의뿐 아니라 과정이 중요합니다.
4. **실행 가능한 결론**: 각 섹션은 "그래서 우리 팀은 ~하기로 했다" 또는 "~가 다음 과제로 남아있다"로 마무리하세요.
5. **학술적 톤**: 비격식적 대화체가 아닌, 보고서/논문 형식의 문체를 사용하세요.

## 출처 표기 규칙
각 content 안에서 반드시 출처를 인라인으로 표기하세요:
- 회의 출처: [회의: 제목, YYYY.MM.DD]
- 리소스 출처: [자료: 리소스 제목]
- 팀원 발언: [발언: 닉네임, 회의명]
- Google Drive 문서: [문서: 파일명]

## 우선순위
1. **회의록/토론 내용이 1순위** — 팀이 실제로 논의하고 결정한 내용이 탭의 근간
2. **공유 리소스는 보강 근거** — 회의에서 논의된 내용을 뒷받침하는 증거로 활용
3. **기존 섹션 심화 우선** — 새 섹션(create)보다 기존 섹션의 내용 확장(update)을 선호
4. **이전 통합 결과는 재처리하지 않음** — 새 데이터만 분석

반드시 아래 JSON 형식으로만 응답하세요:

{
  "weeklyTheme": "이번 주 회의의 핵심 테마 (한 문장, 학술적 톤)",
  "consolidatedSummary": "이번 주 전체 논의의 맥락과 결론 요약. 이전 주 맥락을 이어받아 서술. 최소 500자, 최대 800자. 출처 표기 필수.",
  "wikiPageSuggestions": [
    {
      "title": "챕터 제목 (통합 문서의 한 섹션)",
      "content": "마크다운 내용. 반드시 다음 구조를 따를 것:\\n\\n## 배경\\n왜 이 주제가 논의되었는지\\n\\n## 핵심 논의\\n어떤 의견들이 있었고, 어떤 근거가 제시되었는지. [회의: 제목] [자료: 제목] 등 출처 표기 필수.\\n\\n## 결론 및 합의\\n팀이 도달한 결론\\n\\n## 향후 과제\\n남은 질문이나 다음 단계\\n\\n최소 600자, 최대 1200자.",
      "topicName": "배정할 섹션(토픽) 이름 — 기존 섹션이 있으면 반드시 그 이름 사용",
      "action": "create 또는 update",
      "tags": ["태그1", "태그2"],
      "sourceResources": ["참조한 리소스 제목들"],
      "sourceMeetings": ["참조한 회의 제목들"],
      "keyInsight": "이 섹션의 핵심 발견 (2-3문장, 단순 요약이 아닌 인사이트)"
    }
  ],
  "crossReferences": [
    {
      "fromPage": "소스 페이지 제목",
      "toPage": "타겟 페이지 제목",
      "linkType": "reference|extends|contradicts|prerequisite",
      "reason": "연결 이유 (한 문장)"
    }
  ],
  "knowledgeGaps": [
    {
      "topic": "탐구가 필요한 영역",
      "reason": "왜 이것이 부족한지",
      "suggestedAction": "해결을 위한 구체적 행동 제안"
    }
  ],
  "tabCompletionAssessment": {
    "overallCompleteness": 0,
    "sectionStatuses": [
      {
        "sectionName": "섹션명",
        "completeness": 0,
        "missingAspects": ["부족한 부분들"]
      }
    ],
    "blockers": ["완성을 막는 요소들"],
    "estimatedWeeksToComplete": 0
  },
  "growthMetrics": {
    "newConceptsIntroduced": 0,
    "conceptsDeepened": 0,
    "connectionsDiscovered": 0,
    "evidenceStrength": "weak|moderate|strong"
  },
  "nextWeekSuggestions": ["다음 주 회의에서 다룰 만한 주제 3개 (구체적이고 실행 가능하게)"],
  "compactionNote": "이전 통합 대비 이번 주에 추가된 핵심 변화 (300자 이내, 출처 포함)"
}

규칙:
- 반드시 유효한 JSON만 출력, 한국어, 학술적 톤
- **회의록 우선**: 회의 내용 중심 구성, 리소스는 보조 근거
- **기존 섹션 강화 우선**: update > create
- wikiPageSuggestions는 최대 3개, 각 content는 **600-1200자** (이전보다 2배 이상 상세하게)
- **모든 주장에 출처 표기**: [회의: ...], [자료: ...], [문서: ...] 형식
- content는 반드시 ## 배경, ## 핵심 논의, ## 결론 및 합의, ## 향후 과제 구조를 따를 것
- tabCompletionAssessment로 통합 문서 전체의 완성도를 평가
- crossReferences는 최대 5개
- knowledgeGaps는 구체적 행동 제안 포함`;

export async function POST(request: NextRequest) {
  // model.ts buildChain 이 사용 가능한 provider 0개면 알아서 throw → catch 가 처리.
  try {
    const body = await request.json();
    const { groupId } = body as { groupId?: string };
    if (!groupId) return aiError("bad_input", "ai/wiki-synthesis");

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return aiError("auth", "ai/wiki-synthesis");

    const { data: groupRow } = await supabase
      .from("groups")
      .select("host_id")
      .eq("id", groupId)
      .maybeSingle();
    if (!groupRow) return aiError("not_found", "ai/wiki-synthesis");
    if ((groupRow as { host_id: string }).host_id !== user.id) {
      return aiError("forbidden", "ai/wiki-synthesis");
    }

    const { success } = rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!success) return aiError("rate_limit", "ai/wiki-synthesis");

    // 코어 실행 (60s 내 완료 가정). 오래 걸리는 케이스는 /trigger 사용.
    try {
      const output = await runWikiSynthesis(supabase, groupId, user.id);
      return NextResponse.json(output);
    } catch (err) {
      if (err instanceof WikiSynthesisError) {
        if (err.code === "parse") return aiError("ai_bad_response", "ai/wiki-synthesis", { internal: err.message, context: { step: err.step } });
        if (err.code === "blocked") return aiError("ai_bad_response", "ai/wiki-synthesis", { internal: err.message });
        if (err.code === "ai") return aiError("ai_unavailable", "ai/wiki-synthesis", { internal: err.message, context: { step: err.step } });
      }
      return aiError("server_error", "ai/wiki-synthesis", { internal: err });
    }
  } catch (error: unknown) {
    return aiError("server_error", "ai/wiki-synthesis", { internal: error });
  }
}
