"use client";
/**
 * CodeBuilderClient — Level 3 Code Mode Thread Builder.
 *
 * Flow:
 *   1. User types natural-language requirement → AI generates TSX (`/api/threads/builder/code-generate`)
 *   2. Source goes into a textarea (editable)
 *   3. "Run preview" → POSTs source to `/api/threads/sandbox-preview` → gets token URL
 *   4. iframe (sandbox="allow-scripts") loads that URL
 *   5. "Save" → POST `/api/threads/builder/save` with builder_mode='code' + generated_component_source
 *
 * Security model:
 *   - User code NEVER runs in main Next.js process
 *   - iframe sandbox="allow-scripts" (no allow-same-origin) → cross-origin DOM access blocked
 *   - CSP on serve route restricts script sources
 *   - Code threads default is_public=false until admin reviews
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const BTN =
  "border-[3px] border-nu-ink font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-2 shadow-[3px_3px_0_0_#0D0F14] disabled:opacity-50";

const STARTER = `// REASONING: 미리 작성된 시작 템플릿입니다. 자연어 요구사항을 입력하고 "코드 생성"을 누르세요.
function ThreadComponent(props) {
  const { installation, currentUserId, canEdit } = props;
  const [count, setCount] = React.useState(0);
  return React.createElement(
    "div",
    { className: "p-6" },
    React.createElement("h2", { className: "text-2xl font-bold mb-4" }, "Hello Thread"),
    React.createElement("p", { className: "mb-4" }, "Installation: " + (installation?.id || "(preview)")),
    React.createElement(
      "button",
      {
        className: "border-[3px] border-black px-3 py-2 font-bold",
        onClick: function () { setCount(count + 1); },
      },
      "Clicked: " + count,
    ),
  );
}`;

const EXAMPLES = [
  "팀 일일 스탠드업 — 어제 한 일 / 오늘 할 일 / 블로커를 입력하면 카드 형태로 보여주고, 멤버별 색상 구분",
  "주간 운동 체크리스트 — 월~일 7개 토글, 누른 횟수 카운터와 진행률 바",
  "간단한 투표 — 옵션 3~5개 추가하고 클릭으로 한 표씩 누적, 막대그래프 표시",
];

interface Props {
  userId: string;
}

export function CodeBuilderClient({ userId: _userId }: Props) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [source, setSource] = useState(STARTER);
  const [reasoning, setReasoning] = useState("");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("💻");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<("nut" | "bolt")[]>(["bolt"]);

  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Initial preview render with starter
  useEffect(() => {
    runPreview(STARTER);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for iframe height messages so we can resize
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "thread-ready" && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: "thread-init",
            installation: { id: "preview", target_type: "preview", target_id: null, config: {} },
            currentUserId: _userId,
            canEdit: true,
          },
          "*",
        );
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [_userId]);

  async function generateCode() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/threads/builder/code-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "ai_failed");
      setSource(json.source);
      setReasoning(json.reasoning || "");
      // Auto-suggest name from first line of reasoning
      if (!name && json.reasoning) {
        const guess = json.reasoning.split(/[—.:]/)[0].slice(0, 30);
        setName(guess);
      }
      await runPreview(json.source);
    } catch (e: any) {
      setError(e.message || "ai_failed");
    } finally {
      setGenerating(false);
    }
  }

  async function runPreview(src: string) {
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/threads/sandbox-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: src }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || json.error || "preview_failed");
      setPreviewUrl(json.url);
    } catch (e: any) {
      setError(e.message || "preview_failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      setError("이름을 입력하세요");
      return;
    }
    if (!source.trim()) {
      setError("코드가 비어있습니다");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Spec: code-mode threads need at least 1 placeholder field for the
      // existing save route's validation. Use a hidden internal field.
      const res = await fetch("/api/threads/builder/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          builder_mode: "code",
          name,
          description,
          icon,
          scope,
          category: "custom",
          fields: [{ key: "_code", type: "text", label: "internal", required: false }],
          views: [{ kind: "list" }],
          actions: [{ kind: "add", label: "추가" }],
          is_draft: false,
          ai_reasoning: reasoning,
          generated_component_source: source,
          ui_component: "__code__",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "save_failed");
      router.push(`/threads/${json.slug}/edit`);
    } catch (e: any) {
      setError(e.message || "save_failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-nu-cream/20 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="border-[3px] border-nu-ink bg-white p-5 shadow-[6px_6px_0_0_#0D0F14]">
          <h1 className="font-head text-2xl font-extrabold text-nu-ink">💻 코드로 Thread 만들기 (베타)</h1>
          <p className="mt-1 text-sm text-nu-muted">
            자연어로 설명하면 AI가 React 컴포넌트를 생성합니다. 직접 수정하고 미리보기 후 저장하세요.
          </p>
          <p className="mt-2 text-[11px] font-mono-nu text-nu-muted">
            ⚠️ 코드 모드 Thread 는 관리자 검토 후 공개됩니다 (기본 비공개).
          </p>
        </header>

        <div className="border-[3px] border-nu-ink bg-white p-5 space-y-3">
          <label className="block text-[11px] font-mono-nu uppercase tracking-widest font-bold">
            요구사항 (자연어)
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="예: 팀 일일 스탠드업 — 어제 한 일 / 오늘 할 일 / 블로커를 카드로 보여주기"
            rows={3}
            className="w-full border-[3px] border-nu-ink bg-white p-3 font-mono-nu text-sm focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="border-2 border-nu-ink/40 bg-nu-cream/40 px-2 py-1 text-[11px] font-mono-nu text-nu-muted hover:bg-nu-cream"
              >
                {ex.slice(0, 30)}…
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={generateCode} disabled={generating || !prompt.trim()} className={`${BTN} bg-nu-ink text-white`}>
              {generating ? "✨ 생성 중…" : "✨ 코드 생성"}
            </button>
            {reasoning && (
              <span className="self-center text-[11px] font-mono-nu text-nu-muted">
                💡 {reasoning.slice(0, 80)}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* LEFT — code editor */}
          <div className="border-[3px] border-nu-ink bg-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-nu uppercase tracking-widest font-bold">코드 (TSX)</span>
              <button onClick={() => runPreview(source)} disabled={previewLoading} className={`${BTN} bg-white`}>
                {previewLoading ? "⏳ 컴파일 중…" : "▶ 미리보기 갱신"}
              </button>
            </div>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              aria-label="컴포넌트 소스 코드"
              className="h-[300px] sm:h-[400px] lg:h-[500px] w-full border-2 border-nu-ink/30 bg-[#0D0F14] p-3 font-mono text-[12px] text-[#C8A97E] focus:outline-none"
            />
          </div>

          {/* RIGHT — live preview */}
          <div className="border-[3px] border-nu-ink bg-white p-3 space-y-2">
            <span className="text-[11px] font-mono-nu uppercase tracking-widest font-bold">
              미리보기 (sandboxed iframe)
            </span>
            <div className="border-2 border-nu-ink/30 bg-white">
              {previewUrl ? (
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  sandbox="allow-scripts"
                  className="h-[300px] sm:h-[400px] lg:h-[500px] w-full"
                  title="Thread preview"
                />
              ) : previewLoading ? (
                <div className="flex h-[300px] sm:h-[400px] lg:h-[500px] items-center justify-center gap-2 text-sm text-nu-muted">
                  <span className="animate-pulse">●</span> 코드를 컴파일 중…
                </div>
              ) : (
                <div className="flex h-[300px] sm:h-[400px] lg:h-[500px] flex-col items-center justify-center gap-3 text-sm text-nu-muted p-4 text-center">
                  <span>미리보기를 사용할 수 없습니다.</span>
                  <button onClick={() => runPreview(source)} className={`${BTN} bg-white`}>
                    🔄 다시 시도
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save form */}
        <div className="border-[3px] border-nu-ink bg-white p-5 space-y-3">
          <h2 className="font-head text-lg font-bold">💾 저장</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block">
              <span className="text-[11px] font-mono-nu uppercase font-bold">이름</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full border-2 border-nu-ink p-2"
                placeholder="예: 팀 스탠드업"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-mono-nu uppercase font-bold">아이콘</span>
              <input value={icon} onChange={(e) => setIcon(e.target.value)} className="mt-1 w-full border-2 border-nu-ink p-2" />
            </label>
            <label className="block">
              <span className="text-[11px] font-mono-nu uppercase font-bold">스코프</span>
              <select
                value={scope[0] || "bolt"}
                onChange={(e) => setScope([e.target.value as "nut" | "bolt"])}
                className="mt-1 w-full border-2 border-nu-ink p-2"
              >
                <option value="bolt">볼트 (개별 프로젝트)</option>
                <option value="nut">너트 (커뮤니티)</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] font-mono-nu uppercase font-bold">설명</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full border-2 border-nu-ink p-2"
            />
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className={`${BTN} bg-nu-ink text-white`}>
              {saving ? "저장 중…" : "💾 저장 (관리자 검토 대기)"}
            </button>
            <button onClick={() => router.push("/threads/build")} className={`${BTN} bg-white`}>
              ← 취소
            </button>
          </div>
        </div>

        {error && (
          <div className="border-[3px] border-red-600 bg-red-50 p-4 font-mono-nu text-sm text-red-700 space-y-2">
            <div className="font-bold">⚠️ {error}</div>
            <p className="text-xs text-red-600">
              {error.includes("preview") || error.includes("compile")
                ? "esbuild 컴파일에 실패했어요. 코드 문법을 확인하세요. (자주 보이는 원인: 닫는 괄호 누락, JSX 사용 — TSX 모드에서는 React.createElement 권장)"
                : error.includes("ai") || error.includes("generate")
                ? "AI 생성에 실패했어요. 잠시 후 다시 시도하거나 요구사항을 짧게 다듬어 보세요."
                : "잠시 후 다시 시도해 주세요."}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setError(null)} className={`${BTN} bg-white`}>닫기</button>
              {(error.includes("preview") || error.includes("compile")) && (
                <button onClick={() => runPreview(source)} className={`${BTN} bg-white`}>🔄 미리보기 재시도</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
