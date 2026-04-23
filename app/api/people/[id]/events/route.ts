import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KINDS = ["birthday","anniversary","founding_day","memorial","milestone","note"] as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("person_events")
    .select("*")
    .eq("person_id", id)
    .eq("owner_id", auth.user.id)
    .order("event_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.kind || !ALLOWED_KINDS.includes(body.kind)) {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }
  if (!body?.title?.trim() || !body?.event_date) {
    return NextResponse.json({ error: "title + event_date required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("person_events")
    .insert({
      person_id: id,
      owner_id: auth.user.id,
      kind: body.kind,
      title: body.title.trim(),
      event_date: body.event_date,
      lunar: !!body.lunar,
      recurring: body.recurring !== false,
      detail: body.detail || null,
      source: body.source || "manual",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const eventId = new URL(req.url).searchParams.get("event_id");
  if (!eventId) return NextResponse.json({ error: "event_id required" }, { status: 400 });

  const { error } = await supabase
    .from("person_events")
    .delete()
    .eq("id", eventId)
    .eq("person_id", id)
    .eq("owner_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
