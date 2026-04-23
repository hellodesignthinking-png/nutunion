"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TrendingUp, Info, Flame, Target, Users as UsersIcon, CheckCircle2 } from "lucide-react";

interface StiffnessData {
  stiffness: number;
  activity_score: number;
  points: number;
  bolts_joined: number;
  bolts_completed: number;
  nuts_active: number;
  events_this_week: number;
  delta_this_week: number;
}

const FORMULA_ROWS: { key: keyof StiffnessData; label: string; weight: number; color: string; icon: React.ReactNode }[] = [
  { key: "activity_score",   label: "활동 점수",    weight: 1.0, color: "bg-nu-pink",   icon: <Flame size={11} /> },
  { key: "points",           label: "🥜 포인트",    weight: 0.5, color: "bg-nu-amber",  icon: <Target size={11} /> },
  { key: "bolts_completed",  label: "완료 볼트",    weight: 20,  color: "bg-green-600", icon: <CheckCircle2 size={11} /> },
  { key: "bolts_joined",     label: "참여 볼트",    weight: 5,   color: "bg-nu-blue",   icon: <Target size={11} /> },
  { key: "nuts_active",      label: "활성 너트",    weight: 3,   color: "bg-purple-500",icon: <UsersIcon size={11} /> },
];

/**
 * 강성(Stiffness) 투명화 위젯.
 * - 공개된 산식 그대로 표시
 * - 각 component 기여도 시각화
 * - 이번 주 델타
 * - 다음 단계 가이드
 *
 * 사용: <StiffnessBreakdown userId={user.id} compact={true} />
 */
export function StiffnessBreakdown({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const [data, setData] = useState<StiffnessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFormula, setShowFormula] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    setLoading(true);

    (async () => {
      const { data: row, error } = await supabase
        .from("stiffness_breakdown")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;

      if (!error && row) {
        setData(row as StiffnessData);
        setLoading(false);
        return;
      }

      // fallback: view 누락 환경
      const { data: p } = await supabase
        .from("profiles")
        .select("activity_score, points")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      setData({
        stiffness: Math.round(((p?.activity_score || 0) * 1.0) + ((p?.points || 0) * 0.5)),
        activity_score: p?.activity_score || 0,
        points: p?.points || 0,
        bolts_joined: 0,
        bolts_completed: 0,
        nuts_active: 0,
        events_this_week: 0,
        delta_this_week: 0,
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return <div className="border border-[color:var(--neutral-100)] rounded-[var(--ds-radius-lg)] p-4 animate-pulse h-24 bg-[color:var(--neutral-25)]" />;
  }
  if (!data) return null;

  // 강성 0 + 활동 0 → 친절한 초대 UX (이전엔 0 숫자만 노출)
  const isBrandNew = (data.stiffness ?? 0) === 0 &&
                     (data.bolts_joined ?? 0) === 0 &&
                     (data.nuts_active ?? 0) === 0;
  if (isBrandNew && !compact) {
    return (
      <section className="border border-[color:var(--neutral-100)] rounded-[var(--ds-radius-xl)] bg-[color:var(--neutral-0)] p-5">
        <div className="flex items-center gap-2 mb-2">
          <Flame size={14} className="text-[color:var(--liquid-primary)]" />
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-[color:var(--liquid-primary)] font-bold">Stiffness · 0</span>
        </div>
        <p className="text-[15px] text-[color:var(--neutral-900)] leading-[1.6] mb-2">
          첫 움직임을 시작해보세요
        </p>
        <p className="text-[13px] text-[color:var(--neutral-500)] leading-[1.6] mb-3">
          강성은 너트 합류 · 볼트 기여 · 탭 작성 · 미팅 참석 으로 쌓여요.
        </p>
        <ul className="space-y-1 text-[12px] text-[color:var(--neutral-900)]">
          <li>→ 첫 너트 합류 <strong className="text-[color:var(--liquid-primary)]">+5</strong></li>
          <li>→ 첫 볼트 마일스톤 완료 <strong className="text-[color:var(--liquid-primary)]">+10</strong></li>
          <li>→ 첫 볼트 마감 <strong className="text-[color:var(--liquid-primary)]">+25</strong></li>
        </ul>
      </section>
    );
  }

  const total = data.stiffness || 1;
  const contributions = FORMULA_ROWS.map((r) => {
    const raw = (data[r.key] as number) || 0;
    const weighted = Math.round(raw * r.weight);
    return { ...r, raw, weighted, pct: Math.min(100, (weighted / total) * 100) };
  });

  // 다음 단계 가이드
  const tips: string[] = [];
  if (data.bolts_completed === 0) tips.push("첫 볼트 마감 시 +20 (완료 볼트)");
  if (data.nuts_active < 3) tips.push(`활성 너트 ${3 - data.nuts_active}개 더 참여 (+${(3 - data.nuts_active) * 3})`);
  if (data.events_this_week === 0) tips.push("이번 주 활동(미팅/글/위키) 으로 점수 획득");

  if (compact) {
    return (
      <section className="border-[2.5px] border-nu-ink bg-nu-paper p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-graphite">강성 · Stiffness</div>
          {data.delta_this_week > 0 && (
            <span className="font-mono-nu text-[10px] font-bold text-green-700">+{data.delta_this_week} 이번 주</span>
          )}
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-head text-[32px] font-extrabold text-nu-pink tabular-nums leading-none">{data.stiffness}</span>
          <span className="font-mono-nu text-[9px] text-nu-graphite uppercase">points</span>
        </div>
        <div className="h-1.5 bg-nu-ink/10 flex overflow-hidden">
          {contributions.filter(c => c.pct > 0).map((c) => (
            <div key={c.key} className={c.color} style={{ width: `${c.pct}%` }} title={`${c.label}: ${c.weighted}`} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b-[2px] border-nu-ink bg-gradient-to-r from-nu-pink/10 to-nu-amber/10">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite">강성 · Stiffness Index</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="font-head text-[40px] font-extrabold text-nu-pink tabular-nums leading-none">{data.stiffness}</span>
            {data.delta_this_week > 0 && (
              <span className="font-mono-nu text-[11px] font-bold text-green-700 flex items-center gap-0.5">
                <TrendingUp size={11} /> +{data.delta_this_week}
                <span className="text-nu-graphite font-normal">· 7일</span>
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowFormula((v) => !v)}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[1.5px] border-nu-ink/20 hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-1"
          aria-expanded={showFormula}
        >
          <Info size={11} /> 산식
        </button>
      </header>

      {/* 공개 산식 */}
      {showFormula && (
        <div className="px-4 py-3 bg-nu-cream/30 border-b-[2px] border-nu-ink/10 font-mono-nu text-[10px] text-nu-graphite leading-relaxed">
          <div className="font-bold text-nu-ink mb-1">공개 산식 (Protocol)</div>
          <code className="block text-[10px] text-nu-ink">
            stiffness = activity×1.0 + points×0.5 + completed×20 + joined×5 + nuts×3
          </code>
          <p className="mt-2 text-[10px] text-nu-graphite">
            모든 값은 DB view <code>stiffness_breakdown</code> 에서 실시간 계산됩니다. 조작 불가능한 누적 지표입니다.
          </p>
        </div>
      )}

      {/* 구성 bar */}
      <div className="p-4 space-y-2">
        {contributions.map((c) => (
          <div key={c.key} className="group">
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="font-mono-nu text-nu-graphite flex items-center gap-1.5">
                <span className={`w-2 h-2 ${c.color}`} />
                {c.icon} {c.label}
              </span>
              <span className="font-mono-nu tabular-nums text-nu-ink">
                <span className="text-nu-graphite">{c.raw}</span>
                <span className="mx-1 text-nu-muted">×{c.weight}</span>
                <span className="font-bold">= {c.weighted}</span>
              </span>
            </div>
            <div className="h-1.5 bg-nu-ink/5 overflow-hidden">
              <div className={`h-full ${c.color}`} style={{ width: `${c.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* 다음 단계 가이드 */}
      {tips.length > 0 && (
        <div className="px-4 py-3 bg-nu-pink/5 border-t-[2px] border-nu-pink/20">
          <div className="font-mono-nu text-[9px] uppercase tracking-[0.25em] text-nu-pink font-bold mb-1.5">
            💡 강성 올리기
          </div>
          <ul className="list-none m-0 p-0 space-y-1">
            {tips.slice(0, 3).map((t, i) => (
              <li key={i} className="text-[11px] text-nu-ink flex items-start gap-1.5">
                <span className="text-nu-pink shrink-0">→</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
