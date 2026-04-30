"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MeetingNotes } from "@/components/meetings/meeting-notes";
import { AiMeetingAssistant } from "@/components/meetings/ai-meeting-assistant";
import { MeetingRecorder } from "@/components/meetings/meeting-recorder";
import { AgendaList } from "@/components/meetings/agenda-list";
import type { Profile } from "@/lib/types";
import { toast } from "sonner";
import {
  Plus,
  Calendar,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  FileText,
  Users,
  Trash2,
  Loader2,
  CheckCircle2,
  Play,
  X,
  Sparkles,
  CalendarX,
  Edit3,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ProjectMeeting {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_min: number;
  location?: string | null;
  status: string;
  organizer_id: string | null;
  summary: string | null;
  created_at: string;
  organizer?: { id: string; nickname: string } | null;
}

interface ProjectMember {
  user_id: string;
  profile?: { id: string; nickname: string } | null;
}

interface ProjectMemberRow {
  user_id: string;
  profile:
    | { id: string; nickname: string }
    | { id: string; nickname: string }[]
    | null;
}

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; borderColor: string; badge: string }
> = {
  upcoming: {
    label: "예정",
    color: "text-nu-blue",
    bg: "bg-nu-blue/10",
    borderColor: "border-l-nu-blue",
    badge: "bg-nu-blue/10 text-nu-blue border-nu-blue/20",
  },
  in_progress: {
    label: "진행 중",
    color: "text-nu-amber",
    bg: "bg-nu-amber/10",
    borderColor: "border-l-nu-amber",
    badge: "bg-nu-amber/10 text-nu-amber border-nu-amber/20",
  },
  completed: {
    label: "완료",
    color: "text-nu-pink",
    bg: "bg-nu-pink/10",
    borderColor: "border-l-nu-pink",
    badge: "bg-nu-pink/10 text-nu-pink border-nu-pink/20",
  },
  cancelled: {
    label: "취소",
    color: "text-nu-muted",
    bg: "bg-nu-cream/30",
    borderColor: "border-l-nu-gray",
    badge: "bg-nu-cream text-nu-muted border-nu-ink/10",
  },
};

export function ProjectMeetings({
  projectId,
  canEdit,
  userId,
}: {
  projectId: string;
  canEdit: boolean;
  userId: string;
}) {
  const [meetings, setMeetings] = useState<ProjectMeeting[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const [meetingsRes, membersRes] = await Promise.all([
      supabase
        .from("meetings")
        .select(
          "id, title, description, scheduled_at, duration_min, location, status, organizer_id, summary, created_at"
        )
        .eq("project_id", projectId)
        .order("scheduled_at", { ascending: false }),
      supabase
        .from("project_members")
        .select(
          "user_id, profile:profiles!project_members_user_id_fkey(id, nickname)"
        )
        .eq("project_id", projectId),
    ]);

    if (meetingsRes.data) {
      setMeetings(meetingsRes.data as ProjectMeeting[]);
    }
    if (membersRes.data) {
      setMembers(
        (membersRes.data as ProjectMemberRow[]).map((m) => ({
          user_id: m.user_id,
          profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
        }))
      );
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadData]);

  async function handleCreate() {
    if (!title.trim()) {
      toast.error("회의 제목을 입력해주세요");
      return;
    }
    if (!scheduledAt) {
      toast.error("회의 일시를 선택해주세요");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("meetings").insert({
      project_id: projectId,
      title: title.trim(),
      description: description.trim() || null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_min: durationMin,
      organizer_id: userId,
      status: "upcoming",
    });

    if (error) {
      toast.error("회의 생성 실패: " + error.message);
    } else {
      toast.success("회의가 생성되었습니다");
      setTitle("");
      setDescription("");
      setScheduledAt("");
      setDurationMin(60);
      setShowForm(false);
      await loadData();
    }
    setSaving(false);
  }

  function handleCancelForm() {
    setTitle("");
    setDescription("");
    setScheduledAt("");
    setDurationMin(60);
    setShowForm(false);
  }

  async function handleStatusChange(meetingId: string, newStatus: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("meetings")
      .update({ status: newStatus })
      .eq("id", meetingId);

    if (error) {
      toast.error("상태 변경 실패");
    } else {
      await loadData();
    }
  }

  async function handleDelete(meetingId: string) {
    if (!confirm("이 회의를 삭제하시겠습니까? 관련 노트도 함께 삭제됩니다."))
      return;
    const supabase = createClient();
    const { error } = await supabase
      .from("meetings")
      .delete()
      .eq("id", meetingId);

    if (error) {
      toast.error("삭제 실패");
    } else {
      toast.success("회의가 삭제되었습니다");
      if (expandedId === meetingId) setExpandedId(null);
      await loadData();
    }
  }

  async function handleSaveSummary(meetingId: string, summary: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("meetings")
      .update({ summary })
      .eq("id", meetingId);

    if (error) {
      toast.error("요약 저장 실패");
    } else {
      toast.success("회의 요약이 저장되었습니다");
      await loadData();
    }
  }

  // Build Profile[] for MeetingNotes component
  const memberProfiles = members
    .filter((m) => m.profile)
    .map((m): Profile => ({
      id: m.profile!.id,
      name: m.profile!.nickname,
      nickname: m.profile!.nickname,
      email: "",
      specialty: null,
      avatar_url: null,
      role: "member",
      can_create_crew: false,
      bio: null,
      created_at: new Date(0).toISOString(),
    }));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-nu-cream/50 animate-pulse" />
        <div className="h-48 bg-nu-cream/30 animate-pulse" />
      </div>
    );
  }

  const upcomingMeetings = meetings.filter(
    (m) => m.status === "upcoming" || m.status === "in_progress"
  );
  const pastMeetings = meetings.filter(
    (m) => m.status === "completed" || m.status === "cancelled"
  );

  return (
    <div className="space-y-8">
      {/* 헤더 — 너트와 동일한 스타일 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="px-2 py-0.5 bg-nu-ink text-nu-paper font-mono-nu text-[11px] font-black uppercase tracking-[0.2em]">Meeting_Log</div>
            <div className="px-2 py-0.5 bg-nu-pink/10 text-nu-pink font-mono-nu text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-1">
              <Sparkles size={8} /> {meetings.length}종
            </div>
          </div>
          <p className="text-nu-gray text-sm">예정 {upcomingMeetings.length}개 &middot; 완료 {pastMeetings.length}개</p>
        </div>
        {canEdit && (
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[12px] uppercase tracking-widest"
          >
            {showForm ? (
              <><X size={12} /> 취소</>
            ) : (
              <><Plus size={12} /> 새 회의</>
            )}
          </Button>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-nu-cream/20 border-[2px] border-dashed border-nu-ink/10 p-6 space-y-5">
          <h3 className="font-head text-sm font-bold text-nu-ink">
            새 회의 생성
          </h3>
          <div className="space-y-1.5">
            <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block">
              회의 제목
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: Sprint Week 3 회의, 디자인 리뷰"
              className="border-nu-ink/15"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block">
              회의 설명 (선택)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="회의에서 다룰 주제나 안건을 간략히 적어주세요..."
              rows={2}
              className="border-nu-ink/15 resize-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block">
                회의 일시
              </label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="border-nu-ink/15"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block">
                소요 시간 (분)
              </label>
              <Input
                type="number"
                value={durationMin}
                onChange={(e) => setDurationMin(parseInt(e.target.value) || 60)}
                min={15}
                step={15}
                placeholder="60"
                className="border-nu-ink/15"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[12px] uppercase tracking-widest"
            >
              {saving ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> 생성 중...
                </>
              ) : (
                <>
                  <Plus size={12} /> 회의 생성
                </>
              )}
            </Button>
            <Button
              onClick={handleCancelForm}
              variant="outline"
              className="font-mono-nu text-[12px] uppercase tracking-widest border-nu-ink/[0.12] text-nu-gray"
            >
              <X size={12} /> 취소
            </Button>
          </div>
        </div>
      )}

      {/* Upcoming Meetings */}
      {upcomingMeetings.length > 0 ? (
        <div>
          <h3 className="font-mono-nu text-[12px] font-black uppercase tracking-widest text-nu-muted mb-4">
            예정된 회의 ({upcomingMeetings.length})
          </h3>
          <div className="space-y-3">
            {upcomingMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                expanded={expandedId === meeting.id}
                onToggle={() =>
                  setExpandedId(expandedId === meeting.id ? null : meeting.id)
                }
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onSaveSummary={handleSaveSummary}
                onRefresh={loadData}
                memberProfiles={memberProfiles}
                userId={userId}
                canEdit={canEdit}
                projectId={projectId}
              />
            ))}
          </div>
        </div>
      ) : (
        meetings.length > 0 && (
          <div className="text-center py-12 border-[2px] border-dashed border-nu-ink/[0.08] bg-nu-cream/10">
            <Calendar
              size={36}
              className="mx-auto text-nu-muted/40 mb-3"
              strokeWidth={1.5}
            />
            <p className="font-head text-sm font-bold text-nu-ink mb-1">
              예정된 회의가 없습니다
            </p>
            {canEdit && (
              <p className="text-xs text-nu-muted">
                새 회의를 만들어보세요
              </p>
            )}
          </div>
        )
      )}

      {/* Past Meetings */}
      {pastMeetings.length > 0 ? (
        <div>
          <h3 className="font-mono-nu text-[12px] font-black uppercase tracking-widest text-nu-muted mb-4">
            지난 회의 ({pastMeetings.length})
          </h3>
          <div className="space-y-3">
            {pastMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                expanded={expandedId === meeting.id}
                onToggle={() =>
                  setExpandedId(expandedId === meeting.id ? null : meeting.id)
                }
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onSaveSummary={handleSaveSummary}
                onRefresh={loadData}
                memberProfiles={memberProfiles}
                userId={userId}
                canEdit={canEdit}
                projectId={projectId}
              />
            ))}
          </div>
        </div>
      ) : (
        meetings.length > 0 && (
          <div className="text-center py-10 border-[2px] border-dashed border-nu-ink/[0.08] bg-nu-cream/10">
            <CalendarX
              size={32}
              className="mx-auto text-nu-muted/40 mb-3"
              strokeWidth={1.5}
            />
            <p className="font-head text-sm font-bold text-nu-ink/70">
              아직 완료된 회의가 없습니다
            </p>
          </div>
        )
      )}

      {/* Global Empty State — 회의록 사용법 가이드 */}
      {meetings.length === 0 && (
        <div className="border-[3px] border-nu-ink bg-nu-cream/50 p-6">
          <div className="flex items-start gap-3 mb-4">
            <Calendar size={22} className="text-nu-pink mt-0.5 shrink-0" strokeWidth={2} />
            <div>
              <h3 className="font-head text-xl font-extrabold text-nu-ink mb-1">회의록이란?</h3>
              <p className="text-[13px] text-nu-graphite leading-relaxed">
                팀의 모든 논의·결정·할 일을 <strong>한 곳에서</strong> 관리하는 곳입니다.
                AI 가 녹음을 자동 요약하고, 액션 아이템을 칸반에 연동합니다.
              </p>
            </div>
          </div>
          <div className="border-l-[3px] border-nu-pink pl-4 mb-1 space-y-1.5">
            <p className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-pink font-bold mb-1">시작하는 방법</p>
            {canEdit ? (
              <>
                <p className="text-[13px] text-nu-graphite"><span className="font-mono-nu font-bold text-nu-ink mr-1.5">1.</span>위 <b>+ 회의 생성</b> 버튼으로 첫 회의 만들기</p>
                <p className="text-[13px] text-nu-graphite"><span className="font-mono-nu font-bold text-nu-ink mr-1.5">2.</span>회의 시작 시 녹음 → AI 가 회의록 초안 자동 생성</p>
                <p className="text-[13px] text-nu-graphite"><span className="font-mono-nu font-bold text-nu-ink mr-1.5">3.</span>액션 아이템은 칸반 보드로 자동 전환</p>
              </>
            ) : (
              <p className="text-[13px] text-nu-graphite">볼트 리더가 회의를 생성하면 여기에 표시됩니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Meeting Card with expandable notes                                 */
/* ------------------------------------------------------------------ */

function MeetingCard({
  meeting,
  expanded,
  onToggle,
  onStatusChange,
  onDelete,
  onSaveSummary,
  onRefresh,
  memberProfiles,
  userId,
  canEdit,
  projectId,
}: {
  meeting: ProjectMeeting;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onSaveSummary: (id: string, summary: string) => void;
  onRefresh: () => void;
  memberProfiles: Profile[];
  userId: string;
  canEdit: boolean;
  projectId: string;
}) {
  const [summaryText, setSummaryText] = useState(meeting.summary || "");
  const [editingSummary, setEditingSummary] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [title, setTitle] = useState(meeting.title);
  const [description, setDescription] = useState(meeting.description || "");
  const [scheduledAt, setScheduledAt] = useState(
    new Date(meeting.scheduled_at).toISOString().slice(0, 16)
  );
  const [durationMin, setDurationMin] = useState(meeting.duration_min || 60);
  const [location, setLocation] = useState(meeting.location || "");
  const [savingInfo, setSavingInfo] = useState(false);
  const cfg = statusConfig[meeting.status] || statusConfig.upcoming;
  const date = new Date(meeting.scheduled_at);

  // "upcoming" but scheduled end time has already passed → treat as overdue/past
  const overdueUpcoming =
    meeting.status === "upcoming" &&
    date.getTime() + (meeting.duration_min || 60) * 60000 < Date.now();

  // Date box colors by status
  const dateBoxClass =
    meeting.status === "in_progress"
      ? "bg-nu-amber/15 border-nu-amber/30"
      : meeting.status === "completed"
        ? "bg-green-50 border-green-200"
        : meeting.status === "cancelled"
          ? "bg-nu-cream/40 border-nu-ink/[0.08]"
          : overdueUpcoming
            ? "bg-nu-ink/5 border-nu-ink/[0.08]"
            : "bg-nu-blue/10 border-nu-blue/20";

  return (
    <div
      className={`bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden border-l-[4px] ${overdueUpcoming ? "border-l-nu-ink/20 opacity-75" : cfg.borderColor}`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 text-left hover:bg-nu-cream/20 transition-colors flex items-center gap-4"
      >
        <div
          className={`w-14 h-14 flex flex-col items-center justify-center shrink-0 border ${dateBoxClass}`}
        >
          <span className={`font-head text-lg font-extrabold leading-none ${overdueUpcoming ? "text-nu-muted" : "text-nu-ink"}`}>
            {date.getDate()}
          </span>
          <span className="font-mono-nu text-[10px] uppercase text-nu-muted">
            {date.toLocaleDateString("ko", { month: "short" })}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={`font-head text-sm font-bold truncate ${overdueUpcoming ? "text-nu-muted" : "text-nu-ink"}`}>
              {meeting.title}
            </p>
            <span
              className={`font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border ${cfg.bg} ${cfg.color}`}
            >
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-nu-muted">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {date.toLocaleTimeString("ko", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span>{meeting.duration_min}분</span>
            {memberProfiles.length > 0 && (
              <span className="flex items-center gap-1">
                <Users size={10} />
                {memberProfiles.length}명
              </span>
            )}
            {meeting.description && (
              <span className="truncate max-w-[200px]">
                {meeting.description}
              </span>
            )}
          </div>
        </div>

        {expanded ? (
          <ChevronUp size={16} className="text-nu-muted shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-nu-muted shrink-0" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-nu-ink/[0.08] px-5 py-5 space-y-6">
          {/* Status Actions */}
          {canEdit && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setEditingInfo((prev) => !prev)}
                className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 text-nu-pink hover:bg-nu-pink/10 border border-nu-pink/20 transition-colors flex items-center gap-1"
              >
                <Edit3 size={10} /> {editingInfo ? "수정 닫기" : "일정 수정"}
              </button>
              {meeting.status === "upcoming" && (
                <button
                  onClick={() => onStatusChange(meeting.id, "in_progress")}
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 bg-amber-100 text-amber-700 border-[2px] border-amber-300 hover:bg-amber-200 transition-colors flex items-center gap-1.5"
                >
                  <Play size={11} fill="currentColor" /> 시작
                </button>
              )}
              {meeting.status === "in_progress" && (
                <button
                  onClick={() => onStatusChange(meeting.id, "completed")}
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 bg-green-100 text-green-700 border-[2px] border-green-300 hover:bg-green-200 transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 size={11} /> 완료
                </button>
              )}
              {meeting.status !== "cancelled" && (
                <button
                  onClick={() => onDelete(meeting.id)}
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 text-nu-muted hover:text-red-600 hover:bg-red-50 border border-nu-ink/10 transition-colors flex items-center gap-1 ml-auto"
                >
                  <Trash2 size={10} /> 삭제
                </button>
              )}
            </div>
          )}

          {canEdit && editingInfo && (
            <MeetingInfoEditor
              meeting={meeting}
              title={title}
              description={description}
              scheduledAt={scheduledAt}
              durationMin={durationMin}
              location={location}
              saving={savingInfo}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
              onScheduledAtChange={setScheduledAt}
              onDurationMinChange={setDurationMin}
              onLocationChange={setLocation}
              onCancel={() => {
                setTitle(meeting.title);
                setDescription(meeting.description || "");
                setScheduledAt(new Date(meeting.scheduled_at).toISOString().slice(0, 16));
                setDurationMin(meeting.duration_min || 60);
                setLocation(meeting.location || "");
                setEditingInfo(false);
              }}
              onSave={async () => {
                if (!title.trim()) {
                  toast.error("회의 제목을 입력해주세요");
                  return;
                }
                if (!scheduledAt) {
                  toast.error("회의 일시를 선택해주세요");
                  return;
                }

                setSavingInfo(true);
                const supabase = createClient();
                const { error } = await supabase
                  .from("meetings")
                  .update({
                    title: title.trim(),
                    description: description.trim() || null,
                    scheduled_at: new Date(scheduledAt).toISOString(),
                    duration_min: durationMin,
                    location: location.trim() || null,
                  })
                  .eq("id", meeting.id);

                if (error) {
                  toast.error("회의 수정 실패: " + error.message);
                } else {
                  toast.success("회의 일정이 수정되었습니다");
                  setEditingInfo(false);
                  await onRefresh();
                }
                setSavingInfo(false);
              }}
            />
          )}

          {/* Recording / Upload */}
          <MeetingRecorder
            meetingId={meeting.id}
            meetingTitle={meeting.title}
            meetingStatus={meeting.status}
            canEdit={canEdit}
            onTranscriptionComplete={onRefresh}
          />

          {/* Agendas with resource attachment */}
          <div>
            <h4 className="font-mono-nu text-[12px] font-black uppercase tracking-widest text-nu-muted mb-3 flex items-center gap-1.5">
              안건 · 사전 자료
            </h4>
            <AgendaList
              meetingId={meeting.id}
              projectId={projectId}
              canEdit={canEdit}
              members={memberProfiles}
            />
          </div>

          {/* Summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-mono-nu text-[12px] font-black uppercase tracking-widest text-nu-muted">
                회의 요약
              </h4>
              {canEdit && !editingSummary && (
                <button
                  onClick={() => setEditingSummary(true)}
                  className="font-mono-nu text-[11px] text-nu-blue hover:text-nu-ink transition-colors"
                >
                  {meeting.summary ? "수정" : "작성"}
                </button>
              )}
            </div>
            {editingSummary ? (
              <div className="space-y-2">
                <Textarea
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                  placeholder="회의 요약을 작성하세요..."
                  rows={3}
                  className="border-nu-ink/15 resize-none text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      onSaveSummary(meeting.id, summaryText);
                      setEditingSummary(false);
                    }}
                    className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest h-8"
                  >
                    저장
                  </Button>
                  <Button
                    onClick={() => {
                      setSummaryText(meeting.summary || "");
                      setEditingSummary(false);
                    }}
                    variant="outline"
                    className="font-mono-nu text-[11px] uppercase tracking-widest h-8"
                  >
                    취소
                  </Button>
                </div>
              </div>
            ) : meeting.summary ? (
              <p className="text-sm text-nu-graphite leading-relaxed bg-nu-cream/20 p-3 border border-nu-ink/5 whitespace-pre-wrap">
                {meeting.summary}
              </p>
            ) : (
              <p className="text-xs text-nu-muted italic">
                아직 요약이 없습니다
              </p>
            )}
          </div>

          {/* AI Meeting Assistant */}
          <div>
            <h4 className="font-mono-nu text-[12px] font-black uppercase tracking-widest text-nu-muted mb-3 flex items-center gap-1.5">
              <Sparkles size={12} className="text-nu-pink" /> AI 회의록
            </h4>
            <AiMeetingAssistant
              meetingId={meeting.id}
              meetingTitle={meeting.title}
              existingSummary={meeting.summary || ""}
              canEdit={canEdit}
              onSaveSummary={async (summary) => {
                const supabase = createClient();
                await supabase
                  .from("meetings")
                  .update({ summary })
                  .eq("id", meeting.id);
                onRefresh();
              }}
              onSaveNextTopic={async (topic) => {
                const supabase = createClient();
                await supabase
                  .from("meetings")
                  .update({ next_topic: topic })
                  .eq("id", meeting.id);
              }}
              onAddNote={async (content, type) => {
                const supabase = createClient();
                const insertData: {
                  meeting_id: string;
                  content: string;
                  type: string;
                  created_by: string;
                  status?: string;
                } = {
                  meeting_id: meeting.id,
                  content,
                  type,
                  created_by: userId,
                };
                if (type === "action_item") insertData.status = "pending";
                const { error } = await supabase
                  .from("meeting_notes")
                  .insert(insertData);
                if (error) {
                  console.error("meeting_notes insert error:", error);
                  throw new Error(error.message);
                }
              }}
              onArchiveToGoogleDoc={async (title, docContent) => {
                try {
                  const res = await fetch("/api/google/docs/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title,
                      content: docContent,
                      targetType: "project",
                      targetId: projectId,
                      meetingId: meeting.id,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok)
                    return { error: data.error || "Google Docs 저장 실패" };
                  return { url: data.webViewLink };
                } catch {
                  return { error: "Google Docs 연결에 실패했습니다" };
                }
              }}
            />
          </div>

          {/* Meeting Notes (reused from groups) */}
          <div>
            <h4 className="font-mono-nu text-[12px] font-black uppercase tracking-widest text-nu-muted mb-3">
              노트 · 액션 아이템 · 결정 사항
            </h4>
            <MeetingNotes
              meetingId={meeting.id}
              members={memberProfiles}
              userId={userId}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MeetingInfoEditor({
  meeting,
  title,
  description,
  scheduledAt,
  durationMin,
  location,
  saving,
  onTitleChange,
  onDescriptionChange,
  onScheduledAtChange,
  onDurationMinChange,
  onLocationChange,
  onCancel,
  onSave,
}: {
  meeting: ProjectMeeting;
  title: string;
  description: string;
  scheduledAt: string;
  durationMin: number;
  location: string;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onScheduledAtChange: (value: string) => void;
  onDurationMinChange: (value: number) => void;
  onLocationChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="bg-nu-cream/20 border border-nu-ink/10 p-4 space-y-4">
      <div className="space-y-1.5">
        <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block">
          회의 제목
        </label>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={meeting.title}
          className="border-nu-ink/15"
        />
      </div>

      <div className="space-y-1.5">
        <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block">
          회의 설명
        </label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="회의에서 다룰 주제나 안건을 간략히 적어주세요..."
          rows={2}
          className="border-nu-ink/15 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block">
            회의 일시
          </label>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => onScheduledAtChange(e.target.value)}
            className="border-nu-ink/15"
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block">
            소요 시간 (분)
          </label>
          <Input
            type="number"
            value={durationMin}
            onChange={(e) => onDurationMinChange(parseInt(e.target.value, 10) || 60)}
            min={15}
            step={15}
            className="border-nu-ink/15"
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block">
            장소
          </label>
          <Input
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="온라인 / 장소"
            className="border-nu-ink/15"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => {
            void onSave();
          }}
          disabled={saving || !title.trim()}
          className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[12px] uppercase tracking-widest"
        >
          {saving ? (
            <>
              <Loader2 size={12} className="animate-spin" /> 저장 중...
            </>
          ) : (
            <>
              <Save size={12} /> 일정 저장
            </>
          )}
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          className="font-mono-nu text-[12px] uppercase tracking-widest border-nu-ink/[0.12] text-nu-gray"
        >
          <X size={12} /> 취소
        </Button>
        {location && (
          <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-nu-muted">
            <MapPin size={12} />
            {location}
          </span>
        )}
      </div>
    </div>
  );
}
