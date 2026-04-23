import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { creatorEconomyEnabled } from "@/lib/flags";

/**
 * POST /api/tap-store/[id]/purchase
 * 탭 상품 구매 시작 — escrow 생성 → 결제 위젯으로 이어짐.
 *
 * 가격 0원이면 즉시 완료.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await creatorEconomyEnabled())) {
    return NextResponse.json({ error: "크리에이터 이코노미 기능이 아직 활성화되지 않았습니다" }, { status: 403 });
  }

  const { id: productId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: product } = await supabase
    .from("tap_products")
    .select("id, seller_id, title, price, platform_fee_rate, status")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.status !== "published") {
    return NextResponse.json({ error: "Product not available" }, { status: 404 });
  }
  if (product.seller_id === user.id) {
    return NextResponse.json({ error: "자신의 상품은 구매할 수 없습니다" }, { status: 400 });
  }

  const amount = product.price;
  const platformFee = Math.round(amount * (product.platform_fee_rate ?? 0.1));
  const sellerPayout = amount - platformFee;

  // 무료 상품 — 즉시 완료
  if (amount === 0) {
    const { error } = await supabase.from("tap_purchases").upsert({
      product_id: productId,
      buyer_id: user.id,
      amount: 0,
      platform_fee: 0,
      seller_payout: 0,
      status: "completed",
      purchased_at: new Date().toISOString(),
    }, { onConflict: "product_id,buyer_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.rpc("increment_tap_sales", { p_product_id: productId, p_revenue: 0 }).then(() => {}, () => {});
    return NextResponse.json({ success: true, free: true });
  }

  // 유료 — escrow 생성
  const orderId = `tap-${productId.slice(0, 8)}-${user.id.slice(0, 8)}-${Date.now()}`;
  const { data: escrow, error: escrowErr } = await supabase.from("project_escrow").insert({
    project_id: null,
    amount,
    currency: "KRW",
    status: "pending",
    fee_amount: platformFee,
    fee_rate: product.platform_fee_rate,
    provider: "manual",
    order_id: orderId,
    note: `탭 스토어: ${product.title}`,
    created_by: user.id,
  }).select("id").maybeSingle();

  if (escrowErr) {
    // project_id NOT NULL 환경 — purchase 만 pending 으로 기록
    if (/project_id/.test(escrowErr.message)) {
      const { data: p } = await supabase.from("tap_purchases").upsert({
        product_id: productId, buyer_id: user.id,
        amount, platform_fee: platformFee, seller_payout: sellerPayout,
        status: "pending",
      }, { onConflict: "product_id,buyer_id" }).select("id").single();
      return NextResponse.json({ purchaseId: p?.id, orderId, amount, escrowOmitted: true });
    }
    return NextResponse.json({ error: escrowErr.message }, { status: 500 });
  }

  const { data: purchase } = await supabase.from("tap_purchases").upsert({
    product_id: productId,
    buyer_id: user.id,
    amount,
    platform_fee: platformFee,
    seller_payout: sellerPayout,
    escrow_id: escrow?.id,
    status: "pending",
  }, { onConflict: "product_id,buyer_id" }).select("id").single();

  return NextResponse.json({
    purchaseId: purchase?.id,
    escrowId: escrow?.id,
    orderId,
    amount,
    platformFee,
    productTitle: product.title,
  });
}
