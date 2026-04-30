"use client";
/**
 * AiBuilderClient — Level 2 AI-Assist Thread Builder.
 * User describes desired tool in natural language → AI generates spec → user reviews → save or import to L1 builder.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ThreadSpec, FieldSpec, ViewSpec, ActionSpec } from "@/components/threads/generic-thread";
import { GenericThread } from "@/components/threads/generic-thread";

const BTN = "border-[3px] border-nu-ink font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-2 shadow-[3px_3px_0_0_#0D0F14] disabled:opacity-50";

interface AiSpec extends ThreadSpec {
  name: string;
  icon: string;
  scope: ("nut" | "bolt")[];
  category: string;
  reasoning?: string;
}

const EXAMPLES = [
  "독서 스터디용 진도 추적 — 매주 책 페이지와 감상 입력하고 월말 랭킹",
  "고객 인터뷰 메모 — 인터뷰 일자, 인터뷰 대상, 핵심 인사이트, 다음 액션",
  "팀 OKR — 분기별 목표와 매주 진척도 % 입력, 주간 리뷰 메모",
];

export function AiBuilderClient() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [spec, setSpec] = useState<AiSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [saving, setSaving] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setSpec(null);
    try {
      const res = await fetch("/api/threads/builder/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "ai_failed");
      setSpec(json.spec);
    } catch (e: any) {
      setError(e.message || "ai_failed");
    } finally {
      setLoading(false);
    }
  };

  const importToBuilder = () => {
    if (!spec) return;
    const enc = encodeURIComponent(JSON.stringify(spec));
    router.push(`/threads/build?prefill=${enc}`);
  };

  const saveAsIs = async () => {
    if (!spec) return;
    setSaving(true);
    try {
      const body = {
        thread_id: null,
        builder_mode: "ai-assist",
        name: spec.name,
        description: spec.description || "",
        icon: spec.icon || "🤖",
        scope: spec.scope,
        category: spec.category,
        fields: spec.fields,
        views: spec.views,
        actions: spec.actions,
        is_draft: false,
        ai_reasoning: spec.reasoning || null,
      };
      const res = await fetch("/api/threads/builder/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "save_failed");
      alert(`Thread 가 만들어졌어요!${json.project_id ? "\n개발용 볼트도 함께 생성됐습니다." : ""}`);
      router.push(`/threads/${json.slug}`);
    } catch (e: any) {
      setError(e.message || "save_failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-nu-cream/20 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="border-[3px] border-nu-ink bg-white p-5 shadow-[6px_6px_0_0_#0D0F14]">
          <h1 className="font-head text-2xl font-extrabold text-nu-ink">🤖 자연어로 Thread 만들기</h1>
          <p className="text-xs font-mono text-nu-muted mt-1">어떤 도구가 필요한지 한국어로 적어주세요. AI 가 Thread 스펙을 만들어 드려요.</p>
        </header>

        {!spec && (
          <div className="border-[3px] border-nu-ink bg-white p-5 space-y-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="예: 독서 스터디용 진도 추적 — 매주 책 페이지와 감상 입력하고 월말 랭킹"
              rows={5}
              className="w-full border-[2px] border-nu-ink px-3 py-2 font-mono text-sm"
            />
            <div className="text-[11px] font-mono text-nu-muted">
              <div className="font-bold mb-1">예시:</div>
              <ul className="space-y-1">
                {EXAMPLES.map((ex) => (
                  <li key={ex}>
                    <button onClick={() => setPrompt(ex)} className="text-left hover:text-nu-pink underline">{ex}</button>
                  </li>
                ))}
              </ul>
            </div>
            <button onClick={generate} disabled={loading || !prompt.trim()} className={`${BTN} bg-nu-pink text-white w-full`}>
              {loading ? "생성 중..." : "✨ 생성하기"}
            </button>
            {error && <div className="text-xs text-red-700 font-mono">{error}</div>}
          </div>
        )}

        {spec && (
          <>
            <div className="border-[3px] border-nu-ink bg-white p-5 space-y-3">
              <div className="flex justify-between items-baseline gap-2 flex-wrap">
                <h2 className="font-head text-xl font-extrabold">{spec.icon} {spec.name}</h2>
                <button onClick={() => setShowReasoning((s) => !s)} className="text-xs font-mono text-nu-pink">
                  🤔 왜 이렇게? {showReasoning ? "▲" : "▼"}
                </button>
              </div>
              <p className="text-sm font-mono text-nu-muted">{spec.description}</p>
              {showReasoning && spec.reasoning && (
                <div className="border-[2px] border-nu-pink bg-nu-pink/10 p-3 text-xs font-mono">{spec.reasoning}</div>
              )}

              <div>
                <div className="font-mono-nu text-[10px] uppercase tracking-widest font-bold mb-1">필드 ({spec.fields.length})</div>
                <ul className="space-y-1">
                  {spec.fields.map((f, i) => (
                    <li key={i} className="border-[2px] border-nu-ink px-2 py-1 text-xs font-mono flex justify-between items-center">
                      <span><span className="text-nu-muted">[{f.type}]</span> {f.label}{f.required ? " *" : ""}</span>
                      <button onClick={() => setSpec({ ...spec, fields: spec.fields.filter((_, j) => j !== i) })} className="text-red-700">×</button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="font-mono-nu text-[10px] uppercase tracking-widest font-bold mb-1">뷰</div>
                <div className="flex flex-wrap gap-1">
                  {spec.views.map((v, i) => (
                    <span key={i} className="border-[2px] border-nu-ink px-2 py-1 text-xs font-mono bg-nu-cream">{v.kind}</span>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-mono-nu text-[10px] uppercase tracking-widest font-bold mb-1">액션</div>
                <div className="flex flex-wrap gap-1">
                  {spec.actions.map((a, i) => (
                    <span key={i} className="border-[2px] border-nu-ink px-2 py-1 text-xs font-mono bg-white">{a.label}</span>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t-[2px] border-nu-ink/20">
                <button onClick={() => { setSpec(null); }} className={`${BTN} bg-white`}>← 다시</button>
                <button onClick={importToBuilder} className={`${BTN} bg-white flex-1`}>수정할게요 (L1 빌더로)</button>
                <button onClick={saveAsIs} disabled={saving} className={`${BTN} bg-nu-pink text-white flex-1`}>
                  {saving ? "저장 중..." : "이대로 만들기"}
                </button>
              </div>
              {error && <div className="text-xs text-red-700 font-mono">{error}</div>}
            </div>

            {/* Live preview */}
            <div className="border-[3px] border-nu-ink bg-white p-3 space-y-2">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest font-bold">미리보기</div>
              <GenericThread spec={spec} ephemeral />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
