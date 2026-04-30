/**
 * PATCH /api/finance/settlements/[id]
 *  body: { action: "approve" | "reject" }
 *
 * 정산 요청 승인/반려 (호스트/리더/매니저만).
 * chat_messages 의 payment_pending 액션 카드에서 호출.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { dispatchNotification } from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id: settlementId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const admin = getAdminClient() || supabase;

  // settlements 테이블 로드 (그룹/프로젝트 + 요청자)
  const { data: s, error: loadErr } = await admin
    .from("settlements")
    .select("id, group_id, project_id, requester_id, amount, currency, status")
    .eq("id", settlementId)
    .maybeSingle();
  if (loadErr || !s) {
    // settlements 테이블 없을 수 있음 — fallback: group_spending / payouts 등
    return NextResponse.json({ error: "정산 내역을 찾을 수 없습니다" }, { status: 404 });
  }

  // 권한 — 그룹 호스트/매니저 또는 프로젝트 리더
  let authorized = false;
  if ((s as any).group_id) {
    const { data: g } = await admin
      .from("groups")
      .select("host_id")
      .eq("id", (s as any).group_id)
      .maybeSingle();
    if ((g as any)?.host_id === auth.user.id) authorized = true;
    if (!authorized) {
      const { data: gm } = await admin
        .from("group_members")
        .select("role")
        .eq("group_id", (s as any).group_id)
        .eq("user_id", auth.user.id)
        .in("role", ["moderator", "host"])
        .maybeSingle();
      if (gm) authorized = true;
    }
  } else if ((s as any).project_id) {
    const { data: p } = await admin
      .from("projects")
      .select("created_by")
      .eq("id", (s as any).project_id)
      .maybeSingle();
    if ((p as any)?.created_by === auth.user.id) authorized = true;
  }

  if (!authorized) {
    return NextResponse.json({ error: "승인 권한이 없어요" }, { status: 403 });
  }

  // 상태 업데이트
  const newStatus = action === "approve" ? "approved" : "rejected";
  const { error } = await admin
    .from("settlements")
    .update({
      status: newStatus,
      approved_by: action === "approve" ? auth.user.id : null,
      approved_at: action === "approve" ? new Date().toISOString() : null,
    })
    .eq("id", settlementId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 요청자에게 알림
  await dispatchNotification({
    recipientId: (s as any).requester_id,
    eventType: action === "approve" ? "settlement_approved" : "settlement_rejected",
    title: action === "approve" ? "정산이 승인됐어요 💰" : "정산이 반려됐어요",
    body: action === "approve"
      ? `${(s as any).amount?.toLocaleString?.() || (s as any).amount} ${(s as any).currency || "KRW"} 정산이 승인됐어요`
      : `정산 요청이 반려됐습니다`,
    metadata: { settlement_id: settlementId },
    actorId: auth.user.id,
  });

  return NextResponse.json({ ok: true, action, status: newStatus });
}
