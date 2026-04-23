import { NextResponse } from "next/server";

/**
 * 토스 결제 실패 리다이렉트 핸들러.
 * 토스는 failUrl 로 ?code=...&message=...&orderId=... 를 전달함.
 * 대시보드로 리다이렉트하고 사용자에게 실패 메시지 전달.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "unknown";
  const message = url.searchParams.get("message") || "결제가 취소되었거나 실패했습니다";
  const redirect = new URL("/dashboard", req.url);
  redirect.searchParams.set("payment", "failed");
  redirect.searchParams.set("payment_code", code);
  redirect.searchParams.set("payment_message", message.slice(0, 200));
  return NextResponse.redirect(redirect);
}
