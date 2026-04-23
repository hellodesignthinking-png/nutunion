"use client";

/**
 * AudioWaveform — 채팅 오디오 첨부 전용 플레이어.
 *
 * 기능:
 *  - deterministic 시각 waveform bars (파일 URL 해시 기반 — 같은 파일은 같은 모양)
 *  - 재생/일시정지 버튼 + 진행 바 (bar 색상 채우기)
 *  - 재생시간 표시 (mm:ss / duration)
 *  - Web Audio API 디코딩 없이 경량 구현 (300 bytes JS per instance)
 *
 * preload="none" 으로 자동 다운로드 방지. 버튼 누를 때만 로드.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Loader2 } from "lucide-react";

export interface AudioWaveformProps {
  src: string;
  mine?: boolean;
}

const BARS = 48;

/** URL 을 seed 로 만든 의사 waveform — 같은 파일은 항상 같은 모양 */
function hashBars(seed: string): number[] {
  // simple mulberry32 PRNG
  let a = 0;
  for (let i = 0; i < seed.length; i++) a = (a << 5) - a + seed.charCodeAt(i);
  a = a | 0;
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: number[] = [];
  for (let i = 0; i < BARS; i++) {
    // 가장자리는 낮게, 가운데는 높게 (자연스러운 waveform 감)
    const ribbon = Math.sin((i / BARS) * Math.PI);
    const r = 0.25 + rng() * 0.75;
    out.push(0.15 + ribbon * 0.6 + r * 0.25);
  }
  return out;
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioWaveform({ src, mine }: AudioWaveformProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const bars = useMemo(() => hashBars(src), [src]);
  const progress = duration > 0 ? current / duration : 0;

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => {
      if (isFinite(a.duration)) setDuration(a.duration);
    };
    const onLoad = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("loadstart", onLoad);
    a.addEventListener("canplay", onCanPlay);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("loadstart", onLoad);
      a.removeEventListener("canplay", onCanPlay);
    };
  }, []);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      try {
        await a.play();
      } catch (err) {
        console.warn("[audio] play failed", err);
      }
    }
  };

  const seekTo = (ratio: number) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = ratio * duration;
    setCurrent(a.currentTime);
  };

  const playedColor = mine ? "#FFFFFF" : "#E44C7F"; // mine: 흰색 / other: 너트 핑크
  const unplayedColor = mine ? "rgba(255,255,255,0.45)" : "rgba(13,13,13,0.28)";

  return (
    <div
      className={`mt-1 inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl max-w-xs ${
        mine ? "bg-white/15" : "bg-nu-ink/5"
      }`}
    >
      <audio ref={audioRef} src={src} preload="none" />

      <button
        onClick={toggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
          mine ? "bg-white text-nu-pink" : "bg-nu-pink text-white"
        }`}
        aria-label={playing ? "일시정지" : "재생"}
      >
        {loading && !playing ? (
          <Loader2 size={16} className="animate-spin" />
        ) : playing ? (
          <Pause size={16} fill="currentColor" />
        ) : (
          <Play size={16} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      <button
        className="flex-1 flex items-end gap-[1.5px] h-8 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          seekTo(Math.max(0, Math.min(1, ratio)));
        }}
        aria-label="재생 위치 탐색"
      >
        {bars.map((h, i) => {
          const played = i / BARS <= progress;
          return (
            <span
              key={i}
              style={{
                height: `${Math.round(h * 100)}%`,
                backgroundColor: played ? playedColor : unplayedColor,
                transition: "background-color 0.1s",
              }}
              className="flex-1 rounded-full min-w-[2px] max-w-[4px]"
            />
          );
        })}
      </button>

      <span
        className={`text-[10px] font-mono tabular-nums shrink-0 ${mine ? "text-white/80" : "text-nu-graphite"}`}
      >
        {fmt(current || 0)}
        {duration > 0 && <span className="opacity-60"> / {fmt(duration)}</span>}
      </span>
    </div>
  );
}
