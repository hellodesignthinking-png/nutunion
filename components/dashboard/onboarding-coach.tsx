"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, ArrowRight, Check, X, Users, Rocket, Target, Loader2 } from "lucide-react";

const SPECIALTIES = [
  { key: "space",    emoji: "🏢", label: "공간 (Space)",    desc: "도시·건축·로컬·부동산 프로젝트", vibe: "Architect" },
  { key: "culture",  emoji: "🎨", label: "문화 (Culture)",  desc: "콘텐츠·커뮤니티·라이프스타일",    vibe: "Curator" },
  { key: "platform", emoji: "💻", label: "플랫폼 (Platform)", desc: "서비스·SaaS·개발·리서치",         vibe: "Builder" },
  { key: "vibe",     emoji: "✨", label: "바이브 (Vibe)",   desc: "브랜드·비주얼·영상·경험 디자인",   vibe: "Designer" },
];

interface Props {
  userId: string;
  nickname: string;
  currentSpecialty: string | null;
  onboardedAt: string | null;
  groupCount: number;
  projectCount: number;
}

/**
 * 신규 와셔 온보딩 코치 — "첫 30초" 가이드.
 * Stage 1: 관심사 선택 → Stage 2: 추천 너트 3개 → Stage 3: 첫 볼트 제안
 *
 * 완료 시 profiles.onboarded_at 기록 → 다시 표시 안 됨.
 */
export function OnboardingCoach({ userId, nickname, currentSpecialty, onboardedAt, groupCount, projectCount }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(currentSpecialty ? (groupCount > 0 ? 3 : 2) : 1);
  const [specialty, setSpecialty] = useState<string | null>(currentSpecialty);
  const [savingSpecialty, setSavingSpecialty] = useState(false);
  const [recommendedNuts, setRecommendedNuts] = useState<any[]>([]);
  const [recommendedBolts, setRecommendedBolts] = useState<any[]>([]);
  const [loadingNuts, setLoadingNuts] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const hidden = !!onboardedAt || dismissed;

  // Step 2: 추천 너트 로드 (cancel-safe)
  useEffect(() => {
    if (hidden || step !== 2 || !specialty) return;
    let cancelled = false;
    setLoadingNuts(true);
    const supabase = createClient();
    supabase
      .from("groups")
      .select("id, name, description, category, image_url")
      .eq("category", specialty)
      .eq("is_active", true)
      .limit(6)
      .then(({ data }) => {
        if (cancelled) return;
        setRecommendedNuts(data || []);
        setLoadingNuts(false);
      });
    return () => { cancelled = true; };
  }, [hidden, step, specialty]);

  // Step 3: 추천 볼트 로드 (cancel-safe)
  useEffect(() => {
    if (hidden || step !== 3 || !specialty) return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("projects")
      .select("id, title, description, category, status, image_url")
      .eq("category", specialty)
      .eq("status", "active")
      .eq("recruiting", true)
      .limit(4)
      .then(({ data }) => {
        if (cancelled) return;
        setRecommendedBolts(data || []);
      });
    return () => { cancelled = true; };
  }, [hidden, step, specialty]);

  if (hidden) return null;

  async function saveSpecialty(key: string) {
    setSavingSpecialty(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ specialty: key }).eq("id", userId);
    setSpecialty(key);
    setSavingSpecialty(false);
    setStep(2);
  }

  async function markOnboarded() {
    setFinishing(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ onboarded_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
      setDismissed(true);
    } catch (err: any) {
      const { toast } = await import("sonner");
      toast.error("온보딩 저장 실패 — 다시 시도해주세요");
      setFinishing(false);
    }
  }

  const finishOnboarding = markOnboarded;
  const skip = markOnboarded;

  return (
    <section className="border border-[color:var(--neutral-100)] rounded-[var(--ds-radius-xl)] bg-[color:var(--neutral-0)] mb-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--liquid-primary) 6%, #ffffff), var(--neutral-0) 70%)" }}>
      {/* 진행 바 */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-nu-ink/10">
        <div className="h-full bg-nu-pink transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      <button
        type="button"
        onClick={skip}
        disabled={finishing}
        className="absolute top-3 right-3 p-1 text-nu-graphite hover:text-nu-ink hover:bg-nu-ink/5 transition-colors z-10"
        aria-label="온보딩 건너뛰기"
      >
        <X size={14} />
      </button>

      <div className="px-5 pt-5 pb-3 border-b border-nu-ink/10">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={14} className="text-nu-pink" />
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold">
            Onboarding · {step}/3
          </span>
        </div>
        <h2 className="text-[18px] sm:text-[20px] font-bold text-nu-ink">
          {step === 1 && <><span className="text-nu-pink">{nickname}</span>님, 어떤 분야에 관심이 있나요?</>}
          {step === 2 && <>이 <span className="text-nu-pink">너트</span> 에서 시작해보세요</>}
          {step === 3 && <>첫 <span className="text-nu-blue">볼트</span> 에 참여할 준비 됐어요</>}
        </h2>
        <p className="text-[12px] text-nu-graphite mt-1 leading-relaxed">
          {step === 1 && "관심 분야를 알려주시면 맞춤 너트/볼트를 추천해드립니다. 나중에 바꿀 수 있어요."}
          {step === 2 && "관심 분야 기반 커뮤니티입니다. 하나 이상 참여하면 첫 활동이 시작돼요."}
          {step === 3 && "지금 모집 중인 볼트입니다. 지원하거나 나중에 도전해도 좋아요."}
        </p>
      </div>

      {/* Step 1 — 관심사 선택 */}
      {step === 1 && (
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SPECIALTIES.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={savingSpecialty}
              onClick={() => saveSpecialty(s.key)}
              className={`text-left border-[2px] p-3 transition-all group ${
                specialty === s.key
                  ? "border-nu-pink bg-nu-pink/5"
                  : "border-nu-ink/20 hover:border-nu-ink hover:bg-nu-ink/[0.02]"
              } disabled:opacity-60`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-[24px] leading-none">{s.emoji}</span>
                <div className="flex-1">
                  <div className="font-bold text-[13px] text-nu-ink flex items-center gap-2">
                    {s.label}
                    <span className="font-mono-nu text-[9px] uppercase text-nu-graphite">{s.vibe}</span>
                  </div>
                  <p className="text-[11px] text-nu-graphite mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
                {savingSpecialty && specialty === s.key && (
                  <Loader2 size={14} className="animate-spin text-nu-pink shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 2 — 추천 너트 */}
      {step === 2 && (
        <div className="p-5">
          {loadingNuts ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-nu-ink/5 animate-pulse" />
              ))}
            </div>
          ) : recommendedNuts.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-[12px] text-nu-graphite mb-3">
                아직 이 분야 너트가 없네요. 직접 만들어볼까요?
              </p>
              <Link
                href="/groups/create"
                className="inline-flex items-center gap-1 font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 no-underline"
              >
                <Users size={11} /> 새 너트 만들기
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {recommendedNuts.slice(0, 6).map((g) => (
                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className="border-[2px] border-nu-ink/20 hover:border-nu-pink p-3 no-underline transition-all group flex flex-col"
                >
                  <div className="font-bold text-[13px] text-nu-ink group-hover:text-nu-pink transition-colors">{g.name}</div>
                  {g.description && (
                    <p className="text-[11px] text-nu-graphite mt-1 line-clamp-2 leading-relaxed flex-1">{g.description}</p>
                  )}
                  <div className="mt-2 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink flex items-center gap-1">
                    참여 <ArrowRight size={10} />
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center justify-between pt-3 border-t border-nu-ink/10">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink"
            >
              ← 이전
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors"
            >
              다음 → 볼트 찾기
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — 추천 볼트 */}
      {step === 3 && (
        <div className="p-5">
          {recommendedBolts.length === 0 ? (
            <div className="border-[2px] border-dashed border-nu-ink/20 p-5 text-center">
              <Rocket size={20} className="mx-auto text-nu-muted mb-2" />
              <p className="text-[12px] text-nu-graphite">아직 이 분야에 모집 중 볼트가 없어요.</p>
              <p className="text-[11px] text-nu-muted mt-1">너트에서 활동하다 보면 곧 새 볼트가 만들어집니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {recommendedBolts.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="border-[2px] border-nu-ink/20 hover:border-nu-blue p-3 no-underline transition-all group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Rocket size={12} className="text-nu-blue" />
                    <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-blue">Recruiting</span>
                  </div>
                  <div className="font-bold text-[13px] text-nu-ink group-hover:text-nu-blue">{p.title}</div>
                  {p.description && (
                    <p className="text-[11px] text-nu-graphite mt-1 line-clamp-2 leading-relaxed">{p.description}</p>
                  )}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-4 bg-nu-cream/30 border border-nu-ink/10 p-3 flex items-start gap-2">
            <Target size={14} className="text-nu-amber shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-amber">다음 단계</div>
              <p className="text-[11px] text-nu-graphite mt-0.5 leading-relaxed">
                너트 참여 → 프로필 완성 → 볼트 지원 / 첫 마일스톤 완료 시 <strong className="text-nu-ink">강성 +25 획득</strong>
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between pt-3 border-t border-nu-ink/10">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink"
            >
              ← 이전
            </button>
            <button
              type="button"
              onClick={finishOnboarding}
              disabled={finishing}
              className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {finishing ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              {finishing ? "저장 중..." : "시작하기"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
