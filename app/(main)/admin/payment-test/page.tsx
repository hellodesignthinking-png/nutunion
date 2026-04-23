"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CreditCard, Loader2, RefreshCw, CheckCircle2, AlertCircle, Clock, XCircle } from "lucide-react";
import { EscrowPaymentButton } from "@/components/projects/escrow-payment-button";

function fmt(n: number) { return new Intl.NumberFormat("ko-KR").format(n); }

const STATUS_ICON: Record<string, { icon: any; color: string }> = {
  pending:   { icon: Clock, color: "text-nu-graphite" },
  held:      { icon: Clock, color: "text-nu-blue" },
  approved:  { icon: CheckCircle2, color: "text-green-600" },
  released:  { icon: CheckCircle2, color: "text-green-700" },
  failed:    { icon: XCircle, color: "text-red-600" },
  cancelled: { icon: XCircle, color: "text-nu-muted" },
  refunded:  { icon: RefreshCw, color: "text-orange-600" },
};

export default function PaymentTestPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [amount, setAmount] = useState(1000);
  const [provider, setProvider] = useState<"toss" | "portone">("toss");
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState<{ escrowId: string; orderId: string; amount: number } | null>(null);
  const [escrows, setEscrows] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [envStatus, setEnvStatus] = useState<{ toss: boolean; portone: boolean }>({ toss: false, portone: false });

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setIsAdmin(p?.role === "admin");

      // Env 상태 클라이언트에서 public key 유무 감지
      setEnvStatus({
        toss: !!process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
        portone: !!process.env.NEXT_PUBLIC_PORTONE_STORE_ID,
      });

      refresh();
    })();
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/payment-test");
      const data = await res.json();
      setEscrows(data.escrows || []);
      setWebhooks(data.webhooks || []);
    } finally {
      setRefreshing(false);
    }
  }

  async function createTest() {
    setCreating(true);
    const res = await fetch("/api/admin/payment-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      toast.error(data.error || "생성 실패");
      return;
    }
    setSession({ escrowId: data.escrowId, orderId: data.orderId, amount: data.amount });
    toast.success("테스트 세션 생성됨 — 결제 위젯을 클릭하세요");
    refresh();
  }

  if (isAdmin === null) return <div className="max-w-4xl mx-auto px-6 py-12"><Loader2 className="animate-spin mx-auto text-nu-muted" size={24} /></div>;
  if (isAdmin === false) return <div className="max-w-4xl mx-auto px-6 py-12 text-center text-nu-graphite">관리자만 접근할 수 있습니다</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 pb-20">
      <Link href="/admin" className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline mb-4">
        <ArrowLeft size={11} /> Admin
      </Link>

      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2 flex items-center gap-2">
        <CreditCard size={24} className="text-nu-pink" /> 결제 E2E 테스트
      </h1>
      <p className="text-[13px] text-nu-graphite mb-6">
        Toss / PortOne 실 결제 플로우를 소액으로 검증합니다. 반드시 <strong>test key</strong>로 먼저 실행하세요.
      </p>

      {/* Env 상태 */}
      <section className="grid grid-cols-2 gap-2 mb-6">
        <EnvBadge label="Toss" env="NEXT_PUBLIC_TOSS_CLIENT_KEY" ok={envStatus.toss} />
        <EnvBadge label="PortOne" env="NEXT_PUBLIC_PORTONE_STORE_ID" ok={envStatus.portone} />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-[360px,1fr] gap-6">
        {/* 좌: 테스트 세션 생성 */}
        <section className="border-[2.5px] border-nu-ink bg-nu-paper p-4 h-fit">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-3">
            1. 테스트 세션 생성
          </div>

          <label className="font-mono-nu text-[10px] uppercase text-nu-muted block mb-1">금액 (원)</label>
          <div className="grid grid-cols-4 gap-1 mb-2">
            {[100, 500, 1000, 10000].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAmount(n)}
                className={`py-1.5 border-[2px] font-mono-nu text-[11px] tabular-nums transition-colors ${
                  amount === n ? "border-nu-ink bg-nu-ink text-nu-paper" : "border-nu-ink/15 hover:border-nu-ink/40"
                }`}
              >
                ₩{fmt(n)}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={100}
            max={100000}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Math.max(100, Math.min(100000, Number(e.target.value) || 1000)))}
            className="w-full px-2 py-1 border-[2px] border-nu-ink/20 text-sm tabular-nums focus:border-nu-pink outline-none mb-3"
          />

          <label className="font-mono-nu text-[10px] uppercase text-nu-muted block mb-1">결제 수단</label>
          <div className="grid grid-cols-2 gap-1 mb-3">
            {(["toss", "portone"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={`p-2 border-[2px] font-mono-nu text-[11px] uppercase transition-colors ${
                  provider === p ? "border-nu-pink bg-nu-pink/5 text-nu-pink" : "border-nu-ink/15 hover:border-nu-ink/40"
                }`}
              >
                {p === "toss" ? "Toss" : "PortOne"}
              </button>
            ))}
          </div>

          <button
            onClick={createTest}
            disabled={creating}
            className="w-full py-2.5 bg-nu-pink text-nu-paper font-mono-nu text-[11px] font-bold uppercase tracking-widest hover:bg-nu-pink/90 disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
            세션 생성
          </button>

          {session && (
            <div className="mt-4 border-l-[3px] border-nu-pink bg-nu-pink/5 p-3 space-y-2">
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink font-bold">
                2. 결제 위젯 실행
              </div>
              <div className="font-mono-nu text-[10px] text-nu-graphite break-all">
                order_id: <span className="text-nu-ink">{session.orderId}</span><br />
                escrow_id: <span className="text-nu-ink">{session.escrowId}</span>
              </div>
              <EscrowPaymentButton
                escrowId={session.escrowId}
                orderId={session.orderId}
                amount={session.amount}
                orderName={`E2E 테스트 ₩${fmt(session.amount)}`}
                provider={provider}
              />
              <p className="font-mono-nu text-[9px] text-nu-muted leading-relaxed">
                💡 결제 완료 후 오른쪽 목록에서 escrow status → <strong>held</strong>, webhook status → <strong>approved</strong> 확인
              </p>
            </div>
          )}
        </section>

        {/* 우: 실시간 상태 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite font-bold">
              3. 원장 실시간 조회
            </h2>
            <button onClick={refresh} disabled={refreshing} className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase px-2 py-1 border border-nu-ink/15 hover:bg-nu-ink hover:text-nu-paper">
              <RefreshCw size={10} className={refreshing ? "animate-spin" : ""} /> 새로고침
            </button>
          </div>

          {/* Escrows */}
          <div>
            <div className="font-mono-nu text-[9px] uppercase tracking-[0.25em] text-nu-muted mb-1">Escrow (최근 테스트)</div>
            {escrows.length === 0 ? (
              <div className="border-[2px] border-dashed border-nu-ink/15 p-4 text-center text-[11px] text-nu-graphite">아직 테스트 레코드 없음</div>
            ) : (
              <ul className="list-none m-0 p-0 divide-y divide-nu-ink/10 border-[2px] border-nu-ink/10">
                {escrows.map((e) => {
                  const meta = STATUS_ICON[e.status] || STATUS_ICON.pending;
                  const Icon = meta.icon;
                  return (
                    <li key={e.id} className="p-2 text-[11px] flex items-center gap-2">
                      <Icon size={12} className={meta.color} />
                      <span className="font-mono-nu tabular-nums">₩{fmt(e.amount)}</span>
                      <span className={`font-mono-nu uppercase ${meta.color}`}>{e.status}</span>
                      <span className="font-mono-nu text-nu-graphite text-[9px] truncate flex-1">
                        {e.order_id}
                      </span>
                      <span className="font-mono-nu text-[9px] text-nu-muted tabular-nums">
                        {new Date(e.created_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Webhooks */}
          <div>
            <div className="font-mono-nu text-[9px] uppercase tracking-[0.25em] text-nu-muted mb-1">Payment Webhooks (전체 최근 20)</div>
            {webhooks.length === 0 ? (
              <div className="border-[2px] border-dashed border-nu-ink/15 p-4 text-center text-[11px] text-nu-graphite">웹훅 수신 이력 없음</div>
            ) : (
              <ul className="list-none m-0 p-0 divide-y divide-nu-ink/10 border-[2px] border-nu-ink/10 max-h-60 overflow-y-auto">
                {webhooks.map((w) => {
                  const meta = STATUS_ICON[w.status] || STATUS_ICON.pending;
                  const Icon = meta.icon;
                  return (
                    <li key={w.id} className="p-2 text-[11px] flex items-center gap-2">
                      <Icon size={12} className={meta.color} />
                      <span className="font-mono-nu uppercase text-[10px] text-nu-graphite">{w.provider}</span>
                      <span className={`font-mono-nu uppercase ${meta.color}`}>{w.status}</span>
                      <span className="font-mono-nu text-[9px] truncate flex-1">
                        {w.order_id || w.event_type}
                      </span>
                      {w.error && <AlertCircle size={10} className="text-red-500 shrink-0" />}
                      <span className="font-mono-nu text-[9px] text-nu-muted tabular-nums">
                        {new Date(w.created_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* E2E 체크리스트 */}
          <div className="border-l-[3px] border-nu-amber bg-nu-amber/5 p-3">
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-amber font-bold mb-2">E2E 체크리스트</div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-nu-graphite">
              <li>세션 생성 → escrow <code className="bg-nu-ink/5 px-1">pending</code> 기록</li>
              <li>Toss/PortOne 위젯 호출 → 카드 결제</li>
              <li>successUrl 리턴 → confirm API 호출 → escrow <code className="bg-nu-ink/5 px-1">held</code> 전환</li>
              <li>webhook 수신 → payment_webhooks <code className="bg-nu-ink/5 px-1">approved</code></li>
              <li>(선택) 관리자가 수동으로 <code className="bg-nu-ink/5 px-1">released</code> 전환</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}

function EnvBadge({ label, env, ok }: { label: string; env: string; ok: boolean }) {
  return (
    <div className={`p-2 border-[2px] ${ok ? "border-green-500 bg-green-50" : "border-orange-400 bg-orange-50"}`}>
      <div className="font-mono-nu text-[9px] uppercase text-nu-graphite">{label}</div>
      <div className="flex items-center gap-1">
        {ok ? <CheckCircle2 size={12} className="text-green-600" /> : <AlertCircle size={12} className="text-orange-500" />}
        <span className="font-mono text-[10px] truncate">{env}</span>
      </div>
      <div className={`font-mono-nu text-[9px] ${ok ? "text-green-700" : "text-orange-600"}`}>
        {ok ? "✓ 설정됨" : "✗ Vercel env 에 주입 필요"}
      </div>
    </div>
  );
}
