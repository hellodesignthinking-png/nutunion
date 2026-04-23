import Link from "next/link";
import Image from "next/image";
import { computeNextBestAction } from "@/lib/next-best-action";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight, TrendingUp, Sparkles, Users, Rocket, BookOpen, Plus } from "lucide-react";

/**
 * Dashboard Hero — "Today's Protocol"
 * 0.5초 안에 ① 오늘의 Identity ② 강성 ③ Next Best Action 인지.
 */
export async function DashboardHeroSection({
  userId, nickname, avatarUrl,
}: { userId: string; nickname: string; avatarUrl?: string | null }) {
  const supabase = await createClient();

  const [nba, stiffnessRes] = await Promise.all([
    computeNextBestAction(userId).catch(() => null),
    supabase.from("stiffness_breakdown").select("stiffness, delta_this_week").eq("user_id", userId).maybeSingle().then(
      (r) => r,
      () => ({ data: null }),
    ),
  ]);

  const stiffness = (stiffnessRes as any)?.data?.stiffness ?? 0;
  const delta = (stiffnessRes as any)?.data?.delta_this_week ?? 0;

  // 오늘의 장르 (브랜드 Liquid Identity 와 동기화)
  const genres = ["Resonance", "Overlap", "Drift", "Echo", "Protocol", "Scene", "Vibe", "Pulse"];
  const dayIdx = Math.floor(Date.now() / 86400000) % genres.length;
  const todayGenre = genres[dayIdx];

  // 오늘의 액센트 컬러 (ink 는 고정, 오버레이만 회전)
  const accents = ["#FF3D88", "#4A90E2", "#F5A524", "#9B59B6", "#27AE60"];
  const todayAccent = accents[dayIdx % accents.length];

  return (
    <section className="bg-white border-[2px] border-nu-ink/[0.1] overflow-hidden">
      <div className="flex flex-col sm:flex-row items-stretch">
        {/* 왼쪽: 오늘의 Protocol 뱃지 (compact) */}
        <div
          className="sm:w-[120px] flex flex-col items-center justify-center px-4 py-3 sm:border-r border-b sm:border-b-0 border-nu-ink/[0.08] shrink-0"
          style={{ background: `linear-gradient(135deg, ${todayAccent}18, transparent 70%)` }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-head text-lg font-extrabold mb-1"
            style={{ background: todayAccent, color: "#fff" }}
          >
            ⊕
          </div>
          <p className="font-mono-nu text-[8px] uppercase tracking-[0.25em] text-nu-muted text-center">Protocol</p>
          <p className="text-[11px] font-bold text-nu-ink text-center mt-0.5">{todayGenre}</p>
        </div>

        {/* 오른쪽: 아바타 + 강성 + NBA + 퀵 액션 */}
        <div className="flex-1 p-4 flex flex-col gap-3">
          {/* 강성 + 아바타 row */}
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" width={32} height={32} className="rounded-full w-8 h-8 object-cover shrink-0" unoptimized />
            ) : (
              <div className="w-8 h-8 rounded-full bg-nu-cream flex items-center justify-center text-[13px] font-bold text-nu-muted shrink-0">
                {nickname.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex items-baseline gap-3 flex-wrap">
              <div>
                <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block">강성</span>
                <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: todayAccent }}>
                  {stiffness.toLocaleString("ko-KR")}
                </span>
                {delta > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-green-600 ml-1">
                    <TrendingUp size={10} /> +{delta}
                  </span>
                )}
              </div>
              <Link href="/stiffness" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink no-underline">
                산식 공개 →
              </Link>
            </div>
          </div>

          {/* Next Best Action */}
          {nba && (
            <Link
              href={nba.href}
              className="group flex items-center gap-2 border rounded-lg px-3 py-2 no-underline transition-colors"
              style={{ borderColor: `${todayAccent}40`, background: `${todayAccent}08` }}
            >
              <span className="text-[13px] shrink-0">{nba.emoji || "⚡"}</span>
              <div className="flex-1 min-w-0">
                <span className="font-mono-nu text-[8px] uppercase tracking-[0.25em] font-bold block" style={{ color: todayAccent }}>
                  Next Best Action
                </span>
                <p className="text-[13px] font-semibold text-nu-ink leading-snug truncate">{nba.label}</p>
              </div>
              <ArrowRight size={13} className="shrink-0 transition-transform group-hover:translate-x-1" style={{ color: todayAccent }} />
            </Link>
          )}

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href="/projects/create" className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 border border-nu-ink/15 rounded hover:bg-nu-cream/60 no-underline text-nu-ink">
              <Rocket size={10} /> 볼트
            </Link>
            <Link href="/groups/create" className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 border border-nu-ink/15 rounded hover:bg-nu-cream/60 no-underline text-nu-ink">
              <Users size={10} /> 너트
            </Link>
            <Link href="/wiki" className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 border border-nu-ink/15 rounded hover:bg-nu-cream/60 no-underline text-nu-ink">
              <BookOpen size={10} /> 탭
            </Link>
            <Link href="/members" className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 border border-nu-ink/15 rounded hover:bg-nu-cream/60 no-underline text-nu-ink">
              <Sparkles size={10} /> 와셔
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
