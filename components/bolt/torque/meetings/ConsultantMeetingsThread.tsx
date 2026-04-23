"use client";

/**
 * ConsultantMeetingsThread — consultant-meetings Thread UI.
 *
 * 팀 + 컨설턴트 이중 역할 미팅. visibility: all
 * 세션 유형 태그(Discovery/Diagnosis/Proposal/Review/Check-in) + 세션 브리프.
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus, Calendar, Clock, Users, ChevronDown,
  CheckCircle2, Circle, GraduationCap, FileText,
  Loader2, AlertCircle, Sparkles,
} from "lucide-react";
import type { Meeting, MeetingFormData, SessionType } from "./meeting-schema";
import {
  SESSION_TYPE_LABELS, MEETING_TYPE_LABELS, ACTION_STATUS_CONFIG,
} from "./meeting-schema";

interface Props {
  projectId: string;
  userId: string;
  userRole?: "owner" | "team" | "consultant" | "observer";
  canEdit?: boolean;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
    weekday: "short", hour: "2-digit", minute: "2-digit",
  });
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// ── 세션 유형 뱃지 ──
function SessionTypeBadge({ type }: { type: SessionType }) {
  const cfg = SESSION_TYPE_LABELS[type];
  return (
    <span className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border rounded-sm ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ── 컨설턴트 세션 카드 ──
function SessionCard({
  meeting, onExpand, expanded, userRole,
}: {
  meeting: Meeting;
  onExpand: (id: string) => void;
  expanded: boolean;
  userRole?: string;
}) {
  const isUpcoming  = meeting.status === "scheduled";
  const isCompleted = meeting.status === "completed";
  const openActions = meeting.action_items.filter(a => a.status === "open" || a.status === "in_progress").length;

  return (
    <div className={`border-[2px] transition-all ${
      isUpcoming  ? "border-teal-400 bg-teal-50/40" :
      isCompleted ? "border-nu-ink/[0.08] bg-nu-white" :
                    "border-nu-ink/[0.04] bg-nu-cream/20 opacity-70"
    }`}>
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => onExpand(meeting.id)}>
        {/* 아이콘 */}
        <div className={`mt-0.5 shrink-0 ${isCompleted ? "text-green-600" : "text-teal-600"}`}>
          {isCompleted ? <CheckCircle2 size={16} /> : <GraduationCap size={16} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {meeting.session_type && <SessionTypeBadge type={meeting.session_type} />}
            <span className="font-head text-[14px] font-bold text-nu-ink">{meeting.title}</span>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-nu-muted flex-wrap">
            <span className="flex items-center gap-1"><Calendar size={11} />{fmtDate(meeting.scheduled_at)}</span>
            {meeting.duration_minutes && (
              <span className="flex items-center gap-1"><Clock size={11} />{meeting.duration_minutes}분</span>
            )}
            <span className="flex items-center gap-1"><Users size={11} />{meeting.attendee_ids.length}명 참석</span>
          </div>
          {openActions > 0 && (
            <span className="inline-block mt-1.5 font-mono-nu text-[10px] text-nu-amber">⚡ 미완 액션아이템 {openActions}</span>
          )}
        </div>

        {/* 세션 브리프 여부 */}
        {meeting.session_brief && (
          <span className="shrink-0 font-mono-nu text-[10px] text-teal-600 bg-teal-50 border border-teal-200 px-2 py-1">
            브리프 ✓
          </span>
        )}

        <ChevronDown size={14} className={`text-nu-muted shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </div>

      {/* 확장 상세 */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-nu-ink/[0.05] space-y-4">
          {/* 세션 브리프 */}
          {meeting.session_brief && (
            <div>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-teal-700 mb-2 flex items-center gap-1">
                <Sparkles size={10} /> 세션 브리프
              </p>
              <div className="text-[13px] text-nu-graphite leading-relaxed bg-teal-50 p-3 border border-teal-200 whitespace-pre-wrap">
                {meeting.session_brief}
              </div>
            </div>
          )}

          {/* 의제 */}
          {meeting.agenda_items.length > 0 && (
            <div>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">의제</p>
              <ol className="space-y-1.5">
                {meeting.agenda_items.map((a, i) => (
                  <li key={a.id} className="flex items-start gap-2 text-[13px]">
                    <span className="font-mono-nu text-[10px] text-nu-muted w-5 shrink-0 pt-0.5">{i + 1}.</span>
                    <span className="flex-1">{a.topic}</span>
                    {a.duration_min && (
                      <span className="font-mono-nu text-[10px] text-nu-muted shrink-0">{a.duration_min}분</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 회의록 */}
          {meeting.notes && (
            <div>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">회의록</p>
              <div className="text-[13px] text-nu-graphite leading-relaxed bg-nu-cream/30 p-3 border border-nu-ink/[0.06] whitespace-pre-wrap">
                {meeting.notes}
              </div>
            </div>
          )}

          {/* 결정 사항 */}
          {meeting.decisions.length > 0 && (
            <div>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">결정 사항</p>
              <ul className="space-y-1">
                {meeting.decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px]">
                    <span className="text-teal-600 shrink-0">◆</span>{d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 액션아이템 */}
          {meeting.action_items.length > 0 && (
            <div>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">액션아이템</p>
              <div className="space-y-1.5">
                {meeting.action_items.map(item => {
                  const cfg = ACTION_STATUS_CONFIG[item.status];
                  return (
                    <div key={item.id} className="flex items-center gap-2 text-[13px]">
                      <span className={`font-mono-nu text-[9px] uppercase px-1.5 py-0.5 shrink-0 ${cfg.color}`}>{cfg.label}</span>
                      <span className="flex-1">{item.text}</span>
                      {item.due_date && <span className="font-mono-nu text-[10px] text-nu-muted shrink-0">{fmtShort(item.due_date)}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 팀 vs 컨설턴트 AI 힌트 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div className="p-3 bg-blue-50 border border-blue-200 text-[12px] text-blue-800">
              <p className="font-bold mb-1">👥 팀 Copilot 제안</p>
              <p>이번 세션에서 물어볼 것을 AI에게 준비받으세요.</p>
            </div>
            <div className="p-3 bg-teal-50 border border-teal-200 text-[12px] text-teal-800">
              <p className="font-bold mb-1">🎓 컨설턴트 Copilot 제안</p>
              <p>지난 2주 팀 활동 요약을 AI로 확인하세요.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 새 세션 폼 ──
function NewSessionForm({
  projectId, userId, onCreated, onCancel,
}: {
  projectId: string; userId: string; onCreated: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: "", session_type: "checkin" as SessionType,
    scheduled_at: "", duration_minutes: 90, location: "",
    session_brief: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.scheduled_at) {
      toast.error("제목과 일정을 입력해주세요"); return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("project_meetings_torque").insert({
        project_id: projectId, track: "consultant",
        title: form.title.trim(), meeting_type: "session",
        session_type: form.session_type,
        scheduled_at: form.scheduled_at,
        duration_minutes: form.duration_minutes,
        location: form.location || null,
        session_brief: form.session_brief || null,
        notes: form.notes || null,
        attendee_ids: [userId],
        status: "scheduled", agenda_items: [], action_items: [], decisions: [],
        created_by: userId,
      });
      if (error) throw error;
      toast.success("컨설턴트 세션이 예약되었습니다");
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "세션 생성 실패");
    } finally { setSaving(false); }
  }

  const labelCls = "block font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite mb-1";
  const inputCls = "w-full px-3 py-2 border-[1.5px] border-nu-ink/15 bg-white focus:border-teal-400 outline-none text-[13px] rounded-sm";

  return (
    <form onSubmit={handleSubmit} className="border-[2px] border-teal-400 bg-teal-50/30 p-5 space-y-4">
      <div className="font-mono-nu text-[11px] uppercase tracking-widest text-teal-700 font-bold">
        🎓 새 컨설턴트 세션 예약
      </div>
      <div>
        <label className={labelCls}>세션 제목 *</label>
        <input className={inputCls} value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="예: 4월 전략 점검 세션" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>세션 유형</label>
          <select className={inputCls} value={form.session_type}
            onChange={e => setForm(f => ({ ...f, session_type: e.target.value as SessionType }))}>
            <option value="discovery">발견 (Discovery)</option>
            <option value="diagnosis">진단 (Diagnosis)</option>
            <option value="proposal">제안 (Proposal)</option>
            <option value="review">평가 (Review)</option>
            <option value="checkin">점검 (Check-in)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>소요 시간 (분)</label>
          <input type="number" className={inputCls} value={form.duration_minutes}
            onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}
            min={30} max={480} step={30} />
        </div>
      </div>
      <div>
        <label className={labelCls}>일정 *</label>
        <input type="datetime-local" className={inputCls} value={form.scheduled_at}
          onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} required />
      </div>
      <div>
        <label className={labelCls}>세션 브리프 (팀에게 사전 공유)</label>
        <textarea className={inputCls + " resize-none"} rows={3} value={form.session_brief}
          onChange={e => setForm(f => ({ ...f, session_brief: e.target.value }))}
          placeholder="이번 세션에서 다룰 주요 주제, 팀이 준비할 것..." />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest px-5 py-2.5 bg-teal-700 text-white hover:bg-teal-800 transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          {saving ? "저장 중..." : "예약"}
        </button>
        <button type="button" onClick={onCancel}
          className="font-mono-nu text-[12px] uppercase tracking-widest px-5 py-2.5 border border-nu-ink/15 text-nu-muted hover:text-nu-ink transition-colors">
          취소
        </button>
      </div>
    </form>
  );
}

// ── 메인 ConsultantMeetingsThread ──
export function ConsultantMeetingsThread({ projectId, userId, userRole, canEdit = false }: Props) {
  const [sessions, setSessions]     = useState<Meeting[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<SessionType | "all">("all");

  const loadSessions = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("project_meetings_torque")
      .select("*")
      .eq("project_id", projectId)
      .eq("track", "consultant")
      .order("scheduled_at", { ascending: false });

    if (error) console.warn("[consultant-meetings]:", error.message);
    setSessions((data as Meeting[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const displayed = filterType === "all"
    ? sessions
    : sessions.filter(s => s.session_type === filterType);

  const typeStats = Object.keys(SESSION_TYPE_LABELS).reduce((acc, k) => {
    acc[k] = sessions.filter(s => s.session_type === k).length;
    return acc;
  }, {} as Record<string, number>);

  if (loading) return (
    <div className="animate-pulse space-y-3 p-6">
      {[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-teal-50 rounded" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
            🎓 컨설턴트 세션
          </h2>
          <p className="text-[12px] text-nu-muted mt-0.5">
            팀 + 컨설턴트 공개 세션 · 전원 열람 가능
          </p>
        </div>
        {(canEdit || userRole === "consultant") && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 bg-teal-700 text-white hover:bg-teal-800 transition-colors"
          >
            <Plus size={12} /> 세션 예약
          </button>
        )}
      </div>

      {/* 세션 통계 바 */}
      {sessions.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType("all")}
            className={`font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
              filterType === "all" ? "border-teal-400 bg-teal-50 text-teal-700" : "border-nu-ink/10 text-nu-muted hover:border-teal-300"
            }`}
          >
            전체 {sessions.length}
          </button>
          {Object.entries(SESSION_TYPE_LABELS).map(([k, cfg]) => (
            typeStats[k] > 0 && (
              <button
                key={k}
                onClick={() => setFilterType(k as SessionType)}
                className={`font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                  filterType === k ? `${cfg.color}` : "border-nu-ink/10 text-nu-muted hover:border-teal-300"
                }`}
              >
                {cfg.label} {typeStats[k]}
              </button>
            )
          ))}
        </div>
      )}

      {/* 새 세션 폼 */}
      {showForm && (
        <NewSessionForm
          projectId={projectId} userId={userId}
          onCreated={() => { setShowForm(false); loadSessions(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* 세션 목록 */}
      <div className="space-y-3">
        {displayed.length === 0 ? (
          <div className="text-center py-12 border-[2px] border-dashed border-nu-ink/10">
            <GraduationCap size={28} className="text-nu-muted mx-auto mb-3 opacity-40" />
            <p className="text-nu-muted text-[13px]">예정된 세션이 없습니다</p>
            {(canEdit || userRole === "consultant") && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 font-mono-nu text-[11px] uppercase tracking-widest text-teal-600 hover:underline"
              >
                + 첫 세션 예약하기
              </button>
            )}
          </div>
        ) : (
          displayed.map(s => (
            <SessionCard
              key={s.id}
              meeting={s}
              onExpand={id => setExpandedId(prev => prev === id ? null : id)}
              expanded={expandedId === s.id}
              userRole={userRole}
            />
          ))
        )}
      </div>

      {/* 안내 */}
      <div className="flex items-start gap-2 p-3 bg-teal-50 border border-teal-200 text-[12px] text-teal-800">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        컨설턴트 세션은 팀원·컨설턴트 모두 열람 가능합니다. 세션 전 <strong>브리프</strong>를 작성하면 팀이 24시간 전에 확인할 수 있습니다.
      </div>
    </div>
  );
}
