import { NextResponse } from "next/server";

/**
 * 토스 결제 성공 리다이렉트 핸들러.
 * 토스는 successUrl 로 paymentKey/orderId/amount 를 쿼리 파라미터로 전달함.
 * 여기서 confirm API 를 호출 → 결과에 따라 UI 로 리다이렉트.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentKey = url.searchParams.get("paymentKey");
  const orderId = url.searchParams.get("orderId");
  const amount = Number(url.searchParams.get("amount"));
  const escrowId = url.searchParams.get("escrowId");

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.redirect(new URL("/dashboard?payment=invalid", req.url));
  }

  // confirm
  const confirmRes = await fetch(new URL("/api/payments/toss/confirm", req.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: req.headers.get("cookie") || "",
    },
    body: JSON.stringify({ paymentKey, orderId, amount, escrowId }),
  });

  if (!confirmRes.ok) {
    return NextResponse.redirect(new URL("/dashboard?payment=failed", req.url));
  }
  return NextResponse.redirect(new URL("/dashboard?payment=success", req.url));
}
