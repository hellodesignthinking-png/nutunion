"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap, Plus, Trash2, Play, X, Loader2, ToggleLeft, ToggleRight,
  Clock, AlertTriangle, CheckSquare, Bell, Webhook, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface Rule {
  id: string;
  name: string;
  trigger: string;
  condition: Record<string, unknown>;
  action: "create_task" | "create_risk" | "notify" | "send_webhook";
  action_config: Record<string, unknown>;
  enabled: boolean;
  cooldown_min: number;
  last_fired_at: string | null;
  fire_count: number;
}

const TRIGGER_META: Record<string, { label: string; icon: typeof Clock; hint: string }> = {
  "task.overdue":         { label: "태스크 마감 지남",  icon: Clock,        hint: "마감일 지났는데 미완료 — 매 시간 평가" },
  "milestone.due_soon":   { label: "마일스톤 임박",     icon: AlertTriangle, hint: "마감 N일 이내 미완료" },
  "project.state_changed":{ label: "상태 변경",         icon: ChevronRight, hint: "프로젝트 상태가 바뀔 때 (인라인)" },
  "risk.added.high":      { label: "긴급 리스크 추가",  icon: AlertTriangle, hint: "high/critical 리스크 등록 시" },
  "decision.added":       { label: "결정 추가",         icon: CheckSquare,  hint: "결정 로그 신규 등록 시" },
  "file.uploaded":        { label: "파일 업로드",       icon: ChevronRight, hint: "프로젝트에 파일이 올라올 때" },
};

const ACTION_META: Record<Rule["action"], { label: string; icon: typeof CheckSquare }> = {
  create_task:  { label: "태스크 생성",  icon: CheckSquare },
  create_risk:  { label: "리스크 생성",  icon: AlertTriangle },
  notify:       { label: "알림 발송",   icon: Bell },
  send_webhook: { label: "웹훅 발송",   icon: Webhook },
};

const PRESETS: Array<Partial<Rule> & { name: string }> = [
  {
    name: "마일스톤 D-2 알림",
    trigger: "milestone.due_soon",
    condition: { days_before: 2 },
    action: "notify",
    action_config: { message: "🚨 {rule}: 마감 임박 마일스톤이 있습니다." },
    cooldown_min: 720,
  },
  {
    name: "마감 지난 태스크 → 리스크 자동 등록",
    trigger: "task.overdue",
    condition: {},
    action: "create_risk",
    action_config: { title_template: "지연 — {rule}", severity: "medium" },
    cooldown_min: 1440,
  },
  {
    name: "긴급 리스크 → 태스크 자동 생성",
    trigger: "risk.added.high",
    condition: {},
    action: "create_task",
    action_config: { title_template: "리스크 대응 — {rule}", due_offset_days: 3 },
    cooldown_min: 60,
  },
];

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function ProjectAutomationManager({ projectId, open, onClose }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Rule>>({
    name: "",
    trigger: "milestone.due_soon",
    condition: { days_before: 2 },
    action: "notify",
    action_config: { message: "" },
    cooldown_min: 720,
  });

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/automation`);
      const j = await r.json();
      if (Array.isArray(j.rules)) setRules(j.rules);
    } catch {} finally { setLoading(false); }
  }, [open, projectId]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setCreating(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "실패");
      setRules((p) => [j.rule, ...p]);
      setShowForm(false);
      setForm({ name: "", trigger: "milestone.due_soon", condition: { days_before: 2 }, action: "notify", action_config: { message: "" }, cooldown_min: 720 });
      toast.success("룰 생성");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally { setCreating(false); }
  }

  async function applyPreset(preset: typeof PRESETS[number]) {
    setCreating(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/automation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preset),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "실패");
      setRules((p) => [j.rule, ...p]);
      toast.success("프리셋 추가");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally { setCreating(false); }
  }

  async function toggle(r: Rule) {
    setRules((p) => p.map((x) => x.id === r.id ? { ...x, enabled: !x.enabled } : x));
    await fetch(`/api/projects/automation/${r.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !r.enabled }),
    }).catch(() => undefined);
  }

  async function remove(id: string) {
    if (!window.confirm("이 룰을 삭제할까요?")) return;
    setRules((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/projects/automation/${id}`, { method: "DELETE" }).catch(() => undefined);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b-[3px] border-nu-ink bg-white flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
            <Zap size={11} /> 자동화 룰 — IF / THEN
          </div>
          <button onClick={onClose} className="p-1 text-nu-muted hover:text-nu-ink"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-4">
          {/* 프리셋 */}
          <section>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1.5">빠른 시작</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
              {PRESETS.map((p, i) => (
                <button key={i} type="button" onClick={() => applyPreset(p)} disabled={creating}
                  className="text-left bg-white border-[2px] border-nu-ink/15 hover:border-nu-pink p-2 disabled:opacity-50">
                  <div className="font-bold text-[12px] text-nu-ink leading-snug">{p.name}</div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mt-1">
                    {TRIGGER_META[p.trigger as string]?.label} → {ACTION_META[p.action as Rule["action"]]?.label}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* 새 룰 */}
          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              className="w-full font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border-[2.5px] border-nu-ink bg-nu-ink text-nu-paper hover:bg-nu-graphite inline-flex items-center justify-center gap-1.5">
              <Plus size={12} /> 직접 만들기
            </button>
          ) : (
            <section className="bg-white border-[2px] border-nu-ink/15 p-3 space-y-2">
              <input
                placeholder="룰 이름 — 예: '주간 회의 D-1 알림'"
                value={form.name || ""}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                maxLength={80}
                className="w-full px-2 py-1.5 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-0.5">IF (트리거)</div>
                  <select value={form.trigger || ""} onChange={(e) => setForm((p) => ({ ...p, trigger: e.target.value }))}
                    className="w-full px-2 py-1 text-[11px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none">
                    {Object.entries(TRIGGER_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  <div className="text-[9px] text-nu-muted mt-0.5">{TRIGGER_META[form.trigger || ""]?.hint}</div>
                </div>
                <div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-0.5">THEN (액션)</div>
                  <select value={form.action || ""} onChange={(e) => setForm((p) => ({ ...p, action: e.target.value as Rule["action"] }))}
                    className="w-full px-2 py-1 text-[11px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none">
                    {Object.entries(ACTION_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              {form.trigger === "milestone.due_soon" && (
                <input type="number" min={1} max={30}
                  value={(form.condition as { days_before?: number })?.days_before ?? 2}
                  onChange={(e) => setForm((p) => ({ ...p, condition: { days_before: Number(e.target.value) || 2 } }))}
                  placeholder="N일 이내"
                  className="w-full px-2 py-1 text-[11px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none" />
              )}
              {form.action === "notify" && (
                <input value={(form.action_config as { message?: string })?.message || ""}
                  onChange={(e) => setForm((p) => ({ ...p, action_config: { message: e.target.value } }))}
                  placeholder="알림 메시지 — {rule}, {trigger} 치환 가능"
                  className="w-full px-2 py-1 text-[11px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none" />
              )}
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">cooldown</span>
                <input type="number" min={1} max={10080}
                  value={form.cooldown_min || 1440}
                  onChange={(e) => setForm((p) => ({ ...p, cooldown_min: Number(e.target.value) || 1440 }))}
                  className="w-20 px-2 py-1 border-[2px] border-nu-ink/15 outline-none" />
                <span className="text-nu-muted text-[10px]">분 — 같은 대상에 반복 방지</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setShowForm(false)} className="flex-1 font-mono-nu text-[10px] uppercase px-2 py-1 border-[2px] border-nu-ink/15">취소</button>
                <button onClick={create} disabled={creating || !form.name?.trim()}
                  className="flex-1 font-mono-nu text-[10px] uppercase px-2 py-1 bg-nu-ink text-nu-paper disabled:opacity-40">
                  {creating ? "..." : "저장"}
                </button>
              </div>
            </section>
          )}

          {/* 룰 목록 */}
          <section>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">활성 룰 · {rules.length}</div>
            {loading ? (
              <div className="text-[12px] text-nu-muted flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> 로드 중…</div>
            ) : rules.length === 0 ? (
              <div className="text-[12px] text-nu-muted italic">아직 룰 없음 — 위에서 프리셋 또는 직접 추가</div>
            ) : (
              <ul className="space-y-1.5">
                {rules.map((r) => {
                  const TIcon = TRIGGER_META[r.trigger]?.icon || Clock;
                  const AIcon = ACTION_META[r.action]?.icon || CheckSquare;
                  return (
                    <li key={r.id} className={`bg-white border-[2px] ${r.enabled ? "border-nu-ink/15" : "border-nu-ink/8 opacity-60"} px-3 py-2`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[13px] text-nu-ink">{r.name}</span>
                          </div>
                          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 bg-nu-cream px-1 border border-nu-ink/15">
                              <TIcon size={9} /> {TRIGGER_META[r.trigger]?.label || r.trigger}
                            </span>
                            <span>→</span>
                            <span className="inline-flex items-center gap-1 bg-nu-pink/10 text-nu-pink px-1 border border-nu-pink/30">
                              <AIcon size={9} /> {ACTION_META[r.action]?.label}
                            </span>
                            <span>· {r.fire_count}회 실행</span>
                            {r.last_fired_at && <span>· {formatDistanceToNow(new Date(r.last_fired_at), { addSuffix: true, locale: ko })}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={() => toggle(r)} title={r.enabled ? "비활성" : "활성"} className={`p-1 ${r.enabled ? "text-emerald-700" : "text-nu-muted"}`}>
                            {r.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          </button>
                          <button onClick={() => remove(r.id)} className="p-1 text-nu-muted hover:text-red-600">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted text-center">
            시간 기반 룰은 매시간 자동 평가됩니다 (cron)
          </div>
        </div>
      </div>
    </div>
  );
}
