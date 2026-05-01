import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/creators/[id]/subscribe
 * 와셔 크리에이터에게 월/연 구독 시작 → 탭 콘텐츠 전체 접근.
 * Body: { tier: 'monthly'|'yearly' }
 */
export const POST = withRouteLog("creators.id.subscribe.post", async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: creatorId } = await params;
  const { tier } = await req.json();
  if (!["monthly", "yearly"].includes(tier)) return NextResponse.json({ error: "Invalid tier" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.id === creatorId) return NextResponse.json({ error: "자신을 구독할 수 없습니다" }, { status: 400 });

  const { data: creator } = await supabase
    .from("profiles")
    .select("id, nickname, creator_enabled, creator_monthly_fee, creator_yearly_fee")
    .eq("id", creatorId)
    .maybeSingle();

  if (!creator?.creator_enabled) return NextResponse.json({ error: "크리에이터 구독이 활성화되지 않은 와셔입니다" }, { status: 400 });

  const amount = tier === "monthly" ? creator.creator_monthly_fee : creator.creator_yearly_fee;
  if (!amount || amount <= 0) return NextResponse.json({ error: "구독 금액 설정이 없습니다" }, { status: 400 });

  const orderId = `vibe-${creatorId.slice(0, 8)}-${user.id.slice(0, 8)}-${Date.now()}`;
  const feeRate = 0.1;
  const feeAmount = Math.round(amount * feeRate);

  const { data: escrow, error: escrowErr } = await supabase
    .from("project_escrow")
    .insert({
      project_id: null,
      amount,
      currency: "KRW",
      status: "pending",
      fee_amount: feeAmount,
      fee_rate: feeRate,
      provider: "manual",
      order_id: orderId,
      note: `${creator.nickname} 크리에이터 ${tier === "monthly" ? "월" : "연"} 구독`,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();

  const nextEnd = new Date();
  if (tier === "monthly") nextEnd.setMonth(nextEnd.getMonth() + 1);
  else nextEnd.setFullYear(nextEnd.getFullYear() + 1);

  const { data: sub, error } = await supabase.from("tap_subscriptions").upsert({
    creator_id: creatorId,
    subscriber_id: user.id,
    tier,
    amount,
    status: "pending_payment",
    current_period_end: nextEnd.toISOString(),
    escrow_id: escrow?.id,
  }, { onConflict: "creator_id,subscriber_id" }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    subscriptionId: sub?.id,
    escrowId: escrow?.id,
    orderId,
    amount,
    creator: creator.nickname,
  });
});

export const DELETE = withRouteLog("creators.id.subscribe.delete", async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id: creatorId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("tap_subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("creator_id", creatorId)
    .eq("subscriber_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
});
