import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sendPush, type SubscriptionRow } from "@/lib/push/web-push-client";

export const runtime = "nodejs";
export const maxDuration = 30;

const SendSchema = z.object({
  /** 대상 — user_ids 배열 또는 'self' */
  target: z.union([
    z.literal("self"),
    z.object({ user_ids: z.array(z.string().uuid()).min(1).max(500) }),
  ]),
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(300),
  url: z.string().optional(),
  tag: z.string().max(50).optional(),
});

/**
 * POST /api/push/send
 * - admin/staff 만 다른 사용자에게 발송 가능
 * - target: "self" 는 본인에게 테스트 발송
 */
export const POST = withRouteLog("push.send", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = SendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const d = parsed.data;

  let userIds: string[];
  if (d.target === "self") {
    userIds = [user.id];
  } else {
    // 다른 사용자 대상 — admin/staff 권한 필요
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
    if (!isAdminStaff) {
      return NextResponse.json({ error: "권한 없음 (admin/staff 전용)" }, { status: 403 });
    }
    userIds = d.target.user_ids;
  }

  // service_role 로 구독 조회 (RLS 우회)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json({ error: "서버 설정 누락" }, { status: 500 });
  }
  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth_key")
    .in("user_id", userIds);

  if (!subs || subs.length === 0) {
    return NextResponse.json({ success: true, sent: 0, expired: 0 });
  }

  let sent = 0;
  let expired = 0;
  const expiredIds: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      const row = {
        endpoint: s.endpoint as string,
        p256dh: s.p256dh as string,
        auth_key: s.auth_key as string,
      } as SubscriptionRow;
      const result = await sendPush(row, {
        title: d.title,
        body: d.body,
        url: d.url,
        tag: d.tag,
      });
      if (result.ok) {
        sent += 1;
      } else if (result.expired) {
        expired += 1;
        expiredIds.push(s.id as string);
      }
    })
  );

  // 만료된 구독 정리
  if (expiredIds.length > 0) {
    await admin.from("push_subscriptions").delete().in("id", expiredIds);
  }

  // 성공 구독 last_used_at 갱신 (옵셔널)
  if (sent > 0) {
    await admin
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString(), failed_count: 0 })
      .in(
        "user_id",
        userIds
      );
  }

  return NextResponse.json({ success: true, sent, expired });
});
