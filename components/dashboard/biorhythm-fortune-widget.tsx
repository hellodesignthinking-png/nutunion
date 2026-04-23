"use client";

import { useEffect, useState } from "react";
import { Moon, Sparkles, Loader2, Heart, Brain, Dumbbell, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Props {
  /** ISO date (YYYY-MM-DD) — 있으면 biorhythm 계산, 없으면 skip */
  birthdate?: string | null;
}

interface Fortune {
  text: string;
  model_used?: string | null;
  date?: string;
  cached?: boolean;
}

function computeBiorhythm(birth: Date, today: Date = new Date()) {
  const days = Math.floor((today.getTime() - birth.getTime()) / 86400000);
  return {
    physical: Math.sin((2 * Math.PI * days) / 23),
    emotional: Math.sin((2 * Math.PI * days) / 28),
    intellectual: Math.sin((2 * Math.PI * days) / 33),
    days,
  };
}

export function BiorhythmFortuneWidget({ birthdate }: Props) {
  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/fortune", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Fortune;
        if (!cancelled) setFortune(data);
      } catch {
        if (!cancelled) setFortune({ text: "오늘은 작은 진전 하나로 충분합니다." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  let bio: ReturnType<typeof computeBiorhythm> | null = null;
  if (birthdate) {
    const bd = new Date(birthdate);
    if (!isNaN(bd.getTime())) bio = computeBiorhythm(bd);
  }

  return (
    <section className="bg-nu-ink text-nu-paper border-[3px] border-nu-ink shadow-[4px_4px_0_0_#0D0F14] p-5">
      <header className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-nu-paper text-nu-ink border-[2px] border-nu-paper">
          <Moon size={10} /> 오늘의 리듬
        </span>
        <h3 className="font-head text-base md:text-lg font-extrabold tracking-tight uppercase">
          Biorhythm & Fortune
        </h3>
      </header>

      {/* Biorhythm */}
      {bio ? (
        <div className="space-y-2 mb-5">
          <Bar label="신체" icon={Dumbbell} value={bio.physical} color="bg-rose-400" />
          <Bar label="감정" icon={Heart} value={bio.emotional} color="bg-pink-400" />
          <Bar label="지성" icon={Brain} value={bio.intellectual} color="bg-emerald-400" />
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-paper/50 pt-1">
            생일로부터 {bio.days.toLocaleString()}일
          </p>
        </div>
      ) : (
        <div className="mb-5 bg-nu-paper/5 border-[2px] border-nu-paper/20 p-3">
          <p className="text-[13px] text-nu-paper/80 mb-2">
            생년월일을 프로필에서 등록하면 바이오리듬을 보여드려요.
            <br />
            <span className="text-[11px] text-nu-paper/50">
              ※ 서버 마이그레이션(102)이 적용되어 있어야 합니다.
            </span>
          </p>
          <Link
            href="/profile?edit=1#personal-info"
            className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest text-nu-paper border-[2px] border-nu-paper/40 hover:border-nu-paper px-2 py-1 no-underline"
          >
            프로필에서 등록 <ArrowRight size={10} />
          </Link>
        </div>
      )}

      {/* Fortune */}
      <div className="bg-nu-paper/5 border-[2px] border-nu-paper/20 p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles size={12} className="text-amber-300" />
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-paper/60">
            오늘의 전략 운세
          </span>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-nu-paper/70 py-1">
            <Loader2 size={12} className="animate-spin" />
            <span className="text-sm">읽는 중…</span>
          </div>
        ) : (
          <p className="text-[14px] leading-relaxed text-nu-paper whitespace-pre-line">
            {fortune?.text || "오늘도 반갑습니다."}
          </p>
        )}
      </div>
    </section>
  );
}

function Bar({ label, icon: Icon, value, color }: { label: string; icon: any; value: number; color: string }) {
  // value -1..1 → 0..100 center=50
  const pct = Math.round(value * 100);
  const absPct = Math.abs(pct);
  const positive = pct >= 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className="text-nu-paper/70" />
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-paper/80">
            {label}
          </span>
        </div>
        <span className={`font-mono-nu text-[10px] uppercase tracking-widest ${positive ? "text-emerald-300" : "text-rose-300"}`}>
          {pct > 0 ? "+" : ""}{pct}%
        </span>
      </div>
      <div className="relative h-2 bg-nu-paper/10 border border-nu-paper/20">
        {/* center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-nu-paper/30" />
        {positive ? (
          <div
            className={`absolute top-0 bottom-0 left-1/2 ${color}`}
            style={{ width: `${absPct / 2}%` }}
          />
        ) : (
          <div
            className={`absolute top-0 bottom-0 ${color}`}
            style={{ right: "50%", width: `${absPct / 2}%` }}
          />
        )}
      </div>
    </div>
  );
}
