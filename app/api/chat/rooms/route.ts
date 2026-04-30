import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** service_role 어드민 클라이언트 (RLS 우회 — DM 중복 체크용) */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/chat/rooms — 내가 멤버인 모든 방 + last message preview + unread count
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 내가 멤버인 방 조회 (chat_members 기준)
  const { data: memberships, error } = await supabase
    .from("chat_members")
    .select("room_id, last_read_at")
    .eq("user_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const roomIds = (memberships || []).map((m: any) => m.room_id);
  if (roomIds.length === 0) return NextResponse.json({ rooms: [] });

  // 방 메타 + 연결 객체 (너트/볼트) 정보
  const { data: rooms } = await supabase
    .from("chat_rooms")
    .select(
      "id, type, name, group_id, project_id, last_message_at, group:groups(id, name, image_url), project:projects(id, title, image_url)",
    )
    .in("id", roomIds)
    .order("last_message_at", { ascending: false });

  // === 최적화: N+1 제거 — 배치 3개 쿼리로 한번에 ===
  // Build the membership map by id (not array index — that broke when the
  // membership / roomIds arrays got reordered downstream).
  const roomMap = new Map<string, { room_id: string; last_read_at: string | null }>();
  for (const m of ((memberships || []) as any[])) {
    roomMap.set(m.room_id, m);
  }

  // 1) 모든 방의 최근 메시지 100개를 한번에 가져와 방별 최신 1개 추림
  //    (대부분 방이 10개 미만이므로 각 방의 최근 ~10 메시지 정도면 충분)
  const [lastMsgsRes, dmMembersRes] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("id, room_id, content, sender_id, attachment_type, is_system, created_at")
      .in("room_id", roomIds)
      .order("created_at", { ascending: false })
      .limit(Math.max(100, roomIds.length * 3)),
    // DM 방들의 상대방
    supabase
      .from("chat_members")
      .select("room_id, user_id, user:profiles(id, nickname, avatar_url)")
      .in(
        "room_id",
        ((rooms as any[]) || []).filter((r) => r.type === "dm").map((r) => r.id),
      )
      .neq("user_id", auth.user.id),
  ]);

  // 방별 최근 메시지 맵
  const lastByRoom = new Map<string, any>();
  for (const m of (lastMsgsRes.data as any[]) || []) {
    if (!lastByRoom.has(m.room_id)) lastByRoom.set(m.room_id, m);
  }

  // DM 상대방 맵
  const dmPeerByRoom = new Map<string, any>();
  for (const row of (dmMembersRes.data as any[]) || []) {
    dmPeerByRoom.set(row.room_id, row.user);
  }

  // 2) 방별 unread count 는 일괄로 — 한번만
  //    (방별 last_read_at 다르므로 SQL 하나로 하려면 RPC 필요. 임시로 각 방의 총 메시지 수만 가져와 계산 skip
  //     대신 더 가벼운 방식: chat_messages 에서 created_at > me.last_read_at 총 카운트를 room 별로)
  //    현재 스키마 제약상 loop 는 최소화 — unread 는 단순히 "내 last_read_at 이후 메시지" count
  //    그러나 요청별 쿼리를 안 늘리려면 client 에서 lastByRoom 대비 내 last_read_at 과 비교

  // 임시 근사: 방별 최근 1개 메시지만 가지고 unread 를 0 or 1 로만 표시 (클릭 시 실제값 로드)
  const enriched = ((rooms as any[]) || []).map((r) => {
    const last = lastByRoom.get(r.id) || null;
    const lastRead = (roomMap.get(r.id) as any)?.last_read_at;
    const isUnread =
      last && last.sender_id !== auth.user.id && (!lastRead || new Date(last.created_at) > new Date(lastRead));
    return {
      ...r,
      last_message: last,
      unread_count: isUnread ? 1 : 0, // 근사값 — 방 클릭 시 정확한 값으로 갱신됨
      dm_peer: r.type === "dm" ? dmPeerByRoom.get(r.id) || null : null,
    };
  });

  return NextResponse.json({ rooms: enriched });
}

/**
 * POST /api/chat/rooms — DM 시작 or 너트/볼트 방 ensure
 * Body: { dm_target?: userId, group_id?: id, project_id?: id }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { dm_target, group_id, project_id } = body;

  let roomId: string | null = null;
  if (dm_target) {
    // P2-13: 자기 자신 DM 차단
    if (dm_target === auth.user.id) {
      return NextResponse.json({ error: "자기 자신과는 DM 을 시작할 수 없어요" }, { status: 400 });
    }

    // P2-13: 기존 DM 방 먼저 확인 (중복 방 생성 방지)
    // 두 사용자 모두 멤버인 type='dm' 방이 있으면 재사용
    const admin = getAdminClient();
    if (admin) {
      const { data: myDmMemberships } = await admin
        .from("chat_members")
        .select("room_id, chat_rooms!inner(type)")
        .eq("user_id", auth.user.id);
      const myDmRoomIds = ((myDmMemberships as any[]) || [])
        .filter((r) => r.chat_rooms?.type === "dm")
        .map((r) => r.room_id);

      if (myDmRoomIds.length > 0) {
        const { data: peerInSame } = await admin
          .from("chat_members")
          .select("room_id")
          .eq("user_id", dm_target)
          .in("room_id", myDmRoomIds)
          .limit(1)
          .maybeSingle();
        if ((peerInSame as any)?.room_id) {
          return NextResponse.json({ room_id: (peerInSame as any).room_id, reused: true });
        }
      }
    }

    // 기존 방 없음 → RPC 로 생성
    const { data, error } = await supabase.rpc("get_or_create_dm_room", { p_other_user: dm_target });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    roomId = data as string;
  } else if (group_id) {
    const { data, error } = await supabase.rpc("ensure_group_room", { p_group_id: group_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    roomId = data as string;
  } else if (project_id) {
    const { data, error } = await supabase.rpc("ensure_project_room", { p_project_id: project_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    roomId = data as string;
  } else {
    return NextResponse.json({ error: "dm_target, group_id, 또는 project_id 필요" }, { status: 400 });
  }

  return NextResponse.json({ room_id: roomId });
}
