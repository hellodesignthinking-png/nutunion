"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Send, CheckCircle2, XCircle, ExternalLink, Undo2, Wand2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface GenesisPlanPreview {
  draft_id: string | null;
  kind: "group" | "project";
  intent: string;
  plan: {
    title: string;
    summary: string;
    phases: Array<{ name: string; goal: string }>;
    suggested_roles: Array<{ role_name: string; why: string }>;
    resources_folders: string[];
    first_tasks: string[];
  };
  model_used: string | null;
  phase_count: number;
  task_count: number;
}

interface Action {
  tool: string;
  args: any;
  result: {
    ok: boolean;
    id?: string;
    message: string;
    href?: string;
    genesis_plan?: GenesisPlanPreview;
  };
}

interface AgentResponse {
  reply: string;
  actions: Action[];
  model_used?: string;
}

const TOOL_LABEL: Record<string, string> = {
  create_task: "할 일",
  create_event: "일정",
  create_meeting: "회의",
  create_wiki_draft: "위키 초안",
  send_group_message: "채팅 전송",
  summarize: "요약",
  design_new_space: "Genesis 공간 설계",
};

const TOOL_TARGET_TABLE: Record<string, string> = {
  create_task: "project_tasks", // server decides; fallback guess — could be personal_tasks
  create_event: "events",
  create_meeting: "meetings",
  create_wiki_draft: "wiki_pages",
  send_group_message: "chat_messages",
};

const SUGGESTIONS = [
  "오늘 할 일 요약",
  "다음 주 미팅",
  "새 볼트 만들기",
  "인재 추천",
  "내일 오후 3시 기획 미팅 잡아줘",
  "이번주 금요일까지 LP 초안 할 일 추가",
];

interface HistoryItem { at: number; input: string; summary: string }

export function AICommandBar() {
  const [input, setInput] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const pre = localStorage.getItem("ai-cmdbar-prefill");
      if (pre) { localStorage.removeItem("ai-cmdbar-prefill"); return pre; }
    } catch {}
    return "";
  });
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("ai-cmdbar-history") || "[]"); } catch { return []; }
  });
  const router = useRouter();

  function pushHistory(item: HistoryItem) {
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, 3);
      try { localStorage.setItem("ai-cmdbar-history", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function confirmGenesis(preview: GenesisPlanPreview) {
    setConfirming(preview.draft_id || preview.plan.title);
    try {
      const res = await fetch("/api/genesis/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: preview.kind,
          plan: preview.plan,
          intent: preview.intent,
          model_used: preview.model_used,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "provision 실패" }));
        throw new Error(err?.error || "provision 실패");
      }
      const data = await res.json();
      const href = preview.kind === "group" ? `/groups/${data.target_id}` : `/projects/${data.target_id}`;
      toast.success(`✨ ${preview.plan.title} 공간 생성됨!`);
      router.push(href);
    } catch (e: any) {
      toast.error("확정 실패: " + (e?.message || "unknown"));
    } finally {
      setConfirming(null);
    }
  }

  async function run() {
    if (!input.trim()) return;
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch("/api/dashboard/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<AgentResponse> & { error?: string };
      if (!res.ok) {
        const msg = data?.error || `AI 실행 실패 (HTTP ${res.status})`;
        toast.error(msg);
        return;
      }
      const agent = data as AgentResponse;
      setResponse(agent);
      const summary = agent.actions?.length
        ? agent.actions.map((a) => (a.result?.ok ? "✓" : "✗") + " " + (TOOL_LABEL[a.tool] || a.tool)).join(", ")
        : (agent.reply || "").slice(0, 60);
      pushHistory({ at: Date.now(), input: input.trim(), summary });
    } catch (err: any) {
      toast.error("AI 실행 실패: " + (err?.message || "네트워크 오류"));
    } finally {
      setLoading(false);
    }
  }

  async function undo(action: Action) {
    if (!action.result.ok || !action.result.id) return;
    // personal_tasks 구분 — server 에서 결정되었으므로 best-effort
    const table =
      action.tool === "create_task"
        ? action.args?.project_id
          ? "project_tasks"
          : "personal_tasks"
        : action.tool === "create_event"
          ? action.args?.group_id && !action.args?.is_personal
            ? "events"
            : "personal_events"
          : TOOL_TARGET_TABLE[action.tool];

    let res: Response;
    try {
      res = await fetch("/api/dashboard/ai-agent/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_table: table, target_id: action.result.id }),
      });
    } catch (e: any) {
      toast.error("취소 실패: " + (e?.message || "네트워크 오류"));
      return;
    }
    if (res.ok) {
      toast.success("취소됨");
      // UI 에서 해당 action 을 실패 표시로 바꿈
      setResponse((r) =>
        r
          ? {
              ...r,
              actions: r.actions.map((a) =>
                a === action ? { ...a, result: { ok: false, message: "취소됨" } } : a,
              ),
            }
          : r,
      );
    } else {
      toast.error("취소 실패");
    }
  }

  return (
    <section className="bg-nu-paper border-[4px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] p-6 md:p-8">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1 bg-nu-pink text-nu-paper border-[2px] border-nu-ink">
          <Sparkles size={11} /> 🎯 AI Work Station
        </span>
        <h2 className="font-head text-2xl md:text-3xl font-extrabold text-nu-ink tracking-tight uppercase">
          명령 한 줄, 바로 실행
        </h2>
        {response?.model_used && (
          <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted bg-white px-2 py-0.5 border border-nu-ink/20 hidden md:inline-flex">
            모델 · {response.model_used}
          </span>
        )}
        <Link
          href="/settings/ai-keys"
          className="ml-auto font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline"
        >
          내 AI 키 관리 →
        </Link>
      </div>

      <AiCommandTextarea input={input} setInput={setInput} run={run} />

      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-1.5">
        ⌘ / Ctrl + Enter — 빠른 실행
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-3">
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setInput(s)}
              className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink/20 hover:border-nu-ink hover:bg-nu-ink hover:text-nu-paper bg-white text-nu-graphite transition-colors truncate"
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={run}
          disabled={loading || !input.trim()}
          className="font-mono-nu text-base uppercase tracking-widest w-full md:w-auto px-8 py-4 bg-nu-pink text-nu-paper hover:bg-nu-ink border-[3px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bold"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          🚀 실행
        </button>
      </div>

      {history.length > 0 && !response && (
        <div className="mt-4 pt-3 border-t-[2px] border-nu-ink/10">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1.5">최근 실행</div>
          <ul className="space-y-1 list-none p-0 m-0">
            {history.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <button
                  onClick={() => setInput(h.input)}
                  className="text-left flex-1 min-w-0 hover:bg-nu-ink/[0.04] px-2 py-1 border-0 bg-transparent cursor-pointer"
                >
                  <div className="truncate text-nu-ink">{h.input}</div>
                  <div className="truncate font-mono-nu text-[10px] text-nu-muted">{h.summary}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {response && (
        <div className="mt-5 space-y-3">
          {response.actions.length > 0 && (
            <div className="space-y-1.5">
              {response.actions.map((a, i) => (
                <div key={i} className="space-y-2">
                  <ActionCard action={a} onUndo={() => undo(a)} />
                  {a.result.genesis_plan && (
                    <GenesisPreviewCard
                      preview={a.result.genesis_plan}
                      onConfirm={() => confirmGenesis(a.result.genesis_plan!)}
                      confirming={confirming === (a.result.genesis_plan.draft_id || a.result.genesis_plan.plan.title)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {response.reply && (
            <div className="bg-nu-paper border-[2px] border-nu-ink/20 p-3 text-sm text-nu-ink whitespace-pre-line">
              {response.reply}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function GenesisPreviewCard({
  preview,
  onConfirm,
  confirming,
}: {
  preview: GenesisPlanPreview;
  onConfirm: () => void;
  confirming: boolean;
}) {
  return (
    <div className="border-[3px] border-nu-ink bg-nu-paper shadow-[4px_4px_0_0_#0D0F14] p-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-nu-ink text-nu-paper">
          <Sparkles size={10} /> Genesis Plan
        </span>
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
          {preview.kind === "group" ? "너트(Group)" : "볼트(Project)"}
        </span>
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
          Phase {preview.phase_count} · Task {preview.task_count}
        </span>
      </div>
      <h3 className="font-head text-lg font-extrabold text-nu-ink tracking-tight uppercase mb-1">
        {preview.plan.title}
      </h3>
      <p className="text-sm text-nu-graphite mb-3 leading-relaxed">
        {preview.plan.summary}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">Phases</div>
          <ul className="text-xs text-nu-ink space-y-0.5 list-none p-0 m-0">
            {preview.plan.phases.slice(0, 5).map((p, i) => (
              <li key={i} className="truncate">• {p.name}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">First Tasks</div>
          <ul className="text-xs text-nu-ink space-y-0.5 list-none p-0 m-0">
            {preview.plan.first_tasks.slice(0, 4).map((t, i) => (
              <li key={i} className="truncate">☐ {t}</li>
            ))}
          </ul>
        </div>
      </div>

      {preview.plan.resources_folders?.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {preview.plan.resources_folders.slice(0, 6).map((f, i) => (
            <span
              key={i}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border border-nu-ink/20 text-nu-graphite"
            >
              📁 {f}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t-[2px] border-nu-ink/10">
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
          {preview.model_used ? `model · ${preview.model_used}` : ""}
        </span>
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 bg-nu-ink text-nu-paper hover:bg-nu-pink disabled:opacity-50 flex items-center gap-1.5"
        >
          {confirming ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          ✨ 확정 생성
        </button>
      </div>
    </div>
  );
}

function ActionCard({ action, onUndo }: { action: Action; onUndo: () => void }) {
  const ok = action.result.ok;
  const creating = action.tool.startsWith("create_") || action.tool === "send_group_message";
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border-[2px] text-sm ${
        ok ? "border-emerald-300 bg-emerald-50/50" : "border-red-200 bg-red-50/40"
      }`}
    >
      {ok ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> : <XCircle size={14} className="text-red-500 shrink-0" />}
      <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
        {TOOL_LABEL[action.tool] || action.tool}
      </span>
      <span className="flex-1 truncate">{action.result.message}</span>
      {action.result.href && ok && (
        <Link
          href={action.result.href}
          className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink no-underline hover:underline flex items-center gap-0.5"
        >
          열기 <ExternalLink size={9} />
        </Link>
      )}
      {ok && creating && action.result.id && (
        <button
          onClick={onUndo}
          className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-red-600 flex items-center gap-0.5 bg-transparent border-none cursor-pointer"
        >
          <Undo2 size={10} /> 취소
        </button>
      )}
    </div>
  );
}

function AiCommandTextarea({ input, setInput, run }: { input: string; setInput: (v: string) => void; run: () => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    // Focus + scroll into view when #ai-command hash is set (e.g. PWA shortcut)
    if (typeof window === "undefined") return;
    const check = () => {
      if (window.location.hash === "#ai-command") {
        const el = ref.current;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => el.focus(), 250);
        }
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);

  return (
    <textarea
      ref={ref}
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder='예) "내일 오후 3시에 제로싸이트 기획 미팅 잡아줘" · "이번 주 금요일까지 LP 디자인 초안 할 일 추가" · "20대 개발자 너트 설계"'
      className="w-full min-h-[110px] md:min-h-[140px] px-4 py-3 border-[3px] border-nu-ink focus:border-nu-pink outline-none text-base bg-white resize-y leading-relaxed"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
      }}
    />
  );
}
