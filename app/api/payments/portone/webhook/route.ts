import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * PortOne(아임포트) 웹훅 — 결제 상태 변경 알림 수신
 *
 * Docs: https://developers.portone.io/docs/ko/auth/webhook
 *
 * 환경변수:
 *   PORTONE_API_KEY     — REST API Key
 *   PORTONE_API_SECRET  — REST API Secret
 *   PORTONE_WEBHOOK_SECRET — 웹훅 시그니처 검증 (선택)
 *
 * Payload (V1):
 *   { imp_uid: string, merchant_uid: string, status: 'paid'|'ready'|'failed'|'cancelled' }
 */
export const POST = withRouteLog("payments.portone.webhook", async (req: Request) => {
  const raw = await req.text();
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { imp_uid, merchant_uid, status } = payload;
  if (!imp_uid || !merchant_uid) {
    return NextResponse.json({ error: "Missing imp_uid/merchant_uid" }, { status: 400 });
  }

  const supabase = await createClient();

  // 멱등성 — 같은 imp_uid 로 이전에 처리됐는지
  const { data: existing } = await supabase
    .from("payment_webhooks")
    .select("id, processed_at")
    .eq("provider", "portone")
    .eq("provider_event_id", imp_uid)
    .maybeSingle();
  if (existing?.processed_at) {
    return NextResponse.json({ ok: true, already: true });
  }

  const apiKey = process.env.PORTONE_API_KEY;
  const apiSecret = process.env.PORTONE_API_SECRET;

  let verified: any = payload;
  let verifyError: string | null = null;

  // API Key 가 있으면 portone 서버에서 직접 재조회 (fraud 방지)
  if (apiKey && apiSecret) {
    try {
      // 1) 토큰 발급
      const tokenRes = await fetch("https://api.iamport.kr/users/getToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imp_key: apiKey, imp_secret: apiSecret }),
      });
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.response?.access_token;
      if (accessToken) {
        const verifyRes = await fetch(`https://api.iamport.kr/payments/${imp_uid}`, {
          headers: { Authorization: accessToken },
        });
        const verifyData = await verifyRes.json();
        verified = verifyData.response || payload;
      } else {
        verifyError = "token_failed";
      }
    } catch (e: any) {
    log.error(e, "payments.portone.webhook.failed");
      verifyError = e.message || "verify_failed";
    }
  }

  const amount = Number(verified.amount ?? verified.paid_amount ?? 0);
  const normalizedStatus =
    verified.status === "paid" ? "approved" :
    verified.status === "cancelled" ? "cancelled" :
    verified.status === "failed" ? "failed" :
    status || "pending";

  // 원장 기록 (upsert — 동시 웹훅 재시도에도 안전)
  const { data: wh } = await supabase.from("payment_webhooks").upsert({
    provider: "portone",
    event_type: `payment.${verified.status || status || "unknown"}`,
    provider_event_id: imp_uid,
    payment_key: imp_uid,
    order_id: merchant_uid,
    amount: amount || null,
    currency: verified.currency || "KRW",
    status: normalizedStatus,
    raw_payload: verified,
    processed_at: new Date().toISOString(),
    error: verifyError,
  }, { onConflict: "provider,provider_event_id" }).select("id").maybeSingle();

  // escrow 상태 연동 — merchant_uid 가 order_id 에 매칭되면 자동 업데이트
  const { data: escrow } = await supabase
    .from("project_escrow")
    .select("id, status")
    .eq("order_id", merchant_uid)
    .maybeSingle();

  if (escrow && wh) {
    let nextStatus = escrow.status;
    if (normalizedStatus === "approved") nextStatus = "held";
    else if (normalizedStatus === "cancelled") nextStatus = "cancelled";
    else if (normalizedStatus === "failed") nextStatus = "pending";

    await supabase
      .from("project_escrow")
      .update({
        status: nextStatus,
        provider: "portone",
        provider_txn_id: imp_uid,
        held_at: nextStatus === "held" ? new Date().toISOString() : null,
      })
      .eq("id", escrow.id);

    await supabase.from("payment_webhooks").update({ escrow_id: escrow.id }).eq("id", wh.id);
  }

  return NextResponse.json({ ok: true, status: normalizedStatus });
});
