import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { paidNutsEnabled } from "@/lib/flags";

/**
 * POST /api/nuts/[id]/subscribe
 * Body: { tier: 'monthly'|'yearly' }
 *
 * 흐름:
 *   1) 너트 조회 (is_paid, monthly_fee, yearly_fee)
 *   2) project_escrow 에 pending 레코드 생성 (order_id 발급)
 *   3) nut_subscription 에 pending_payment 레코드
 *   4) { escrowId, orderId, amount } 반환 → 클라이언트가 결제 위젯 호출
 *   5) 결제 성공 후 webhook → escrow=held → subscription=active 전환은 별도 API
 */
export const POST = withRouteLog("nuts.id.subscribe.post", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  if (!(await paidNutsEnabled())) {
    return NextResponse.json({ error: "유료 너트 기능이 아직 활성화되지 않았습니다" }, { status: 403 });
  }

  const { id: groupId } = await params;
  const { tier } = await req.json();
  if (!["monthly", "yearly"].includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, is_paid, monthly_fee, yearly_fee, max_paid_members")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return NextResponse.json({ error: "Nut not found" }, { status: 404 });
  if (!group.is_paid) return NextResponse.json({ error: "이 너트는 유료 너트가 아닙니다" }, { status: 400 });

  const amount = tier === "monthly" ? group.monthly_fee : group.yearly_fee;
  if (!amount || amount <= 0) return NextResponse.json({ error: "Invalid fee" }, { status: 400 });

  // 이미 활성 구독?
  const { data: existing } = await supabase
    .from("nut_subscriptions")
    .select("id, status")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing && existing.status === "active") {
    return NextResponse.json({ error: "이미 구독 중입니다" }, { status: 400 });
  }

  // 정원 체크
  if (group.max_paid_members) {
    const { count } = await supabase
      .from("nut_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .eq("status", "active");
    if ((count ?? 0) >= group.max_paid_members) {
      return NextResponse.json({ error: "정원이 가득 찼습니다" }, { status: 409 });
    }
  }

  const orderId = `nut-${groupId.slice(0, 8)}-${user.id.slice(0, 8)}-${Date.now()}`;
  const feeRate = 0.05;
  const feeAmount = Math.round(amount * feeRate);

  // 에스크로 레코드
  const { data: escrow, error: escrowErr } = await supabase
    .from("project_escrow")
    .insert({
      project_id: null,            // 너트 구독은 project 연결 안 함
      amount,
      currency: "KRW",
      status: "pending",
      fee_amount: feeAmount,
      fee_rate: feeRate,
      provider: "manual",
      order_id: orderId,
      note: `${group.name} 너트 ${tier === "monthly" ? "월" : "연"} 구독`,
      created_by: user.id,
    })
    .select("id")
    .single();

  // escrow.project_id 가 NOT NULL 이면 fallback — subscription 만 생성
  if (escrowErr && /project_id/.test(escrowErr.message)) {
    const { data: sub } = await supabase.from("nut_subscriptions").upsert({
      group_id: groupId,
      user_id: user.id,
      tier,
      status: "pending_payment",
      amount,
      started_at: new Date().toISOString(),
    }, { onConflict: "group_id,user_id" }).select("id").single();
    return NextResponse.json({ subscriptionId: sub?.id, orderId, amount, escrowOmitted: true });
  }
  if (escrowErr) return NextResponse.json({ error: escrowErr.message }, { status: 500 });

  const nextPeriodEnd = new Date();
  if (tier === "monthly") nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
  else nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);

  const { data: sub } = await supabase.from("nut_subscriptions").upsert({
    group_id: groupId,
    user_id: user.id,
    tier,
    status: "pending_payment",
    amount,
    started_at: new Date().toISOString(),
    current_period_end: nextPeriodEnd.toISOString(),
    escrow_id: escrow.id,
  }, { onConflict: "group_id,user_id" }).select("id").single();

  return NextResponse.json({
    subscriptionId: sub?.id,
    escrowId: escrow.id,
    orderId,
    amount,
    feeAmount,
    groupName: group.name,
  });
});

/**
 * DELETE /api/nuts/[id]/subscribe — 구독 취소
 */
export const DELETE = withRouteLog("nuts.id.subscribe.delete", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: groupId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("nut_subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
});
