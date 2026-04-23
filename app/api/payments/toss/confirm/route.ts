import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 토스페이먼츠 결제 승인 (서버)
 * 클라이언트 `requestPayment` 성공 후 → paymentKey, orderId, amount 전달 → 서버가 `confirm` 호출.
 *
 * Docs: https://docs.tosspayments.com/reference#결제-승인
 *
 * 환경변수:
 *   TOSS_SECRET_KEY   — 서버용 Secret Key
 *
 * Payload:
 *   { paymentKey: string, orderId: string, amount: number, escrowId?: string }
 */
export async function POST(req: Request) {
  const { paymentKey, orderId, amount, escrowId } = await req.json();
  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json({ error: "Missing paymentKey/orderId/amount" }, { status: 400 });
  }
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "TOSS_SECRET_KEY not configured" }, { status: 501 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 토스 confirm 호출
  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${secretKey}:`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  const data = await tossRes.json();

  // 웹훅 원장 기록 (upsert — 재시도/중복 호출 멱등)
  const whRes = await supabase.from("payment_webhooks").upsert({
    provider: "toss",
    event_type: "payment.confirm",
    provider_event_id: paymentKey,
    payment_key: paymentKey,
    order_id: orderId,
    amount,
    status: tossRes.ok ? "approved" : "failed",
    raw_payload: data,
    escrow_id: escrowId || null,
    processed_at: new Date().toISOString(),
    error: tossRes.ok ? null : (data.message || "confirm failed"),
  }, { onConflict: "provider,provider_event_id" });
  if (whRes.error) console.warn("[toss/confirm] ledger upsert failed:", whRes.error.message);

  if (!tossRes.ok) {
    return NextResponse.json({ error: data.message || "결제 승인 실패", code: data.code }, { status: 400 });
  }

  // escrow 업데이트 — held 상태로
  if (escrowId) {
    await supabase
      .from("project_escrow")
      .update({
        status: "held",
        provider: "toss",
        provider_txn_id: paymentKey,
        held_at: new Date().toISOString(),
        order_id: orderId,
      })
      .eq("id", escrowId);
  }

  return NextResponse.json({ success: true, paymentKey, orderId, amount });
}
