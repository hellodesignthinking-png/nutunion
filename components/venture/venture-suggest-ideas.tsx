"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Suggestion {
  title: string;
  description: string;
  rationale: string;
  risks: string[];
}

export function VentureSuggestIdeas({
  projectId,
  disabled,
  disabledReason,
}: {
  projectId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [importing, setImporting] = useState<number | null>(null);
  const router = useRouter();

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/venture/${projectId}/suggest-ideas`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "제안 실패");
      setSuggestions(data.suggestions as Suggestion[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "실패");
    } finally {
      setLoading(false);
    }
  };

  const importOne = async (idx: number) => {
    const s = suggestions[idx];
    if (!s) return;
    setImporting(idx);
    try {
      const res = await fetch(`/api/venture/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "idea",
          title: s.title,
          description: `${s.description}\n\n💡 근거: ${s.rationale}${s.risks.length > 0 ? `\n\n⚠ 리스크: ${s.risks.join(" / ")}` : ""}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "추가 실패");
      toast.success("아이디어에 추가됨");
      setSuggestions((prev) => prev.filter((_, i) => i !== idx));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "실패");
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="border-[2px] border-dashed border-nu-pink bg-nu-pink/5 p-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
            🤖 AI 보조 제안
          </div>
          <p className="text-[12px] text-nu-graphite mt-0.5">
            선정된 HMW + 수집된 인사이트 기반으로 AI 가 다양한 해결 아이디어를 3~6개 제안합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading || disabled}
          title={disabled ? disabledReason : undefined}
          className="h-9 px-3 border-[2.5px] border-nu-pink bg-nu-paper text-nu-pink font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-pink hover:text-nu-paper disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "AI 생성 중..." : suggestions.length > 0 ? "↻ 다시 제안" : "💡 AI 아이디어 제안"}
        </button>
      </div>

      {disabled && disabledReason && suggestions.length === 0 && (
        <p className="text-[11px] text-orange-600">⚠ {disabledReason}</p>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <article key={i} className="border-[2px] border-nu-ink bg-nu-paper p-3">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h4 className="font-bold text-[14px] text-nu-ink flex-1">
                  <span className="font-mono-nu text-[10px] text-nu-graphite mr-2">AI-{i + 1}</span>
                  {s.title}
                </h4>
                <button
                  type="button"
                  onClick={() => importOne(i)}
                  disabled={importing === i}
                  className="h-7 px-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper font-mono-nu text-[9px] uppercase tracking-wider hover:bg-nu-pink hover:border-nu-pink disabled:opacity-50 flex-shrink-0"
                >
                  {importing === i ? "추가 중..." : "+ 아이디어에 추가"}
                </button>
              </div>
              <p className="text-[12px] text-nu-ink leading-relaxed">{s.description}</p>
              <div className="mt-2 text-[11px] text-nu-graphite italic">💡 {s.rationale}</div>
              {s.risks.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {s.risks.map((r, j) => (
                    <li key={j} className="text-[11px] text-orange-700">⚠ {r}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
