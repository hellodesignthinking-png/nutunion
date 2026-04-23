"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Download, Loader2, Lock, ShoppingBag, Tag, CheckCircle2 } from "lucide-react";
import { EscrowPaymentButton } from "@/components/projects/escrow-payment-button";

function fmt(n: number) { return new Intl.NumberFormat("ko-KR").format(n); }

export default function TapProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [purchased, setPurchased] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [payment, setPayment] = useState<{ escrowId: string; orderId: string; amount: number } | null>(null);

  useEffect(() => { load(); }, [productId]);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const { data: p } = await supabase
      .from("tap_products")
      .select("id, title, summary, product_type, price, currency, cover_url, preview_md, full_content_md, attached_files, tags, sales_count, seller_id, status, platform_fee_rate, created_at")
      .eq("id", productId)
      .maybeSingle();

    if (!p) { setLoading(false); return; }

    const { data: s } = await supabase
      .from("profiles")
      .select("id, nickname, avatar_url, slogan")
      .eq("id", p.seller_id)
      .maybeSingle();
    setSeller(s);

    setProduct(p);

    if (user) {
      const { data: purchase } = await supabase
        .from("tap_purchases")
        .select("status")
        .eq("product_id", productId)
        .eq("buyer_id", user.id)
        .maybeSingle();
      setPurchased(purchase?.status === "completed");
    }
    setLoading(false);
  }

  async function startPurchase() {
    if (!userId) {
      window.location.href = `/login?redirectTo=/tap-store/${productId}`;
      return;
    }
    setPurchasing(true);
    const res = await fetch(`/api/tap-store/${productId}/purchase`, { method: "POST" });
    const data = await res.json();
    setPurchasing(false);
    if (!res.ok) return toast.error(data.error || "구매 실패");
    if (data.free) {
      toast.success("무료 상품 — 즉시 열람 가능");
      setPurchased(true);
      load();
    } else if (data.escrowId) {
      setPayment({ escrowId: data.escrowId, orderId: data.orderId, amount: data.amount });
    } else {
      toast.success("구매 준비 완료");
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-12"><Loader2 className="animate-spin mx-auto text-nu-muted" size={24} /></div>;
  if (!product) return <div className="max-w-4xl mx-auto px-6 py-12 text-center text-nu-graphite">상품을 찾을 수 없습니다</div>;

  const isSeller = userId === product.seller_id;
  const canAccessFull = isSeller || purchased || product.price === 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 pb-20">
      <Link href="/tap-store" className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline mb-4">
        <ArrowLeft size={11} /> 탭 스토어
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,300px] gap-6 mb-8">
        <div>
          {product.cover_url && (
            <div className="aspect-[3/2] bg-nu-ink/5 overflow-hidden mb-4 border-[2px] border-nu-ink/10">
              <img src={product.cover_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-ink/5 text-nu-graphite px-1.5 py-0.5">
              {product.product_type}
            </span>
            {product.tags?.map((t: string) => (
              <span key={t} className="font-mono-nu text-[9px] text-nu-pink">#{t}</span>
            ))}
          </div>
          <h1 className="font-head text-2xl font-extrabold text-nu-ink mb-2">{product.title}</h1>
          {product.summary && <p className="text-[14px] text-nu-graphite leading-relaxed">{product.summary}</p>}

          {seller && (
            <Link href={`/portfolio/${seller.id}`} className="mt-4 inline-flex items-center gap-2 p-2 border border-nu-ink/10 hover:border-nu-pink no-underline">
              {seller.avatar_url ? <img src={seller.avatar_url} className="w-8 h-8 rounded-full" alt="" /> : <div className="w-8 h-8 rounded-full bg-nu-pink/20" />}
              <div>
                <div className="font-bold text-[13px] text-nu-ink">{seller.nickname}</div>
                {seller.slogan && <div className="font-mono-nu text-[10px] text-nu-graphite">{seller.slogan}</div>}
              </div>
            </Link>
          )}
        </div>

        <aside className="space-y-3">
          <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4">
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">가격</div>
            <div className="font-head text-[28px] font-extrabold text-nu-pink tabular-nums leading-none">
              {product.price === 0 ? "무료" : `₩${fmt(product.price)}`}
            </div>
            {product.sales_count > 0 && (
              <p className="font-mono-nu text-[10px] text-nu-amber mt-1">🔥 {product.sales_count}명 구매</p>
            )}

            {payment ? (
              <div className="mt-4 space-y-2">
                <p className="font-mono-nu text-[10px] text-nu-graphite">결제를 완료하면 즉시 열람 가능</p>
                <EscrowPaymentButton
                  escrowId={payment.escrowId}
                  orderId={payment.orderId}
                  amount={payment.amount}
                  orderName={product.title.slice(0, 50)}
                  provider="toss"
                />
              </div>
            ) : canAccessFull ? (
              <div className="mt-3 flex items-center gap-1 font-mono-nu text-[11px] text-green-700">
                <CheckCircle2 size={12} /> 열람 가능
              </div>
            ) : (
              <button
                type="button"
                onClick={startPurchase}
                disabled={purchasing}
                className="mt-3 w-full py-2.5 bg-nu-pink text-nu-paper font-mono-nu text-[11px] font-bold uppercase tracking-widest hover:bg-nu-pink/90 disabled:opacity-50 inline-flex items-center justify-center gap-1"
              >
                {purchasing ? <Loader2 size={12} className="animate-spin" /> : <ShoppingBag size={12} />}
                {product.price === 0 ? "무료 받기" : "구매하기"}
              </button>
            )}
          </div>

          {isSeller && (
            <div className="border-[2px] border-nu-amber bg-nu-amber/5 p-3">
              <p className="font-mono-nu text-[10px] uppercase text-nu-amber font-bold mb-1">판매자 뷰</p>
              <p className="text-[11px] text-nu-graphite">이 상품의 소유자입니다. 현재 상태: <strong>{product.status}</strong></p>
            </div>
          )}
        </aside>
      </div>

      {/* 미리보기 */}
      {product.preview_md && (
        <section className="border-[2px] border-nu-ink/10 bg-nu-cream/20 p-5 mb-6">
          <h2 className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite font-bold mb-3">
            <BookOpen size={11} className="inline mr-1" /> 미리보기
          </h2>
          <article className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-[13px] text-nu-ink leading-relaxed">
            {product.preview_md}
          </article>
        </section>
      )}

      {/* 본문 */}
      {canAccessFull && product.full_content_md && (
        <section className="border-[2.5px] border-nu-pink bg-nu-paper p-5 mb-6">
          <h2 className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-pink font-bold mb-3">
            🔓 구매 전용 콘텐츠
          </h2>
          <article className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-[13px] text-nu-ink leading-relaxed">
            {product.full_content_md}
          </article>
        </section>
      )}

      {/* 첨부 파일 */}
      {canAccessFull && Array.isArray(product.attached_files) && product.attached_files.length > 0 && (
        <section className="border-[2px] border-nu-ink bg-nu-paper p-4">
          <h2 className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-ink font-bold mb-3">
            <Download size={11} className="inline mr-1" /> 다운로드 ({product.attached_files.length}개)
          </h2>
          <ul className="list-none m-0 p-0 space-y-1.5">
            {product.attached_files.map((f: any, i: number) => (
              <li key={i}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 border border-nu-ink/10 hover:border-nu-pink no-underline"
                >
                  <Download size={14} className="text-nu-pink shrink-0" />
                  <span className="font-mono text-[13px] text-nu-ink flex-1 truncate">{f.name}</span>
                  <span className="font-mono-nu text-[10px] text-nu-muted">열기 →</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Locked 안내 */}
      {!canAccessFull && (product.full_content_md || (product.attached_files?.length > 0)) && (
        <section className="border-[2px] border-dashed border-nu-ink/20 p-8 text-center bg-nu-cream/20">
          <Lock size={28} className="mx-auto text-nu-muted mb-2" />
          <p className="text-[13px] text-nu-ink font-bold mb-1">구매 후 열람 가능합니다</p>
          <p className="text-[11px] text-nu-graphite">본문 · 첨부 파일 · 관련 리소스 모두 접근 가능</p>
        </section>
      )}
    </div>
  );
}
