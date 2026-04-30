"use client";

/**
 * FileAiSummary — 자료실 카드에 [✨ AI 요약] 펼치기 버튼.
 * 캐시된 요약이 있으면 즉시 표시, 없으면 요청 시 생성.
 */

import { useState } from "react";
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface AiSummary {
  summary: string[];
  qa: Array<{ q: string; a: string }>;
  model_used?: string;
}

interface Props {
  table: "file_attachments" | "project_resources";
  fileId: string;
  initial?: AiSummary | null;
  fileExt?: string; // 미지원 형식이면 버튼 숨김
}

const SUPPORTED = new Set(["pdf", "txt", "md", "markdown", "csv", "json", "yml", "yaml", "log", "html", "htm"]);

export function FileAiSummary({ table, fileId, initial, fileExt }: Props) {
  const [summary, setSummary] = useState<AiSummary | null>(initial || null);
  const [open, setOpen] = useState(!!initial);
  const [loading, setLoading] = useState(false);

  if (fileExt && !SUPPORTED.has(fileExt.toLowerCase())) return null;

  async function generate(force = false) {
    setLoading(true);
    try {
      const r = await fetch("/api/files/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, id: fileId, force }),
      });
      const json = await r.json();
      if (!r.ok) {
        if (json?.code === "MIGRATION_MISSING") {
          toast.error("AI 요약 미활성 — 관리자에게 문의 (migration 134)");
        } else {
          toast.error(json?.error || "요약 실패");
        }
        return;
      }
      setSummary(json.ai_summary);
      setOpen(true);
      if (!json.cached) toast.success("AI 가 자료를 정리했어요");
    } finally {
      setLoading(false);
    }
  }

  if (!summary) {
    return (
      <button
        onClick={() => generate(false)}
        disabled={loading}
        className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border-[2px] border-nu-pink/30 text-nu-pink hover:bg-nu-pink hover:text-white transition-all flex items-center gap-1 disabled:opacity-50"
        title="AI 가 본문을 읽고 3줄 요약 + 예상 Q&A 를 만들어요"
      >
        {loading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
        AI 요약
      </button>
    );
  }

  return (
    <div className="w-full">
      <button
        onClick={() => setOpen((o) => !o)}
        className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border-[2px] border-nu-pink bg-nu-pink/10 text-nu-pink flex items-center gap-1"
      >
        <Sparkles size={10} /> AI 요약
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {open && (
        <div className="mt-2 p-3 bg-nu-cream/30 border-2 border-nu-ink/10 space-y-2">
          {summary.summary.length > 0 && (
            <ul className="space-y-1 list-disc list-inside text-[12px] text-nu-ink leading-relaxed">
              {summary.summary.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
          {summary.qa.length > 0 && (
            <div className="pt-2 border-t border-nu-ink/10 space-y-1.5">
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">예상 질문</p>
              {summary.qa.map((qa, i) => (
                <div key={i}>
                  <p className="text-[11px] font-bold text-nu-ink">Q. {qa.q}</p>
                  <p className="text-[11px] text-nu-muted leading-relaxed">A. {qa.a}</p>
                </div>
              ))}
            </div>
          )}
          <div className="pt-1 flex items-center justify-between gap-2 text-[10px]">
            {summary.model_used && (
              <span className="font-mono-nu text-nu-muted/70 uppercase tracking-widest">{summary.model_used}</span>
            )}
            <button
              onClick={() => generate(true)}
              disabled={loading}
              className="font-mono-nu uppercase tracking-widest text-nu-muted hover:text-nu-ink flex items-center gap-1 disabled:opacity-50"
            >
              {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              다시 생성
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
