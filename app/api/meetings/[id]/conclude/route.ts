import { NextRequest, NextResponse } from "next/server";
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
  if (r.summary) {
    lines.push(`## 요약`);
    lines.push(String(r.summary));
    lines.push("");
  }
  if (Array.isArray(r.discussions) && r.discussions.length) {
    lines.push(`## 논의 사항`);
    r.discussions.forEach((d: string) => lines.push(`- ${d}`));
    lines.push("");
  }
  if (Array.isArray(r.decisions) && r.decisions.length) {
    lines.push(`## 결정 사항`);
    r.decisions.forEach((d: string) => lines.push(`- ${d}`));
    lines.push("");
  }
  if (Array.isArray(r.actionItems) && r.actionItems.length) {
    lines.push(`## 액션 아이템`);
    r.actionItems.forEach((a: any) => {
      const who = a.assignee ? ` (담당: ${a.assignee})` : "";
      lines.push(`- [ ] ${a.task || a.content || ""}${who}`);
    });
    lines.push("");
  }
  if (Array.isArray(r.nextTopics) && r.nextTopics.length) {
    lines.push(`## 다음 미팅 주제`);
    r.nextTopics.forEach((t: string) => lines.push(`- ${t}`));
    lines.push("");
  }
  if (Array.isArray(r.growthInsights) && r.growthInsights.length) {
    lines.push(`## 성장 인사이트`);
    r.growthInsights.forEach((t: string) => lines.push(`- ${t}`));
    lines.push("");
  }
  return lines.join("\n").trim();
}
