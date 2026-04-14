import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Weekly Digest API
 * 
 * Core Concept: "Knowledge Compaction"
 * Instead of sending ALL historical data to AI every meeting,
 * we compress the week's data into a digest that becomes
 * the starting context for the next meeting.
 * 
 * Flow: Meetings + Notes + Resources + Wiki → AI Compress → Digest
 * Next meeting: Digest (small) + new notes → AI = less tokens
 */
const SYSTEM_PROMPT = `당신은 NutUnion 너트의 **주간 지식 다이제스트 & 성장 촉진자** AI입니다.
한 주간의 모든 회의 내용, 공유 자료, 결정 사항, 액션 아이템을 분석하여
**다음 회의의 시작 컨텍스트**로 사용할 압축된 다이제스트를 생성하고,
회원들의 성장을 돕는 인사이트를 제공합니다.

반드시 아래 JSON 형식으로만 응답하세요:

{
  "digest": "이번 주 핵심 내용을 3-5 문장으로 압축 요약.",
  "carryOverItems": ["아직 완료되지 않은 액션 아이템 목록 (담당자 포함)"],
  "resolvedItems": ["이번 주 완료된 사항"],
  "keyDecisions": ["이번 주 확정된 결정 사항"],
  "openQuestions": ["아직 해결되지 않은 질문/과제"],
  "knowledgeGrowth": ["탭에 추가/업데이트된 지식 항목"],
  "nextMeetingContext": "다음 회의에서 AI가 참고할 압축 컨텍스트 (200자 이내)",
  "suggestedAgenda": ["다음 회의 안건 제안 3-5개"],
  "tokenSavings": "이 다이제스트로 대체된 원본 데이터의 대략적 크기",
  "memberGrowth": ["이번 주 회원들이 보여준 성장 포인트 (새 아이디어, 깊은 논의, 문제 해결 등)"],
  "learningJourney": {
    "topicsExplored": ["이번 주 탐구한 주요 주제들"],
    "recommendedReading": ["다음 주 추천 학습 주제/자료"],
    "skillsSharpened": ["이번 주 연마된 역량들"]
  },
  "weeklyReflection": {
    "whatWentWell": "이번 주 잘된 점",
    "whatToImprove": "다음 주 개선할 점",
    "discussionEvolution": "지난주 대비 토론 품질 변화"
  },
  "encouragement": "팀에게 보내는 격려 메시지 (따뜻하고 구체적으로)"
}

규칙:
- 반드시 유효한 JSON만 출력
- 한국어로 작성
- nextMeetingContext는 반드시 200자 이내로 핵심만
- carryOverItems는 구체적으로 (누가 무엇을 언제까지)
- memberGrowth: 회원들의 발전을 인정하고 격려하는 톤
- learningJourney: 토론에서 자연스럽게 이어지는 학습 주제 제안
- weeklyReflection: 건설적이고 긍정적인 피드백
- encouragement: 다음 주 동기부여가 되는 메시지
- 이전 다이제스트가 있다면 그 맥락을 이어서 작성
- digest는 모든 참석자가 5초 안에 맥락을 파악할 수 있도록 간결하게`;

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { groupId, periodStart, periodEnd, previousDigest } = body;

    if (!groupId) {
      return NextResponse.json({ error: "groupId가 필요합니다" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    }
    const { success } = rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!success) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    // ── 1. Gather period data ──────────────────────────────────────────

    // Meetings in the period
    const startISO = periodStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endISO = periodEnd || new Date().toISOString();

    const { data: meetings } = await supabase
      .from("meetings")
      .select("id, title, summary, status, next_topic, scheduled_at")
      .eq("group_id", groupId)
      .gte("scheduled_at", startISO)
      .lte("scheduled_at", endISO)
      .order("scheduled_at");

    const meetingIds = (meetings || []).map(m => m.id);

    // Meeting notes (all types)
    let notes: any[] = [];
    if (meetingIds.length > 0) {
      const { data: notesData } = await supabase
        .from("meeting_notes")
        .select("content, type, status")
        .in("meeting_id", meetingIds)
        .order("created_at");
      notes = notesData || [];
    }

    // Shared resources
    let resources: any[] = [];
    if (meetingIds.length > 0) {
      try {
        const { data: resData } = await supabase
          .from("meeting_resources")
          .select("title, type, description")
          .in("meeting_id", meetingIds);
        resources = resData || [];
      } catch { /* table may not exist */ }
    }

    // Wiki updates in period
    const { data: topics } = await supabase
      .from("wiki_topics")
      .select("id, name")
      .eq("group_id", groupId);

    const topicIds = (topics || []).map(t => t.id);
    let wikiUpdates: any[] = [];
    if (topicIds.length > 0) {
      // Parallelize wiki data fetching
      const [contribsResult, pagesResult] = await Promise.all([
        supabase
          .from("wiki_contributions")
          .select("change_summary, page_id, created_at")
          .gte("created_at", startISO),
        supabase
          .from("wiki_pages")
          .select("id, title")
          .in("topic_id", topicIds),
      ]);
      
      const contribs = contribsResult.data || [];
      const pages = pagesResult.data || [];
      
      if (contribs.length > 0) {
        const pageMap: Record<string, string> = {};
        pages.forEach(p => { pageMap[p.id] = p.title; });
        
        wikiUpdates = contribs
          .filter(c => pageMap[c.page_id])
          .map(c => ({
            page: pageMap[c.page_id],
            change: c.change_summary,
          }));
      }
    }

    // ── 2. Build AI prompt ─────────────────────────────────────────────

    let userPrompt = `## 주간 데이터 (${new Date(startISO).toLocaleDateString("ko")} ~ ${new Date(endISO).toLocaleDateString("ko")})\n\n`;

    // Previous digest context (knowledge chain)
    if (previousDigest) {
      userPrompt += `### 📌 이전 주간 다이제스트 (이어서 작성)\n${previousDigest}\n\n`;
    }

    // Meetings
    if (meetings && meetings.length > 0) {
      userPrompt += `### 회의 목록 (${meetings.length}건)\n`;
      meetings.forEach(m => {
        userPrompt += `- **${m.title}** (${new Date(m.scheduled_at).toLocaleDateString("ko")}, ${m.status})\n`;
        if (m.summary) userPrompt += `  요약: ${m.summary}\n`;
        if (m.next_topic) userPrompt += `  다음 주제: ${m.next_topic}\n`;
      });
      userPrompt += "\n";
    }

    // Notes breakdown
    const notesByType = {
      note: notes.filter(n => n.type === "note"),
      decision: notes.filter(n => n.type === "decision"),
      action_item: notes.filter(n => n.type === "action_item"),
    };

    if (notesByType.decision.length > 0) {
      userPrompt += `### 결정 사항 (${notesByType.decision.length}건)\n`;
      notesByType.decision.forEach(n => { userPrompt += `- ${n.content}\n`; });
      userPrompt += "\n";
    }

    if (notesByType.action_item.length > 0) {
      userPrompt += `### 액션 아이템 (${notesByType.action_item.length}건)\n`;
      notesByType.action_item.forEach(n => {
        const status = n.status === "done" ? "✅" : "⬜";
        userPrompt += `- ${status} ${n.content}\n`;
      });
      userPrompt += "\n";
    }

    if (notesByType.note.length > 0) {
      userPrompt += `### 회의 메모 (${notesByType.note.length}건)\n`;
      notesByType.note.slice(0, 10).forEach(n => { userPrompt += `- ${n.content}\n`; });
      if (notesByType.note.length > 10) userPrompt += `... 외 ${notesByType.note.length - 10}건\n`;
      userPrompt += "\n";
    }

    // Shared resources
    if (resources.length > 0) {
      userPrompt += `### 공유 자료 (${resources.length}건)\n`;
      resources.forEach(r => {
        userPrompt += `- [${r.type}] ${r.title}${r.description ? `: ${r.description}` : ""}\n`;
      });
      userPrompt += "\n";
    }

    // Wiki updates
    if (wikiUpdates.length > 0) {
      userPrompt += `### 탭 업데이트 (${wikiUpdates.length}건)\n`;
      wikiUpdates.forEach(w => { userPrompt += `- ${w.page}: ${w.change}\n`; });
      userPrompt += "\n";
    }

    userPrompt += `위 한 주간의 데이터를 분석하여 주간 다이제스트를 JSON 형식으로 생성해주세요.\n`;
    userPrompt += `특히 nextMeetingContext는 다음 회의 AI의 시작 컨텍스트로 사용되므로 핵심만 200자 이내로 압축해주세요.`;

    // ── 3. Call Gemini ─────────────────────────────────────────────────

    const geminiBody = {
      contents: [{
        parts: [
          { text: SYSTEM_PROMPT },
          { text: userPrompt },
        ],
      }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 2048,
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        });
        if (response.ok) break;
        lastError = `HTTP ${response.status}`;
        if (response.status === 429 || response.status >= 500) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
        break;
      } catch (fetchErr: any) {
        lastError = fetchErr.message || "Network error";
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : lastError;
      console.error("Gemini API error after retries:", errorText);
      return NextResponse.json({ error: `Gemini API 오류: ${lastError}` }, { status: 502 });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) result = JSON.parse(jsonMatch[1].trim());
      else {
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) result = JSON.parse(braceMatch[0]);
        else throw new Error("AI 응답에서 JSON을 파싱할 수 없습니다");
      }
    }

    // Normalize
    const normalized = {
      digest: result.digest || "",
      carryOverItems: Array.isArray(result.carryOverItems) ? result.carryOverItems : [],
      resolvedItems: Array.isArray(result.resolvedItems) ? result.resolvedItems : [],
      keyDecisions: Array.isArray(result.keyDecisions) ? result.keyDecisions : [],
      openQuestions: Array.isArray(result.openQuestions) ? result.openQuestions : [],
      knowledgeGrowth: Array.isArray(result.knowledgeGrowth) ? result.knowledgeGrowth : [],
      nextMeetingContext: result.nextMeetingContext || "",
      suggestedAgenda: Array.isArray(result.suggestedAgenda) ? result.suggestedAgenda : [],
      tokenSavings: result.tokenSavings || "",
      // Growth facilitation
      memberGrowth: Array.isArray(result.memberGrowth) ? result.memberGrowth : [],
      learningJourney: result.learningJourney || { topicsExplored: [], recommendedReading: [], skillsSharpened: [] },
      weeklyReflection: result.weeklyReflection || { whatWentWell: "", whatToImprove: "", discussionEvolution: "" },
      encouragement: result.encouragement || "",
      // Metadata
      periodStart: startISO,
      periodEnd: endISO,
      meetingCount: meetings?.length || 0,
      noteCount: notes.length,
      resourceCount: resources.length,
      wikiUpdateCount: wikiUpdates.length,
    };

    return NextResponse.json(normalized);
  } catch (error: any) {
    console.error("Weekly digest error:", error);
    return NextResponse.json(
      { error: error.message || "주간 다이제스트 생성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
