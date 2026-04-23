"use client";

import { useState } from "react";
import { AISuggestButton, AISuggestionCard } from "./ai-suggest-button";
import { toast } from "sonner";

/**
 * 너트 생성/수정 시 AI 가 소개문 3가지 초안 제안.
 */
export function NutDescriptionSuggest({
  name, category, onAccept,
}: {
  name: string;
  category: string;
  onAccept: (text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<string[] | null>(null);

  async function fetchSuggest() {
    if (!name.trim()) { toast.error("너트 이름을 먼저 입력해주세요"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/nut-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, keywords: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 호출 실패");
      // 응답 문자열에서 Option A/B/C 파싱
      const raw = data.suggestions as string;
      const parts = raw.split(/Option [A-C][^:]*:\s*/i).filter((s) => s.trim().length > 10);
      setOptions(parts.slice(0, 3));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-2">
      <AISuggestButton onClick={fetchSuggest} loading={loading} label="AI 제안 3개" />
      {options && options.length > 0 && (
        <div className="w-full max-w-xl space-y-2 mt-1">
          {options.map((opt, i) => (
            <AISuggestionCard
              key={i}
              title={`Option ${String.fromCharCode(65 + i)}`}
              onAccept={() => { onAccept(opt.trim()); toast.success(`Option ${String.fromCharCode(65 + i)} 수락`); setOptions(null); }}
              onDismiss={() => { if (options.length === 1) setOptions(null); else setOptions(options.filter((_, j) => j !== i)); }}
            >
              {opt.trim()}
            </AISuggestionCard>
          ))}
        </div>
      )}
    </div>
  );
}
