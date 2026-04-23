"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { listTemplates, type TemplateCategory } from "@/lib/venture/templates";

export function VentureEnableButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<TemplateCategory>("generic");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const templates = listTemplates();
  const selected = templates.find((t) => t.id === category);

  const enable = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/venture/${projectId}/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "활성화 실패");
      toast.success(`Venture 모드 활성화됨${data.seeded ? " (템플릿 시드 완료)" : ""}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "실패");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-6 py-3 font-mono-nu text-[12px] uppercase tracking-widest hover:bg-nu-ink"
      >
        🚀 Venture 모드 활성화
      </button>
    );
  }

  return (
    <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5 max-w-2xl mx-auto text-left">
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-3">
        분야 선택 — 프리셋 HMW/아이디어/체크리스트 자동 시드
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setCategory(t.id)}
            className={`border-[2.5px] p-3 text-left transition-colors ${
              category === t.id
                ? "border-nu-pink bg-nu-pink/5"
                : "border-nu-ink/30 hover:border-nu-ink"
            }`}
          >
            <div className="text-[22px] mb-1">{t.icon}</div>
            <div className={`font-bold text-[12px] ${category === t.id ? "text-nu-pink" : "text-nu-ink"}`}>
              {t.label}
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <p className="text-[12px] text-nu-graphite mb-4 leading-relaxed">
          <strong>{selected.label}</strong> — {selected.description}
          <br />
          <span className="font-mono-nu text-[10px] text-nu-graphite/80">
            빈 상태로 시작합니다. 실제 데이터(인사이트/HMW/아이디어)는 팀이 직접 작성.
          </span>
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5"
        >
          취소
        </button>
        <button
          type="button"
          onClick={enable}
          disabled={loading}
          className="flex-1 border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
        >
          {loading ? "활성화 중..." : "🚀 활성화"}
        </button>
      </div>
    </div>
  );
}
