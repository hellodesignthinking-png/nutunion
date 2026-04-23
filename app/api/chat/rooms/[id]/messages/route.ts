import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { dispatchEvent } from "@/lib/automation/engine";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** RLS 우회 — chat_members/messages 재귀 버그 회피용 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/chat/rooms/[id]/messages?before=ISO&limit=50
 *  — 최신부터 N개 (역순), before 가 있으면 그 이전
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS 재귀 버그 회피 — admin 클라이언트로 쿼리 (권한은 상단 auth 체크로 이미 검증)
  const admin = getAdminClient();
  const db = admin || supabase;

  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const limit = Math.min(100, Number(url.searchParams.get("limit") || "50"));

  // 권한 체크 + 메시지 + 전체 멤버 병렬 쿼리 (3-way parallel)
  let q = db
    .from("chat_messages")
    .select(
      "id, room_id, sender_id, content, attachment_url, attachment_type, attachment_name, attachment_size, is_system, auto_indexed_as, linked_resource_id, reply_to, created_at, edited_at, sender:profiles(id, nickname, avatar_url), reactions:chat_reactions(emoji, user_id)",
    )
    .eq("room_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);

  const [membershipRes, msgRes, membersRes] = await Promise.all([
    db
      .from("chat_members")
      .select("room_id")
      .eq("room_id", id)
      .eq("user_id", auth.user.id)
      .maybeSingle(),
    q,
    db.from("chat_members").select("user_id, last_read_at").eq("room_id", id),
  ]);

  if (!membershipRes.data) {
    return NextResponse.json({ error: "방 멤버가 아니거나 방이 존재하지 않습니다" }, { status: 403 });
  }

  const { data, error } = msgRes;
  if (error) {
    console.error("[chat messages GET]", error);
    return NextResponse.json({ error: error.message, hint: error.code === "42P17" ? "RLS 재귀 — is_chat_member SECURITY DEFINER 필요" : undefined }, { status: 500 });
  }

  const membersRaw = membersRes.data;
  const members = (membersRaw as any[]) || [];
  const totalMembers = members.length;

  // P2-12: 멤버 read 정보 pre-parse (ms timestamp + user_id)
  // 이전: Map.iteration × 매 메시지마다 Date 재생성 (O(n*m*date_parse))
  // 개선: number 비교만 (O(n*m))
  const memberReads = members.map((mem: any) => ({
    user_id: mem.user_id as string,
    last_read_ms: mem.last_read_at ? new Date(mem.last_read_at).getTime() : 0,
  }));

  const enriched = (data || []).map((m: any) => {
    const createdMs = new Date(m.created_at).getTime();
    let readCount = 0;
    for (const r of memberReads) {
      if (r.user_id === m.sender_id || r.last_read_ms >= createdMs) readCount++;
    }
    return {
      ...m,
      unread_count: Math.max(0, totalMembers - readCount),
      total_members: totalMembers,
    };
  });

  // last_read_at 갱신 (본인)
  await db
    .from("chat_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("room_id", id)
    .eq("user_id", auth.user.id);

  return NextResponse.json({ messages: enriched.reverse() });
}

/**
 * POST /api/chat/rooms/[id]/messages
 *  Body: { content?, attachment_url?, attachment_type?, attachment_name?, attachment_size?, reply_to? }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS 우회 — 권한은 membership 체크로 보장
  const admin = getAdminClient();
  const db = admin || supabase;

  // 방 멤버 확인 — 없으면 자동 등록 시도 (그룹/볼트 멤버인 경우)
  let { data: membership } = await db
    .from("chat_members")
    .select("room_id")
    .eq("room_id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!membership) {
    // 방 맥락 로드 (type + group_id / project_id)
    const { data: room } = await db
      .from("chat_rooms")
      .select("type, group_id, project_id")
      .eq("id", id)
      .maybeSingle();
    if (room) {
      let canJoin = false;
      if ((room as any).group_id) {
        // 그룹의 active 멤버 또는 host 면 join 가능
        const [{ data: g }, { data: gm }] = await Promise.all([
          db.from("groups").select("host_id").eq("id", (room as any).group_id).maybeSingle(),
          db
            .from("group_members")
            .select("status")
            .eq("group_id", (room as any).group_id)
            .eq("user_id", auth.user.id)
            .maybeSingle(),
        ]);
        canJoin =
          (g as any)?.host_id === auth.user.id ||
          (gm as any)?.status === "active";
      } else if ((room as any).project_id) {
        // 프로젝트 멤버 또는 created_by 면 join
        const [{ data: p }, { data: pm }] = await Promise.all([
          db.from("projects").select("created_by").eq("id", (room as any).project_id).maybeSingle(),
          db
            .from("project_members")
            .select("role")
            .eq("project_id", (room as any).project_id)
            .eq("user_id", auth.user.id)
            .maybeSingle(),
        ]);
        canJoin = (p as any)?.created_by === auth.user.id || !!pm;
      }

      if (canJoin) {
        // chat_members 에 upsert — 트리거 누락/지연 대응
        await db
          .from("chat_members")
          .upsert(
            { room_id: id, user_id: auth.user.id },
            { onConflict: "room_id,user_id" },
          );
        // 재확인
        const retry = await db
          .from("chat_members")
          .select("room_id")
          .eq("room_id", id)
          .eq("user_id", auth.user.id)
          .maybeSingle();
        membership = retry.data;
      }
    }
  }

  if (!membership) {
    return NextResponse.json(
      { error: "방 멤버가 아니거나 방이 존재하지 않습니다", hint: "그룹/볼트에 먼저 가입해주세요" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  if (!body.content?.trim() && !body.attachment_url) {
    return NextResponse.json({ error: "content or attachment required" }, { status: 400 });
  }

  // 1) 완전한 payload (migration 088 적용 환경)
  const fullPayload: any = {
    room_id: id,
    sender_id: auth.user.id,
    content: body.content?.trim() || null,
    attachment_url: body.attachment_url || null,
    attachment_type: body.attachment_type || null,
    attachment_name: body.attachment_name || null,
    attachment_size: body.attachment_size || null,
    reply_to: body.reply_to || null,
  };

  let result = await db
    .from("chat_messages")
    .insert(fullPayload)
    .select(
      "id, room_id, sender_id, content, attachment_url, attachment_type, attachment_name, is_system, created_at, sender:profiles(id, nickname, avatar_url)",
    )
    .single();

  // 2) 스키마 캐시 미반영 환경 fallback — 문제되는 컬럼 drop 후 재시도
  if (result.error && /attachment_|reply_to/i.test(result.error.message)) {
    const minimal: any = {
      room_id: id,
      sender_id: auth.user.id,
      content: body.content?.trim() || null,
    };
    if (body.attachment_url) {
      minimal.attachment_url = body.attachment_url;
      minimal.attachment_type = body.attachment_type || null;
    }
    result = await db
      .from("chat_messages")
      .insert(minimal)
      .select(
        "id, room_id, sender_id, content, attachment_url, attachment_type, is_system, created_at, sender:profiles(id, nickname, avatar_url)",
      )
      .single();
  }

  if (result.error) {
    console.error("[chat_messages.POST]", result.error);
    return NextResponse.json(
      { error: result.error.message, hint: "Supabase SQL Editor 에서 'notify pgrst, ''reload schema'';' 실행 후 재시도" },
      { status: 500 },
    );
  }

  // Automation dispatch — resolve room context (group_id / project_id) and fire.
  try {
    const { data: room } = await db
      .from("chat_rooms")
      .select("group_id, project_id")
      .eq("id", id)
      .maybeSingle();
    await dispatchEvent("chat.message_posted", {
      room_id: id,
      group_id: (room as any)?.group_id || null,
      project_id: (room as any)?.project_id || null,
      sender_id: auth.user.id,
      text: (result.data as any)?.content || null,
      content: (result.data as any)?.content || null,
      message_id: (result.data as any)?.id,
    });
  } catch {
    /* dispatch errors must never block chat */
  }

  return NextResponse.json({ message: result.data });
}
