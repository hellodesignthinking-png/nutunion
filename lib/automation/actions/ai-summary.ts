/**
 * Action: ai_summary — trigger AI meeting summary generation.
 * Called from meeting.completed event. The conclude route typically already
 * generates a summary, so this handler is a no-op fallback that records
 * the meeting id for traceability.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = {
  admin: SupabaseClient;
  rule: any;
  payload: any;
  params: Record<string, any>;
};

export default async function aiSummary({ admin, payload, params }: Ctx) {
  const meetingId = payload?.meeting_id || payload?.meetingId;
  if (!meetingId) return { skipped: true, reason: "no meeting_id" };

  const { data: meeting } = await admin
    .from("meetings")
    .select("id, title, summary, group_id")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting) return { skipped: true, reason: "meeting not found" };

  return {
    meeting_id: meetingId,
    has_summary: !!meeting.summary,
    save_to_wiki: !!params.save_to_wiki,
  };
}
