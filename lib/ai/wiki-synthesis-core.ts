// wiki-synthesis 코어 로직 — route 핸들러와 workflow processor 양쪽에서 공용.
// 인증/rate-limit은 호출자(route)가 담당. 이 함수는 "이미 검증된" 요청을 처리.

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateTextWithFallback } from "./model";

export const WIKI_SYNTHESIS_SYSTEM_PROMPT = `당신은 NutUnion 너트의 **회의록 기반 통합 탭 강화 엔진** AI입니다.

## 핵심 철학
너트(팀)는 하나의 주제로 모인 사람들입니다. 팀의 궁극적 목표는 매주 회의와 토론을 반복하며 **하나의 완성된 통합 문서(탭)**를 만들어가는 것입니다.

## 콘텐츠 작성 원칙
1. **깊이 있는 분석**: 단순 요약이 아니라, 왜 이 결론에 도달했는지를 서술
2. **맥락과 근거**: 모든 주장에 출처를 명시. [회의: 제목], [자료: 제목], [문서: 파일명]
3. **논쟁과 합의 과정**: 팀 내 다른 의견 기록
4. **실행 가능한 결론**
5. **학술적 톤**

반드시 아래 JSON 형식으로만 응답하세요:

{
  "weeklyTheme": "이번 주 회의의 핵심 테마 (한 문장, 학술적 톤)",
  "consolidatedSummary": "이번 주 전체 논의의 맥락과 결론 요약 (500-800자). 출처 표기 필수",
  "wikiPageSuggestions": [
    {
      "title": "챕터 제목",
      "content": "## 배경\\n## 핵심 논의\\n## 결론 및 합의\\n## 향후 과제 구조 (600-1200자). 출처 표기 필수",
      "topicName": "배정할 섹션 이름",
      "action": "create 또는 update",
      "tags": ["태그1", "태그2"],
      "sourceResources": ["참조한 리소스 제목들"],
      "sourceMeetings": ["참조한 회의 제목들"],
      "keyInsight": "이 섹션의 핵심 발견 (2-3문장)"
    }
  ],
  "crossReferences": [
    { "fromPage": "...", "toPage": "...", "linkType": "reference|extends|contradicts|prerequisite", "reason": "..." }
  ],
  "knowledgeGaps": [
    { "topic": "...", "reason": "...", "suggestedAction": "..." }
  ],
  "tabCompletionAssessment": {
    "overallCompleteness": 0,
    "sectionStatuses": [{ "sectionName": "...", "completeness": 0, "missingAspects": [] }],
    "blockers": [],
    "estimatedWeeksToComplete": 0
  },
  "growthMetrics": { "newConceptsIntroduced": 0, "conceptsDeepened": 0, "connectionsDiscovered": 0, "evidenceStrength": "weak|moderate|strong" },
  "nextWeekSuggestions": ["다음 주 회의 주제 3개 (구체적으로)"],
  "compactionNote": "이전 통합 대비 이번 주 핵심 변화 (300자 이내, 출처 포함)"
}

규칙: 유효한 JSON만 출력, 한국어, 학술적 톤, 회의록 우선, 기존 섹션 강화 우선, wikiPageSuggestions 최대 3개, content 600-1200자, 모든 주장에 출처 표기`;

export class WikiSynthesisError extends Error {
  constructor(public code: "config" | "ai" | "parse" | "blocked", public step: string, message: string) {
    super(message);
  }
}

export interface WikiSynthesisOutput extends Record<string, unknown> {
  _meta: {
    newResourceCount: number;
    newMeetingCount: number;
    newNoteCount: number;
    driveDocsProcessed: number;
    existingPageCount: number;
    isIncremental: boolean;
    lastSynthesisAt: string;
  };
}

/**
 * wiki-synthesis 실행.
 * - 인증/권한/rate-limit: 호출자 책임
 * - 이 함수: DB 조회 + Gemini 호출 + 로그 저장 + 결과 반환
 */
export async function runWikiSynthesis(
  supabase: SupabaseClient,
  groupId: string,
  userId: string
): Promise<WikiSynthesisOutput> {
  // model.ts buildChain 이 사용 가능한 provider 가 0개면 throw — 그때 config 에러.
  let step = "init";
  try {
    // ── 1. 마지막 통합 시점 ──
    step = "fetch-prev-synthesis";
    let lastSynthesisAt = new Date(0).toISOString();
    let prevOutput: Record<string, unknown> | null = null;

    const { data: prevArr } = await supabase
      .from("wiki_synthesis_logs")
      .select("created_at, output_data")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (prevArr && prevArr.length > 0) {
      lastSynthesisAt = prevArr[0].created_at;
      prevOutput = prevArr[0].output_data;
    }

    const now = new Date().toISOString();

    // ── 1b. 이전에 AI 분석에 사용된 자료 ID 조회 (전 기간) ──
    step = "fetch-analyzed-inputs";
    const analyzedResourceIds = new Set<string>();
    const analyzedMeetingIds = new Set<string>();
    const analyzedMeetingNoteIds = new Set<string>();
    const analyzedDriveIds = new Set<string>();
    try {
      const { data: inputs } = await supabase
        .from("wiki_synthesis_inputs")
        .select("source_type, source_id")
        .eq("group_id", groupId);
      for (const r of (inputs as { source_type: string; source_id: string }[] | null) ?? []) {
        if (r.source_type === "resource") analyzedResourceIds.add(r.source_id);
        else if (r.source_type === "meeting") analyzedMeetingIds.add(r.source_id);
        else if (r.source_type === "meeting_note") analyzedMeetingNoteIds.add(r.source_id);
        else if (r.source_type === "drive_doc") analyzedDriveIds.add(r.source_id);
      }
    } catch {
      // 065 미적용 — 기존 방식(timestamp만) 으로 fallback
    }

    // ── 2. 새 데이터 조회 — 이미 분석된 자료 제외 ──
    step = "fetch-resources";
    const { data: rawResources } = await supabase
      .from("wiki_weekly_resources")
      .select("id, title, url, resource_type, description, auto_summary, created_at")
      .eq("group_id", groupId)
      .order("created_at");
    const newResources = ((rawResources as { id: string; title: string; url: string; resource_type: string; description?: string; auto_summary?: string; created_at: string }[] | null) ?? [])
      .filter((r) => !analyzedResourceIds.has(r.id));

    step = "fetch-meetings";
    const { data: rawMeetings } = await supabase
      .from("meetings")
      .select("id, title, summary, next_topic, scheduled_at")
      .eq("group_id", groupId)
      .order("scheduled_at");
    const newMeetings = ((rawMeetings as { id: string; title: string; summary?: string; next_topic?: string; scheduled_at: string }[] | null) ?? [])
      .filter((m) => !analyzedMeetingIds.has(m.id));

    step = "fetch-topics";
    const { data: rawTopics } = await supabase
      .from("wiki_topics")
      .select("id, name")
      .eq("group_id", groupId);
    const topics = rawTopics || [];

    step = "fetch-notes";
    const meetingIds = newMeetings.map((m) => m.id);
    let newNotes: { id: string; content: string; type: string; status: string }[] = [];
    if (meetingIds.length > 0) {
      const { data } = await supabase
        .from("meeting_notes")
        .select("id, content, type, status")
        .in("meeting_id", meetingIds);
      newNotes = ((data as typeof newNotes) ?? []).filter((n) => !analyzedMeetingNoteIds.has(n.id));
    }

    step = "fetch-page-titles";
    const topicIds = topics.map((t) => t.id);
    let existingPageTitles: string[] = [];
    if (topicIds.length > 0) {
      const { data } = await supabase.from("wiki_pages").select("title").in("topic_id", topicIds);
      existingPageTitles = ((data as { title: string }[] | null) ?? []).map((p) => p.title);
    }

    // ── 2b. Drive 문서 — 이미 분석된 것 제외 ──
    step = "fetch-drive-files";
    const driveDocContents: { id: string; name: string; content: string }[] = [];
    try {
      const { data: driveFiles } = await supabase
        .from("file_attachments")
        .select("id, file_name, file_url, created_at")
        .eq("target_type", "group")
        .eq("target_id", groupId)
        .eq("file_type", "drive-link")
        .order("created_at", { ascending: false })
        .limit(20);

      const newDriveFiles = ((driveFiles as { id: string; file_name?: string; file_url?: string }[] | null) ?? [])
        .filter((df) => !analyzedDriveIds.has(df.id))
        .slice(0, 10);

      if (newDriveFiles.length > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("google_access_token")
          .eq("id", userId)
          .single();

        if (profile?.google_access_token) {
          for (const df of newDriveFiles) {
            const m = df.file_url?.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
            if (!m) continue;
            try {
              const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${m[1]}`, {
                headers: { Authorization: `Bearer ${profile.google_access_token}` },
              });
              if (!docRes.ok) continue;
              const docData = await docRes.json();
              const content = (docData.body?.content || [])
                .map((block: { paragraph?: { elements?: { textRun?: { content?: string } }[] } }) => {
                  if (block.paragraph) {
                    return (block.paragraph.elements || []).map((el) => el.textRun?.content || "").join("");
                  }
                  return "";
                })
                .join("")
                .trim();
              if (content) {
                driveDocContents.push({ id: df.id, name: df.file_name || "Untitled", content: content.substring(0, 3000) });
              }
            } catch {
              /* skip */
            }
          }
        }
      }
    } catch (driveErr: unknown) {
      console.warn("Drive fetch failed:", driveErr instanceof Error ? driveErr.message : String(driveErr));
    }

    // ── 변경 없으면 조기 반환 ──
    if (newResources.length === 0 && newMeetings.length === 0 && driveDocContents.length === 0) {
      return {
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
          newMeetingCount: 0,
          newNoteCount: 0,
          driveDocsProcessed: 0,
          existingPageCount: existingPageTitles.length,
          isIncremental: !!prevOutput,
          lastSynthesisAt,
        },
      };
    }

    // ── 3. 프롬프트 빌드 ──
    step = "build-prompt";
    let prompt = `## 증분 지식 통합\n\n`;
    prompt += `**마지막 통합**: ${new Date(lastSynthesisAt).toLocaleDateString("ko")}\n`;
    prompt += `**이번 분석 범위**: 그 이후 ~ 현재\n\n`;

    if (prevOutput) {
      const prev = typeof prevOutput === "string" ? JSON.parse(prevOutput) : (prevOutput as { consolidatedSummary?: string; weeklyTheme?: string; compactionNote?: string });
      prompt += `### 이전까지의 지식 요약 (재검토 불필요)\n${prev.consolidatedSummary || prev.weeklyTheme || "첫 통합"}\n`;
      if (prev.compactionNote) prompt += `최근 변화: ${prev.compactionNote}\n`;
      prompt += "\n";
    } else {
      prompt += `### 첫 번째 통합입니다.\n\n`;
    }

    if (newResources.length > 0) {
      prompt += `### 새 리소스 (${newResources.length}건)\n`;
      newResources.forEach((r) => {
        prompt += `- [${r.resource_type}] **${r.title}** — ${r.url}\n`;
        if (r.description) prompt += `  설명: ${r.description}\n`;
        if (r.auto_summary) prompt += `  AI 요약: ${r.auto_summary}\n`;
      });
      prompt += "\n";
    }

    if (newMeetings.length > 0) {
      prompt += `### 새 미팅 (${newMeetings.length}건)\n`;
      newMeetings.forEach((m) => {
        prompt += `- **${m.title}** (${new Date(m.scheduled_at).toLocaleDateString("ko")})\n`;
        if (m.summary) prompt += `  요약: ${m.summary}\n`;
        if (m.next_topic) prompt += `  다음 주제: ${m.next_topic}\n`;
      });
      prompt += "\n";
    }

    if (newNotes.length > 0) {
      const decisions = newNotes.filter((n) => n.type === "decision");
      const actions = newNotes.filter((n) => n.type === "action_item");
      const memos = newNotes.filter((n) => n.type === "note");
      if (decisions.length > 0) prompt += `### 새 결정\n${decisions.map((d) => `- ${d.content}`).join("\n")}\n\n`;
      if (actions.length > 0) prompt += `### 새 액션\n${actions.map((a) => `- ${a.status === "done" ? "✅" : "⬜"} ${a.content}`).join("\n")}\n\n`;
      if (memos.length > 0) prompt += `### 새 메모\n${memos.slice(0, 15).map((n) => `- ${n.content}`).join("\n")}\n\n`;
    }

    if (driveDocContents.length > 0) {
      prompt += `### Google Drive 문서 (${driveDocContents.length}개)\n`;
      driveDocContents.forEach((d, i) => {
        prompt += `#### 문서 ${i + 1}: ${d.name}\n${d.content}\n\n`;
      });
    }

    if (existingPageTitles.length > 0) {
      prompt += `### 기존 탭 페이지 목록\n${existingPageTitles.map((t) => `- ${t}`).join("\n")}\n\n`;
    }
    if (topics.length > 0) {
      prompt += `### 기존 토픽: ${topics.map((t) => t.name).join(", ")}\n\n`;
    }

    prompt += `위 **새 데이터만** 분석하여 통합 문서를 고도화할 결과를 JSON으로 생성하세요. 이전 정리는 반복 금지.\n`;

    // ── 4. AI 호출 — model.ts/vault 자동 fallback chain (Gateway 우선)
    step = "call-ai";
    let aiText = "";
    try {
      const ai = await generateTextWithFallback({
        system: WIKI_SYNTHESIS_SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: 16384,
        tier: "fast",
      });
      aiText = ai.text || "";
    } catch (e: unknown) {
      throw new WikiSynthesisError("ai", step, e instanceof Error ? e.message : "AI 호출 실패");
    }

    // ── 5. 파싱 ──
    step = "parse-ai";
    const text = aiText;
    if (!text) {
      throw new WikiSynthesisError("ai", step, "empty response");
    }

    let result: Record<string, unknown> | null = null;
    try {
      result = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[1].trim());
        } catch { /* fall */ }
      }
      if (!result) {
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          try {
            result = JSON.parse(braceMatch[0]);
          } catch { /* fall */ }
        }
      }
      if (!result) {
        throw new WikiSynthesisError("parse", step, `JSON parse failed: ${text.slice(0, 200)}`);
      }
    }

    // ── 6. 로그 저장 ──
    step = "save-log";
    const weekStartDate = new Date(
      lastSynthesisAt > new Date(0).toISOString() ? lastSynthesisAt : now
    )
      .toISOString()
      .split("T")[0];

    const { data: logRow, error: logError } = await supabase.from("wiki_synthesis_logs").insert({
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
      created_by: userId,
    }).select("id").single();
    if (logError) console.warn("Failed to save synthesis log:", logError.message);

    // ── 6b. 분석에 사용된 자료 ID 기록 ─ 다음 synthesis 에서 제외 ──
    if (logRow?.id) {
      const entries: { source_type: string; source_id: string }[] = [];
      for (const r of newResources) entries.push({ source_type: "resource", source_id: r.id });
      for (const m of newMeetings) entries.push({ source_type: "meeting", source_id: m.id });
      for (const n of newNotes) entries.push({ source_type: "meeting_note", source_id: n.id });
      for (const d of driveDocContents) entries.push({ source_type: "drive_doc", source_id: d.id });

      if (entries.length > 0) {
        try {
          await supabase.rpc("record_wiki_synthesis_inputs", {
            p_synthesis_id: (logRow as { id: string }).id,
            p_group_id: groupId,
            p_entries: entries,
          });
        } catch (err) {
          console.warn("[synthesis] record inputs failed:", err);
        }
      }
    }

    return {
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
    };
  } catch (err) {
    if (err instanceof WikiSynthesisError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new WikiSynthesisError("ai", step, msg);
  }
}
