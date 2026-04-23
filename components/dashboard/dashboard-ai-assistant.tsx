"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Send, Loader2, Calendar, CheckSquare, Clock, AlertTriangle, Rocket, Users } from "lucide-react";

interface Brief {
  events: Array<{ id: string; title: string; start_at: string; location?: string | null; groups?: { name: string } | null }>;
  meetings: Array<{ id: string; title: string; scheduled_at: string; groups?: { name: string } | null }>;
  overdue: Array<{ id: string; title: string; due_date: string | null; project?: { title: string } | null }>;
  dueToday: Array<{ id: string; title: string; due_date: string | null; project?: { title: string } | null }>;
  dueSoon: Array<{ id: string; title: string; due_date: string | null; project?: { title: string } | null }>;
  upcomingBoltDeadlines: Array<{ id: string; title: string; end_date: string; days_left: number }>;
  activeBolts: Array<{ id: string; title: string; venture_stage: string | null; milestone_progress: string }>;
  counts: { groups: number; projects: number; overdue: number; dueToday: number; dueSoon: number };
}

interface AskResult {
  mode: "answer" | "action";
  message: string;
  priorities: Array<{ order: number; action: string; why: string; target_type?: string; target_id?: string }>;
  actions: Array<{
    type: "task" | "event";
    title: string;
    description?: string;
    due_date?: string;
    start_time?: string;
    end_time?: string;
    target_kind: "bolt" | "nut";
    target_id: string;
    target_title: string;
  }>;
}

const QUICK_PROMPTS = [
  "지금 뭐 해야 해?",
  "이번 주 마감 뭐 있어?",
  "내 볼트 어디까지 왔어?",
];

export function DashboardAIAssistant() {
  const router = useRouter();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [applying, setApplying] = useState(false);

  const loadBrief = useCallback(async () => {
    setBriefLoading(true);
    try {
      const res = await fetch("/api/dashboard/brief", { cache: "no-store" });
      if (res.ok) setBrief(await res.json());
    } catch { /* noop */ }
    finally { setBriefLoading(false); }
  }, []);

  useEffect(() => { loadBrief(); }, [loadBrief]);

  const ask = async (q: string) => {
    if (!q.trim() || asking) return;
    setAsking(true);
    setResult(null);
    try {
      const res = await fetch("/api/dashboard/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "질의 실패");
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "질의 실패");
    } finally {
      setAsking(false);
    }
  };

  const applyActions = async () => {
    if (!result || result.actions.length === 0) return;
    setApplying(true);
    try {
      const res = await fetch("/api/dashboard/apply-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: result.actions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "등록 실패");
      toast.success(`${data.applied}건 등록 완료`);
      setResult(null);
      setInput("");
      router.refresh();
      loadBrief();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "등록 실패");
    } finally {
      setApplying(false);
    }
  };

  const urgentCount = (brief?.counts.overdue ?? 0) + (brief?.counts.dueToday ?? 0);

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper">
      {/* 헤더 + 브리프 */}
      <div className="px-4 py-3 border-b-[2px] border-nu-ink bg-gradient-to-r from-nu-pink/5 to-transparent">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-nu-pink" />
            <span className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-pink font-bold">
              오늘의 브리프
            </span>
          </div>
          {brief && !briefLoading && (
            <div className="font-mono-nu text-[10px] text-nu-graphite">
              너트 {brief.counts.groups} · 볼트 {brief.counts.projects}
            </div>
          )}
        </div>
        {briefLoading ? (
          <div className="mt-2 font-mono-nu text-[11px] text-nu-graphite">오늘의 브리프 생성 중...</div>
        ) : brief ? (
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            <BriefStat
              icon={<AlertTriangle size={12} className="text-red-600" />}
              label="지난 할일"
              value={brief.counts.overdue}
              urgent={brief.counts.overdue > 0}
            />
            <BriefStat
              icon={<CheckSquare size={12} className="text-nu-pink" />}
              label="오늘 할일"
              value={brief.counts.dueToday}
              urgent={brief.counts.dueToday > 0}
            />
            <BriefStat
              icon={<Calendar size={12} className="text-nu-blue" />}
              label="오늘 일정"
              value={(brief.events.length + brief.meetings.length)}
            />
            <BriefStat
              icon={<Clock size={12} className="text-nu-amber" />}
              label="이번 주"
              value={brief.counts.dueSoon}
            />
          </div>
        ) : null}
      </div>

      {/* 입력 영역 */}
      <form
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
        className="p-3 border-b-[2px] border-nu-ink/10"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='"지금 뭐해야해?" 또는 "제로싸이트 내일 10시 미팅"'
            className="flex-1 h-10 px-3 border-[2px] border-nu-ink bg-nu-paper text-[13px]"
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={asking || !input.trim()}
            className="h-10 px-4 border-[2px] border-nu-pink bg-nu-pink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:border-nu-ink disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {asking ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {asking ? "생각 중..." : "물어보기"}
          </button>
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => { setInput(q); ask(q); }}
              disabled={asking}
              className="h-7 px-2 border-[1.5px] border-nu-ink/30 bg-nu-paper text-nu-ink font-mono-nu text-[10px] hover:border-nu-pink hover:text-nu-pink disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </form>

      {/* 결과 */}
      {result && (
        <div className="p-3 border-b-[2px] border-nu-ink/10 bg-nu-cream/20">
          {result.mode === "answer" ? (
            <>
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink mb-2">💬 AI 답변</div>
              <p className="text-[13px] text-nu-ink leading-relaxed whitespace-pre-wrap mb-3">{result.message}</p>
              {result.priorities.length > 0 && (
                <ol className="space-y-2 list-none p-0 m-0">
                  {result.priorities.map((p) => (
                    <li key={p.order} className="flex gap-2">
                      <span className="w-5 h-5 shrink-0 rounded-full bg-nu-pink text-nu-paper font-mono-nu text-[10px] font-bold flex items-center justify-center">
                        {p.order}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-bold text-nu-ink">{p.action}</div>
                        <div className="text-[11px] text-nu-graphite mt-0.5">{p.why}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <>
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue mb-2">⚡ 액션 제안</div>
              <p className="text-[12px] text-nu-graphite leading-relaxed mb-3">{result.message}</p>
              <ul className="space-y-2 list-none p-0 m-0 mb-3">
                {result.actions.map((a, i) => (
                  <li key={i} className="border-[1.5px] border-nu-ink bg-nu-paper p-2">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-ink text-nu-paper px-1.5 py-0.5">
                        {a.type === "task" ? "할일" : "일정"}
                      </span>
                      <span className="font-mono-nu text-[9px] text-nu-blue">
                        @ {a.target_title}
                      </span>
                      {a.due_date && (
                        <span className="font-mono-nu text-[9px] text-nu-graphite">
                          📅 {a.due_date}
                          {a.start_time && ` ${a.start_time}`}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-[13px] text-nu-ink">{a.title}</div>
                    {a.description && <div className="text-[11px] text-nu-graphite mt-0.5">{a.description}</div>}
                  </li>
                ))}
              </ul>
              {result.actions.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyActions}
                    disabled={applying}
                    className="h-9 px-3 border-[2px] border-nu-ink bg-nu-ink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-pink hover:border-nu-pink disabled:opacity-50"
                  >
                    {applying ? "등록 중..." : `${result.actions.length}건 등록 →`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="h-9 px-3 border-[2px] border-nu-ink/30 bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest hover:border-nu-ink"
                  >
                    취소
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 브리프 상세 */}
      {brief && !result && !briefLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x-[2px] divide-nu-ink/10">
          {/* 좌: 오늘 할일 */}
          <div className="p-3">
            <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">
              🔥 할일 ({brief.counts.overdue + brief.counts.dueToday + brief.counts.dueSoon})
            </div>
            {urgentCount === 0 && brief.counts.dueSoon === 0 ? (
              <p className="text-[11px] text-nu-graphite italic">할일 없음 — 여유있는 날</p>
            ) : (
              <ul className="space-y-1 list-none p-0 m-0 max-h-40 overflow-y-auto">
                {brief.overdue.map((t) => (
                  <li key={`o-${t.id}`} className="flex items-center gap-1.5 text-[11px]">
                    <span className="font-mono-nu text-[9px] text-red-600 font-bold shrink-0">지남</span>
                    <span className="truncate flex-1">{t.title}</span>
                    {t.project && <span className="font-mono-nu text-[9px] text-nu-graphite shrink-0">{t.project.title}</span>}
                  </li>
                ))}
                {brief.dueToday.map((t) => (
                  <li key={`d-${t.id}`} className="flex items-center gap-1.5 text-[11px]">
                    <span className="font-mono-nu text-[9px] text-nu-pink font-bold shrink-0">오늘</span>
                    <span className="truncate flex-1">{t.title}</span>
                    {t.project && <span className="font-mono-nu text-[9px] text-nu-graphite shrink-0">{t.project.title}</span>}
                  </li>
                ))}
                {brief.dueSoon.slice(0, 4).map((t) => (
                  <li key={`s-${t.id}`} className="flex items-center gap-1.5 text-[11px] opacity-70">
                    <span className="font-mono-nu text-[9px] text-nu-graphite shrink-0">{t.due_date?.slice(5)}</span>
                    <span className="truncate flex-1">{t.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 우: 오늘 일정 + 볼트 진행 */}
          <div className="p-3">
            <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">
              📅 오늘 일정 + 진행 중 볼트
            </div>
            <ul className="space-y-1 list-none p-0 m-0 max-h-40 overflow-y-auto">
              {brief.events.map((e) => (
                <li key={`e-${e.id}`} className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-mono-nu text-[9px] text-nu-blue shrink-0">
                    {new Date(e.start_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="truncate flex-1">{e.title}</span>
                  {e.groups?.name && <span className="font-mono-nu text-[9px] text-nu-graphite shrink-0">{e.groups.name}</span>}
                </li>
              ))}
              {brief.meetings.map((m) => (
                <li key={`m-${m.id}`} className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-mono-nu text-[9px] text-nu-pink shrink-0">
                    {new Date(m.scheduled_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="truncate flex-1">회의: {m.title}</span>
                </li>
              ))}
              {brief.activeBolts.slice(0, 4).map((b) => (
                <li key={`b-${b.id}`}>
                  <Link
                    href={`/projects/${b.id}`}
                    className="flex items-center gap-1.5 text-[11px] no-underline text-nu-ink hover:text-nu-pink"
                  >
                    <Rocket size={10} className="shrink-0 text-nu-graphite" />
                    <span className="truncate flex-1">{b.title}</span>
                    <span className="font-mono-nu text-[9px] text-nu-graphite shrink-0">
                      {b.venture_stage ?? ""} {b.milestone_progress}
                    </span>
                  </Link>
                </li>
              ))}
              {brief.events.length === 0 && brief.meetings.length === 0 && brief.activeBolts.length === 0 && (
                <li className="text-[11px] text-nu-graphite italic">진행 중 볼트/일정 없음</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function BriefStat({
  icon, label, value, urgent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  urgent?: boolean;
}) {
  return (
    <div className={`border-[1.5px] px-2 py-1.5 ${urgent ? "border-nu-pink bg-nu-pink/5" : "border-nu-ink/20 bg-nu-paper"}`}>
      <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite flex items-center gap-1">
        {icon} {label}
      </div>
      <div className={`font-bold text-[16px] tabular-nums ${urgent && value > 0 ? "text-nu-pink" : "text-nu-ink"}`}>
        {value}
      </div>
    </div>
  );
}
