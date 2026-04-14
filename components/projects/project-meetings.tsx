"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MeetingNotes } from "@/components/meetings/meeting-notes";
import { AiMeetingAssistant } from "@/components/meetings/ai-meeting-assistant";
import { AgendaList } from "@/components/meetings/agenda-list";
import { toast } from "sonner";
import {
  Plus,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Users,
  Trash2,
  Loader2,
  CheckCircle2,
  Circle,
  Play,
  X,
  Sparkles,
  CalendarX,
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

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; borderColor: string }
> = {
  upcoming: {
    label: "예정",
    color: "text-nu-blue",
    bg: "bg-nu-blue/10",
    borderColor: "border-l-nu-blue",
  },
  in_progress: {
    label: "진행 중",
    color: "text-nu-amber",
    bg: "bg-nu-amber/10",
    borderColor: "border-l-nu-amber",
  },
  completed: {
    label: "완료",
    color: "text-green-600",
    bg: "bg-green-50",
    borderColor: "border-l-green-500",
  },
  cancelled: {
    label: "취소",
    color: "text-nu-muted",
    bg: "bg-nu-cream/30",
    borderColor: "border-l-nu-gray",
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
          "id, title, description, scheduled_at, duration_min, status, organizer_id, summary, created_at"
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
        membersRes.data.map((m: any) => ({
          user_id: m.user_id,
          profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
        }))
      );
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadData();
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
    .map((m) => ({
      id: m.profile!.id,
      nickname: m.profile!.nickname,
      name: m.profile!.nickname,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
            <FileText size={20} /> 회의록
          </h2>
          <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mt-1">
            {meetings.length} meetings · {upcomingMeetings.length} upcoming
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[10px] uppercase tracking-widest"
          >
            {showForm ? (
              <>
                <X size={12} /> 취소
              </>
            ) : (
              <>
                <Plus size={12} /> 새 회의
              </>
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
            <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block">
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
            <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block">
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
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block">
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
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block">
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
              className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[10px] uppercase tracking-widest"
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
              className="font-mono-nu text-[10px] uppercase tracking-widest border-nu-ink/[0.12] text-nu-gray"
            >
              <X size={12} /> 취소
            </Button>
          </div>
        </div>
      )}

      {/* Upcoming Meetings */}
      {upcomingMeetings.length > 0 ? (
        <div>
          <h3 className="font-mono-nu text-[10px] font-black uppercase tracking-widest text-nu-muted mb-4">
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
          <h3 className="font-mono-nu text-[10px] font-black uppercase tracking-widest text-nu-muted mb-4">
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

      {/* Global Empty State */}
      {meetings.length === 0 && (
        <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/10 p-12 text-center">
          <Calendar
            size={40}
            className="mx-auto text-nu-muted/40 mb-4"
            strokeWidth={1.5}
          />
          <p className="font-head text-sm font-bold text-nu-ink mb-1">
            아직 회의가 없습니다
          </p>
          <p className="text-xs text-nu-muted">
            {canEdit
              ? "첫 회의를 생성하여 팀의 논의를 체계적으로 관리해보세요"
              : "볼트 리더가 회의를 생성하면 여기에 표시됩니다"}
          </p>
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
  memberProfiles: any[];
  userId: string;
  canEdit: boolean;
  projectId: string;
}) {
  const [summaryText, setSummaryText] = useState(meeting.summary || "");
  const [editingSummary, setEditingSummary] = useState(false);
  const cfg = statusConfig[meeting.status] || statusConfig.upcoming;
  const date = new Date(meeting.scheduled_at);

  // Date box colors by status
  const dateBoxClass =
    meeting.status === "in_progress"
      ? "bg-nu-amber/15 border-nu-amber/30"
      : meeting.status === "completed"
        ? "bg-green-50 border-green-200"
        : meeting.status === "cancelled"
          ? "bg-nu-cream/40 border-nu-ink/[0.08]"
          : "bg-nu-blue/10 border-nu-blue/20";

  return (
    <div
      className={`bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden border-l-[4px] ${cfg.borderColor}`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 text-left hover:bg-nu-cream/20 transition-colors flex items-center gap-4"
      >
        <div
          className={`w-14 h-14 flex flex-col items-center justify-center shrink-0 border ${dateBoxClass}`}
        >
          <span className="font-head text-lg font-extrabold text-nu-ink leading-none">
            {date.getDate()}
          </span>
          <span className="font-mono-nu text-[8px] uppercase text-nu-muted">
            {date.toLocaleDateString("ko", { month: "short" })}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-head text-sm font-bold text-nu-ink truncate">
              {meeting.title}
            </p>
            <span
              className={`font-mono-nu text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border ${cfg.bg} ${cfg.color}`}
            >
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-nu-muted">
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
              {meeting.status === "upcoming" && (
                <button
                  onClick={() => onStatusChange(meeting.id, "in_progress")}
                  className="font-mono-nu text-[9px] font-bold uppercase tracking-widest px-4 py-2 bg-amber-100 text-amber-700 border-[2px] border-amber-300 hover:bg-amber-200 transition-colors flex items-center gap-1.5"
                >
                  <Play size={11} fill="currentColor" /> 시작
                </button>
              )}
              {meeting.status === "in_progress" && (
                <button
                  onClick={() => onStatusChange(meeting.id, "completed")}
                  className="font-mono-nu text-[9px] font-bold uppercase tracking-widest px-4 py-2 bg-green-100 text-green-700 border-[2px] border-green-300 hover:bg-green-200 transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 size={11} /> 완료
                </button>
              )}
              {meeting.status !== "cancelled" && (
                <button
                  onClick={() => onDelete(meeting.id)}
                  className="font-mono-nu text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 text-nu-muted hover:text-red-600 hover:bg-red-50 border border-nu-ink/10 transition-colors flex items-center gap-1 ml-auto"
                >
                  <Trash2 size={10} /> 삭제
                </button>
              )}
            </div>
          )}

          {/* Agendas with resource attachment */}
          <div>
            <h4 className="font-mono-nu text-[10px] font-black uppercase tracking-widest text-nu-muted mb-3 flex items-center gap-1.5">
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
              <h4 className="font-mono-nu text-[10px] font-black uppercase tracking-widest text-nu-muted">
                회의 요약
              </h4>
              {canEdit && !editingSummary && (
                <button
                  onClick={() => setEditingSummary(true)}
                  className="font-mono-nu text-[9px] text-nu-blue hover:text-nu-ink transition-colors"
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
                    className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[9px] uppercase tracking-widest h-8"
                  >
                    저장
                  </Button>
                  <Button
                    onClick={() => {
                      setSummaryText(meeting.summary || "");
                      setEditingSummary(false);
                    }}
                    variant="outline"
                    className="font-mono-nu text-[9px] uppercase tracking-widest h-8"
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
            <h4 className="font-mono-nu text-[10px] font-black uppercase tracking-widest text-nu-muted mb-3 flex items-center gap-1.5">
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
                const insertData: any = {
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
            <h4 className="font-mono-nu text-[10px] font-black uppercase tracking-widest text-nu-muted mb-3">
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
