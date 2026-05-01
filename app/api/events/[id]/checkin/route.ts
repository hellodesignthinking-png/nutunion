import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

/**
 * POST /api/events/[id]/checkin
 * - Action: "generate" — 호스트만, 새 token 발급
 * - Action: "redeem" — 참석자, token 검증 후 event_checkins insert
 * - Action: "info" — token 메타 조회 (공개 — 리덤션 페이지용)
 */
export const POST = withRouteLog("events.id.checkin.post", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: eventId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as "generate" | "redeem" | "info" | undefined;
  const token = body.token as string | undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 이벤트 + 그룹 host 정보 조회
  const { data: event, error: evErr } = await supabase
    .from("events")
    .select("id, title, group_id, start_at, end_at, created_by, checkin_token, checkin_enabled")
    .eq("id", eventId)
    .single();
  if (evErr || !event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  if (action === "generate") {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // 호스트 / 제작자 / admin 만 허용
    const { data: group } = await supabase.from("groups").select("host_id").eq("id", event.group_id).maybeSingle();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const isOwner = group?.host_id === user.id || event.created_by === user.id || profile?.role === "admin";
    if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const newToken = crypto.randomBytes(12).toString("base64url");
    const { error: updErr } = await supabase
      .from("events")
      .update({ checkin_token: newToken, checkin_enabled: true })
      .eq("id", eventId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    const origin = new URL(req.url).origin;
    return NextResponse.json({
      token: newToken,
      checkin_url: `${origin}/events/${eventId}/checkin?t=${newToken}`,
    });
  }

  if (action === "info") {
    if (!event.checkin_token || !event.checkin_enabled) {
      return NextResponse.json({ error: "Check-in not enabled" }, { status: 404 });
    }
    if (token !== event.checkin_token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }
    return NextResponse.json({
      title: event.title,
      start_at: event.start_at,
      end_at: event.end_at,
    });
  }

  if (action === "redeem") {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!event.checkin_token || !event.checkin_enabled) {
      return NextResponse.json({ error: "Check-in not enabled" }, { status: 400 });
    }
    if (token !== event.checkin_token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }
    // 시간 제약 — 이벤트 시작 1시간 전부터 종료 후 2시간까지 허용
    const now = Date.now();
    const start = new Date(event.start_at).getTime();
    const end = new Date(event.end_at).getTime();
    if (now < start - 60 * 60 * 1000) {
      return NextResponse.json({ error: "체크인은 이벤트 시작 1시간 전부터 가능합니다" }, { status: 400 });
    }
    if (now > end + 2 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "체크인 시간이 지났습니다" }, { status: 400 });
    }

    const { error: insErr } = await supabase.from("event_checkins").insert({
      event_id: eventId,
      user_id: user.id,
      method: "qr",
    });
    if (insErr && insErr.code !== "23505") {
      // 23505 = 이미 체크인 (OK 처리)
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // 강성 이벤트 기록
    await supabase.from("stiffness_events").insert({
      user_id: user.id,
      event_type: "event_attend",
      points: 5,
      source_type: "event",
      source_id: eventId,
    }).then(() => {}, () => {});

    return NextResponse.json({ success: true, already: insErr?.code === "23505" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
});

// GET /api/events/[id]/checkin — 호스트/제작자/admin 만 전체 목록, 일반 유저는 본인 것만
export const GET = withRouteLog("events.id.checkin.get", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: eventId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: event } = await supabase
    .from("events")
    .select("id, group_id, created_by")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const [{ data: group }, { data: profile }] = await Promise.all([
    event.group_id
      ? supabase.from("groups").select("host_id").eq("id", event.group_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);
  const isOwner =
    event.created_by === user.id ||
    group?.host_id === user.id ||
    profile?.role === "admin";

  let q = supabase
    .from("event_checkins")
    .select("user_id, method, checked_in_at, profile:profiles(id, nickname, avatar_url)")
    .eq("event_id", eventId)
    .order("checked_in_at", { ascending: false });
  if (!isOwner) q = q.eq("user_id", user.id);

  const { data: checkins } = await q;
  return NextResponse.json({ checkins: checkins || [], isOwner });
});
