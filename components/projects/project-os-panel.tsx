"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sparkles, Brain, AlertTriangle, ListChecks, ShieldCheck,
  Loader2, Plus, Trash2, RefreshCw, Edit3, X,
  CheckCircle2, Circle, AlertOctagon, Flame, Info,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

/**
 * ProjectOsPanel — "프로젝트 OS" 통합 패널.
 *
 *   상단: AI PM 브리핑 (5개 버킷)
 *   섹션 1: 결정 로그 (active 만, 토글로 reverted 표시)
 *   섹션 2: 리스크 (severity 별 컬러)
 */

interface OwnerProfile { id: string; nickname: string; avatar_url: string | null }
interface Decision {
  id: string; title: string; rationale: string | null; status: "active" | "reverted";
  decided_at: string; source_kind: string | null;
  decider?: OwnerProfile | OwnerProfile[] | null;
}
interface Risk {
  id: string; title: string; description: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "mitigating" | "resolved" | "accepted";
  due_at: string | null; created_at: string; updated_at: string;
  owner?: OwnerProfile | OwnerProfile[] | null;
}

type Brief = {
  summary?: string;
  todays?: Array<{ title: string; why: string; href?: string }>;
  risks?: Array<{ title: string; severity: "low"|"medium"|"high"|"critical"; note: string }>;
  blocked?: Array<{ title: string; waiting_on: string }>;
  decisions?: Array<{ title: string; when?: string }>;
  next?: string[];
  cached?: boolean;
  model_used?: string;
};

const SEV_META: Record<Risk["severity"], { color: string; label: string; icon: typeof Flame }> = {
  low:      { color: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "낮음", icon: Info },
  medium:   { color: "bg-amber-50 text-amber-700 border-amber-200",       label: "보통", icon: AlertTriangle },
  high:     { color: "bg-orange-50 text-orange-700 border-orange-200",    label: "높음", icon: AlertOctagon },
  critical: { color: "bg-red-50 text-red-700 border-red-300",             label: "긴급", icon: Flame },
};

const RISK_STATUS_META: Record<Risk["status"], { label: string; color: string }> = {
  open:        { label: "진행 중", color: "text-red-700" },
  mitigating:  { label: "완화 중", color: "text-amber-700" },
  resolved:    { label: "해결됨", color: "text-emerald-700" },
  accepted:    { label: "수용",   color: "text-nu-graphite" },
};

interface Props { projectId: string; canEdit: boolean; }

export function ProjectOsPanel({ projectId, canEdit }: Props) {
  return (
    <div className="space-y-6">
      <PmBriefSection projectId={projectId} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DecisionsSection projectId={projectId} canEdit={canEdit} />
        <RisksSection projectId={projectId} canEdit={canEdit} />
      </div>
    </div>
  );
}

// ─── PM Brief ─────────────────────────────────────────────────────────
function PmBriefSection({ projectId }: { projectId: string }) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/pm-brief${force ? "?refresh=1" : ""}`);
      const j = await r.json();
      setBrief(j);
    } catch {} finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(false); }, [load]);

  return (
    <section className="bg-emerald-50 border-[3px] border-emerald-800 shadow-[4px_4px_0_0_#0D0F14] p-4 md:p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
          <Brain size={18} className="text-emerald-700" /> AI PM 브리핑
          <span className="font-mono-nu text-[10px] uppercase tracking-widest bg-emerald-300 text-nu-ink border border-emerald-800 px-1.5 py-0.5">
            Genesis
          </span>
        </h2>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-emerald-800 text-emerald-800 hover:bg-emerald-800 hover:text-nu-paper transition-colors inline-flex items-center gap-1 disabled:opacity-50"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} 새로
        </button>
      </div>

      {loading && !brief ? (
        <div className="flex items-center gap-2 text-sm text-nu-graphite py-4">
          <Loader2 size={14} className="animate-spin" /> 프로젝트 분석 중…
        </div>
      ) : brief ? (
        <>
          {brief.summary && (
            <p className="text-[14px] font-bold text-nu-ink mb-3 flex items-start gap-2">
              <Sparkles size={14} className="text-nu-pink mt-0.5 shrink-0" />
              <span>{brief.summary}</span>
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <BriefBucket title="🎯 오늘 할 일" items={brief.todays || []}
              render={(t: { title: string; why: string }) => (<><div className="font-bold">{t.title}</div><div className="text-nu-muted">{t.why}</div></>)}
              empty="오늘 우선순위 없음" />
            <BriefBucket title="⚠️ 리스크" items={brief.risks || []}
              render={(r: { title: string; severity: keyof typeof SEV_META; note: string }) => (
                <>
                  <div className="flex items-center gap-1">
                    <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-1 ${SEV_META[r.severity]?.color || ""}`}>
                      {SEV_META[r.severity]?.label}
                    </span>
                    <span className="font-bold">{r.title}</span>
                  </div>
                  <div className="text-nu-muted">{r.note}</div>
                </>
              )} empty="리스크 없음" />
            <BriefBucket title="🛑 막힌 일" items={brief.blocked || []}
              render={(b: { title: string; waiting_on: string }) => (<><div className="font-bold">{b.title}</div><div className="text-nu-muted">↳ {b.waiting_on}</div></>)}
              empty="막힌 일 없음" />
            <BriefBucket title="💡 결정사항" items={brief.decisions || []}
              render={(d: { title: string; when?: string }) => (<><div className="font-bold">{d.title}</div>{d.when && <div className="font-mono-nu text-[9px] text-nu-muted">{new Date(d.when).toLocaleDateString("ko")}</div>}</>)}
              empty="결정 없음" />
          </div>
          {(brief.next || []).length > 0 && (
            <div className="mt-3 pt-3 border-t-2 border-emerald-800/20">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-emerald-800 mb-1.5">📅 다음 1주</div>
              <ul className="space-y-1 list-none p-0 m-0 text-[13px] text-nu-graphite">
                {(brief.next || []).map((s, i) => <li key={i}>· {s}</li>)}
              </ul>
            </div>
          )}
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mt-2">
            {brief.cached ? "cached · " : ""}{brief.model_used}
          </div>
        </>
      ) : (
        <div className="text-sm text-nu-muted">데이터 없음</div>
      )}
    </section>
  );
}

function BriefBucket<T>({ title, items, render, empty }: {
  title: string;
  items: T[];
  render: (item: T) => React.ReactNode;
  empty: string;
}) {
  return (
    <div className="bg-white border-[2px] border-emerald-800/20 p-3">
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-emerald-800 font-black mb-1.5">{title}</div>
      {items.length === 0 ? (
        <div className="text-[12px] text-nu-muted italic">{empty}</div>
      ) : (
        <ul className="space-y-1.5 list-none p-0 m-0">
          {items.map((it, i) => (
            <li key={i} className="text-[12px] text-nu-graphite leading-snug">{render(it)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Decisions ────────────────────────────────────────────────────────
function DecisionsSection({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const [items, setItems] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReverted, setShowReverted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", rationale: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/decisions`);
      const j = await r.json();
      if (Array.isArray(j.decisions)) setItems(j.decisions as Decision[]);
    } catch {} finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/decisions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "실패");
      setItems((p) => [j.decision, ...p]);
      setAdding(false); setForm({ title: "", rationale: "" });
      toast.success("결정 추가");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally { setBusy(false); }
  }

  async function toggleStatus(d: Decision) {
    const next = d.status === "active" ? "reverted" : "active";
    setItems((p) => p.map((x) => x.id === d.id ? { ...x, status: next } : x));
    await fetch(`/api/projects/decisions/${d.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => undefined);
  }

  async function remove(id: string) {
    if (!window.confirm("이 결정을 삭제할까요?")) return;
    setItems((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/projects/decisions/${id}`, { method: "DELETE" }).catch(() => undefined);
  }

  const visible = showReverted ? items : items.filter((x) => x.status === "active");

  return (
    <section className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-head text-base font-extrabold text-nu-ink flex items-center gap-1.5">
          <ListChecks size={14} className="text-nu-blue" /> 결정 로그
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{visible.length}건</span>
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowReverted((v) => !v)} className="font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-nu-ink/15 hover:border-nu-ink/40">
            {showReverted ? "active 만" : "전체"}
          </button>
          {canEdit && (
            <button onClick={() => setAdding(true)} className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 bg-nu-ink text-nu-paper inline-flex items-center gap-1">
              <Plus size={10} /> 결정 추가
            </button>
          )}
        </div>
      </div>

      {adding && (
        <div className="mb-3 bg-nu-cream/40 border-2 border-nu-ink/15 p-2.5 space-y-2">
          <input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="결정사항 — 예: 'A안으로 진행'"
            maxLength={200}
            className="w-full px-2 py-1 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none"
            autoFocus
          />
          <textarea
            value={form.rationale}
            onChange={(e) => setForm((p) => ({ ...p, rationale: e.target.value }))}
            placeholder="왜 그렇게 결정했나요? (선택)"
            rows={2}
            className="w-full px-2 py-1 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none resize-y"
          />
          <div className="flex gap-1">
            <button onClick={() => { setAdding(false); setForm({ title: "", rationale: "" }); }} className="flex-1 font-mono-nu text-[10px] uppercase px-2 py-1 border-[2px] border-nu-ink/15">취소</button>
            <button onClick={add} disabled={busy || !form.title.trim()} className="flex-1 font-mono-nu text-[10px] uppercase px-2 py-1 bg-nu-ink text-nu-paper disabled:opacity-40">
              {busy ? "..." : "저장"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[12px] text-nu-muted flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> 로드 중…</div>
      ) : visible.length === 0 ? (
        <div className="text-[12px] text-nu-muted italic py-2">아직 결정 기록 없음</div>
      ) : (
        <ul className="space-y-1.5 list-none p-0 m-0">
          {visible.map((d) => {
            const decider = Array.isArray(d.decider) ? d.decider[0] : d.decider;
            return (
            <li key={d.id} className={`bg-white border-l-[3px] border-nu-blue px-2.5 py-1.5 ${d.status === "reverted" ? "opacity-50 line-through" : ""}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-nu-ink">{d.title}</div>
                  {d.rationale && <div className="text-[11px] text-nu-graphite mt-0.5 leading-snug">{d.rationale}</div>}
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mt-0.5 flex items-center gap-1.5">
                    {decider?.nickname && <span>{decider.nickname}</span>}
                    <span>· {formatDistanceToNow(new Date(d.decided_at), { addSuffix: true, locale: ko })}</span>
                    {d.source_kind && d.source_kind !== "manual" && <span>· {d.source_kind}</span>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => toggleStatus(d)} title={d.status === "active" ? "취소" : "복원"} className="p-1 text-nu-muted hover:text-nu-ink">
                      {d.status === "active" ? <Circle size={10} /> : <CheckCircle2 size={10} />}
                    </button>
                    <button onClick={() => remove(d.id)} className="p-1 text-nu-muted hover:text-red-600"><Trash2 size={10} /></button>
                  </div>
                )}
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ─── Risks ────────────────────────────────────────────────────────────
function RisksSection({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const [items, setItems] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ title: string; description: string; severity: Risk["severity"] }>({ title: "", description: "", severity: "medium" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/risks`);
      const j = await r.json();
      if (Array.isArray(j.risks)) setItems(j.risks as Risk[]);
    } catch {} finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/risks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "실패");
      setItems((p) => [j.risk, ...p]);
      setAdding(false); setForm({ title: "", description: "", severity: "medium" });
      toast.success("리스크 등록");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally { setBusy(false); }
  }

  async function patchStatus(r: Risk, status: Risk["status"]) {
    setItems((p) => p.map((x) => x.id === r.id ? { ...x, status } : x));
    await fetch(`/api/projects/risks/${r.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => undefined);
  }

  async function remove(id: string) {
    if (!window.confirm("이 리스크를 삭제할까요?")) return;
    setItems((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/projects/risks/${id}`, { method: "DELETE" }).catch(() => undefined);
  }

  const visible = showResolved ? items : items.filter((r) => r.status !== "resolved");

  return (
    <section className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-head text-base font-extrabold text-nu-ink flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-nu-pink" /> 리스크
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{visible.length}건</span>
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowResolved((v) => !v)} className="font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-nu-ink/15 hover:border-nu-ink/40">
            {showResolved ? "open 만" : "전체"}
          </button>
          {canEdit && (
            <button onClick={() => setAdding(true)} className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 bg-nu-ink text-nu-paper inline-flex items-center gap-1">
              <Plus size={10} /> 리스크 등록
            </button>
          )}
        </div>
      </div>

      {adding && (
        <div className="mb-3 bg-nu-cream/40 border-2 border-nu-ink/15 p-2.5 space-y-2">
          <input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="리스크 — 예: '권리분석 미완료'"
            maxLength={200}
            className="w-full px-2 py-1 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none"
            autoFocus
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="상세 설명 (선택)"
            rows={2}
            className="w-full px-2 py-1 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none resize-y"
          />
          <div className="flex items-center gap-1 flex-wrap">
            {(["low", "medium", "high", "critical"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setForm((p) => ({ ...p, severity: s }))}
                className={`font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 border ${
                  form.severity === s ? `${SEV_META[s].color} font-black` : "border-nu-ink/15 text-nu-muted"
                }`}>
                {SEV_META[s].label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <button onClick={() => setAdding(false)} className="flex-1 font-mono-nu text-[10px] uppercase px-2 py-1 border-[2px] border-nu-ink/15">취소</button>
            <button onClick={add} disabled={busy || !form.title.trim()} className="flex-1 font-mono-nu text-[10px] uppercase px-2 py-1 bg-nu-ink text-nu-paper disabled:opacity-40">
              {busy ? "..." : "저장"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[12px] text-nu-muted flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> 로드 중…</div>
      ) : visible.length === 0 ? (
        <div className="text-[12px] text-nu-muted italic py-2">활성 리스크 없음</div>
      ) : (
        <ul className="space-y-1.5 list-none p-0 m-0">
          {visible.map((r) => {
            const SevIcon = SEV_META[r.severity].icon;
            const overdue = r.due_at && new Date(r.due_at) < new Date() && r.status !== "resolved";
            return (
              <li key={r.id} className={`bg-white border-2 ${SEV_META[r.severity].color} px-2.5 py-1.5`}>
                <div className="flex items-start gap-2">
                  <SevIcon size={11} className="mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-nu-ink">{r.title}</div>
                    {r.description && <div className="text-[11px] text-nu-graphite mt-0.5 leading-snug">{r.description}</div>}
                    <div className="font-mono-nu text-[9px] uppercase tracking-widest mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className={RISK_STATUS_META[r.status].color}>{RISK_STATUS_META[r.status].label}</span>
                      {r.due_at && (
                        <span className={overdue ? "text-red-700 font-black" : "text-nu-muted"}>
                          {overdue ? "지남 · " : "마감 · "}{new Date(r.due_at).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {r.status !== "resolved" && (
                        <button onClick={() => patchStatus(r, "resolved")} title="해결" className="p-1 text-nu-muted hover:text-emerald-700">
                          <CheckCircle2 size={10} />
                        </button>
                      )}
                      <button onClick={() => remove(r.id)} className="p-1 text-nu-muted hover:text-red-600"><Trash2 size={10} /></button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
