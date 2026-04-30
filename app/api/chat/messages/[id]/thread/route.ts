/**
 * GET /api/chat/messages/[id]/thread
 *  → returns parent message + replies (oldest → newest).
 *
 * POST not supported here — replies post via /api/chat/rooms/[id]/messages
 * with `parent_message_id` in body.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

const SELECT =
  "id, room_id, sender_id, content, attachment_url, attachment_type, attachment_name, attachment_size, is_system, parent_message_id, thread_reply_count, thread_last_reply_at, mentions, created_at, edited_at, sender:profiles!chat_messages_sender_id_fkey(id, nickname, avatar_url), reactions:chat_reactions(emoji, user_id)";
const SELECT_FALLBACK =
  "id, room_id, sender_id, content, attachment_url, attachment_type, attachment_name, attachment_size, is_system, created_at, edited_at, sender:profiles!chat_messages_sender_id_fkey(id, nickname, avatar_url), reactions:chat_reactions(emoji, user_id)";

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = admin() || supabase;

  let parentRes = await db.from("chat_messages").select(SELECT).eq("id", id).maybeSingle();
  if (parentRes.error && /parent_message_id|thread_reply_count|mentions/i.test(parentRes.error.message)) {
    parentRes = await db.from("chat_messages").select(SELECT_FALLBACK).eq("id", id).maybeSingle();
  }
  if (parentRes.error || !parentRes.data) {
    return NextResponse.json({ error: "parent not found" }, { status: 404 });
  }
  const parent: any = parentRes.data;

  // Membership check via parent.room_id
  const { data: membership } = await db
    .from("chat_members")
    .select("room_id")
    .eq("room_id", parent.room_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "not a member" }, { status: 403 });
  }

  let repliesRes = await db
    .from("chat_messages")
    .select(SELECT)
    .eq("parent_message_id", id)
    .order("created_at", { ascending: true });
  if (repliesRes.error) {
    // 119 미적용 → 빈 배열
    repliesRes = { data: [], error: null } as any;
  }

  return NextResponse.json({ parent, replies: repliesRes.data || [] });
}
