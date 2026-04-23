"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Crown, Loader2, Check, X, Lock } from "lucide-react";
import { toast } from "sonner";
import { EscrowPaymentButton } from "@/components/projects/escrow-payment-button";

interface Props {
  groupId: string;
  userId: string | null;
  isPaid: boolean;
  monthlyFee: number;
  yearlyFee: number;
  paidDescription?: string | null;
}

function fmt(n: number) { return new Intl.NumberFormat("ko-KR").format(n); }

export function PaidNutSubscribe({ groupId, userId, isPaid, monthlyFee, yearlyFee, paidDescription }: Props) {
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<"monthly" | "yearly">("monthly");
  const [subscribing, setSubscribing] = useState(false);
  const [payment, setPayment] = useState<{ escrowId: string; orderId: string; amount: number } | null>(null);

  useEffect(() => {
    if (!isPaid || !userId) { setLoading(false); return; }
    const supabase = createClient();
    supabase
      .from("nut_subscriptions")
      .select("id, tier, status, current_period_end")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => { setCurrentSub(data); setLoading(false); });
  }, [groupId, userId, isPaid]);

  if (!isPaid) return null;

  if (currentSub?.status === "active") {
    return (
      <section className="border-[2.5px] border-green-500 bg-green-50 p-3">
        <div className="flex items-center gap-2">
          <Crown size={16} className="text-green-700" />
          <span className="font-mono-nu text-[11px] uppercase tracking-widest text-green-700 font-bold">구독 중</span>
          <span className="font-mono-nu text-[10px] text-green-700/70 ml-auto">
            다음 갱신: {currentSub.current_period_end ? new Date(currentSub.current_period_end).toLocaleDateString("ko") : "—"}
          </span>
        </div>
      </section>
    );
  }

  async function startSubscribe() {
    if (!userId) return toast.error("로그인이 필요합니다");
    setSubscribing(true);
    const res = await fetch(`/api/nuts/${groupId}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json();
    setSubscribing(false);
    if (!res.ok) return toast.error(data.error || "구독 시작 실패");
    if (data.escrowId) {
      setPayment({ escrowId: data.escrowId, orderId: data.orderId, amount: data.amount });
      toast.success("결제 단계로 진입합니다");
    } else {
      toast.success("구독이 대기 상태로 생성됐습니다. 수동 결제 후 활성화됩니다.");
    }
  }

  const amount = tier === "monthly" ? monthlyFee : yearlyFee;
  const savePct = yearlyFee && monthlyFee ? Math.round((1 - yearlyFee / (monthlyFee * 12)) * 100) : 0;

  return (
    <section className="border-[2.5px] border-nu-amber bg-gradient-to-br from-nu-amber/5 to-nu-paper overflow-hidden">
      <header className="px-4 py-3 border-b-[2px] border-nu-amber/30 bg-nu-amber/10 flex items-center gap-2">
        <Crown size={14} className="text-nu-amber" />
        <div className="flex-1">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-amber font-bold">유료 너트 · Paid Nut</div>
          <p className="text-[11px] text-nu-graphite mt-0.5">{paidDescription || "멤버십 구독으로 프리미엄 콘텐츠·활동에 참여하세요"}</p>
        </div>
      </header>

      <div className="p-4 space-y-3">
        {/* tier 선택 */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setTier("monthly")}
            className={`p-3 border-[2px] text-left transition-colors ${tier === "monthly" ? "border-nu-amber bg-nu-amber/10" : "border-nu-ink/15 hover:border-nu-ink/40"}`}>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">월간</div>
            <div className="font-head text-[22px] font-extrabold text-nu-ink tabular-nums">₩{fmt(monthlyFee)}</div>
            <div className="font-mono-nu text-[10px] text-nu-muted">매달 자동 갱신</div>
          </button>
          <button type="button" onClick={() => setTier("yearly")}
            className={`p-3 border-[2px] text-left transition-colors relative ${tier === "yearly" ? "border-nu-amber bg-nu-amber/10" : "border-nu-ink/15 hover:border-nu-ink/40"}`}>
            {savePct > 0 && (
              <span className="absolute top-1 right-1 font-mono-nu text-[9px] font-bold bg-nu-pink text-nu-paper px-1 py-0.5">-{savePct}%</span>
            )}
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">연간</div>
            <div className="font-head text-[22px] font-extrabold text-nu-ink tabular-nums">₩{fmt(yearlyFee)}</div>
            <div className="font-mono-nu text-[10px] text-nu-muted">12개월 한 번에</div>
          </button>
        </div>

        {payment ? (
          <div className="border-l-[3px] border-nu-pink bg-nu-pink/5 p-3 space-y-2">
            <p className="text-[12px] text-nu-ink font-bold">결제를 완료하면 즉시 활성화됩니다</p>
            <div className="flex gap-2">
              <EscrowPaymentButton
                escrowId={payment.escrowId}
                orderId={payment.orderId}
                amount={payment.amount}
                orderName={`너트 ${tier === "monthly" ? "월" : "연"} 구독`}
                provider="toss"
              />
              <EscrowPaymentButton
                escrowId={payment.escrowId}
                orderId={payment.orderId}
                amount={payment.amount}
                orderName={`너트 ${tier === "monthly" ? "월" : "연"} 구독`}
                provider="portone"
              />
            </div>
          </div>
        ) : (
          <button type="button" onClick={startSubscribe} disabled={subscribing || amount <= 0}
            className="w-full py-3 bg-nu-amber text-nu-paper font-mono-nu text-[12px] font-bold uppercase tracking-widest hover:bg-nu-amber/90 disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {subscribing ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            ₩{fmt(amount)} {tier === "monthly" ? "/월" : "/년"} 구독 시작
          </button>
        )}

        <p className="font-mono-nu text-[10px] text-nu-graphite text-center">
          언제든 취소 가능 · 결제 수수료 5% 포함 · 환불 정책은 호스트에게 문의
        </p>
      </div>
    </section>
  );
}
