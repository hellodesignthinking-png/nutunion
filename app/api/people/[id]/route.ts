import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRouteLog("people.id.get", async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [personRes, eventsRes, notesRes] = await Promise.all([
    supabase.from("people").select("*").eq("id", id).eq("owner_id", auth.user.id).maybeSingle(),
    supabase.from("person_events").select("*").eq("person_id", id).eq("owner_id", auth.user.id).order("event_date", { ascending: true }),
    supabase.from("person_context_notes").select("*").eq("person_id", id).eq("owner_id", auth.user.id).order("created_at", { ascending: false }),
  ]);
  if (personRes.error) return NextResponse.json({ error: personRes.error.message }, { status: 500 });
  if (!personRes.data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    person: personRes.data,
    events: eventsRes.data || [],
    notes: notesRes.data || [],
  });
});

export const PATCH = withRouteLog("people.id.patch", async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "bad body" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  const allowed = ["display_name","role_hint","company","phone","email","kakao_id","relationship","importance","notes","tags","avatar_url","last_contact_at","linked_profile_id"] as const;
  for (const k of allowed) if (k in body) patch[k] = body[k];
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "empty patch" }, { status: 400 });

  const { data, error } = await supabase
    .from("people")
    .update(patch)
    .eq("id", id)
    .eq("owner_id", auth.user.id)
    .select()
    .single();
  if (error) {
    log.error(error, "people.update.failed", { user_id: auth.user.id, id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ row: data });
});

export const DELETE = withRouteLog("people.id.delete", async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase.from("people").delete().eq("id", id).eq("owner_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
