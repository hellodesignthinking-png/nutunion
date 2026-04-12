import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `당신은 NutUnion 소모임의 **증분 지식 통합 엔진** AI입니다.

핵심 원칙: **이미 위키로 정리된 자료는 다시 검토하지 않습니다.**
이전 통합의 요약만 컨텍스트로 받고, 그 이후 새로 올라온 리소스와 회의 내용만 분석합니다.
이를 통해 매주 위키가 점진적으로 고도화되며, 토큰 사용량을 최소화합니다.

반드시 아래 JSON 형식으로만 응답하세요:

{
  "weeklyTheme": "이번 주의 핵심 학습 테마 (한 문장)",
  "consolidatedSummary": "이번 주 새로 추가된 지식의 통합 요약 (마크다운, 500자 이내). 이전 요약과 자연스럽게 이어지게 작성.",
  "wikiPageSuggestions": [
    {
      "title": "위키 페이지 제목",
      "content": "전체 마크다운 내용 (# 제목, ## 섹션, - 리스트 포함. 최소 300자). 새 자료에서 얻은 지식만 포함.",
      "topicName": "배정할 토픽 이름",
      "action": "create 또는 update",
      "tags": ["태그1", "태그2"],
      "sourceResources": ["참조한 리소스 제목들"],
      "keyInsight": "이 페이지의 핵심 인사이트 (한 문장)"
    }
  ],
  "crossReferences": [
    {
      "fromPage": "소스 페이지 제목",
      "toPage": "타겟 페이지 제목",
      "linkType": "reference|extends|contradicts|prerequisite",
      "reason": "연결 이유"
    }
  ],
  "knowledgeGaps": ["아직 탐구하지 못한 영역/질문"],
  "growthMetrics": {
    "newConceptsIntroduced": 0,
    "conceptsDeepened": 0,
    "connectionsDiscovered": 0
  },
  "nextWeekSuggestions": ["다음 주 학습 제안 3개"],
  "compactionNote": "이전 통합 대비 이번 주에 추가된 지식의 핵심 변화 (200자 이내)"
}

규칙:
- 반드시 유효한 JSON만 출력, 한국어로 작성
- **새 자료만 분석**: "이전 통합 요약"에 포함된 내용은 이미 정리된 것이므로 재분석하지 않음
- wikiPageSuggestions의 content는 완전한 마크다운 문서 (바로 위키 등록 가능)
- action이 "update"인 경우 기존 내용에 **추가**할 새 섹션만 작성
- compactionNote로 이전 대비 변화를 기록하여 지식 체인 유지`;

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { groupId } = body;

    if (!groupId) {
      return NextResponse.json({ error: "groupId가 필요합니다" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    }

    // ── 1. Find last synthesis timestamp (incremental boundary) ──
    const { data: prevSynthesisArr } = await supabase
      .from("wiki_synthesis_logs")
      .select("created_at, output_data")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(1);

    const prevSynthesis = prevSynthesisArr?.[0];
    const lastSynthesisAt = prevSynthesis?.created_at || new Date(0).toISOString();
    const prevOutput = prevSynthesis?.output_data;

    const now = new Date().toISOString();

    // ── 2. Fetch ONLY new data since last synthesis ──
    const [resourcesRes, meetingsRes, topicsRes] = await Promise.all([
      // Resources shared AFTER last synthesis
      supabase.from("wiki_weekly_resources")
        .select("title, url, resource_type, description, auto_summary")
        .eq("group_id", groupId)
        .gt("created_at", lastSynthesisAt)
        .order("created_at"),
      // Meetings completed AFTER last synthesis
      supabase.from("meetings")
        .select("id, title, summary, next_topic, scheduled_at")
        .eq("group_id", groupId)
        .gt("scheduled_at", lastSynthesisAt)
        .order("scheduled_at"),
      // All topics (lightweight, for context)
      supabase.from("wiki_topics")
        .select("id, name")
        .eq("group_id", groupId),
    ]);

    const newResources = resourcesRes.data || [];
    const newMeetings = meetingsRes.data || [];
    const topics = topicsRes.data || [];

    // Fetch notes only for NEW meetings
    const meetingIds = newMeetings.map(m => m.id);
    let newNotes: any[] = [];
    if (meetingIds.length > 0) {
      const { data } = await supabase.from("meeting_notes")
        .select("content, type, status")
        .in("meeting_id", meetingIds);
      newNotes = data || [];
    }

    // Fetch existing wiki page TITLES only (not full content - saves tokens)
    const topicIds = topics.map(t => t.id);
    let existingPageTitles: string[] = [];
    if (topicIds.length > 0) {
      const { data } = await supabase.from("wiki_pages")
        .select("title")
        .in("topic_id", topicIds);
      existingPageTitles = (data || []).map(p => p.title);
    }

    // If no new data, return early
    if (newResources.length === 0 && newMeetings.length === 0) {
      return NextResponse.json({
        weeklyTheme: "새로운 데이터 없음",
        consolidatedSummary: "마지막 통합 이후 새로 공유된 리소스나 회의가 없습니다.",
        wikiPageSuggestions: [],
        crossReferences: [],
        knowledgeGaps: [],
        growthMetrics: { newConceptsIntroduced: 0, conceptsDeepened: 0, connectionsDiscovered: 0 },
        nextWeekSuggestions: [],
        compactionNote: "변경 없음",
        _meta: { resourceCount: 0, meetingCount: 0, noteCount: 0, isIncremental: true, lastSynthesisAt },
      });
    }

    // ── 3. Build INCREMENTAL prompt ──
    let prompt = `## 증분 지식 통합\n\n`;
    prompt += `**마지막 통합**: ${new Date(lastSynthesisAt).toLocaleDateString("ko")}\n`;
    prompt += `**이번 분석 범위**: 그 이후 ~ 현재\n\n`;

    // Previous synthesis summary (compressed context — NOT full data)
    if (prevOutput) {
      const prev = typeof prevOutput === "string" ? JSON.parse(prevOutput) : prevOutput;
      prompt += `### 📌 이전까지의 지식 요약 (이미 정리됨, 재검토 불필요)\n`;
      prompt += `${prev.consolidatedSummary || prev.weeklyTheme || "첫 통합"}\n`;
      if (prev.compactionNote) prompt += `최근 변화: ${prev.compactionNote}\n`;
      prompt += "\n";
    } else {
      prompt += `### 📌 첫 번째 통합입니다. 기초 지식 체계를 구축해주세요.\n\n`;
    }

    // NEW resources only
    if (newResources.length > 0) {
      prompt += `### 🆕 새로 공유된 리소스 (${newResources.length}건, 이번에 처음 분석)\n`;
      newResources.forEach(r => {
        prompt += `- [${r.resource_type}] **${r.title}** — ${r.url}\n`;
        if (r.description) prompt += `  설명: ${r.description}\n`;
        if (r.auto_summary) prompt += `  AI 요약: ${r.auto_summary}\n`;
      });
      prompt += "\n";
    }

    // NEW meetings only
    if (newMeetings.length > 0) {
      prompt += `### 🆕 새 미팅 (${newMeetings.length}건)\n`;
      newMeetings.forEach(m => {
        prompt += `- **${m.title}** (${new Date(m.scheduled_at).toLocaleDateString("ko")})\n`;
        if (m.summary) prompt += `  요약: ${m.summary}\n`;
        if (m.next_topic) prompt += `  다음 주제: ${m.next_topic}\n`;
      });
      prompt += "\n";
    }

    // NEW notes only
    if (newNotes.length > 0) {
      const decisions = newNotes.filter(n => n.type === "decision");
      const actions = newNotes.filter(n => n.type === "action_item");
      const memos = newNotes.filter(n => n.type === "note");

      if (decisions.length > 0) {
        prompt += `### 🆕 새 결정 사항\n${decisions.map(d => `- ${d.content}`).join("\n")}\n\n`;
      }
      if (actions.length > 0) {
        prompt += `### 🆕 새 액션 아이템\n${actions.map(a => `- ${a.status === "done" ? "✅" : "⬜"} ${a.content}`).join("\n")}\n\n`;
      }
      if (memos.length > 0) {
        prompt += `### 🆕 새 미팅 메모\n${memos.slice(0, 15).map(n => `- ${n.content}`).join("\n")}\n\n`;
      }
    }

    // Existing page titles (for cross-reference, no full content)
    if (existingPageTitles.length > 0) {
      prompt += `### 기존 위키 페이지 목록 (제목만, 내용은 이미 정리됨)\n`;
      prompt += existingPageTitles.map(t => `- ${t}`).join("\n") + "\n\n";
    }
    if (topics.length > 0) {
      prompt += `### 기존 토픽: ${topics.map(t => t.name).join(", ")}\n\n`;
    }

    prompt += `위 **새 데이터만** 분석하여 위키를 고도화할 통합 결과를 JSON으로 생성해주세요.\n`;
    prompt += `이전에 정리된 내용을 반복하지 마세요. 새로운 지식만 추가하세요.`;

    // ── 4. Call Gemini ──
    const geminiBody = {
      contents: [{ parts: [{ text: SYSTEM_PROMPT }, { text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    };

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
      } catch (e: any) {
        lastError = e.message || "Network error";
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    if (!response || !response.ok) {
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

    // ── 5. Save synthesis log (marks boundary for next incremental run) ──
    const weekStartDate = new Date(lastSynthesisAt > new Date(0).toISOString() ? lastSynthesisAt : now).toISOString().split("T")[0];

    await supabase.from("wiki_synthesis_logs").insert({
      group_id: groupId,
      week_start: weekStartDate,
      week_end: now.split("T")[0],
      synthesis_type: "weekly_consolidation",
      input_summary: {
        newResourceCount: newResources.length,
        newMeetingCount: newMeetings.length,
        newNoteCount: newNotes.length,
        existingPageCount: existingPageTitles.length,
        lastSynthesisAt,
        isIncremental: !!prevSynthesis,
      },
      output_data: result,
      created_by: user.id,
    });

    return NextResponse.json({
      ...result,
      _meta: {
        newResourceCount: newResources.length,
        newMeetingCount: newMeetings.length,
        newNoteCount: newNotes.length,
        existingPageCount: existingPageTitles.length,
        isIncremental: !!prevSynthesis,
        lastSynthesisAt,
      },
    });
  } catch (error: any) {
    console.error("Wiki synthesis error:", error);
    return NextResponse.json({ error: error.message || "통합 중 오류 발생" }, { status: 500 });
  }
}
