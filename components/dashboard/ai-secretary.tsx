"use client";

/**
 * AI Secretary — 자연어 입력을 받아 task/event/nut_activity/bolt_activity/journal 로 분류.
 * 각 제안마다 target(너트/볼트/개인) 을 AI 가 추천하고, 유저가 override 가능.
 * "등록하기" 클릭 시 실제 DB 에 insert.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles, Loader2, Send, CheckSquare, Calendar as CalIcon,
  Layers, Briefcase, BookOpen, ArrowRight, Lightbulb,
} from "lucide-react";

type ItemType = "task" | "event" | "nut_activity" | "bolt_activity" | "journal";
type TargetKind = "personal" | "group" | "project";

interface Item {
  type: ItemType;
  title: string;
  detail?: string;
  due_at?: string;
  suggested_target: {
    kind: TargetKind;
    id: string | null;
    name: string | null;
    reason: string;
  };
  confidence: number;
}

interface AnalyzeResponse {
  summary: string;
  items: Item[];
  recommendations: string[];
  groups: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string }>;
}

const TYPE_META: Record<ItemType, { label: string; icon: any; color: string }> = {
  task: { label: "할 일", icon: CheckSquare, color: "text-indigo-500 bg-indigo-50" },
  event: { label: "일정", icon: CalIcon, color: "text-nu-blue bg-blue-50" },
  nut_activity: { label: "너트 활동", icon: Layers, color: "text-nu-pink bg-pink-50" },
  bolt_activity: { label: "볼트 활동", icon: Briefcase, color: "text-purple-600 bg-purple-50" },
  journal: { label: "기록", icon: BookOpen, color: "text-amber-700 bg-amber-50" },
};

export function AISecretary() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [overrides, setOverrides] = useState<Record<number, { kind: TargetKind; id: string | null; name: string | null }>>({});
  const [registering, setRegistering] = useState<number | null>(null);
  const [registered, setRegistered] = useState<Set<number>>(new Set());

  async function analyze() {
    if (!input.trim() || analyzing) return;
    setAnalyzing(true);
    setResult(null);
    setOverrides({});
    setRegistered(new Set());
    try {
      const res = await fetch("/api/dashboard/ai-secretary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석 실패");
      setResult(data);
    } catch (err: any) {
      toast.error(err?.message || "분석 실패");
    } finally {
      setAnalyzing(false);
    }
  }

  async function register(idx: number) {
    if (!result) return;
    const item = result.items[idx];
    const override = overrides[idx];
    const target = override || item.suggested_target;
    setRegistering(idx);
    try {
      const res = await fetch("/api/dashboard/ai-secretary/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: item.type,
          title: item.title,
          detail: item.detail,
          due_at: item.due_at,
          target_kind: target.kind,
          target_id: target.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "등록 실패");
      setRegistered((prev) => new Set(prev).add(idx));
      toast.success(`등록됨: ${item.title}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "등록 실패");
    } finally {
      setRegistering(null);
    }
  }

  function updateOverride(idx: number, value: string) {
    if (!result) return;
    const [kind, id] = value.split(":");
    if (kind === "personal") {
      setOverrides((prev) => ({ ...prev, [idx]: { kind: "personal", id: null, name: null } }));
    } else if (kind === "group") {
      const g = result.groups.find((x) => x.id === id);
      setOverrides((prev) => ({ ...prev, [idx]: { kind: "group", id, name: g?.name || null } }));
    } else if (kind === "project") {
      const p = result.projects.find((x) => x.id === id);
      setOverrides((prev) => ({ ...prev, [idx]: { kind: "project", id, name: p?.title || null } }));
    }
  }

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper">
      <div className="px-4 py-3 border-b-[2px] border-nu-ink bg-gradient-to-r from-nu-pink/5 to-transparent flex items-center gap-2">
        <Sparkles size={16} className="text-nu-pink" />
        <span className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-pink font-bold">AI 비서</span>
        <span className="font-mono-nu text-[10px] text-nu-graphite">자연어 → 할 일/일정/활동 자동 분류</span>
      </div>

      <div className="p-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="오늘 뭘 할지, 떠오르는 아이디어, 회의 메모 — 뭐든 자유롭게 적어보세요. 어디에 등록하면 좋을지 정리해드릴게요."
          rows={3}
          className="w-full px-3 py-2 border-[2px] border-nu-ink bg-nu-paper text-[13px] leading-relaxed resize-none focus:outline-none focus:border-nu-pink"
          maxLength={4000}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="font-mono-nu text-[10px] text-nu-muted tabular-nums">{input.length} / 4000</span>
          <button
            type="button"
            onClick={analyze}
            disabled={analyzing || !input.trim()}
            className="h-9 px-4 border-[2px] border-nu-pink bg-nu-pink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:border-nu-ink disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {analyzing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {analyzing ? "분석 중..." : "분석하기"}
          </button>
        </div>
      </div>

      {result && (
        <div className="border-t-[2px] border-nu-ink/10 bg-nu-cream/20">
          {/* Summary */}
          {result.summary && (
            <div className="px-4 py-3 border-b border-nu-ink/10">
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">요약</div>
              <p className="text-[13px] text-nu-ink leading-relaxed">{result.summary}</p>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="px-4 py-3 border-b border-nu-ink/10">
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink mb-1.5 flex items-center gap-1">
                <Lightbulb size={10} /> 우선 추천
              </div>
              <ul className="space-y-1 list-none p-0 m-0">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="text-[12px] text-nu-ink flex items-start gap-1.5">
                    <ArrowRight size={10} className="mt-1 shrink-0 text-nu-pink" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Items */}
          <div className="p-3 space-y-2">
            {result.items.length === 0 ? (
              <p className="text-[12px] text-nu-graphite italic text-center py-2">자동 등록할 만한 항목이 없어요</p>
            ) : (
              result.items.map((item, idx) => {
                const override = overrides[idx];
                const effective = override || item.suggested_target;
                const meta = TYPE_META[item.type];
                const Icon = meta.icon;
                const isRegistered = registered.has(idx);
                const currentValue = effective.kind === "personal"
                  ? "personal:"
                  : effective.kind === "group"
                    ? `group:${effective.id}`
                    : `project:${effective.id}`;
                return (
                  <div key={idx} className={`border-[1.5px] border-nu-ink bg-nu-paper p-3 ${isRegistered ? "opacity-50" : ""}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 inline-flex items-center gap-1 ${meta.color}`}>
                        <Icon size={10} /> {meta.label}
                      </span>
                      {item.due_at && (
                        <span className="font-mono-nu text-[10px] text-nu-muted tabular-nums">
                          {new Date(item.due_at).toLocaleString("ko", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      <span className="ml-auto font-mono-nu text-[9px] text-nu-muted tabular-nums">
                        신뢰도 {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                    <div className="font-bold text-[14px] text-nu-ink mb-0.5">{item.title}</div>
                    {item.detail && <div className="text-[12px] text-nu-graphite mb-2">{item.detail}</div>}

                    <div className="bg-nu-cream/40 border border-nu-ink/10 p-2 mb-2">
                      <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1">등록 위치</div>
                      <select
                        value={currentValue}
                        onChange={(e) => updateOverride(idx, e.target.value)}
                        disabled={isRegistered}
                        className="w-full px-2 py-1 border-[1.5px] border-nu-ink bg-nu-paper text-[12px] font-mono-nu"
                      >
                        <option value="personal:">개인 (내 워크스페이스)</option>
                        {result.groups.length > 0 && (
                          <optgroup label="내 너트">
                            {result.groups.map((g) => (
                              <option key={g.id} value={`group:${g.id}`}>너트: {g.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {result.projects.length > 0 && (
                          <optgroup label="내 볼트">
                            {result.projects.map((p) => (
                              <option key={p.id} value={`project:${p.id}`}>볼트: {p.title}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {!override && item.suggested_target.reason && (
                        <p className="font-mono-nu text-[10px] text-nu-muted mt-1">AI 추천 이유: {item.suggested_target.reason}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => register(idx)}
                      disabled={registering === idx || isRegistered}
                      className="h-8 px-3 border-[2px] border-nu-ink bg-nu-ink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-pink hover:border-nu-pink disabled:opacity-40 inline-flex items-center gap-1"
                    >
                      {isRegistered
                        ? "등록됨 ✓"
                        : registering === idx
                        ? <><Loader2 size={12} className="animate-spin" /> 등록 중...</>
                        : <>등록하기 <ArrowRight size={12} /></>}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
