import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

// Extend serverless function timeout (default 10s is too short for AI synthesis)
export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ── Diagnostic GET endpoint ──────────────────────────────────────
export async function GET(request: NextRequest) {
  const groupId = new URL(request.url).searchParams.get("groupId");
  const checks: Record<string, string> = {};

  try {
    checks.gemini_key = GEMINI_API_KEY ? `set (${GEMINI_API_KEY.slice(0, 8)}...)` : "MISSING";
    checks.gemini_model = GEMINI_MODEL;
    checks.gemini_url = GEMINI_URL ? "built" : "MISSING";

    // Always test Gemini (no auth needed)
    try {
      const geminiQuickTest = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Reply with: OK" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });
      if (geminiQuickTest.ok) {
        const gd = await geminiQuickTest.json();
        checks.gemini_quick_test = `ok: ${gd?.candidates?.[0]?.content?.parts?.[0]?.text || "(empty)"}`;
      } else {
        const errText = await geminiQuickTest.text();
        checks.gemini_quick_test = `FAIL HTTP ${geminiQuickTest.status}: ${errText.slice(0, 300)}`;
      }
    } catch (e: any) {
      checks.gemini_quick_test = `ERROR: ${e.message}`;
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

    // Test Gemini reachability
    try {
      const geminiTestRes = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say OK" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });
      if (geminiTestRes.ok) {
        checks.gemini_api = "ok";
      } else {
        const errBody = await geminiTestRes.text();
        checks.gemini_api = `HTTP ${geminiTestRes.status}: ${errBody.slice(0, 200)}`;
      }
    } catch (e: any) {
      checks.gemini_api = `ERROR: ${e.message}`;
    }

    return NextResponse.json({ checks });
  } catch (e: any) {
    return NextResponse.json({ checks, fatal: e.message }, { status: 500 });
  }
}

const SYSTEM_PROMPT = `당신은 NutUnion 너트의 **증분 지식 통합 엔진** AI입니다.

핵심 원칙: **이미 탭으로 정리된 자료는 다시 검토하지 않습니다.**
이전 통합의 요약만 컨텍스트로 받고, 그 이후 새로 올라온 리소스와 회의 내용만 분석합니다.
이를 통해 매주 탭이 점진적으로 고도화되며, 토큰 사용량을 최소화합니다.

반드시 아래 JSON 형식으로만 응답하세요:

{
  "weeklyTheme": "이번 주의 핵심 학습 테마 (한 문장)",
  "consolidatedSummary": "이번 주 새로 추가된 지식의 통합 요약 (마크다운, 500자 이내). 이전 요약과 자연스럽게 이어지게 작성.",
  "wikiPageSuggestions": [
    {
      "title": "탭 페이지 제목",
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
- wikiPageSuggestions의 content는 완전한 마크다운 문서 (바로 탭 등록 가능)
- action이 "update"인 경우 기존 내용에 **추가**할 새 섹션만 작성
- compactionNote로 이전 대비 변화를 기록하여 지식 체인 유지`;

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  let step = "init";
  try {
    // ── Auth & validation ──
    step = "parse-body";
    const body = await request.json();
    const { groupId } = body;

    if (!groupId) {
      return NextResponse.json({ error: "groupId가 필요합니다" }, { status: 400 });
    }

    step = "auth";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    }

    // Verify requester is host of the group
    step = "verify-host";
    const { data: groupRow, error: groupError } = await supabase
      .from("groups")
      .select("host_id")
      .eq("id", groupId)
      .single();

    if (groupError || !groupRow) {
      return NextResponse.json({ error: "그룹을 찾을 수 없습니다" }, { status: 404 });
    }

    if (groupRow.host_id !== user.id) {
      return NextResponse.json({ error: "호스트만 지식 통합을 실행할 수 있습니다" }, { status: 403 });
    }

    const { success } = rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!success) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    // ── 1. Find last synthesis timestamp ──
    step = "fetch-prev-synthesis";
    let lastSynthesisAt = new Date(0).toISOString();
    let prevOutput: any = null;

    const { data: prevSynthesisArr, error: prevError } = await supabase
      .from("wiki_synthesis_logs")
      .select("created_at, output_data")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (prevError) {
      // Table might not exist — treat as first synthesis
      console.warn("wiki_synthesis_logs query failed (table may not exist):", prevError.message);
    } else if (prevSynthesisArr && prevSynthesisArr.length > 0) {
      lastSynthesisAt = prevSynthesisArr[0].created_at;
      prevOutput = prevSynthesisArr[0].output_data;
    }

    const now = new Date().toISOString();

    // ── 2. Fetch new data since last synthesis ──
    step = "fetch-resources";
    const { data: rawResources, error: resErr } = await supabase
      .from("wiki_weekly_resources")
      .select("title, url, resource_type, description, auto_summary")
      .eq("group_id", groupId)
      .gt("created_at", lastSynthesisAt)
      .order("created_at");

    if (resErr) {
      console.warn("wiki_weekly_resources query failed:", resErr.message);
    }
    const newResources = rawResources || [];

    step = "fetch-meetings";
    const { data: rawMeetings, error: meetErr } = await supabase
      .from("meetings")
      .select("id, title, summary, next_topic, scheduled_at")
      .eq("group_id", groupId)
      .gt("scheduled_at", lastSynthesisAt)
      .order("scheduled_at");

    if (meetErr) {
      console.warn("meetings query failed:", meetErr.message);
    }
    const newMeetings = rawMeetings || [];

    step = "fetch-topics";
    const { data: rawTopics } = await supabase
      .from("wiki_topics")
      .select("id, name")
      .eq("group_id", groupId);
    const topics = rawTopics || [];

    // Fetch notes for new meetings
    step = "fetch-notes";
    const meetingIds = newMeetings.map(m => m.id);
    let newNotes: any[] = [];
    if (meetingIds.length > 0) {
      const { data } = await supabase
        .from("meeting_notes")
        .select("content, type, status")
        .in("meeting_id", meetingIds);
      newNotes = data || [];
    }

    // Fetch existing wiki page TITLES
    step = "fetch-page-titles";
    const topicIds = topics.map(t => t.id);
    let existingPageTitles: string[] = [];
    if (topicIds.length > 0) {
      const { data } = await supabase
        .from("wiki_pages")
        .select("title")
        .in("topic_id", topicIds);
      existingPageTitles = (data || []).map(p => p.title);
    }

    // ── 2b. Fetch Drive-linked files (lightweight REST API, no googleapis SDK) ──
    step = "fetch-drive-files";
    let driveDocContents: { name: string; content: string }[] = [];
    try {
      const driveQueryBuilder = supabase
        .from("file_attachments")
        .select("id, file_name, file_url, created_at")
        .eq("target_type", "group")
        .eq("target_id", groupId)
        .eq("file_type", "drive-link");

      if (lastSynthesisAt > new Date(0).toISOString()) {
        driveQueryBuilder.gte("created_at", lastSynthesisAt);
      }

      const { data: driveFiles } = await driveQueryBuilder
        .order("created_at", { ascending: false })
        .limit(10);

      if (driveFiles && driveFiles.length > 0) {
        // Get user's Google access token from profile (lightweight, no googleapis SDK)
        const { data: profile } = await supabase
          .from("profiles")
          .select("google_access_token")
          .eq("id", user.id)
          .single();

        if (profile?.google_access_token) {
          for (const df of driveFiles) {
            const docIdMatch = df.file_url?.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
            if (!docIdMatch) continue;
            try {
              // Use Google Docs REST API directly with fetch (avoids bundling googleapis ~50MB)
              const docRes = await fetch(
                `https://docs.googleapis.com/v1/documents/${docIdMatch[1]}`,
                { headers: { Authorization: `Bearer ${profile.google_access_token}` } }
              );
              if (!docRes.ok) continue;
              const docData = await docRes.json();
              const docContent = (docData.body?.content || [])
                .map((block: any) => {
                  if (block.paragraph) {
                    return (block.paragraph.elements || [])
                      .map((el: any) => el.textRun?.content || "")
                      .join("");
                  }
                  return "";
                })
                .join("")
                .trim();
              if (docContent && docContent.length > 0) {
                driveDocContents.push({
                  name: df.file_name || "Untitled",
                  content: docContent.substring(0, 3000),
                });
              }
            } catch {
              // Skip individual docs that can't be read
            }
          }
        }
      }
    } catch (driveErr: any) {
      console.warn("Drive file fetch failed:", driveErr.message);
      // Non-critical, continue without Drive content
    }

    // If no new data, return early
    if (newResources.length === 0 && newMeetings.length === 0 && driveDocContents.length === 0) {
      return NextResponse.json({
        weeklyTheme: "새로운 데이터 없음",
        consolidatedSummary: "마지막 통합 이후 새로 공유된 리소스나 회의가 없습니다.",
        wikiPageSuggestions: [],
        crossReferences: [],
        knowledgeGaps: [],
        growthMetrics: { newConceptsIntroduced: 0, conceptsDeepened: 0, connectionsDiscovered: 0 },
        nextWeekSuggestions: [],
        compactionNote: "변경 없음",
        _meta: {
          newResourceCount: 0,
          meetingCount: 0,
          noteCount: 0,
          driveDocsProcessed: 0,
          isIncremental: true,
          lastSynthesisAt,
        },
      });
    }

    // ── 3. Build prompt ──
    step = "build-prompt";
    let prompt = `## 증분 지식 통합\n\n`;
    prompt += `**마지막 통합**: ${new Date(lastSynthesisAt).toLocaleDateString("ko")}\n`;
    prompt += `**이번 분석 범위**: 그 이후 ~ 현재\n\n`;

    if (prevOutput) {
      const prev = typeof prevOutput === "string" ? JSON.parse(prevOutput) : prevOutput;
      prompt += `### 이전까지의 지식 요약 (이미 정리됨, 재검토 불필요)\n`;
      prompt += `${prev.consolidatedSummary || prev.weeklyTheme || "첫 통합"}\n`;
      if (prev.compactionNote) prompt += `최근 변화: ${prev.compactionNote}\n`;
      prompt += "\n";
    } else {
      prompt += `### 첫 번째 통합입니다. 기초 지식 체계를 구축해주세요.\n\n`;
    }

    if (newResources.length > 0) {
      prompt += `### 새로 공유된 리소스 (${newResources.length}건)\n`;
      newResources.forEach(r => {
        prompt += `- [${r.resource_type}] **${r.title}** — ${r.url}\n`;
        if (r.description) prompt += `  설명: ${r.description}\n`;
        if (r.auto_summary) prompt += `  AI 요약: ${r.auto_summary}\n`;
      });
      prompt += "\n";
    }

    if (newMeetings.length > 0) {
      prompt += `### 새 미팅 (${newMeetings.length}건)\n`;
      newMeetings.forEach(m => {
        prompt += `- **${m.title}** (${new Date(m.scheduled_at).toLocaleDateString("ko")})\n`;
        if (m.summary) prompt += `  요약: ${m.summary}\n`;
        if (m.next_topic) prompt += `  다음 주제: ${m.next_topic}\n`;
      });
      prompt += "\n";
    }

    if (newNotes.length > 0) {
      const decisions = newNotes.filter(n => n.type === "decision");
      const actions = newNotes.filter(n => n.type === "action_item");
      const memos = newNotes.filter(n => n.type === "note");
      if (decisions.length > 0) {
        prompt += `### 새 결정 사항\n${decisions.map(d => `- ${d.content}`).join("\n")}\n\n`;
      }
      if (actions.length > 0) {
        prompt += `### 새 액션 아이템\n${actions.map(a => `- ${a.status === "done" ? "✅" : "⬜"} ${a.content}`).join("\n")}\n\n`;
      }
      if (memos.length > 0) {
        prompt += `### 새 미팅 메모\n${memos.slice(0, 15).map(n => `- ${n.content}`).join("\n")}\n\n`;
      }
    }

    if (driveDocContents.length > 0) {
      prompt += `### Google Drive 문서 (${driveDocContents.length}개)\n`;
      driveDocContents.forEach((d, i) => {
        prompt += `#### 문서 ${i + 1}: ${d.name}\n${d.content}\n\n`;
      });
    }

    if (existingPageTitles.length > 0) {
      prompt += `### 기존 탭 페이지 목록 (제목만)\n`;
      prompt += existingPageTitles.map(t => `- ${t}`).join("\n") + "\n\n";
    }
    if (topics.length > 0) {
      prompt += `### 기존 토픽: ${topics.map(t => t.name).join(", ")}\n\n`;
    }

    prompt += `위 **새 데이터만** 분석하여 탭을 고도화할 통합 결과를 JSON으로 생성해주세요.\n`;
    prompt += `이전에 정리된 내용을 반복하지 마세요. 새로운 지식만 추가하세요.`;

    // ── 4. Call Gemini ──
    step = "call-gemini";
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
        const errBody = await response.text();
        lastError = `HTTP ${response.status}: ${errBody.slice(0, 200)}`;
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
      console.error("Gemini API failed:", lastError);
      return NextResponse.json({ error: `AI 모델 호출 실패: ${lastError}` }, { status: 502 });
    }

    // ── 5. Parse Gemini response ──
    step = "parse-gemini";
    const data = await response.json();

    // Check for prompt feedback blocking
    if (data?.promptFeedback?.blockReason) {
      return NextResponse.json({
        error: `AI가 요청을 차단했습니다: ${data.promptFeedback.blockReason}`,
      }, { status: 502 });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const finishReason = data?.candidates?.[0]?.finishReason || "unknown";

    if (!text) {
      console.error("Gemini empty response:", JSON.stringify(data).slice(0, 1000));
      return NextResponse.json({
        error: `AI가 빈 응답을 반환했습니다. (reason: ${finishReason}, candidates: ${data?.candidates?.length || 0})`,
      }, { status: 502 });
    }

    let result;
    try {
      result = JSON.parse(text);
    } catch (parseErr1) {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[1].trim());
        } catch {
          // Fall through to brace matching
        }
      }
      if (!result) {
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          try {
            result = JSON.parse(braceMatch[0]);
          } catch {
            // Fall through to error
          }
        }
      }
      if (!result) {
        console.error("Failed to parse Gemini JSON:", text.slice(0, 1000));
        return NextResponse.json({
          error: `AI JSON 파싱 실패 (finishReason: ${finishReason}). 응답 미리보기: ${text.slice(0, 200)}`,
        }, { status: 502 });
      }
    }

    // ── 6. Save synthesis log ──
    step = "save-log";
    const weekStartDate = new Date(
      lastSynthesisAt > new Date(0).toISOString() ? lastSynthesisAt : now,
    ).toISOString().split("T")[0];

    const { error: logError } = await supabase.from("wiki_synthesis_logs").insert({
      group_id: groupId,
      week_start: weekStartDate,
      week_end: now.split("T")[0],
      synthesis_type: "weekly_consolidation",
      input_summary: {
        newResourceCount: newResources.length,
        newMeetingCount: newMeetings.length,
        newNoteCount: newNotes.length,
        driveDocsProcessed: driveDocContents.length,
        existingPageCount: existingPageTitles.length,
        lastSynthesisAt,
        isIncremental: !!prevOutput,
      },
      output_data: result,
      created_by: user.id,
    });

    if (logError) {
      // Non-critical: log failed but synthesis result is still valid
      console.warn("Failed to save synthesis log:", logError.message);
    }

    return NextResponse.json({
      ...result,
      _meta: {
        newResourceCount: newResources.length,
        newMeetingCount: newMeetings.length,
        newNoteCount: newNotes.length,
        driveDocsProcessed: driveDocContents.length,
        existingPageCount: existingPageTitles.length,
        isIncremental: !!prevOutput,
        lastSynthesisAt,
      },
    });
  } catch (error: any) {
    console.error(`Wiki synthesis error at step [${step}]:`, error);
    return NextResponse.json(
      { error: `통합 중 오류 발생 (${step}): ${error.message || "알 수 없는 오류"}` },
      { status: 500 },
    );
  }
}
