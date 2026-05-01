import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";

/**
 * PortOne 모바일 결제 리다이렉트 핸들러.
 * V1 IMP.request_pay 의 m_redirect_url 로 설정됨.
 * imp_uid / merchant_uid / imp_success 가 쿼리 파라미터로 전달됨.
 *
 * 이 라우트는 웹훅과 중복 호출되므로 상태 조회만 하고 UI 로 리다이렉트.
 * 실제 확정은 /api/payments/portone/webhook 에서 처리.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const imp_uid = url.searchParams.get("imp_uid");
  const merchant_uid = url.searchParams.get("merchant_uid");
  const imp_success = url.searchParams.get("imp_success") || url.searchParams.get("success");
  const escrowId = url.searchParams.get("escrowId");
  const error_msg = url.searchParams.get("error_msg");

  const isSuccess = imp_success === "true";

  const redirect = new URL("/dashboard", req.url);
  redirect.searchParams.set("payment", isSuccess ? "success" : "failed");
  if (!isSuccess && error_msg) redirect.searchParams.set("payment_message", error_msg.slice(0, 200));
  if (merchant_uid) redirect.searchParams.set("order_id", merchant_uid);

  // 성공 시 escrow 상태 즉시 반영 (웹훅보다 먼저 도착 가능)
  if (isSuccess && escrowId && imp_uid) {
    try {
      const supabase = await createClient();
      await supabase
        .from("project_escrow")
        .update({
          provider: "portone",
          provider_txn_id: imp_uid,
          order_id: merchant_uid,
        })
        .eq("id", escrowId);
    } catch {}
  }

  return NextResponse.redirect(redirect);
}
