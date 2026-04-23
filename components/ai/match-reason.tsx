"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * Recommendations 카드 내부 reason 슬롯을 AI 가 생성한 자연어로 점진적 대체.
 * 실패 · 로딩 중 · AI off 시 기본 reason 그대로 표시 (graceful).
 */
export function MatchReason({
  targetType, targetId, baseReason, enabled = true,
}: {
  targetType: "nut" | "bolt";
  targetId: string;
  baseReason: string;
  enabled?: boolean;
}) {
  const [text, setText] = useState(baseReason);
  const [isAi, setIsAi] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // idle 시점에만 호출 (페이지 로딩 블록 방지)
    const schedule = (cb: () => void) => {
      if (typeof (window as any).requestIdleCallback === "function") {
        (window as any).requestIdleCallback(cb, { timeout: 2000 });
      } else setTimeout(cb, 500);
    };

    schedule(async () => {
      try {
        const res = await fetch("/api/ai/match-explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType, targetId, baseReason }),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.explanation && !cancelled) {
          setText(data.explanation);
          setIsAi(true);
        }
      } catch {}
    });

    return () => { cancelled = true; };
  }, [targetType, targetId, baseReason, enabled]);

  return (
    <span className="inline-flex items-center gap-1">
      {isAi && <Sparkles size={9} className="text-[color:var(--liquid-primary,#FF3D88)] opacity-70" />}
      {text}
    </span>
  );
}
