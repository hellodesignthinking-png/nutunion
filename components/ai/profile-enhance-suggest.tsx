"use client";

import { useState } from "react";
import { AISuggestButton } from "./ai-suggest-button";
import { Sparkles, Check } from "lucide-react";
import { toast } from "sonner";

interface Enhancement {
  skills: string[];
  slogans: { serious: string; playful: string; expert: string };
}

/**
 * 프로필 수정 시 AI 가 참여 볼트 히스토리 기반으로 스킬 태그 + 슬로건 3버전 제안.
 */
export function ProfileEnhanceSuggest({
  currentSkills, onApplySkills, onApplySlogan,
}: {
  currentSkills: string[];
  onApplySkills: (skills: string[]) => void;
  onApplySlogan: (slogan: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Enhancement | null>(null);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/profile-enhance", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "AI 호출 실패");
      if (!body.enhancement) { toast.error("AI 응답 파싱 실패"); return; }
      setData(body.enhancement);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function acceptAllSkills() {
    if (!data) return;
    const next = Array.from(new Set([...currentSkills, ...data.skills])).slice(0, 12);
    onApplySkills(next);
    toast.success(`스킬 ${Math.min(data.skills.length, 12 - currentSkills.length)}개 추가됨`);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-muted">AI 프로필 도우미</span>
        <AISuggestButton onClick={run} loading={loading} label={data ? "다시 제안" : "스킬·슬로건 제안"} />
      </div>

      {data && (
        <div className="border-l-[3px] border-[color:var(--liquid-primary,#FF3D88)] bg-[color:var(--liquid-primary,#FF3D88)]/5 rounded-md p-3 space-y-3">
          {/* Skills */}
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-[color:var(--liquid-primary,#FF3D88)] font-bold">
                <Sparkles size={10} className="inline mr-1" /> 스킬 태그 {data.skills.length}개
              </span>
              <button type="button" onClick={acceptAllSkills}
                className="px-2 py-0.5 bg-[color:var(--neutral-900,#1a1a1a)] text-white rounded text-[10px] font-medium hover:bg-[color:var(--liquid-primary,#FF3D88)]">
                <Check size={9} className="inline mr-0.5" /> 모두 추가
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {data.skills.map((s) => (
                <button key={s} type="button"
                  onClick={() => { if (currentSkills.includes(s)) return; onApplySkills([...currentSkills, s]); toast.success(`"${s}" 추가`); }}
                  className={`px-1.5 py-0.5 text-[11px] font-mono-nu border transition-colors ${
                    currentSkills.includes(s)
                      ? "border-green-500 text-green-700 bg-green-50"
                      : "border-[color:var(--neutral-200)] text-[color:var(--neutral-700)] hover:border-[color:var(--liquid-primary,#FF3D88)] hover:text-[color:var(--liquid-primary,#FF3D88)]"
                  }`}>
                  {currentSkills.includes(s) ? "✓ " : "+ "}{s}
                </button>
              ))}
            </div>
          </section>

          {/* Slogans */}
          <section>
            <span className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-[color:var(--liquid-primary,#FF3D88)] font-bold block mb-1.5">
              슬로건 3버전
            </span>
            <ul className="list-none m-0 p-0 space-y-1.5">
              {(["serious", "playful", "expert"] as const).map((k) => {
                const text = data.slogans[k];
                if (!text) return null;
                const label = k === "serious" ? "진지" : k === "playful" ? "유쾌" : "전문가";
                return (
                  <li key={k} className="flex items-center gap-2">
                    <span className="font-mono-nu text-[9px] uppercase text-[color:var(--neutral-500)] w-8 shrink-0">{label}</span>
                    <span className="text-[12px] text-[color:var(--neutral-900)] flex-1">{text}</span>
                    <button type="button" onClick={() => { onApplySlogan(text); toast.success(`"${label}" 슬로건 적용`); }}
                      className="px-1.5 py-0.5 border border-[color:var(--neutral-200)] rounded text-[10px] hover:bg-[color:var(--neutral-900)] hover:text-white">
                      적용
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
