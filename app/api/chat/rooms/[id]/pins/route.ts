/**
 * GET  /api/chat/rooms/[id]/pins — 방 고정 메시지 목록 (최신순, 최대 10개)
 * POST /api/chat/rooms/[id]/pins  body: { message_id }
 * DELETE /api/chat/rooms/[id]/pins?message_id=...
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

async function assertMember(db: any, roomId: string, userId: string): Promise<boolean> {
  const { data } = await db
    .from("chat_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export const GET = withRouteLog("chat.rooms.id.pins.get", async (_req: NextRequest, { params }: Ctx) => {
  const { id: roomId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ pins: [] });

  const db = getAdmin() || supabase;
  if (!(await assertMember(db, roomId, auth.user.id))) {
    return NextResponse.json({ error: "not a member" }, { status: 403 });
  }

  // 1차: join 포함 시도
  let { data, error } = await db
    .from("chat_pins")
    .select(`
      id, message_id, pinned_at,
      message:chat_messages(id, content, is_system, created_at, sender:profiles!chat_messages_sender_id_fkey(id, nickname))
    `)
    .eq("room_id", roomId)
    .order("pinned_at", { ascending: false })
    .limit(10);

  // 2차: join 실패(FK/RLS) 시 단순 조회 fallback
  if (error) {
    if (/relation.*chat_pins.*does not exist|PGRST205/.test(error.message)) {
      return NextResponse.json({ pins: [], migration_pending: true });
    }
    // 메시지 join 이 문제면 기본 select 만 재시도
    const retry = await db
      .from("chat_pins")
      .select("id, message_id, pinned_at")
      .eq("room_id", roomId)
      .order("pinned_at", { ascending: false })
      .limit(10);
    if (retry.error) {
      // pins 는 핵심 기능 X — 실패해도 빈 배열로 응답 (채팅방 전체 마비 방지)
      console.warn("[pins GET] fallback failed:", retry.error.message);
      return NextResponse.json({ pins: [], error: retry.error.message, degraded: true });
    }
    data = retry.data as any;
  }

  return NextResponse.json({ pins: data || [] });
});

export const POST = withRouteLog("chat.rooms.id.pins.post", async (req: NextRequest, { params }: Ctx) => {
  const { id: roomId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const messageId = body?.message_id;
  if (!messageId) return NextResponse.json({ error: "message_id 필요" }, { status: 400 });

  const db = getAdmin() || supabase;
  if (!(await assertMember(db, roomId, auth.user.id))) {
    return NextResponse.json({ error: "방 멤버만 고정할 수 있어요" }, { status: 403 });
  }

  const { data, error } = await db
    .from("chat_pins")
    .upsert(
      { room_id: roomId, message_id: messageId, pinned_by: auth.user.id },
      { onConflict: "room_id,message_id" },
    )
    .select("id, message_id, pinned_at")
    .maybeSingle();

  if (error) {
    if (/relation.*chat_pins.*does not exist|PGRST205/.test(error.message)) {
      return NextResponse.json({ error: "MIGRATION_PENDING" }, { status: 501 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ pin: data });
});

export const DELETE = withRouteLog("chat.rooms.id.pins.delete", async (req: NextRequest, { params }: Ctx) => {
  const { id: roomId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const messageId = url.searchParams.get("message_id");
  if (!messageId) return NextResponse.json({ error: "message_id 필요" }, { status: 400 });

  const db = getAdmin() || supabase;
  if (!(await assertMember(db, roomId, auth.user.id))) {
    return NextResponse.json({ error: "방 멤버만 해제할 수 있어요" }, { status: 403 });
  }

  const { error } = await db
    .from("chat_pins")
    .delete()
    .eq("room_id", roomId)
    .eq("message_id", messageId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
