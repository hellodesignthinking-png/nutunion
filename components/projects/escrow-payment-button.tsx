"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window {
    TossPayments?: any;
    IMP?: any;
  }
}

interface Props {
  escrowId: string;
  orderId: string;           // 새 order_id (고유, escrow_id 와 연결)
  amount: number;            // KRW 원 단위
  orderName: string;
  customerName?: string;
  customerEmail?: string;
  provider?: "toss" | "portone";
}

/**
 * 클라이언트 결제 위젯.
 * - Toss: @tosspayments/tosspayments-sdk (loaded dynamically)
 * - PortOne V1 (아임포트): iamport.payment.js
 *
 * 환경변수 (public):
 *   NEXT_PUBLIC_TOSS_CLIENT_KEY — test_gck_xxx / live_gck_xxx
 *   NEXT_PUBLIC_PORTONE_STORE_ID — imp12345678 (가맹점 식별)
 */
export function EscrowPaymentButton({
  escrowId,
  orderId,
  amount,
  orderName,
  customerName,
  customerEmail,
  provider = "toss",
}: Props) {
  const [loading, setLoading] = useState(false);

  async function loadScript(src: string) {
    return new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
      if (existing) {
        // 이미 로드 완료됐으면 즉시, 아니면 onload 까지 대기 (race 방지)
        if ((existing as any).dataset.loaded === "true") return resolve();
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Script load failed: " + src)), { once: true });
        return;
      }
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = () => { (s as any).dataset.loaded = "true"; resolve(); };
      s.onerror = () => reject(new Error("Script load failed: " + src));
      document.head.appendChild(s);
    });
  }

  async function payWithToss() {
    const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
    if (!clientKey) {
      toast.error("NEXT_PUBLIC_TOSS_CLIENT_KEY 가 설정되지 않았습니다");
      return;
    }
    await loadScript("https://js.tosspayments.com/v1/payment");
    const tossPayments = window.TossPayments(clientKey);

    const origin = window.location.origin;
    await tossPayments.requestPayment("카드", {
      amount,
      orderId,
      orderName,
      customerName: customerName || undefined,
      customerEmail: customerEmail || undefined,
      successUrl: `${origin}/api/payments/toss/success?escrowId=${escrowId}`,
      failUrl: `${origin}/api/payments/toss/fail`,
    });
  }

  async function payWithPortOne() {
    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    if (!storeId) {
      toast.error("NEXT_PUBLIC_PORTONE_STORE_ID 가 설정되지 않았습니다");
      return;
    }
    await loadScript("https://cdn.iamport.kr/v1/iamport.js");
    const IMP = window.IMP;
    IMP.init(storeId);

    IMP.request_pay(
      {
        pg: "tosspayments",
        pay_method: "card",
        merchant_uid: orderId,
        name: orderName,
        amount,
        buyer_name: customerName,
        buyer_email: customerEmail,
        m_redirect_url: `${window.location.origin}/api/payments/portone/callback?escrowId=${escrowId}`,
      },
      async (rsp: any) => {
        if (rsp.success) {
          toast.success("결제 성공 — 웹훅으로 확정 중");
        } else {
          toast.error(rsp.error_msg || "결제 실패");
        }
      }
    );
  }

  async function handleClick() {
    setLoading(true);
    try {
      if (provider === "toss") await payWithToss();
      else await payWithPortOne();
    } catch (e: any) {
      toast.error(e.message || "결제 요청 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 disabled:opacity-50"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
      {provider === "toss" ? "토스로 결제" : "포트원 결제"} · ₩{amount.toLocaleString("ko-KR")}
    </button>
  );
}
