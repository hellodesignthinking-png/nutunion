/**
 * PATCH  /api/chat/messages/[id] — 메시지 수정 (본인만)
 * DELETE /api/chat/messages/[id] — 메시지 삭제 (본인만)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const content = (body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });

  const { data, error } = await supabase
    .from("chat_messages")
    .update({ content, edited_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sender_id", auth.user.id)
    .select("id, content, edited_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found or not your message" }, { status: 404 });
  return NextResponse.json({ message: data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("id", id)
    .eq("sender_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
