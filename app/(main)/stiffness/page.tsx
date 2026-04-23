import { createClient } from "@/lib/supabase/server";
import { STIFFNESS_MATRIX, ACTION_LABELS } from "@/lib/stiffness/rules";
import { BOLT_TYPE_META } from "@/lib/bolt/labels";
import { StiffnessBreakdown } from "@/components/shared/stiffness-breakdown";
import { Target, Zap, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "강성 · Stiffness Protocol — nutunion",
  description: "강성은 너트 합류·볼트 기여·탭 작성·미팅 참석으로 쌓이는 누적 지표입니다.",
};

export default async function StiffnessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={16} className="text-nu-pink" />
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold">
            Stiffness Protocol
          </span>
        </div>
        <h1 className="font-head text-[32px] font-extrabold text-nu-ink">강성 · Stiffness</h1>
        <p className="text-[14px] text-nu-graphite mt-2 leading-[1.7]">
          강성은 너트유니온에서 <strong>조작 불가능한 누적 기여도 지표</strong>입니다.
          너트 합류·볼트 기여·탭 작성·미팅 참석·리뷰 응답 등 실제 활동이 쌓여 계산됩니다.
          공개 산식은 아래에서 투명하게 공개합니다.
        </p>
      </header>

      {user && (
        <section className="mb-10">
          <StiffnessBreakdown userId={user.id} />
        </section>
      )}

      <section className="mb-10">
        <h2 className="font-head text-[18px] font-extrabold text-nu-ink mb-4 flex items-center gap-2">
          <Target size={16} /> 볼트 유형별 기여 매트릭스
        </h2>
        <div className="space-y-4">
          {Object.entries(STIFFNESS_MATRIX).map(([btype, rules]) => {
            const meta = BOLT_TYPE_META[btype as keyof typeof BOLT_TYPE_META];
            return (
              <div key={btype} className="border border-nu-ink/[0.08] bg-white p-4 rounded-[var(--ds-radius-lg)]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[16px]">{meta?.emoji}</span>
                  <span className={`font-mono-nu text-[11px] uppercase tracking-widest font-bold ${meta?.accentColor}`}>
                    {meta?.label}
                  </span>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {Object.entries(rules).map(([action, weight]) => (
                    <li key={action} className="flex items-center justify-between text-[12px] px-2 py-1 bg-nu-cream/20 rounded">
                      <span className="text-nu-graphite">{ACTION_LABELS[action as keyof typeof ACTION_LABELS] || action}</span>
                      <span className="font-mono-nu font-bold tabular-nums text-nu-pink">+{weight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border border-nu-ink/10 bg-nu-cream/20 p-5 rounded-[var(--ds-radius-lg)]">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={14} className="text-green-700" />
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-green-700 font-bold">
            올리는 방법
          </span>
        </div>
        <ul className="space-y-2 text-[13px] text-nu-ink leading-[1.7]">
          <li>→ <strong className="text-nu-pink">첫 너트 합류 +5</strong> — 관심사 너트에 합류</li>
          <li>→ <strong className="text-nu-pink">첫 볼트 마일스톤 완료 +10</strong> — 볼트 내 마일스톤 달성</li>
          <li>→ <strong className="text-nu-pink">첫 볼트 마감 +25</strong> — 볼트 완료 + 탭 아카이브 발행</li>
          <li>→ <strong className="text-nu-pink">회고 작성 +5</strong> — 볼트 탭에 회고록 작성</li>
          <li>→ <strong className="text-nu-pink">피어 리뷰 +3</strong> — 동료 리뷰 작성</li>
        </ul>
      </section>

      <p className="text-[11px] text-nu-muted font-mono-nu mt-6 text-center">
        강성은 조작 불가능한 누적 지표입니다. DB 트리거로 실시간 계산됩니다.
      </p>
    </div>
  );
}
