"use client";

/**
 * TeamMeetingsThread — team-meetings Thread UI.
 *
 * 팀 전용 미팅 목록 + 회의록 작성 + 컨설턴트 공유 토글.
 * visibility: team_only
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus, Calendar, Clock, Users, ChevronRight, ChevronDown,
  CheckCircle2, Circle, Share2, Loader2, FileText, Zap,
  Eye, EyeOff, AlertCircle,
} from "lucide-react";
import type {
  Meeting, MeetingFormData, ActionItem, ActionItemStatus,
} from "./meeting-schema";
import {
  SESSION_TYPE_LABELS, MEETING_TYPE_LABELS, ACTION_STATUS_CONFIG,
} from "./meeting-schema";

interface Props {
  projectId: string;
  userId: string;
  canEdit?: boolean;
}

// ── 날짜 포맷 ──
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
    weekday: "short", hour: "2-digit", minute: "2-digit",
  });
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

// ── 미팅 카드 ──
function MeetingCard({
  meeting, onToggleShare, onExpand, expanded,
}: {
  meeting: Meeting;
  onToggleShare: (id: string, shared: boolean) => void;
  onExpand: (id: string) => void;
  expanded: boolean;
}) {
  const isUpcoming   = meeting.status === "scheduled";
  const isCompleted  = meeting.status === "completed";
  const openActions  = meeting.action_items.filter(a => a.status === "open" || a.status === "in_progress").length;
  const doneActions  = meeting.action_items.filter(a => a.status === "done").length;

  return (
    <div className={`border-[2px] transition-all ${
      isUpcoming  ? "border-teal-300 bg-teal-50/30" :
      isCompleted ? "border-nu-ink/[0.08] bg-nu-white" :
                    "border-nu-ink/[0.04] bg-nu-cream/20 opacity-70"
    }`}>
      {/* 카드 헤더 */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => onExpand(meeting.id)}
      >
        {/* 상태 아이콘 */}
        <div className={`mt-0.5 shrink-0 ${
          isCompleted ? "text-green-600" : isUpcoming ? "text-teal-600" : "text-nu-muted"
        }`}>
          {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
              {MEETING_TYPE_LABELS[meeting.meeting_type]}
            </span>
            <span className="font-head text-[14px] font-bold text-nu-ink truncate">
              {meeting.title}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[12px] text-nu-muted flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {fmtDate(meeting.scheduled_at)}
            </span>
            {meeting.duration_minutes && (
              <span className="flex items-center gap-1">
                <Clock size={11} /> {meeting.duration_minutes}분
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users size={11} /> {meeting.attendee_ids.length}명
            </span>
          </div>

          {/* 액션아이템 통계 */}
          {meeting.action_items.length > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="font-mono-nu text-[10px] text-nu-amber">
                ⚡ 진행중 {openActions}
              </span>
              <span className="font-mono-nu text-[10px] text-green-600">
                ✓ 완료 {doneActions}
              </span>
            </div>
          )}
        </div>

        {/* 컨설턴트 공유 토글 */}
        {isCompleted && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleShare(meeting.id, !meeting.shared_with_consultant); }}
            className={`shrink-0 flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest px-2.5 py-1.5 border transition-colors ${
              meeting.shared_with_consultant
                ? "border-teal-400 bg-teal-50 text-teal-700 hover:bg-teal-100"
                : "border-nu-ink/10 text-nu-muted hover:border-teal-300 hover:text-teal-600"
            }`}
            title={meeting.shared_with_consultant ? "컨설턴트에게 공개됨" : "컨설턴트에게 비공개"}
          >
            {meeting.shared_with_consultant ? <Eye size={10} /> : <EyeOff size={10} />}
            {meeting.shared_with_consultant ? "공유됨" : "공유"}
          </button>
        )}

        <ChevronDown
          size={14}
          className={`text-nu-muted shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </div>

      {/* 확장된 상세 */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-nu-ink/[0.05] space-y-4">
          {/* 의제 */}
          {meeting.agenda_items.length > 0 && (
            <div>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">의제</p>
              <ol className="space-y-1">
                {meeting.agenda_items.map((a, i) => (
                  <li key={a.id} className="flex items-start gap-2 text-[13px]">
                    <span className="font-mono-nu text-[10px] text-nu-muted w-5 shrink-0 pt-0.5">{i + 1}.</span>
                    <span>{a.topic}</span>
                    {a.duration_min && (
                      <span className="ml-auto font-mono-nu text-[10px] text-nu-muted shrink-0">{a.duration_min}분</span>
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
              <div className="text-[13px] text-nu-graphite leading-relaxed whitespace-pre-wrap bg-nu-cream/30 p-3 border border-nu-ink/[0.06] rounded">
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
                    <span className="text-teal-600 shrink-0">◆</span>
                    {d}
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
                {meeting.action_items.map((item) => {
                  const cfg = ACTION_STATUS_CONFIG[item.status];
                  return (
                    <div key={item.id} className="flex items-center gap-2 text-[13px]">
                      <span className={`font-mono-nu text-[9px] uppercase px-1.5 py-0.5 shrink-0 ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="flex-1">{item.text}</span>
                      {item.due_date && (
                        <span className="font-mono-nu text-[10px] text-nu-muted shrink-0">
                          {fmtShort(item.due_date)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 새 미팅 폼 ──
function NewMeetingForm({
  projectId, userId, onCreated, onCancel,
}: {
  projectId: string;
  userId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<MeetingFormData>({
    title: "", meeting_type: "weekly", scheduled_at: "",
    duration_minutes: 60, location: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.scheduled_at) {
      toast.error("제목과 일정을 입력해주세요");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const newMeeting = {
        project_id: projectId,
        track: "team",
        title: form.title.trim(),
        meeting_type: form.meeting_type,
        scheduled_at: form.scheduled_at,
        duration_minutes: form.duration_minutes || 60,
        location: form.location || null,
        attendee_ids: [userId],
        status: "scheduled",
        agenda_items: [],
        action_items: [],
        decisions: [],
        shared_with_consultant: false,
        notes: form.notes || null,
        created_by: userId,
      };
      const { error } = await supabase.from("project_meetings_torque").insert(newMeeting);
      if (error) throw error;
      toast.success("팀 미팅이 예약되었습니다");
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "미팅 생성 실패");
    } finally {
      setSaving(false);
    }
  }

  const labelCls = "block font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite mb-1";
  const inputCls = "w-full px-3 py-2 border-[1.5px] border-nu-ink/15 bg-white focus:border-teal-400 outline-none text-[13px] rounded-sm";

  return (
    <form onSubmit={handleSubmit} className="border-[2px] border-teal-300 bg-teal-50/20 p-5 space-y-4">
      <div className="font-mono-nu text-[11px] uppercase tracking-widest text-teal-700 font-bold mb-3">
        👥 새 팀 미팅 예약
      </div>
      <div>
        <label className={labelCls}>제목 *</label>
        <input className={inputCls} value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="예: 4월 4주차 주간 회의" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>미팅 유형</label>
          <select className={inputCls} value={form.meeting_type}
            onChange={e => setForm(f => ({ ...f, meeting_type: e.target.value as any }))}>
            <option value="weekly">주간</option>
            <option value="biweekly">격주</option>
            <option value="monthly">월간</option>
            <option value="adhoc">수시</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>소요 시간 (분)</label>
          <input type="number" className={inputCls} value={form.duration_minutes}
            onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}
            min={15} max={480} step={15} />
        </div>
      </div>
      <div>
        <label className={labelCls}>일정 *</label>
        <input type="datetime-local" className={inputCls} value={form.scheduled_at}
          onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} required />
      </div>
      <div>
        <label className={labelCls}>장소 / 링크</label>
        <input className={inputCls} value={form.location}
          onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
          placeholder="예: 줌 링크 또는 오프라인 주소" />
      </div>
      <div>
        <label className={labelCls}>사전 메모 (선택)</label>
        <textarea className={inputCls + " resize-none"} rows={3} value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="다룰 주제, 준비 사항 등..." />
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

// ── 메인 TeamMeetingsThread ──
export function TeamMeetingsThread({ projectId, userId, canEdit = false }: Props) {
  const [meetings, setMeetings]       = useState<Meeting[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [activeView, setActiveView]   = useState<"upcoming" | "all" | "actions">("upcoming");

  const loadMeetings = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("project_meetings_torque")
      .select("*")
      .eq("project_id", projectId)
      .eq("track", "team")
      .order("scheduled_at", { ascending: false });

    if (error) {
      // 테이블 미생성 환경 — 빈 상태로 처리
      console.warn("[team-meetings] 테이블 없음:", error.message);
    }
    setMeetings((data as Meeting[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  async function toggleShare(meetingId: string, shared: boolean) {
    const supabase = createClient();
    const { error } = await supabase
      .from("project_meetings_torque")
      .update({ shared_with_consultant: shared })
      .eq("id", meetingId);
    if (error) { toast.error("공유 설정 실패"); return; }
    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, shared_with_consultant: shared } : m));
    toast.success(shared ? "컨설턴트에게 공유됐습니다" : "공유가 해제됐습니다");
  }

  function handleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  // 뷰 필터
  const now = new Date().toISOString();
  const upcoming  = meetings.filter(m => m.scheduled_at >= now && m.status !== "cancelled");
  const completed = meetings.filter(m => m.status === "completed");
  const allActions = meetings.flatMap(m => m.action_items.map(a => ({ ...a, meeting_title: m.title })));
  const openActions = allActions.filter(a => a.status === "open" || a.status === "in_progress");

  const displayList =
    activeView === "upcoming" ? upcoming :
    activeView === "all"      ? meetings :
    [];

  if (loading) return (
    <div className="animate-pulse space-y-3 p-6">
      {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-teal-50 rounded" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
            👥 팀 미팅
          </h2>
          <p className="text-[12px] text-nu-muted mt-0.5">
            내부 팀 전용 · 기본 비공개 (선택 공유 가능)
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 bg-teal-700 text-white hover:bg-teal-800 transition-colors"
          >
            <Plus size={12} /> 새 미팅
          </button>
        )}
      </div>

      {/* 새 미팅 폼 */}
      {showForm && (
        <NewMeetingForm
          projectId={projectId}
          userId={userId}
          onCreated={() => { setShowForm(false); loadMeetings(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* 뷰 탭 */}
      <div className="flex gap-0 border-b-[2px] border-nu-ink/[0.06]">
        {[
          { key: "upcoming", label: `다가오는 미팅`, count: upcoming.length },
          { key: "all",      label: `전체`,          count: meetings.length },
          { key: "actions",  label: `액션아이템`,    count: openActions.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key as any)}
            className={`font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 border-b-[3px] transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeView === tab.key
                ? "border-teal-500 text-teal-700 font-bold bg-teal-50/50"
                : "border-transparent text-nu-muted hover:text-nu-graphite"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 ${
                activeView === tab.key ? "bg-teal-500/15 text-teal-700" : "bg-nu-ink/5 text-nu-muted"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 미팅 목록 */}
      {activeView !== "actions" && (
        <div className="space-y-3">
          {displayList.length === 0 ? (
            <div className="text-center py-12 border-[2px] border-dashed border-nu-ink/10">
              <Calendar size={28} className="text-nu-muted mx-auto mb-3 opacity-40" />
              <p className="text-nu-muted text-[13px]">
                {activeView === "upcoming" ? "예정된 미팅이 없습니다" : "미팅 기록이 없습니다"}
              </p>
              {canEdit && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-3 font-mono-nu text-[11px] uppercase tracking-widest text-teal-600 hover:underline"
                >
                  + 첫 미팅 예약하기
                </button>
              )}
            </div>
          ) : (
            displayList.map(meeting => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onToggleShare={toggleShare}
                onExpand={handleExpand}
                expanded={expandedId === meeting.id}
              />
            ))
          )}
        </div>
      )}

      {/* 액션아이템 뷰 */}
      {activeView === "actions" && (
        <div className="space-y-2">
          {openActions.length === 0 ? (
            <div className="text-center py-12 border-[2px] border-dashed border-nu-ink/10">
              <CheckCircle2 size={28} className="text-green-500 mx-auto mb-3 opacity-60" />
              <p className="text-nu-muted text-[13px]">모든 액션아이템 완료!</p>
            </div>
          ) : (
            openActions.map(item => {
              const cfg = ACTION_STATUS_CONFIG[item.status];
              return (
                <div key={item.id} className="flex items-center gap-3 p-3 border border-nu-ink/[0.08] bg-nu-white text-[13px]">
                  <span className={`font-mono-nu text-[9px] uppercase px-1.5 py-0.5 shrink-0 ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="flex-1 truncate">{item.text}</span>
                  <span className="font-mono-nu text-[11px] text-nu-muted shrink-0 hidden sm:block">
                    {(item as any).meeting_title}
                  </span>
                  {item.due_date && (
                    <span className="font-mono-nu text-[10px] text-nu-muted shrink-0">
                      {fmtShort(item.due_date)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 안내 */}
      <div className="flex items-start gap-2 p-3 bg-teal-50 border border-teal-200 text-[12px] text-teal-800">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        완료된 미팅 우측의 <strong>공유</strong> 버튼으로 특정 회의록을 컨설턴트에게 공개할 수 있습니다.
      </div>
    </div>
  );
}
