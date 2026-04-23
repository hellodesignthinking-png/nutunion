/**
 * POST   /api/chat/messages/[id]/react — 리액션 추가/토글
 * DELETE /api/chat/messages/[id]/react?emoji=❤️ — 리액션 제거
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id: messageId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const emoji: string = (body.emoji || "❤️").slice(0, 16);

  // upsert (동일 (message, user, emoji) 이미 있으면 제거 = 토글)
  const { data: existing } = await supabase
    .from("chat_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", auth.user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from("chat_reactions").delete().eq("id", (existing as any).id);
    return NextResponse.json({ toggled: "removed" });
  }

  const { error } = await supabase
    .from("chat_reactions")
    .insert({ message_id: messageId, user_id: auth.user.id, emoji });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ toggled: "added" });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id: messageId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const emoji = new URL(req.url).searchParams.get("emoji") || "❤️";
  await supabase
    .from("chat_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", auth.user.id)
    .eq("emoji", emoji);
  return NextResponse.json({ ok: true });
}
