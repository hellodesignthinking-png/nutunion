import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KINDS = ["birthday","anniversary","founding_day","memorial","milestone","note"] as const;

/**
 * POST /api/people/parse/commit
 * body: { person_id?: string, new_person_name?: string, events: [...], notes: string[] }
 */
export const POST = withRouteLog("people.parse.commit", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad body" }, { status: 400 });

  let personId: string | null = body.person_id || null;

  // 새 사람 생성
  if (!personId && body.new_person_name?.trim()) {
    const { data: newP, error: cErr } = await supabase
      .from("people")
      .insert({
        owner_id: auth.user.id,
        display_name: body.new_person_name.trim(),
        role_hint: body.new_person_role_hint || null,
        kakao_id: body.new_person_kakao_id || null,
      })
      .select("id")
      .single();
    if (cErr || !newP) {
      log.error(cErr, "people.parse.commit.create_person_failed", { user_id: auth.user.id });
      return NextResponse.json({ error: cErr?.message || "create_failed" }, { status: 500 });
    }
    personId = newP.id;
  }

  if (!personId) return NextResponse.json({ error: "person_id or new_person_name required" }, { status: 400 });

  // 소유권 확인
  const { data: owns } = await supabase.from("people").select("id").eq("id", personId).eq("owner_id", auth.user.id).maybeSingle();
  if (!owns) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const events = Array.isArray(body.events) ? body.events : [];
  const notes = Array.isArray(body.notes) ? body.notes : [];

  const insertedEvents: any[] = [];
  for (const ev of events) {
    if (!ev?.kind || !ALLOWED_KINDS.includes(ev.kind)) continue;
    if (!ev?.title || !ev?.event_date) continue;
    const { data: row } = await supabase
      .from("person_events")
      .insert({
        person_id: personId,
        owner_id: auth.user.id,
        kind: ev.kind,
        title: String(ev.title).slice(0, 200),
        event_date: ev.event_date,
        recurring: true,
        detail: ev.detail ? String(ev.detail).slice(0, 500) : null,
        source: "kakao_parse",
      })
      .select()
      .single();
    if (row) insertedEvents.push(row);
  }

  const insertedNotes: any[] = [];
  for (const note of notes) {
    if (typeof note !== "string" || !note.trim()) continue;
    const { data: row } = await supabase
      .from("person_context_notes")
      .insert({
        person_id: personId,
        owner_id: auth.user.id,
        note: note.trim().slice(0, 500),
        extracted_from: "chat_log",
        ttl_days: 180,
      })
      .select()
      .single();
    if (row) insertedNotes.push(row);
  }

  return NextResponse.json({
    person_id: personId,
    events_saved: insertedEvents.length,
    notes_saved: insertedNotes.length,
  });
});
