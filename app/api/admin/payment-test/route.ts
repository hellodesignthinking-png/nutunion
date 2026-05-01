import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/payment-test
 * Admin 전용 — 1,000원 테스트 escrow 레코드 생성 + orderId 발급.
 * 이후 클라이언트가 Toss/PortOne 위젯을 호출해 실제 결제 진행.
 *
 * GET /api/admin/payment-test — 최근 테스트 거래 + 웹훅 원장 조회
 */
export const POST = withRouteLog("admin.payment-test.post", async (req: Request) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const amount = Math.max(100, Math.min(100000, Number(body.amount) || 1000));

  const orderId = `test-${Date.now()}-${user.id.slice(0, 6)}`;

  const { data: escrow, error } = await supabase.from("project_escrow").insert({
    project_id: null,
    amount,
    currency: "KRW",
    status: "pending",
    fee_amount: Math.round(amount * 0.05),
    fee_rate: 0.05,
    provider: "manual",
    order_id: orderId,
    note: `E2E 테스트 — ${new Date().toISOString()}`,
    created_by: user.id,
  }).select("id").maybeSingle();

  if (error && /project_id/.test(error.message || "")) {
    return NextResponse.json({
      error: "project_escrow.project_id NOT NULL — 테스트 레코드 생성 불가. Migration 069 확인 필요",
      escrowOmitted: true,
      orderId,
      amount,
    }, { status: 500 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    escrowId: escrow?.id,
    orderId,
    amount,
    testMode: true,
  });
});

export const GET = withRouteLog("admin.payment-test.get", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const [escrowRes, webhookRes] = await Promise.all([
    supabase
      .from("project_escrow")
      .select("id, order_id, amount, status, provider, provider_txn_id, fee_amount, held_at, released_at, note, created_at")
      .ilike("note", "E2E 테스트%")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("payment_webhooks")
      .select("id, provider, event_type, order_id, amount, status, error, processed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    escrows: escrowRes.data || [],
    webhooks: webhookRes.data || [],
  });
});
