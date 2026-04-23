import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { creatorEconomyEnabled } from "@/lib/flags";
import { BookOpen, ShoppingBag, Sparkles, Plus } from "lucide-react";
import { PageHero } from "@/components/shared/page-hero";

export const dynamic = "force-dynamic";
export const metadata = { title: "탭 스토어 — nutunion" };

const TYPE_META: Record<string, { emoji: string; label: string }> = {
  template:  { emoji: "📐", label: "템플릿" },
  report:    { emoji: "📊", label: "리포트" },
  course:    { emoji: "🎓", label: "코스" },
  dataset:   { emoji: "🗃", label: "데이터셋" },
  ebook:     { emoji: "📖", label: "전자책" },
  other:     { emoji: "✨", label: "기타" },
};

function fmt(n: number) { return new Intl.NumberFormat("ko-KR").format(n); }

export default async function TapStorePage() {
  const enabled = await creatorEconomyEnabled();
  if (!enabled) {
    return (
      <div className="bg-nu-paper min-h-screen">
        <PageHero
          compact
          category="Tap Store"
          title="탭 스토어 · Coming Q2 2026"
          description="와셔가 만든 템플릿 · 리포트 · 코스를 거래하는 크리에이터 이코노미."
          stats={[
            { label: "시드 상품", value: "3종 준비 중", icon: <ShoppingBag size={12} /> },
            { label: "수익 분배", value: "창작자 90%", icon: <Sparkles size={12} /> },
          ]}
        />
        <div className="reader-shell">
          <div className="max-w-[680px] mx-auto px-4 md:px-6 py-10 space-y-8">
            <section>
              <h2 className="text-[22px] font-semibold text-[color:var(--neutral-900)] leading-tight mb-3">
                볼트 산출물이 다시 팔릴 수 있도록
              </h2>
              <p className="text-[15px] leading-[1.75] text-[color:var(--neutral-900)] mb-4">
                너트유니온의 가장 큰 자산은 <strong>실제로 돌아간 프로젝트의 기록</strong>입니다.
                제로싸이트의 LH 공급모델 검토 템플릿, 플래그테일의 공간 운영 매뉴얼, SecondWind 의 러닝 커리큘럼 —
                이것들이 <strong>새 와셔의 시작점</strong>이 되는 곳이 탭 스토어예요.
              </p>
              <p className="text-[15px] leading-[1.75] text-[color:var(--neutral-900)]">
                노션 템플릿 마켓처럼 단순 거래가 아니라, <strong>실전에서 검증된 작업물</strong>만 올라옵니다.
                구매자는 템플릿과 함께 만든 사람의 강성 지표 · 원본 볼트의 마감 회고까지 같이 받아봅니다.
              </p>
            </section>

            <section>
              <h2 className="text-[18px] font-semibold text-[color:var(--neutral-900)] mb-3">시드 상품 3종 (준비 중)</h2>
              <ul className="list-none m-0 p-0 space-y-3">
                {[
                  { title: "LH 사회주택 공급모델 분석 템플릿", kind: "템플릿", price: "89,000원", origin: "ZeroSite" },
                  { title: "공간 운영 매뉴얼 — Flagtale 3년 축적", kind: "매뉴얼", price: "29,000원", origin: "Flagtale" },
                  { title: "SecondWind 러닝 12주 커리큘럼", kind: "코스", price: "49,000원", origin: "SecondWind" },
                ].map((item) => (
                  <li key={item.title} className="p-4 rounded-[var(--ds-radius-lg)] border border-[color:var(--neutral-100)] bg-[color:var(--neutral-0)]">
                    <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-[color:var(--neutral-500)] mb-1">{item.kind} · {item.origin}</div>
                    <div className="text-[15px] font-semibold text-[color:var(--neutral-900)] mb-0.5">{item.title}</div>
                    <div className="text-[13px] text-[color:var(--neutral-500)]">{item.price} · Coming soon</div>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-[18px] font-semibold text-[color:var(--neutral-900)] mb-3">수익 구조</h2>
              <ul className="list-none m-0 p-0 space-y-2 text-[14px] text-[color:var(--neutral-900)] leading-[1.7]">
                <li>— 창작자 <strong>90%</strong>, 플랫폼 수수료 <strong>10%</strong></li>
                <li>— 볼트 내부 거래 (같은 너트 멤버간)는 수수료 별도 설정 가능</li>
                <li>— 결제는 토스페이먼츠 · 포트원 에스크로로 안전하게 보호</li>
              </ul>
            </section>

            <section className="pt-4 border-t border-[color:var(--neutral-100)]">
              <p className="text-[14px] text-[color:var(--neutral-500)] leading-[1.7]">
                런칭 시점에 알림 받으시려면 <a href="/signup" className="underline decoration-[color:var(--neutral-200)] underline-offset-2 hover:decoration-[color:var(--neutral-900)]">가입</a> 후 프로필에서 "창작자로 등록" 체크박스를 선택해주세요.
              </p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/tap-store");

  const [{ data: products }, { data: myProducts }] = await Promise.all([
    supabase
      .from("tap_products")
      .select("id, title, summary, cover_url, product_type, price, currency, sales_count, tags, seller:profiles!tap_products_seller_id_fkey(id, nickname, avatar_url)")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("tap_products")
      .select("id, status")
      .eq("seller_id", user.id),
  ]);

  const items = (products as any[]) || [];
  const myCount = (myProducts as any[])?.length || 0;

  return (
    <div className="bg-nu-paper min-h-screen pb-20">
      <PageHero
        compact
        category="Tap Store"
        title="탭 스토어"
        description="와셔가 만든 템플릿·리포트·코스. 커뮤니티 수익은 창작자에게 90%, 플랫폼 10%."
        stats={[
          { label: "판매 상품", value: `${items.length}개`, icon: <ShoppingBag size={12} /> },
          { label: "내 상품", value: `${myCount}개`, icon: <Sparkles size={12} /> },
        ]}
      />

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <section className="flex items-center justify-between border-[2px] border-nu-ink/10 bg-nu-cream/30 p-3">
          <div>
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">창작자이신가요?</p>
            <p className="text-[12px] text-nu-ink mt-0.5">볼트 산출물·템플릿을 판매해보세요</p>
          </div>
          <Link href="/tap-store/new"
            className="inline-flex items-center gap-1 font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 bg-nu-ink text-nu-paper hover:bg-nu-pink no-underline">
            <Plus size={11} /> 상품 등록
          </Link>
        </section>

        {items.length === 0 ? (
          <div className="border-[2px] border-dashed border-nu-ink/15 p-12 text-center">
            <BookOpen size={28} className="mx-auto text-nu-muted mb-3" />
            <p className="text-[13px] text-nu-graphite">아직 등록된 상품이 없습니다</p>
            <p className="text-[11px] text-nu-muted mt-1">첫 상품을 올려 스토어를 열어보세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((p) => {
              const meta = TYPE_META[p.product_type] || TYPE_META.other;
              return (
                <Link key={p.id} href={`/tap-store/${p.id}`}
                  className="group border-[2px] border-nu-ink/10 bg-nu-paper hover:border-nu-pink no-underline transition-all overflow-hidden">
                  {p.cover_url ? (
                    <div className="aspect-[3/2] bg-nu-ink/5 overflow-hidden">
                      <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-[3/2] bg-gradient-to-br from-nu-pink/10 to-nu-blue/10 flex items-center justify-center text-[40px]">
                      {meta.emoji}
                    </div>
                  )}
                  <div className="p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-ink/5 text-nu-graphite px-1.5 py-0.5">
                        {meta.emoji} {meta.label}
                      </span>
                      {p.sales_count > 0 && (
                        <span className="font-mono-nu text-[9px] text-nu-amber ml-auto">🔥 {p.sales_count}</span>
                      )}
                    </div>
                    <div className="font-bold text-[13px] text-nu-ink group-hover:text-nu-pink truncate">{p.title}</div>
                    {p.summary && <p className="text-[11px] text-nu-graphite line-clamp-2 mt-1 leading-relaxed">{p.summary}</p>}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-nu-ink/10">
                      <span className="font-mono-nu text-[10px] text-nu-graphite">{p.seller?.nickname || "—"}</span>
                      <span className="font-head text-[15px] font-extrabold text-nu-pink tabular-nums">
                        {p.price === 0 ? "무료" : `₩${fmt(p.price)}`}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
