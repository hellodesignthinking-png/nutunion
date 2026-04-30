"use client";
import { useState } from "react";
import { registry, type ThreadProps } from "@/lib/threads/registry";
import { CopilotDependencyWarning } from "@/components/threads/copilot-dependency-warning";

type Action = "summarize" | "extract_actions" | "recommend" | "freeform" | "cross_thread_alert";

interface CopilotResponse {
  reply: string;
  model_used?: string;
  reasoning?: string;
  quick_facts?: string[];
  requires_confirm?: boolean;
}

function AICopilotComponent({ installation }: ThreadProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CopilotResponse | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0); // 0=idle, 1=preview-shown, 2=applied
  const [accepted, setAccepted] = useState(false);

  const run = async (action: Action, msg?: string) => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/threads/ai-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installation_id: installation.id, action, message: msg }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "request_failed");
      setResult(json);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="border-[3px] border-nu-ink p-4 bg-white shadow-[4px_4px_0_0_#0D0F14] space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-head text-lg font-extrabold text-nu-ink">🤖 AI Copilot</h3>
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{installation.target_type}</span>
      </div>

      <CopilotDependencyWarning />

      <div className="flex gap-1 flex-wrap">
        <button onClick={() => run("summarize")} disabled={loading}
          className="border-[2px] border-nu-ink bg-nu-cream/40 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-nu-pink hover:text-white transition disabled:opacity-50">
          종합 요약 (7일)
        </button>
        <button onClick={() => run("extract_actions")} disabled={loading}
          className="border-[2px] border-nu-ink bg-nu-cream/40 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-nu-pink hover:text-white transition disabled:opacity-50">
          액션아이템 추출
        </button>
        <button onClick={() => run("recommend")} disabled={loading}
          className="border-[2px] border-nu-ink bg-nu-cream/40 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-nu-pink hover:text-white transition disabled:opacity-50">
          다음 할 일 제안
        </button>
        <button onClick={() => run("cross_thread_alert")} disabled={loading}
          className="border-[2px] border-nu-ink bg-amber-100 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-amber-300 transition disabled:opacity-50">
          ⚠ 이상 감지
        </button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (message.trim()) run("freeform", message.trim()); }}
        className="flex gap-1"
      >
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`이 ${installation.target_type === "nut" ? "너트" : "볼트"}에서 무엇을 도와드릴까요?`}
          className="flex-1 border-[2px] border-nu-ink/50 px-2 py-1 text-sm font-mono"
        />
        <button disabled={loading || !message.trim()}
          className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14] disabled:opacity-50">
          {loading ? "..." : "→"}
        </button>
      </form>

      {error && <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-[11px] font-mono">{error}</div>}

      {loading && <div className="text-[11px] font-mono text-nu-muted">생각 중...</div>}

      {result && (
        <div className="border-[2px] border-nu-ink p-3 bg-nu-cream/20 space-y-2">
          {result.model_used && (
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
              model: {result.model_used}
            </div>
          )}
          <div className="text-sm whitespace-pre-wrap text-nu-ink">{result.reply}</div>
          {result.quick_facts && result.quick_facts.length > 0 && (
            <ul className="text-[11px] font-mono text-nu-muted list-disc list-inside">
              {result.quick_facts.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          )}
          {result.reasoning && (
            <div>
              <button onClick={() => setShowReasoning((v) => !v)}
                className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink">
                🤔 왜 이렇게 답했나요? {showReasoning ? "▾" : "▸"}
              </button>
              {showReasoning && (
                <div className="mt-1 text-[11px] font-mono text-nu-ink/70 whitespace-pre-wrap border-l-[2px] border-nu-ink/30 pl-2">
                  {result.reasoning}
                </div>
              )}
            </div>
          )}

          {/* Suggest Never Execute — 2-step apply */}
          {result.requires_confirm && (
            <div className="border-[2px] border-nu-pink bg-nu-pink/10 p-2 space-y-1">
              {confirmStep === 0 && (
                <button onClick={() => setConfirmStep(1)}
                  className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1">
                  [적용] 미리보기
                </button>
              )}
              {confirmStep === 1 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-nu-ink">⚠ 한 번 더 확인하세요. AI 는 자동 실행하지 않습니다.</div>
                  <div className="flex gap-1">
                    <button onClick={() => { setConfirmStep(2); setAccepted(true); fetch("/api/threads/ai-copilot/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "accepted" }) }).catch(() => {}); }}
                      className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 font-bold">
                      확인 적용
                    </button>
                    <button onClick={() => { setConfirmStep(0); fetch("/api/threads/ai-copilot/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: "rejected" }) }).catch(() => {}); }}
                      className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1">
                      취소
                    </button>
                  </div>
                </div>
              )}
              {confirmStep === 2 && accepted && (
                <div className="text-[11px] font-mono text-nu-ink">✅ 적용됨 (30일 내 롤백 가능)</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

registry.register({
  slug: "ai-copilot",
  name: "🤖 AI Copilot",
  description: "이 너트/볼트의 데이터를 컨텍스트로 답변. 요약·액션 추출·추천.",
  icon: "🤖",
  category: "ai",
  scope: ["nut", "bolt"],
  schema: { type: "object", properties: {} },
  configSchema: {
    type: "object",
    properties: {
      enabled_features: {
        type: "array",
        items: { type: "string", enum: ["summarize", "extract_actions", "recommend"] },
        default: ["summarize"],
      },
      daily_check_time: { type: "string", default: "09:00" },
    },
  },
  Component: AICopilotComponent,
  isCore: true,
  version: "1.0.0",
});
