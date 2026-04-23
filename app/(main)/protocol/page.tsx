import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Zap, ArrowRight, Building2, Check, Code2 } from "lucide-react";
import { PageHero } from "@/components/shared/page-hero";
import { GrammarPlayground } from "@/components/art/grammar-playground";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "nutunion Protocol — 너트유니온 오픈 프로토콜",
  description: "너트-볼트-탭-와셔-강성 구조를 자체 커뮤니티에 화이트라벨로 설치하세요.",
};

export default async function ProtocolPage() {
  const supabase = await createClient();
  const { data: instances } = await supabase
    .from("protocol_instances")
    .select("id, slug, name, domain, license_tier, status, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);

  const tiers = [
    { key: "community", label: "Community",  price: "무료",  features: ["너트·볼트·탭·와셔 전 기능", "월 50명 이하", "nutunion 로고 표시"], cta: "시작하기" },
    { key: "pro",       label: "Pro",        price: "월 29만원", features: ["제한 없음", "커스텀 도메인", "브랜드 커스터마이즈", "API 접근"], cta: "상담 신청", highlight: true },
    { key: "enterprise",label: "Enterprise", price: "협의",   features: ["온프레미스 옵션", "SLA", "전담 엔지니어", "수수료율 협상"], cta: "영업 문의" },
  ];

  return (
    <div className="bg-nu-paper min-h-screen pb-20">
      <PageHero
        compact
        category="Open Protocol"
        title="nutunion Protocol"
        description="너트-볼트-탭-와셔-강성. 커뮤니티를 구조화하는 오픈 프로토콜을 당신의 씬에 설치하세요."
      />

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 space-y-10">
        {/* Hero explainer */}
        <section className="border-[2.5px] border-nu-ink bg-gradient-to-br from-nu-pink/5 via-nu-paper to-nu-blue/5 p-6 md:p-8">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-nu-pink" />
            <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold">
              Protocol v0.1 · 베타
            </span>
          </div>
          <h2 className="font-head text-2xl md:text-3xl font-extrabold text-nu-ink mb-3">
            커뮤니티는 템플릿이 아닌 <span className="text-nu-pink">프로토콜</span>로 자라납니다
          </h2>
          <p className="text-[14px] text-nu-graphite leading-relaxed max-w-3xl">
            슬랙·디스코드·노션이 해결하지 못한 것: <strong className="text-nu-ink">"관심사 → 실행 → 아카이브 → 평판"</strong>의 자연스러운 전환.
            너트유니온은 이 전환을 <strong>강성(Stiffness)</strong> 이라는 누적 지표로 게임화합니다.
            이 프로토콜을 <strong>당신의 씬</strong>에 화이트라벨로 심어보세요.
          </p>
        </section>

        {/* Tiers */}
        <section>
          <h3 className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite font-bold mb-4">
            💎 라이선스 티어
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {tiers.map((t) => (
              <div key={t.key}
                className={`p-5 border-[2.5px] ${t.highlight ? "border-nu-pink bg-nu-pink/5 relative" : "border-nu-ink/15 bg-nu-paper"} flex flex-col`}>
                {t.highlight && (
                  <span className="absolute -top-3 left-4 font-mono-nu text-[9px] uppercase tracking-widest bg-nu-pink text-nu-paper px-2 py-0.5">
                    추천
                  </span>
                )}
                <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">{t.label}</div>
                <div className="font-head text-[22px] font-extrabold text-nu-ink mb-3">{t.price}</div>
                <ul className="space-y-1.5 mb-4 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[12px] text-nu-graphite">
                      <Check size={11} className="text-green-600 shrink-0 mt-[3px]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a href={`mailto:hello@nutunion.kr?subject=Protocol ${t.label}`}
                  className={`inline-flex items-center gap-1 justify-center font-mono-nu text-[11px] font-bold uppercase tracking-widest py-2 no-underline ${
                    t.highlight ? "bg-nu-pink text-nu-paper hover:bg-nu-pink/90" : "border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper"
                  }`}>
                  {t.cta} <ArrowRight size={11} />
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Active instances */}
        <section>
          <h3 className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-graphite font-bold mb-3">
            🌍 활성 인스턴스 ({(instances || []).length})
          </h3>
          {(instances || []).length === 0 ? (
            <div className="border-[2px] border-dashed border-nu-ink/15 p-8 text-center">
              <Building2 size={24} className="mx-auto text-nu-muted mb-2" />
              <p className="text-[13px] text-nu-graphite">아직 공개된 인스턴스가 없습니다</p>
              <p className="text-[11px] text-nu-muted mt-1">첫 번째 파트너가 되시겠어요?</p>
            </div>
          ) : (
            <ul className="list-none m-0 p-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {instances!.map((i) => (
                <li key={i.id} className="border-[2px] border-nu-ink/10 hover:border-nu-pink bg-nu-paper p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-ink/5 text-nu-graphite px-1.5 py-0.5">
                      {i.license_tier}
                    </span>
                    <span className="font-bold text-[14px] text-nu-ink">{i.name}</span>
                  </div>
                  {i.domain && <p className="font-mono-nu text-[11px] text-nu-pink">{i.domain}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Grammar Playground — 오픈소스 표현 */}
        <GrammarPlayground />

        {/* Dev preview */}
        <section className="border-[2px] border-nu-ink/10 bg-nu-cream/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Code2 size={14} className="text-nu-blue" />
            <h3 className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-blue font-bold">개발자용</h3>
          </div>
          <p className="text-[12px] text-nu-graphite leading-relaxed mb-3">
            프로토콜 SDK 는 오픈소스로 공개 예정입니다. GitHub 에서 진행 상황을 확인하세요.
          </p>
          <a href="https://github.com/nutunion" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper no-underline">
            GitHub → <ArrowRight size={11} />
          </a>
        </section>
      </div>
    </div>
  );
}
