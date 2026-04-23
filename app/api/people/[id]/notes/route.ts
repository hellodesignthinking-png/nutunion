import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("person_context_notes")
    .select("*")
    .eq("person_id", id)
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.note?.trim()) return NextResponse.json({ error: "note required" }, { status: 400 });

  const { data, error } = await supabase
    .from("person_context_notes")
    .insert({
      person_id: id,
      owner_id: auth.user.id,
      note: body.note.trim(),
      extracted_from: body.extracted_from || "manual",
      ttl_days: Number.isFinite(body.ttl_days) ? body.ttl_days : 180,
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

  const noteId = new URL(req.url).searchParams.get("note_id");
  if (!noteId) return NextResponse.json({ error: "note_id required" }, { status: 400 });

  const { error } = await supabase
    .from("person_context_notes")
    .delete()
    .eq("id", noteId)
    .eq("person_id", id)
    .eq("owner_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
