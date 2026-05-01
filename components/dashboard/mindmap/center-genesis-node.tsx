"use client";

import { useState } from "react";
import { Handle, Position } from "reactflow";
import { Sparkles, Send, Loader2 } from "lucide-react";

interface CenterNodeData {
  kind: "center";
  title: string;
  subtitle?: string;
  /** 응답 후 호출 — 부모에서 관련 노드 하이라이트 + 임시 노드 추가 */
  onAnswer: (result: {
    text: string;
    keywords: string[];
    roles: Array<{ name: string; tags?: string[]; why?: string }>;
    tasks: string[];
  }) => void;
}

/**
 * Phase C — 마인드맵 중앙에 들어가는 인터랙티브 Genesis 입력 노드.
 *
 * 동작:
 *  1) 사용자가 "오늘 가장 먼저 할 일은?" 같은 질문 입력
 *  2) /api/genesis/plan 호출 (기존 인프라, lease 멱등성 + Gateway 자동 fallback)
 *  3) 응답에서 phases/first_tasks 키워드 추출
 *  4) onAnswer 콜백으로 키워드 전달 — 부모가 매칭되는 가지 노드 하이라이트
 *
 * 응답은 짧게 노드 안에 표시. 자세한 답변이 길면 줄임.
 */
export function CenterGenesisNode({ data }: { data: CenterNodeData }) {
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function ask() {
    const trimmed = intent.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const res = await fetch("/api/genesis/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": `mindmap:${trimmed.slice(0, 50)}`,
        },
        body: JSON.stringify({ intent: trimmed, kind: "group" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "AI 응답 실패");

      const summary: string = json?.plan?.summary || json?.plan?.title || "응답 생성됨";
      setAnswer(summary.slice(0, 140));

      // 키워드 추출 — phases.name + first_tasks 의 명사·동사 (하이라이트용)
      const keywords = new Set<string>();
      (json?.plan?.phases || []).forEach((p: any) => {
        if (p?.name) keywords.add(String(p.name).toLowerCase());
      });
      const tasks: string[] = (json?.plan?.first_tasks || []).slice(0, 4).map((t: any) => String(t));
      tasks.forEach((t) => {
        t.toLowerCase().split(/\s+/).slice(0, 3).forEach((w: string) => {
          if (w.length > 2) keywords.add(w);
        });
      });
      // suggested_roles → ai-role 임시 노드용
      const roles = ((json?.plan?.suggested_roles || []) as any[]).slice(0, 4).map((r) => ({
        name: String(r?.role_name || r?.name || "역할"),
        tags: Array.isArray(r?.specialty_tags) ? r.specialty_tags.map(String) : [],
        why: r?.why ? String(r.why) : undefined,
      }));
      data.onAnswer({ text: summary, keywords: Array.from(keywords), roles, tasks });
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border-[3px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] px-4 py-3 min-w-[260px] max-w-[320px]">
      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} style={{ opacity: 0 }} />

      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles size={14} className="text-nu-pink" />
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">Genesis AI</span>
      </div>
      <div className="font-head text-[14px] font-extrabold text-nu-ink mb-2 truncate">{data.title}</div>

      <form
        onSubmit={(e) => { e.preventDefault(); void ask(); }}
        className="flex items-center gap-1 border-[2px] border-nu-ink/20 focus-within:border-nu-ink"
      >
        <input
          type="text"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="궁금한 점을 물어보세요"
          disabled={loading}
          className="flex-1 px-2 py-1.5 text-[12px] outline-none bg-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !intent.trim()}
          className="px-2 py-1.5 bg-nu-pink text-nu-paper disabled:opacity-40"
          aria-label="질문 보내기"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </button>
      </form>

      {answer && !loading && (
        <div className="mt-2 text-[11px] text-nu-ink/80 bg-nu-cream/50 border border-nu-ink/10 px-2 py-1.5">
          💡 {answer}
        </div>
      )}
      {error && (
        <div className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 px-2 py-1">
          {error}
        </div>
      )}
    </div>
  );
}
