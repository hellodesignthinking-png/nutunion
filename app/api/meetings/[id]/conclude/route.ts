import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { dispatchEvent } from "@/lib/automation/engine";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/meetings/:id/conclude
 * Concludes a meeting:
 *   1) (optional) call /api/ai/meeting-summary if notes/audio provided → generate structured summary
 *   2) save markdown summary to meetings.summary
 *   3) (optional) create Google Doc via /api/google/docs/create (if createDoc=true)
 *   4) set meetings.status = 'completed' + google_doc_url / google_doc_id
 *   5) return { summary, google_doc_url }
 *
 * Body:
 *   {
 *     audioUrl?: string,
 *     audioMimeType?: string,
 *     notes?: string,
 *     agendas?: { topic?: string; description?: string }[],
 *     summaryOverride?: string,   // if already generated (skip AI call)
 *     createDoc?: boolean,        // if true → create Google Doc
 *   }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  // Load meeting + membership check
  const { data: meeting, error: mErr } = await supabase
    .from("meetings")
    .select("id, group_id, title, status, summary, google_doc_url")
    .eq("id", meetingId)
    .maybeSingle();
  if (mErr || !meeting) {
    return NextResponse.json({ error: "회의를 찾을 수 없습니다" }, { status: 404 });
  }

  // Host OR organizer can conclude
  const { data: hostRow } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", meeting.group_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  const isHost = hostRow?.role === "host";
  // organizer check via separate query (could also join)
  const { data: meta } = await supabase
    .from("meetings")
    .select("organizer_id")
    .eq("id", meetingId)
    .single();
  const isOrganizer = meta?.organizer_id === user.id;
  if (!isHost && !isOrganizer) {
    return NextResponse.json({ error: "회의 주최자 또는 호스트만 마감할 수 있습니다" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as any));
  const { audioUrl, audioMimeType, notes, agendas, summaryOverride, createDoc } = body as {
    audioUrl?: string;
    audioMimeType?: string;
    notes?: string;
    agendas?: { topic?: string; description?: string }[];
    summaryOverride?: string;
    createDoc?: boolean;
  };

  // Step 1: get summary
  let summaryMd = summaryOverride?.trim() || "";
  let aiResult: any = null;

  if (!summaryMd && (audioUrl || notes)) {
    // Call AI meeting-summary internally (reuse existing route)
    const origin = req.nextUrl.origin;
    const cookie = req.headers.get("cookie") || "";
    const aiRes = await fetch(`${origin}/api/ai/meeting-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        audioUrl,
        audioMimeType,
        notes,
        agendas,
        meetingTitle: meeting.title,
      }),
    });
    if (!aiRes.ok) {
      const err = await aiRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error || "AI 회의록 생성 실패" },
        { status: 502 }
      );
    }
    aiResult = await aiRes.json();
    summaryMd = formatAiResultToMarkdown(meeting.title, aiResult);
  }

  // Fall back to existing summary if none provided
  if (!summaryMd) summaryMd = meeting.summary || "";

  // Step 2: save to meetings.summary + mark completed (service-role to bypass RLS)
  const writer = adminClient() || supabase;
  const { error: updErr } = await writer
    .from("meetings")
    .update({ status: "completed", summary: summaryMd || null })
    .eq("id", meetingId);
  if (updErr) {
    return NextResponse.json({ error: "회의 마감 실패: " + updErr.message }, { status: 500 });
  }

  // Step 2b: persist structured AI output for the archive timeline.
  // Backward-compatible: if migration 129 hasn't run yet, columns won't exist —
  // catch and continue so the existing flow never breaks.
  if (aiResult) {
    try {
      const nextTopics = Array.isArray(aiResult?.nextTopics)
        ? aiResult.nextTopics
        : Array.isArray(aiResult?.next_topics)
          ? aiResult.next_topics
          : [];
      await writer
        .from("meetings")
        .update({ ai_result: aiResult, next_topics: nextTopics } as any)
        .eq("id", meetingId);
    } catch (e: any) {
    log.error(e, "meetings.id.conclude.failed");
      console.warn("[conclude] ai_result/next_topics 저장 실패 (마이그레이션 129 미실행?)", e?.message);
    }
  }

  // Step 3 (optional): create Google Doc
  let google_doc_url: string | null = meeting.google_doc_url || null;
  let google_doc_id: string | null = null;
  if (createDoc && summaryMd) {
    try {
      const origin = req.nextUrl.origin;
      const cookie = req.headers.get("cookie") || "";
      const docRes = await fetch(`${origin}/api/google/docs/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({
          title: `회의록 - ${meeting.title} (${new Date().toLocaleDateString("ko-KR")})`,
          content: summaryMd,
          targetType: "group",
          targetId: meeting.group_id,
          meetingId,
        }),
      });
      if (docRes.ok) {
        const d = await docRes.json();
        google_doc_url = d.webViewLink || null;
        google_doc_id = d.documentId || null;
        // persist on meetings
        try {
          await writer
            .from("meetings")
            .update({ google_doc_url, google_doc_id } as any)
            .eq("id", meetingId);
        } catch {
          // columns may not exist in very old DB
        }
      } else {
        // Non-fatal: meeting is still concluded
        console.warn("[conclude] Google Docs 생성 실패", await docRes.text());
      }
    } catch (e: any) {
    log.error(e, "meetings.id.conclude.failed");
      console.warn("[conclude] Google Docs 실패 (무시하고 진행)", e?.message);
    }
  }

  // Nut-mation dispatch (non-fatal)
  try {
    await dispatchEvent("meeting.completed", {
      meeting_id: meetingId,
      group_id: meeting.group_id,
      title: meeting.title,
      has_summary: !!summaryMd,
    });
  } catch (e: any) {
    log.error(e, "meetings.id.conclude.failed");
    console.warn("[conclude] automation dispatch failed", e?.message);
  }

  return NextResponse.json({
    success: true,
    summary: summaryMd,
    google_doc_url,
    google_doc_id,
    aiResult,
  });
}

/**
 * Convert AI meeting-summary JSON result into a clean markdown document.
 * Stored in meetings.summary.
 */
function formatAiResultToMarkdown(title: string, r: any): string {
  if (!r) return "";
  const lines: string[] = [];
  lines.push(`# 회의록: ${title}`);
  lines.push("");

  // ── 개요 (Plaud-style metadata strip)
  const overview = r.overview ?? null;
  const attendees: string[] = Array.isArray(overview?.attendees) ? overview.attendees : [];
  const durationMin: number | null = typeof overview?.durationMin === "number" ? overview.durationMin : null;
  const date: string | null = typeof overview?.date === "string" ? overview.date : null;
  const gist: string = (overview?.gist || r.summary || "").toString();

  if (gist || attendees.length || durationMin || date) {
    lines.push(`## 개요`);
    const meta: string[] = [];
    if (date) meta.push(`**일시:** ${date}`);
    if (durationMin) meta.push(`**길이:** ${durationMin}분`);
    if (attendees.length) meta.push(`**참석자:** ${attendees.join(", ")}`);
    if (meta.length) {
      lines.push(meta.join(" · "));
      lines.push("");
    }
    if (gist) {
      lines.push(gist);
      lines.push("");
    }
  }

  // ── 주제별 논의
  const topics = Array.isArray(r.topics) ? r.topics : [];
  if (topics.length) {
    lines.push(`## 주제별 논의`);
    lines.push("");
    topics.forEach((t: any) => {
      lines.push(`### ${t.title || "주제"}`);
      const points: string[] = Array.isArray(t.points) ? t.points : [];
      points.forEach((p: string) => lines.push(`- ${p}`));
      const quotes: any[] = Array.isArray(t.quotes) ? t.quotes : [];
      if (quotes.length) {
        lines.push("");
        quotes.forEach((q: any) => {
          const ts = q.timestamp ? `\`[${q.timestamp}]\` ` : "";
          lines.push(`> ${ts}**${q.speaker || "화자"}:** ${q.text}`);
        });
      }
      lines.push("");
    });
  } else if (Array.isArray(r.discussions) && r.discussions.length) {
    // 구버전 호환
    lines.push(`## 논의 사항`);
    r.discussions.forEach((d: string) => lines.push(`- ${d}`));
    lines.push("");
  }

  // ── 결정 사항
  if (Array.isArray(r.decisions) && r.decisions.length) {
    lines.push(`## 결정 사항`);
    r.decisions.forEach((d: string) => lines.push(`> ✅ ${d}`));
    lines.push("");
  }

  // ── 액션 아이템 (table)
  if (Array.isArray(r.actionItems) && r.actionItems.length) {
    lines.push(`## 액션 아이템`);
    lines.push("");
    lines.push(`| 담당자 | 할 일 | 마감 | 우선순위 |`);
    lines.push(`| --- | --- | --- | --- |`);
    r.actionItems.forEach((a: any) => {
      const who = a.assignee || "-";
      const task = (a.task || a.content || "").replace(/\|/g, "\\|");
      const due = a.dueDate || "-";
      const pr = a.priority === "high" ? "🔴 높음" : a.priority === "low" ? "🟢 낮음" : "🟡 보통";
      lines.push(`| ${who} | ${task} | ${due} | ${pr} |`);
    });
    lines.push("");
  }

  // ── 주요 발언
  const quotes: any[] = Array.isArray(r.quotes) ? r.quotes : [];
  if (quotes.length) {
    lines.push(`## 주요 발언`);
    lines.push("");
    quotes.forEach((q: any) => {
      const ts = q.timestamp ? `\`[${q.timestamp}]\` ` : "";
      lines.push(`> ${ts}**${q.speaker || "화자"}:** ${q.text}`);
      lines.push("");
    });
  }

  // ── 참여자별 요약
  const speakers: any[] = Array.isArray(r.speakers) ? r.speakers : [];
  if (speakers.length) {
    lines.push(`## 참여자별 요약`);
    speakers.forEach((s: any) => {
      lines.push(`- **${s.label}** — ${s.summary || ""}`);
    });
    lines.push("");
  }

  // ── 후속 질문
  if (Array.isArray(r.openQuestions) && r.openQuestions.length) {
    lines.push(`## 후속 질문`);
    r.openQuestions.forEach((q: string) => lines.push(`- ❓ ${q}`));
    lines.push("");
  }

  // ── 다음 미팅 주제
  if (Array.isArray(r.nextTopics) && r.nextTopics.length) {
    lines.push(`## 다음 미팅 주제`);
    r.nextTopics.forEach((t: string) => lines.push(`- ${t}`));
    lines.push("");
  }

  // ── 성장 인사이트
  if (Array.isArray(r.growthInsights) && r.growthInsights.length) {
    lines.push(`## 성장 인사이트`);
    r.growthInsights.forEach((t: string) => lines.push(`- 🌱 ${t}`));
    lines.push("");
  }

  // ── 전체 트랜스크립트 (collapsible)
  const transcript: any[] = Array.isArray(r.transcript) ? r.transcript : [];
  if (transcript.length) {
    lines.push(`<details>`);
    lines.push(`<summary>📝 전체 트랜스크립트 (${transcript.length}개 발화)</summary>`);
    lines.push("");
    transcript.forEach((t: any) => {
      const ts = t.timestamp ? `\`[${t.timestamp}]\` ` : "";
      lines.push(`${ts}**${t.speaker || "화자"}:** ${t.text}`);
      lines.push("");
    });
    lines.push(`</details>`);
    lines.push("");
  }

  return lines.join("\n").trim();
}
