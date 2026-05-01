/**
 * GET /api/chat/rooms/[id]/members — 방 참여자 전체 + 접속 상태 근사.
 *
 * 응답:
 *   { members: [{ user_id, nickname, avatar_url, bio, job_title, role, joined_at, online }] }
 *
 * 접속 상태:
 *   - profiles.last_seen_at 이 있으면 그 값 기준 (최근 5분 이내 = online)
 *   - 없으면 online: null (클라이언트에서 "접속 상태 미지원"으로 처리)
 */
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 10;
type Ctx = { params: Promise<{ id: string }> };

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export const GET = withRouteLog("chat.rooms.id.members", async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getAdminClient() || supabase;

  // 권한 체크 — 본인이 방 멤버여야 조회 가능
  const { data: meMember } = await db
    .from("chat_members")
    .select("room_id")
    .eq("room_id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!meMember) return NextResponse.json({ error: "방 멤버가 아닙니다" }, { status: 403 });

  const { data: rows, error } = await db
    .from("chat_members")
    .select("user_id, role, joined_at, user:profiles(id, nickname, avatar_url, bio, job_title)")
    .eq("room_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // last_seen_at 시도 — 컬럼 없으면 에러 무시
  let lastSeenMap = new Map<string, string>();
  try {
    const userIds = (rows as any[]).map((r) => r.user_id).filter(Boolean);
    if (userIds.length > 0) {
      const { data: seen } = await db
        .from("profiles")
        .select("id, last_seen_at")
        .in("id", userIds);
      if (seen) {
        for (const s of seen as any[]) {
          if (s?.last_seen_at) lastSeenMap.set(s.id, s.last_seen_at);
        }
      }
    }
  } catch {
    // 컬럼 없음 — 무시
  }

  const FIVE_MIN = 5 * 60 * 1000;
  const now = Date.now();

  const members = (rows as any[]).map((r) => {
    const ls = lastSeenMap.get(r.user_id);
    const online = ls ? now - new Date(ls).getTime() < FIVE_MIN : null;
    return {
      user_id: r.user_id,
      role: r.role || "member",
      joined_at: r.joined_at,
      nickname: r.user?.nickname || "익명",
      avatar_url: r.user?.avatar_url || null,
      bio: r.user?.bio || null,
      job_title: r.user?.job_title || null,
      last_seen_at: ls || null,
      online,
    };
  });

  return NextResponse.json({ members, presence_supported: lastSeenMap.size > 0 });
});
