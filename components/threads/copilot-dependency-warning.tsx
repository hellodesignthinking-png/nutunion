"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "ai-copilot-dependency-warned-at";
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

export function CopilotDependencyWarning() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // gate: at most once per week
        const last = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (last && Date.now() - +last < ONE_WEEK) return;

        const res = await fetch("/api/threads/ai-copilot/dependency", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        // show if last 10 actions are 100% accepted
        if (json.recent_count >= 10 && json.accept_rate >= 1.0) {
          setShow(true);
          if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
        }
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!show) return null;
  return (
    <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-[11px] font-mono text-nu-ink flex items-start justify-between gap-2">
      <span>💭 잠깐만요, AI 제안을 자주 수락하셨네요. 가끔은 직접 판단해보세요.</span>
      <button onClick={() => setShow(false)} className="font-mono-nu text-[10px] uppercase tracking-widest">✕</button>
    </div>
  );
}
