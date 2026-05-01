/**
 * POST /api/chat/system-message
 *
 * 특정 너트/볼트의 채팅방에 is_system 메시지 삽입. service_role 로 RLS 우회.
 *
 * Body:
 *  - group_id? / project_id? — 방 결정
 *  - content: string (ACTION 프리픽스 포함 가능)
 *  - ensure_room?: boolean — 방 없으면 ensure_group_room RPC 호출 (기본 true)
 */

import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export const POST = withRouteLog("chat.system-message", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.content) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  if (!body.group_id && !body.project_id) {
    return NextResponse.json({ error: "group_id or project_id required" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "service_role 미설정" }, { status: 501 });

  // 1) 방 찾기 또는 ensure
  let roomId: string | null = null;
  if (body.group_id) {
    const { data: room } = await admin
      .from("chat_rooms")
      .select("id")
      .eq("type", "nut")
      .eq("group_id", body.group_id)
      .maybeSingle();
    roomId = (room as any)?.id || null;
    if (!roomId && body.ensure_room !== false) {
      const rpc = await admin.rpc("ensure_group_room", { p_group_id: body.group_id });
      if (!rpc.error) roomId = rpc.data as string;
    }
  } else if (body.project_id) {
    const { data: room } = await admin
      .from("chat_rooms")
      .select("id")
      .eq("type", "bolt")
      .eq("project_id", body.project_id)
      .maybeSingle();
    roomId = (room as any)?.id || null;
    if (!roomId && body.ensure_room !== false) {
      const rpc = await admin.rpc("ensure_project_room", { p_project_id: body.project_id });
      if (!rpc.error) roomId = rpc.data as string;
    }
  }

  if (!roomId) {
    return NextResponse.json({ error: "방을 찾지 못했습니다" }, { status: 404 });
  }

  // 2) is_system 메시지 삽입 (호출자 ID 로, 단 is_system = true)
  const { data, error } = await admin
    .from("chat_messages")
    .insert({
      room_id: roomId,
      sender_id: auth.user.id,
      content: body.content,
      is_system: true,
    })
    .select("id, room_id, created_at")
    .maybeSingle();

  if (error) {
    console.error("[chat system-message]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    room_id: roomId,
    message_id: (data as any)?.id,
  });
});
