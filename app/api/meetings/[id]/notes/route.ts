import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/meetings/:id/notes
 * Saves live meeting notes (auto-save during in_progress).
 *
 * Tries meetings.notes first (migration 110). Falls back to meeting_notes
 * single-row upsert (type='live', content=notes) when the column is missing.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: meetingId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const notes = typeof body?.notes === "string" ? body.notes : "";

  // Permission check — any active group member of the meeting's group can take notes
  const { data: meeting } = await supabase
    .from("meetings")
    .select("group_id, organizer_id")
    .eq("id", meetingId)
    .maybeSingle();
  if (!meeting) return NextResponse.json({ error: "회의를 찾을 수 없음" }, { status: 404 });

  const { data: membership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", meeting.group_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership && meeting.organizer_id !== user.id) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  // Try meetings.notes column first
  const { error: upErr } = await supabase
    .from("meetings")
    .update({ notes } as any)
    .eq("id", meetingId);

  if (upErr && /notes/.test(upErr.message)) {
    // Fallback: UPSERT into meeting_notes table as a single "live" row per meeting.
    // We do a lookup-and-update to avoid relying on a unique index on (meeting_id, type).
    const { data: existing } = await supabase
      .from("meeting_notes")
      .select("id")
      .eq("meeting_id", meetingId)
      .eq("type", "live")
      .maybeSingle();

    if (existing?.id) {
      await supabase.from("meeting_notes").update({ content: notes }).eq("id", existing.id);
    } else {
      await supabase.from("meeting_notes").insert({
        meeting_id: meetingId,
        type: "live",
        content: notes,
        created_by: user.id,
      });
    }
  } else if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
