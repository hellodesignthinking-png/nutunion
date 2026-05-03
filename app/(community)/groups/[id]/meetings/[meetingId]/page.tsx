"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Meeting, MeetingAgenda, Profile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AgendaList } from "@/components/meetings/agenda-list";
import { MeetingNotes } from "@/components/meetings/meeting-notes";
import { GoogleCalendarButton } from "@/components/integrations/google-calendar-button";
import {
  Calendar, Clock, MapPin, User, Play, CheckCircle2, Lightbulb,
  Users, Edit3, Save, FileText, ArrowLeft, ChevronRight,
  Link2, ExternalLink, Plus, Trash2, AlertCircle, Zap, Eye, Columns, Maximize2, X,
  Sparkles,
} from "lucide-react";
import { BestPracticePromote } from "@/components/shared/best-practice-promote";
import { toast } from "sonner";
import { ResourcePreviewModal } from "@/components/shared/resource-preview-modal";
import { AiAgendaManager } from "@/components/meetings/ai-agenda-manager";
import { AiMeetingAssistant } from "@/components/meetings/ai-meeting-assistant";
import { WikiSyncPanel } from "@/components/wiki/wiki-sync-panel";
import { MeetingDecisionsExtractor } from "@/components/groups/meeting-decisions-extractor";
import { ListChecks } from "lucide-react";
import { WeeklyDigestEngine } from "@/components/wiki/weekly-digest-engine";
import { AiErrorBoundary } from "@/components/shared/ai-error-boundary";
import { MeetingRecorder, type MeetingRecorderHandle } from "@/components/meetings/meeting-recorder";
import { LiveMeetingPanel, ConcludeProgressModal } from "@/components/meetings/live-meeting-panel";
import { QuickRetro } from "./components/quick-retro";

function getEmbedUrl(url: string) {
  if (!url) return "";
  if (url.includes("docs.google.com/document") || url.includes("docs.google.com/presentation")) {
    return url.replace(/\/edit.*$/, "/preview");
  } else if (url.includes("docs.google.com/spreadsheets")) {
    const base = url.replace(/\/edit.*$/, "/preview");
    return `${base}?widget=true&headers=false&rm=minimal`;
  } else if (url.includes("drive.google.com/file/d/")) {
    return url.replace(/\/view.*$/, "/preview");
  }
  return url;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  upcoming:    { label: "예정",    className: "bg-nu-blue/10 text-nu-blue border-nu-blue/20" },
  in_progress: { label: "진행 중", className: "bg-nu-amber/10 text-nu-amber border-nu-amber/20" },
  completed:   { label: "완료",    className: "bg-nu-pink/10 text-nu-pink border-nu-pink/20" },
  cancelled:   { label: "취소됨",  className: "bg-nu-red/10 text-nu-red border-nu-red/20" },
};

interface SharedResource {
  id: string;
  meeting_id: string;
  title: string;
  url: string;
  type: "drive" | "article" | "paper" | "link";
  description?: string;
  created_by: string;
  created_at: string;
  author?: { nickname: string | null };
  replies?: ResourceReply[];
}

interface ResourceReply {
  id: string;
  resource_id: string;
  content: string;
  created_by: string;
  created_at: string;
  author?: { nickname: string | null };
}

interface LinkedIssue {
  id: string;
  title: string;
  status: "open" | "resolved";
  created_at: string;
}

function MeetingInfoEditor({ meeting, date, canEdit, meetingId, onUpdate }: {
  meeting: Meeting; date: Date; canEdit: boolean; meetingId: string; onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(meeting.title);
  const [description, setDescription] = useState(meeting.description || "");
  const [scheduledAt, setScheduledAt] = useState(
    new Date(meeting.scheduled_at).toISOString().slice(0, 16)
  );
  const [durationMin, setDurationMin] = useState(meeting.duration_min || 60);
  const [location, setLocation] = useState(meeting.location || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("meetings").update({
      title: title.trim(),
      description: description.trim() || null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_min: durationMin,
      location: location.trim() || null,
    }).eq("id", meetingId);
    if (error) toast.error("수정 실패: " + error.message);
    else { toast.success("회의 정보가 수정되었습니다"); setEditing(false); onUpdate(); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("이 회의를 삭제하시겠습니까? 관련된 안건, 노트, 자료가 모두 삭제됩니다.")) return;
    const supabase = createClient();
    // Clean up related data
    await Promise.allSettled([
      supabase.from("meeting_notes").delete().eq("meeting_id", meetingId),
      supabase.from("meeting_resources").delete().eq("meeting_id", meetingId),
      supabase.from("meeting_agendas").delete().eq("meeting_id", meetingId),
    ]);
    const { error } = await supabase.from("meetings").delete().eq("id", meetingId);
    if (error) toast.error("삭제 실패: " + error.message);
    else {
      toast.success("회의가 삭제되었습니다");
      window.location.href = `/groups/${meeting.group_id}/meetings`;
    }
  }

  if (editing) {
    return (
      <div className="bg-nu-white border border-nu-ink/[0.08] p-6 mb-6 space-y-4">
        <div>
          <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block mb-1">회의 제목</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink bg-nu-paper" />
        </div>
        <div>
          <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block mb-1">설명</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            className="w-full px-3 py-2 border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink bg-nu-paper resize-none" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block mb-1">일시</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink bg-nu-paper" />
          </div>
          <div>
            <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block mb-1">시간 (분)</label>
            <input type="number" value={durationMin} onChange={e => setDurationMin(parseInt(e.target.value) || 60)} min={10} max={480}
              className="w-full px-3 py-2 border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink bg-nu-paper" />
          </div>
          <div>
            <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block mb-1">장소</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="온라인 / 장소"
              className="w-full px-3 py-2 border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink bg-nu-paper" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving || !title.trim()}
            className="font-mono-nu text-[12px] font-bold uppercase px-4 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
          <button onClick={() => setEditing(false)}
            className="font-mono-nu text-[12px] uppercase px-4 py-2 text-nu-muted hover:text-nu-ink transition-colors">취소</button>
          <button onClick={handleDelete}
            className="ml-auto font-mono-nu text-[12px] uppercase px-4 py-2 text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 transition-colors flex items-center gap-1">
            <Trash2 size={11} /> 회의 삭제
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-nu-white border border-nu-ink/[0.08] p-6 mb-6">
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-nu-pink" />
          <span className="text-sm">{date.toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-nu-blue" />
          <span className="text-sm">{date.toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })} ({meeting.duration_min}분)</span>
        </div>
        {meeting.location && (
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-nu-amber" />
            <span className="text-sm">{meeting.location}</span>
          </div>
        )}
        {canEdit && (
          <button onClick={() => setEditing(true)}
            className="ml-auto font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink hover:underline flex items-center gap-1">
            <Edit3 size={11} /> 수정
          </button>
        )}
      </div>
      {meeting.status === "in_progress" && (
        <MeetingTimer startTime={meeting.scheduled_at} />
      )}
    </div>
  );
}

export default function MeetingDetailPage() {
  const params     = useParams();
  const router     = useRouter();
  const groupId    = params.id as string;
  const meetingId  = params.meetingId as string;

  const [meeting, setMeeting]             = useState<Meeting | null>(null);
  const [groupName, setGroupName]         = useState("");
  const [members, setMembers]             = useState<Profile[]>([]);
  const [loading, setLoading]             = useState(true);
  const [userId, setUserId]               = useState<string | null>(null);
  const [canEdit, setCanEdit]             = useState(false);

  // Summary / status
  const [showSummaryInput, setShowSummaryInput] = useState(false);
  const [summary, setSummary]                   = useState("");
  const [actionLoading, setActionLoading]       = useState(false);
  const [extractDecisionsOpen, setExtractDecisionsOpen] = useState(false);
  const [userProjects, setUserProjects] = useState<Array<{ id: string; title: string }>>([]);

  // 결정 추출 다이얼로그용 — 사용자가 멤버인 프로젝트
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: pms } = await supabase
        .from("project_members").select("project_id").eq("user_id", user.id);
      const ids = (pms || []).map((m) => m.project_id);
      if (ids.length === 0) return;
      const { data: ps } = await supabase
        .from("projects").select("id, title").in("id", ids).order("created_at", { ascending: false });
      setUserProjects(ps as Array<{ id: string; title: string }> || []);
    })();
  }, []);
  const [editingSummary, setEditingSummary]     = useState(false);
  const [editedSummary, setEditedSummary]       = useState("");
  const [showPromote, setShowPromote]           = useState(false);
  const [meetingNotes, setMeetingNotes]           = useState<string[]>([]);
  const [previousDigest, setPreviousDigest]       = useState<string | null>(null);

  // Next topic + issues
  const [nextTopic, setNextTopic]         = useState("");
  const [savingNextTopic, setSavingNextTopic] = useState(false);
  const [issues, setIssues]               = useState<LinkedIssue[]>([]);
  const [newIssue, setNewIssue]           = useState("");
  const [addingIssue, setAddingIssue]     = useState(false);

  // Shared resources
  const [resources, setResources]         = useState<SharedResource[]>([]);
  const [showAdd, setShowAdd]           = useState(false);
  const [newRes, setNewRes]               = useState({ title: "", url: "", type: "link" as SharedResource["type"], description: "" });
  const [addingRes, setAddingRes]         = useState(false);
  const [replyTexts, setReplyTexts]       = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ url: string; name: string } | null>(null);
  const [isSplitView, setIsSplitView] = useState(false);

  // Tab persistence
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`nutunion_tab_${meetingId}`) || "agendas";
    }
    return "agendas";
  });

  // Conclude progress modal
  const [concludeOpen, setConcludeOpen] = useState(false);
  const [concludeStep, setConcludeStep] = useState("");
  const [concludeError, setConcludeError] = useState<string | null>(null);

  // Recorder handle + latest blob (for one-click conclude)
  const recorderRef = useRef<MeetingRecorderHandle | null>(null);
  const [pendingAudio, setPendingAudio] = useState<{ blob: Blob; mime: string } | null>(null);

  // 고급 도구 패널 열기 토글 (기본 숨김 — 사용자가 원할 때만)
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadMeeting = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Query meeting — basic query with organizer join only (secretary/speaker columns may not exist)
    let meetingData: any = null;
    let groupData: any = null;
    const { data: mData, error: mErr } = await supabase.from("meetings")
      .select("*, organizer:profiles!meetings_organizer_id_fkey(id, nickname, avatar_url)")
      .eq("id", meetingId).single();
    if (mErr) {
      // Fallback: without any FK joins
      const { data: basicData } = await supabase.from("meetings")
        .select("*").eq("id", meetingId).single();
      meetingData = basicData;
    } else {
      meetingData = mData;
    }
    const groupResult = await supabase.from("groups").select("host_id, name").eq("id", groupId).single();
    groupData = groupResult.data;

    if (!meetingData) return;
    setMeeting(meetingData);
    setNextTopic(meetingData.next_topic || "");
    setEditedSummary(meetingData.summary || "");
    setGroupName(groupData?.name || "너트");

    // Edit permission
    const { data: membership } = await supabase
      .from("group_members").select("role").eq("group_id", groupId).eq("user_id", user.id).eq("status", "active").maybeSingle();
    const isHostOrOrganizer = groupData?.host_id === user.id || meetingData.organizer_id === user.id;
    setCanEdit(isHostOrOrganizer || membership?.role === "host" || membership?.role === "moderator");

    // Members
    const { data: membersData } = await supabase
      .from("group_members").select("profile:profiles(*)").eq("group_id", groupId).eq("status", "active");
    if (membersData) setMembers(membersData.map((m: any) => m.profile).filter(Boolean) as Profile[]);

    // Parallel load: resources, issues, notes, digest (all independent)
    const [resourcesResult, issuesResult, notesResult, digestResult] = await Promise.allSettled([
      // Shared resources
      (async () => {
        const { data: resData, error: resError } = await supabase.from("meeting_resources").select("*, author:profiles!meeting_resources_created_by_fkey(nickname)").eq("meeting_id", meetingId).order("created_at");
        if (!resError && resData) {
          const resWithReplies = await Promise.all(resData.map(async (r: any) => {
            const { data: replies } = await supabase.from("meeting_resource_replies").select("*, author:profiles!meeting_resource_replies_created_by_fkey(nickname)").eq("resource_id", r.id).order("created_at");
            return { ...r, replies: replies || [] };
          }));
          return resWithReplies;
        }
        return null;
      })(),
      // Linked issues
      supabase.from("meeting_issues").select("*").eq("meeting_id", meetingId).order("created_at"),
      // Meeting notes for AI
      supabase.from("meeting_notes").select("content, type").eq("meeting_id", meetingId).order("created_at"),
      // Previous digest context
      supabase.from("wiki_ai_analyses").select("content").eq("group_id", groupId).eq("analysis_type", "weekly_digest").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    // Apply results
    if (resourcesResult.status === "fulfilled" && resourcesResult.value) {
      setResources(resourcesResult.value as SharedResource[]);
    }
    if (issuesResult.status === "fulfilled" && issuesResult.value.data) {
      setIssues(issuesResult.value.data as LinkedIssue[]);
    }
    if (notesResult.status === "fulfilled" && notesResult.value.data) {
      setMeetingNotes(notesResult.value.data.map((n: any) => {
        const prefix = n.type === "decision" ? "[결정] " : n.type === "action_item" ? "[액션] " : "";
        return prefix + n.content;
      }));
    }
    if (digestResult.status === "fulfilled" && digestResult.value.data?.content) {
      try {
        const parsed = JSON.parse(digestResult.value.data.content);
        setPreviousDigest(parsed.nextMeetingContext || parsed.digest || null);
      } catch { /* ignore parse errors */ }
    }

    setLoading(false);
  }, [groupId, meetingId]);

  useEffect(() => { loadMeeting(); }, [loadMeeting]);

  // ── Roles & Links Updaters ─────────────────────────────────────────────
  async function updateMeetingField(field: string, value: any) {
    const supabase = createClient();
    const { error } = await supabase.from("meetings").update({ [field]: value }).eq("id", meetingId);
    if (error) toast.error("수정에 실패했습니다");
    else { toast.success("수정되었습니다"); await loadMeeting(); }
  }

  // ── Status actions ─────────────────────────────────────────────────────
  async function handleStartMeeting() {
    setActionLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("meetings").update({ status: "in_progress" }).eq("id", meetingId);
    if (error) toast.error("상태 변경에 실패했습니다");
    else { toast.success("회의가 시작되었습니다!"); await loadMeeting(); }
    setActionLoading(false);
  }

  async function handleCompleteMeeting() {
    // 회의록 본문이 있으면 그대로 저장, 없으면 AI(녹음+노트) 기반으로 생성
    setActionLoading(true);
    setConcludeError(null);
    setConcludeOpen(true);
    setConcludeStep("🎙️ 녹음 확인 중...");

    // Pull the freshest live notes (from meetings.notes, if column exists)
    const liveNotes = (meeting as any)?.notes || "";
    const combinedNotes = [liveNotes, meetingNotes.join("\n")].filter(Boolean).join("\n\n");

    // 1) 녹음이 진행 중이거나 이미 잡힌 blob 이 있으면 확보
    let audioInfo: { blob: Blob; mime: string } | null = pendingAudio;
    try {
      const stopped = recorderRef.current?.isRecording() ? await recorderRef.current?.stopAndGetBlob() : null;
      if (stopped) audioInfo = stopped;
      else if (!audioInfo) {
        const current = recorderRef.current?.getCurrentBlob() || null;
        if (current) audioInfo = current;
      }
    } catch { /* 녹음 처리 실패는 무시하고 노트만으로 진행 */ }

    // 2) blob 이 있으면 R2 업로드 + file_attachments 저장
    let audioUrl: string | undefined;
    let audioMimeType: string | undefined;
    if (audioInfo && audioInfo.blob.size > 0) {
      try {
        setConcludeStep("🎙️ 녹음 업로드 중...");
        const ext = (audioInfo.mime.split("/")[1] || "webm").split(";")[0];
        const displayName = `recording_${Date.now()}.${ext}`;
        const audioFile = new File([audioInfo.blob], displayName, { type: audioInfo.mime });
        const { uploadFile } = await import("@/lib/storage/upload-client");
        const up = await uploadFile(audioFile, { prefix: "resources", scopeId: meetingId });
        audioUrl = up.url;
        audioMimeType = audioInfo.mime;

        // file_attachments 에 등록 (group 기준)
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user && groupId) {
            const faPayload: any = {
              target_type: "group",
              target_id: groupId,
              uploaded_by: user.id,
              file_name: displayName,
              file_url: up.url,
              file_size: audioInfo.blob.size,
              file_type: audioInfo.mime,
              storage_type: up.storage,
              storage_key: up.key,
            };
            const { error: faErr } = await supabase.from("file_attachments").insert(faPayload);
            if (faErr && /storage_type|storage_key/.test(faErr.message)) {
              delete faPayload.storage_type;
              delete faPayload.storage_key;
              await supabase.from("file_attachments").insert(faPayload);
            }
          }
        } catch { /* file_attachments 저장 실패는 무시 */ }
      } catch (e: any) {
        // 업로드 실패 — 노트만으로 진행
        console.warn("[conclude] audio upload failed", e?.message);
      }
    }

    // Rotating progress hints while the server processes
    const steps = [
      audioUrl ? "🧠 AI가 녹음 + 노트 분석 중..." : "🧠 AI 회의록 초안 작성 중...",
      "노트와 교차 검증 중...",
      "Google Docs 저장 중...",
      "마무리 중...",
    ];
    let idx = 0;
    setConcludeStep(steps[0]);
    const timer = setInterval(() => {
      idx = Math.min(idx + 1, steps.length - 1);
      setConcludeStep(steps[idx]);
    }, 2500);

    try {
      const res = await fetch(`/api/meetings/${meetingId}/conclude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryOverride: summary.trim() || undefined,
          notes: combinedNotes,
          audioUrl,
          audioMimeType,
          agendas: ((meeting as any)?.agendas || []).map((a: any) => ({ topic: a.topic, description: a.description })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      clearInterval(timer);
      if (!res.ok) {
        setConcludeError(data.error || "회의 종료 처리에 실패했습니다");
        return;
      }
      setConcludeStep("완료!");
      toast.success("회의가 완료되었습니다. 회의록이 저장되었습니다.");
      setShowSummaryInput(false);
      setConcludeOpen(false);
      await loadMeeting();
    } catch (e: any) {
      clearInterval(timer);
      setConcludeError(e?.message || "회의 종료 실패");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveNextTopic() {
    setSavingNextTopic(true);
    const supabase = createClient();
    const { error } = await supabase.from("meetings").update({ next_topic: nextTopic.trim() || null }).eq("id", meetingId);
    if (error) toast.error("저장에 실패했습니다");
    else toast.success("다음 주제가 저장되었습니다");
    setSavingNextTopic(false);
  }

  async function handleSaveEditedSummary() {
    const supabase = createClient();
    const { error } = await supabase.from("meetings").update({ summary: editedSummary.trim() || null }).eq("id", meetingId);
    if (error) toast.error("저장에 실패했습니다");
    else { toast.success("회의 요약이 수정되었습니다"); setEditingSummary(false); await loadMeeting(); }
  }

  // ── Resources ──────────────────────────────────────────────────────────
  async function handleAddResource() {
    if (!newRes.title.trim() || !newRes.url.trim()) { toast.error("제목과 URL을 입력해주세요"); return; }
    setAddingRes(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("meeting_resources")
      .insert({ meeting_id: meetingId, ...newRes, created_by: userId })
      .select("*, author:profiles!meeting_resources_created_by_fkey(nickname)")
      .single();
    if (error) { toast.error("자료 추가에 실패했습니다"); }
    else {
      setResources(prev => [...prev, { ...data, replies: [] } as SharedResource]);
      setNewRes({ title: "", url: "", type: "link", description: "" });
      setShowAdd(false);
      toast.success("자료가 추가되었습니다");
      // Also register in file_attachments so it appears in 자료실
      try {
        const groupId = (await supabase.from("meetings").select("group_id").eq("id", meetingId).single()).data?.group_id;
        if (groupId) {
          await supabase.from("file_attachments").insert({
            target_type: "group",
            target_id: groupId,
            uploaded_by: userId,
            file_name: `[회의] ${newRes.title.trim()}`,
            file_url: newRes.url.trim(),
            file_type: newRes.url.includes("drive.google") ? "drive-link" : "url-link",
            file_size: null,
          });
        }
      } catch { /* non-critical */ }
    }
    setAddingRes(false);
  }

  async function handleDeleteResource(id: string) {
    if (!confirm("이 자료를 삭제하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("meeting_resources").delete().eq("id", id);
    if (error) { toast.error("삭제에 실패했습니다"); return; }
    setResources(prev => prev.filter(r => r.id !== id));
    toast.success("삭제되었습니다");
  }

  async function handleAddReply(resourceId: string) {
    const text = replyTexts[resourceId]?.trim();
    if (!text) return;
    setSubmittingReply(resourceId);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("meeting_resource_replies")
      .insert({ resource_id: resourceId, content: text, created_by: userId })
      .select("*, author:profiles!meeting_resource_replies_created_by_fkey(nickname)")
      .single();
    if (error) toast.error("답글 추가에 실패했습니다");
    else {
      setResources(prev => prev.map(r => r.id === resourceId ? { ...r, replies: [...(r.replies || []), data as ResourceReply] } : r));
      setReplyTexts(prev => ({ ...prev, [resourceId]: "" }));
    }
    setSubmittingReply(null);
  }

  // ── Issues ─────────────────────────────────────────────────────────────
  async function handleAddIssue() {
    if (!newIssue.trim()) return;
    setAddingIssue(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("meeting_issues")
      .insert({ meeting_id: meetingId, title: newIssue.trim(), status: "open", created_by: userId })
      .select().single();
    if (error) toast.error("이슈 추가에 실패했습니다");
    else { setIssues(prev => [...prev, data as LinkedIssue]); setNewIssue(""); toast.success("이슈가 등록되었습니다"); }
    setAddingIssue(false);
  }

  async function handleToggleIssue(issue: LinkedIssue) {
    const next = issue.status === "open" ? "resolved" : "open";
    const supabase = createClient();
    const { error } = await supabase.from("meeting_issues").update({ status: next }).eq("id", issue.id);
    if (error) { toast.error("상태 변경에 실패했습니다"); return; }
    setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, status: next } : i));
  }

  async function handleDeleteIssue(id: string) {
    if (!confirm("이 이슈를 삭제하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("meeting_issues").delete().eq("id", id);
    if (error) { toast.error("삭제에 실패했습니다"); return; }
    setIssues(prev => prev.filter(i => i.id !== id));
  }

  if (loading || !meeting) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-nu-cream/50 w-32" />
          <div className="h-8 bg-nu-cream/50 w-64" />
          <div className="h-64 bg-nu-cream/50" />
        </div>
      </div>
    );
  }

  const date = new Date(meeting.scheduled_at);
  const cfg  = statusConfig[meeting.status] || statusConfig.upcoming;
  const typeIcon = { drive: "📁", article: "📰", paper: "📄", link: "🔗" };

  return (
    <div className={`mx-auto px-4 md:px-8 py-10 transition-all duration-500 ${isSplitView ? "max-w-full" : "max-w-4xl"}`}>
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Main Content (Notes/Agendas) Area */}
        <div className={`transition-all duration-500 ${isSplitView ? "lg:w-[55%] xl:w-[50%] shrink-0" : "w-full"}`}>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 mb-6 font-mono-nu text-[13px] uppercase tracking-widest flex-wrap">
        <Link href={`/groups/${groupId}`}
          className="text-nu-muted hover:text-nu-ink no-underline flex items-center gap-1 transition-colors">
          <ArrowLeft size={12} /> {groupName}
        </Link>
        <ChevronRight size={12} className="text-nu-muted/40" />
        <Link href={`/groups/${groupId}/meetings`}
          className="text-nu-muted hover:text-nu-ink no-underline transition-colors">
          회의
        </Link>
        <ChevronRight size={12} className="text-nu-muted/40" />
        <span className="text-nu-ink truncate max-w-[200px]">{meeting.title}</span>
      </nav>

      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <Badge className={`text-[12px] ${cfg.className}`}>{cfg.label}</Badge>
              {meeting.organizer && (
                <span className="font-mono-nu text-[12px] text-nu-muted flex items-center gap-1">
                  <User size={12} />{meeting.organizer.nickname} (주최)
                </span>
              )}
            </div>
            <h1 className="font-head text-4xl font-extrabold text-nu-ink tracking-tight">{meeting.title}</h1>
            {meeting.description && <p className="text-nu-gray mt-2 max-w-2xl leading-relaxed">{meeting.description}</p>}
          </div>

          <button
            onClick={() => setIsSplitView(!isSplitView)}
            className={`font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-2.5 border-[2px] transition-all flex items-center gap-2 shrink-0 ${
              isSplitView ? "bg-nu-ink text-nu-paper border-nu-ink" : "bg-nu-white border-nu-ink/10 text-nu-muted hover:border-nu-ink"
            }`}
            title="스플릿 뷰 토글"
          >
            {isSplitView ? <Maximize2 size={13} /> : <Columns size={13} />}
            <span className="hidden md:inline">{isSplitView ? "단일 뷰" : "스플릿 뷰"}</span>
          </button>
          {canEdit && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-nu-cream/50 border border-nu-ink/[0.06]">
              <kbd className="font-mono-nu text-[10px] bg-nu-white px-1.5 py-0.5 border border-nu-ink/10 text-nu-muted">⌘</kbd>
              <span className="font-mono-nu text-[10px] text-nu-muted">+</span>
              <kbd className="font-mono-nu text-[10px] bg-nu-white px-1.5 py-0.5 border border-nu-ink/10 text-nu-muted">Enter</kbd>
              <span className="font-mono-nu text-[10px] text-nu-muted ml-1">AI 분석</span>
            </div>
          )}
        </div>

      {/* Roles & Quick Assets Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
          <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-3 flex items-center gap-2">
            <Users size={12} /> 세션 역할
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">✍️ 서기</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-nu-ink">{(meeting as any).secretary?.nickname || "미지정"}</span>
                {canEdit && (
                  <select 
                    className="text-[12px] border border-nu-ink/10 bg-nu-cream/30 px-1 py-0.5"
                    onChange={(e) => updateMeetingField("secretary_id", e.target.value || null)}
                    value={(meeting as any).secretary_id || ""}
                  >
                    <option value="">지정</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.nickname}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">🎤 발표자</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-nu-ink">{(meeting as any).speaker?.nickname || "미지정"}</span>
                {canEdit && (
                  <select 
                    className="text-[12px] border border-nu-ink/10 bg-nu-cream/30 px-1 py-0.5"
                    onChange={(e) => updateMeetingField("speaker_id", e.target.value || null)}
                    value={(meeting as any).speaker_id || ""}
                  >
                    <option value="">지정</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.nickname}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
          <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted mb-3 flex items-center gap-2">
             <Link2 size={12} /> 세션 아카이브
          </h3>
          {canEdit || (meeting as any).log_url ? (
            <div className="space-y-3">
              {(meeting as any).log_url ? (
                <a href={(meeting as any).log_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 p-2 bg-nu-pink/5 border border-nu-pink/20 text-nu-pink no-underline hover:bg-nu-pink/10 transition-all group">
                  <ExternalLink size={14} />
                  <span className="text-xs font-bold truncate flex-1">외부 세션 로그 (Notion/Docs)</span>
                  <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </a>
              ) : (
                <p className="text-xs text-nu-muted italic">외부 로그 링크가 등록되지 않았습니다.</p>
              )}
              {canEdit && (
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="https://notion.so/..."
                    className="flex-1 text-[12px] bg-transparent border border-nu-ink/10 px-2 py-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateMeetingField("log_url", (e.target as HTMLInputElement).value);
                      }
                    }}
                    defaultValue={(meeting as any).log_url || ""}
                  />
                  <Button variant="outline" className="h-6 px-2 text-[10px]" onClick={() => toast.info("링크를 입력하고 엔터를 눌러주세요")}>등록</Button>
                </div>
              )}
            </div>
          ) : (
             <p className="text-xs text-nu-muted italic py-4">등록된 링크가 없습니다.</p>
          )}
        </div>
      </div>

      {/* Meeting info */}
      <MeetingInfoEditor
        meeting={meeting}
        date={date}
        canEdit={canEdit}
        meetingId={meetingId}
        onUpdate={loadMeeting}
      />

      {/* Live notes — in_progress only, auto-saved, cross-validated by AI on conclude */}
      {meeting.status === "in_progress" && (
        <LiveMeetingPanel
          meetingId={meetingId}
          initialNotes={(meeting as any).notes || ""}
          disabled={!canEdit}
        />
      )}

      {/* Meeting Recorder — active during in_progress or for file upload when completed */}
      <MeetingRecorder
        ref={recorderRef}
        meetingId={meetingId}
        meetingTitle={meeting.title}
        meetingStatus={meeting.status}
        canEdit={canEdit}
        onAudioReady={(blob, mime) => {
          if (blob && mime) setPendingAudio({ blob, mime });
          else setPendingAudio(null);
        }}
        onTranscriptionComplete={() => {
          setActiveTab("ai-notes");
          loadMeeting();
        }}
      />

      {/* Auto-combine hint — before meeting end */}
      {meeting.status === "in_progress" && canEdit && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-nu-pink/5 border border-nu-pink/20 text-[12px] text-nu-ink">
          <Sparkles size={12} className="text-nu-pink shrink-0" />
          <span>🎙️ 녹음 + ✍️ 실시간 노트가 <b>함께 AI 회의록으로 합쳐집니다</b> — "회의 종료"를 누르면 한 번에 처리됩니다.</span>
        </div>
      )}

      {/* Google Calendar */}
      {meeting.status === "upcoming" && (
        <div className="mb-6">
          <GoogleCalendarButton
            title={meeting.title}
            description={meeting.description || ""}
            location={meeting.location || ""}
            startAt={meeting.scheduled_at}
            endAt={new Date(new Date(meeting.scheduled_at).getTime() + (meeting.duration_min || 60) * 60000).toISOString()}
          />
        </div>
      )}

      {/* Completed: 회의록 section */}
      {meeting.status === "completed" && (
        <div className="bg-nu-pink/5 border-[2px] border-nu-pink/20 p-5 mb-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink font-bold flex items-center gap-1.5">
              <FileText size={12} /> 📋 회의록
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {canEdit && userProjects.length > 0 && (
                <button
                  onClick={() => setExtractDecisionsOpen(true)}
                  className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-pink text-nu-pink hover:bg-nu-pink hover:text-nu-paper transition-all flex items-center gap-1.5"
                >
                  <ListChecks size={11} /> 결정 추출
                </button>
              )}
              {(meeting as any).google_doc_url && (
                <a
                  href={(meeting as any).google_doc_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-green-600 text-green-700 hover:bg-green-600 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <ExternalLink size={11} /> 📄 Google Docs에서 열기
                </a>
              )}
              {canEdit && !(meeting as any).google_doc_url && meeting.summary && (
                <button
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      const res = await fetch(`/api/google/docs/create`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          title: `회의록 - ${meeting.title} (${new Date(meeting.scheduled_at).toLocaleDateString("ko-KR")})`,
                          content: meeting.summary,
                          targetType: "group",
                          targetId: groupId,
                          meetingId,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        toast.error(data.error || "Google Docs 저장 실패");
                      } else {
                        toast.success("Google Docs에 저장되었습니다");
                        await loadMeeting();
                      }
                    } catch (err: any) {
                      toast.error(err?.message || "Google Docs 저장 실패");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-blue text-nu-blue hover:bg-nu-blue hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles size={11} /> 📋 Google Docs로 저장
                </button>
              )}
              {canEdit && (
                <button
                  onClick={async () => {
                    if (!confirm("AI로 회의록을 다시 생성하시겠습니까? 기존 요약이 덮어씌워집니다.")) return;
                    setActionLoading(true);
                    try {
                      const res = await fetch(`/api/meetings/${meetingId}/conclude`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          notes: meeting.summary || "",
                          agendas: (meeting as any).agendas || [],
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        toast.error(data.error || "회의록 재생성 실패");
                      } else {
                        toast.success("회의록을 다시 생성했습니다");
                        await loadMeeting();
                      }
                    } catch (err: any) {
                      toast.error(err?.message || "회의록 재생성 실패");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  className="font-mono-nu text-[12px] text-nu-muted hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <Sparkles size={11} /> 🔄 다시 생성
                </button>
              )}
              {canEdit && (
                <button onClick={() => setShowPromote(true)}
                  className="font-mono-nu text-[12px] text-nu-pink hover:underline flex items-center gap-1">
                  <Sparkles size={11} /> 베스트 프랙티스 승격
                </button>
              )}
              {canEdit && !editingSummary && (
                <button onClick={() => { setEditingSummary(true); setEditedSummary(meeting.summary || ""); }}
                  className="font-mono-nu text-[12px] text-nu-pink hover:underline flex items-center gap-1">
                  <Edit3 size={11} /> 수정
                </button>
              )}
            </div>
          </div>
          {editingSummary ? (
            <div className="flex flex-col gap-2">
              <Textarea value={editedSummary} onChange={e => setEditedSummary(e.target.value)}
                rows={6} className="border-nu-ink/15 bg-nu-white resize-none text-sm font-mono" />
              <div className="flex gap-2">
                <Button onClick={handleSaveEditedSummary} className="bg-nu-pink text-nu-paper hover:bg-nu-pink/90 font-mono-nu text-[12px] uppercase tracking-widest">
                  <Save size={12} /> 저장
                </Button>
                <Button variant="outline" onClick={() => setEditingSummary(false)} className="font-mono-nu text-[12px] uppercase tracking-widest">취소</Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-nu-ink leading-relaxed whitespace-pre-wrap font-mono">
              {meeting.summary || <span className="text-nu-muted italic font-sans">회의록이 아직 작성되지 않았습니다. "AI 회의록" 탭에서 생성하거나, 회의 종료 시 자동 생성됩니다.</span>}
            </div>
          )}
        </div>
      )}

      {/* Status actions */}
      {canEdit && (
        <div className="mb-6 flex flex-wrap gap-3">
          {meeting.status === "upcoming" && (
            <Button onClick={handleStartMeeting} disabled={actionLoading}
              className="bg-nu-blue text-nu-paper hover:bg-nu-blue/90 font-mono-nu text-[13px] uppercase tracking-widest">
              <Play size={14} /> 🎬 회의 시작
            </Button>
          )}
          {meeting.status === "in_progress" && !showSummaryInput && (
            <Button onClick={() => setShowSummaryInput(true)}
              className="bg-nu-pink text-nu-paper hover:bg-nu-pink/90 font-mono-nu text-[13px] uppercase tracking-widest">
              <CheckCircle2 size={14} /> ⏹️ 회의 종료
            </Button>
          )}
          {showSummaryInput && (
            <div className="w-full bg-nu-white border border-nu-ink/[0.08] p-5">
              <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray mb-2">회의 요약</p>
              {meeting.summary && !summary && (
                <button
                  onClick={() => setSummary(meeting.summary || "")}
                  className="mb-2 text-[12px] font-mono-nu text-nu-pink hover:underline"
                >
                  ✨ AI가 작성한 요약 불러오기
                </button>
              )}
              <Textarea value={summary} onChange={e => setSummary(e.target.value)}
                placeholder="회의 내용을 직접 입력하거나 비워두고 종료하면 AI가 녹음/노트 기반으로 회의록을 생성합니다" rows={3}
                className="border-nu-ink/15 bg-transparent resize-none mb-3" />
              <div className="flex items-center gap-2">
                <Button onClick={handleCompleteMeeting} disabled={actionLoading}
                  className="bg-nu-pink text-nu-paper hover:bg-nu-pink/90 font-mono-nu text-[13px] uppercase tracking-widest">
                  {actionLoading ? "저장 중..." : "완료 처리"}
                </Button>
                <Button variant="outline" onClick={() => setShowSummaryInput(false)} className="font-mono-nu text-[13px] uppercase tracking-widest">취소</Button>
                {!meeting.summary && (
                  <button
                    onClick={() => { setShowSummaryInput(false); setActiveTab("ai-notes"); }}
                    className="ml-auto text-[12px] font-mono-nu text-nu-blue hover:underline flex items-center gap-1"
                  >
                    <Sparkles size={10} /> AI 회의록으로 먼저 분석하기
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Previous digest context preview */}
      {previousDigest && (
        <div className="mb-4 bg-purple-50 border border-purple-200 p-3 flex items-start gap-2">
          <Zap size={14} className="text-purple-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-mono-nu text-[10px] text-purple-500 uppercase tracking-widest mb-0.5">이전 다이제스트 컨텍스트 (AI 자동 참조 중)</p>
            <p className="text-[13px] text-purple-800 leading-relaxed line-clamp-2">{previousDigest}</p>
          </div>
          <button
            onClick={() => setActiveTab("digest")}
            className="shrink-0 px-2 py-1 font-mono-nu text-[9px] uppercase tracking-widest text-purple-600 border border-purple-300 hover:bg-purple-100 transition-colors"
          >
            상세
          </button>
        </div>
      )}

      {/* ── 탭 — 핵심 4개 항상 표시 ─────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
          try { localStorage.setItem(`nutunion_tab_${meetingId}`, val); } catch {}
        }}
      >
        <div className="overflow-x-auto mb-6 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory">
        <TabsList variant="line" className="whitespace-nowrap flex-nowrap">
          {/* 핵심 탭 */}
          <TabsTrigger value="agendas" className="font-mono-nu text-[12px] md:text-[13px] uppercase tracking-widest whitespace-nowrap snap-start">
            안건
          </TabsTrigger>
          <TabsTrigger value="ai-notes" className="font-mono-nu text-[12px] md:text-[13px] uppercase tracking-widest flex items-center gap-1 whitespace-nowrap snap-start">
            <Sparkles size={11} /> 회의록
          </TabsTrigger>
          <TabsTrigger value="resources" className="font-mono-nu text-[12px] md:text-[13px] uppercase tracking-widest whitespace-nowrap snap-start">
            자료 {resources.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-nu-ink/10 text-nu-ink rounded-full text-[10px]">{resources.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="notes" className="font-mono-nu text-[12px] md:text-[13px] uppercase tracking-widest whitespace-nowrap snap-start">
            노트
          </TabsTrigger>
          {/* 고급 탭 — 항상 노출 (접기 없음) */}
          <TabsTrigger value="next" className="font-mono-nu text-[12px] md:text-[13px] uppercase tracking-widest whitespace-nowrap snap-start text-nu-amber">
            다음 주제
          </TabsTrigger>
          <TabsTrigger value="attendance" className="font-mono-nu text-[12px] md:text-[13px] uppercase tracking-widest whitespace-nowrap snap-start">
            출석
          </TabsTrigger>
          <TabsTrigger value="retro" className="font-mono-nu text-[12px] md:text-[13px] uppercase tracking-widest flex items-center gap-1 whitespace-nowrap snap-start">
            <Zap size={11} /> 회고
          </TabsTrigger>
          <TabsTrigger value="wiki-sync" className="font-mono-nu text-[12px] md:text-[13px] uppercase tracking-widest flex items-center gap-1 whitespace-nowrap snap-start">
            <Sparkles size={11} /> 탭 동기화
          </TabsTrigger>
          <TabsTrigger value="digest" className="font-mono-nu text-[12px] md:text-[13px] uppercase tracking-widest flex items-center gap-1 whitespace-nowrap snap-start">
            <Zap size={11} /> 다이제스트
            {previousDigest && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-0.5" />}
          </TabsTrigger>
        </TabsList>
        </div>

        {/* ── 안건 */}
        <TabsContent value="agendas">
          {canEdit && meeting.status === "upcoming" && (
            <div className="mb-6">
              <AiAgendaManager groupId={groupId} />
            </div>
          )}
          <AgendaList meetingId={meetingId} groupId={groupId} canEdit={canEdit} members={members} />
        </TabsContent>

        {/* ── AI 회의록 */}
        <TabsContent value="ai-notes">
          <AiErrorBoundary fallbackTitle="AI 회의록 분석 오류">
          <AiMeetingAssistant
            meetingId={meetingId}
            meetingTitle={meeting.title}
            existingNotes={meetingNotes}
            existingSummary={meeting.summary || ""}
            previousDigest={previousDigest || undefined}
            agendas={(meeting as any).agendas?.map((a: any) => ({ topic: a.topic, description: a.description })) || []}
            canEdit={canEdit}
            groupId={groupId}
            onSaveSummary={async (summary) => {
              const supabase = createClient();
              await supabase.from("meetings").update({ summary }).eq("id", meetingId);
              await loadMeeting();
            }}
            onSaveNextTopic={async (topic) => {
              const supabase = createClient();
              await supabase.from("meetings").update({ next_topic: topic }).eq("id", meetingId);
              setNextTopic(topic);
            }}
            onAddNote={async (content, type, extra) => {
              const supabase = createClient();
              const insertData: any = {
                meeting_id: meetingId,
                content,
                type,
                created_by: userId,
              };
              if (type === "action_item") {
                insertData.status = "pending";
                if (extra?.dueDate) insertData.due_date = extra.dueDate;
              }
              const { error } = await supabase.from("meeting_notes").insert(insertData);
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
                    targetType: "group",
                    targetId: groupId,
                    meetingId,
                  }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || "Google Docs 저장 실패" };
                return { url: data.webViewLink };
              } catch {
                return { error: "Google Docs 연결에 실패했습니다" };
              }
            }}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
          </AiErrorBoundary>
        </TabsContent>

        {/* ── 자료 공유 */}
        <TabsContent value="resources">
          <div className="flex flex-col gap-4">
            {/* Add resource */}
            {(canEdit || true) && (
              <div className="bg-nu-white border border-nu-ink/[0.08]">
                <button onClick={() => setShowAdd(!showAdd)}
                  className="w-full flex items-center gap-2 p-4 font-mono-nu text-[13px] uppercase tracking-widest text-nu-ink hover:text-nu-pink transition-colors">
                  <Plus size={14} /> 자료 추가하기 (Drive, 기사, 논문, 링크)
                </button>
                {showAdd && (
                  <div className="border-t border-nu-ink/[0.08] p-5 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray block mb-1">유형</label>
                        <select value={newRes.type} onChange={e => setNewRes(p => ({ ...p, type: e.target.value as SharedResource["type"] }))}
                          className="w-full px-3 py-2 border border-nu-ink/15 bg-transparent text-sm focus:outline-none focus:border-nu-pink">
                          <option value="drive">📁 Google Drive</option>
                          <option value="article">📰 기사/뉴스</option>
                          <option value="paper">📄 논문/리포트</option>
                          <option value="link">🔗 기타 링크</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray block mb-1">제목</label>
                        <Input value={newRes.title} onChange={e => setNewRes(p => ({ ...p, title: e.target.value }))}
                          placeholder="자료 제목" className="border-nu-ink/15 bg-transparent" />
                      </div>
                    </div>
                    <div>
                      <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray block mb-1">URL</label>
                      <Input value={newRes.url} onChange={e => setNewRes(p => ({ ...p, url: e.target.value }))}
                        placeholder="https://" className="border-nu-ink/15 bg-transparent" />
                    </div>
                    <div>
                      <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray block mb-1">설명 (선택)</label>
                      <Textarea value={newRes.description} onChange={e => setNewRes(p => ({ ...p, description: e.target.value }))}
                        placeholder="이 자료에 대한 간단한 설명" rows={2} className="border-nu-ink/15 bg-transparent resize-none" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleAddResource} disabled={addingRes}
                        className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[12px] uppercase tracking-widest">
                        {addingRes ? "추가 중..." : "추가"}
                      </Button>
                      <Button variant="outline" onClick={() => setShowAdd(false)} className="font-mono-nu text-[12px] uppercase tracking-widest">취소</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Resource list */}
            {resources.length === 0 ? (
              <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
                <Link2 size={24} className="text-nu-muted mx-auto mb-2" />
                <p className="text-nu-gray text-sm">공유된 자료가 없습니다</p>
              </div>
            ) : (
              resources.map(r => (
                <div key={r.id} className="bg-nu-white border border-nu-ink/[0.08]">
                  <div className="p-4 flex items-start gap-3">
                    <span className="text-lg shrink-0">{typeIcon[r.type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          className="font-head text-sm font-bold text-nu-ink hover:text-nu-pink transition-colors no-underline flex items-center gap-1">
                          {r.title} <ExternalLink size={12} />
                        </a>
                        <span className="font-mono-nu text-[11px] px-1.5 py-0.5 bg-nu-cream text-nu-muted uppercase">
                          {r.type === "drive" ? "Drive" : r.type === "article" ? "기사" : r.type === "paper" ? "논문" : "링크"}
                        </span>
                      </div>
                      {r.description && <p className="text-xs text-nu-muted mb-1">{r.description}</p>}
                      <p className="font-mono-nu text-[11px] text-nu-muted">{r.author?.nickname} · {new Date(r.created_at).toLocaleDateString("ko")}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        onClick={() => setPreviewData({ url: r.url, name: r.title })}
                        className="p-1.5 text-nu-muted hover:text-nu-pink transition-colors"
                        title="미리보기"
                      >
                        <Eye size={14} />
                      </button>
                      {(userId === r.created_by || canEdit) && (
                        <button onClick={() => handleDeleteResource(r.id)} className="text-nu-muted hover:text-nu-red transition-colors" aria-label="자료 삭제">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Replies */}
                  {(r.replies?.length ?? 0) > 0 && (
                    <div className="border-t border-nu-ink/[0.05] px-4 pb-3">
                      {r.replies!.map(reply => (
                        <div key={reply.id} className="flex items-start gap-2 pt-3">
                          <div className="w-6 h-6 rounded-full bg-nu-cream flex items-center justify-center text-[12px] font-bold shrink-0">
                            {(reply.author?.nickname || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-mono-nu text-[12px] text-nu-muted">{reply.author?.nickname}</span>
                            <p className="text-sm text-nu-graphite">{reply.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply input */}
                  <div className="border-t border-nu-ink/[0.05] px-4 py-3 flex gap-2">
                    <input
                      value={replyTexts[r.id] || ""}
                      onChange={e => setReplyTexts(p => ({ ...p, [r.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddReply(r.id); } }}
                      placeholder="답글 달기..."
                      className="flex-1 px-3 py-1.5 bg-nu-paper border border-nu-ink/[0.08] text-xs focus:outline-none focus:border-nu-pink transition-colors"
                    />
                    <button onClick={() => handleAddReply(r.id)} disabled={submittingReply === r.id}
                      className="font-mono-nu text-[12px] uppercase tracking-widest px-3 py-1.5 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-50">
                      {submittingReply === r.id ? "..." : "답글"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* ── 노트 */}
        <TabsContent value="notes">
          <MeetingNotes meetingId={meetingId} members={members} userId={userId} />
        </TabsContent>

        {/* ── 다음 주제 + 이슈 */}
        <TabsContent value="next">
          <div className="flex flex-col gap-4">
            {/* Next topic */}
            <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb size={18} className="text-nu-amber" />
                <h3 className="font-head text-lg font-extrabold text-nu-ink">다음 회의 주제</h3>
              </div>
              <Textarea value={nextTopic} onChange={e => setNextTopic(e.target.value)}
                placeholder="다음 회의에서 논의할 주제를 적어주세요" rows={4}
                className="border-nu-ink/15 bg-transparent resize-none mb-3" disabled={!canEdit} />
              {canEdit && (
                <Button onClick={handleSaveNextTopic} disabled={savingNextTopic}
                  className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[13px] uppercase tracking-widest">
                  {savingNextTopic ? "저장 중..." : "저장"}
                </Button>
              )}
            </div>

            {/* Linked issues */}
            <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={18} className="text-nu-red" />
                <h3 className="font-head text-lg font-extrabold text-nu-ink">연계 이슈</h3>
                <span className="font-mono-nu text-[12px] text-nu-muted">{issues.filter(i => i.status === "open").length}개 오픈</span>
              </div>

              {/* Issue list */}
              <div className="flex flex-col gap-2 mb-4">
                {issues.length === 0 && <p className="text-nu-gray text-sm">등록된 이슈가 없습니다</p>}
                {issues.map(issue => (
                  <div key={issue.id} className="flex items-center gap-3 p-3 border border-nu-ink/[0.08]">
                    <button onClick={() => handleToggleIssue(issue)}
                      className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${issue.status === "resolved" ? "bg-green-400 border-green-400" : "border-nu-red/50 hover:border-nu-red"}`} />
                    <span className={`text-sm flex-1 ${issue.status === "resolved" ? "line-through text-nu-muted" : "text-nu-ink"}`}>
                      {issue.title}
                    </span>
                    <span className={`font-mono-nu text-[11px] uppercase px-1.5 py-0.5 ${issue.status === "open" ? "bg-nu-red/10 text-nu-red" : "bg-green-50 text-green-600"}`}>
                      {issue.status === "open" ? "오픈" : "해결됨"}
                    </span>
                    {canEdit && (
                      <button onClick={() => handleDeleteIssue(issue.id)} className="text-nu-muted hover:text-nu-red transition-colors" aria-label="이슈 삭제">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add issue */}
              <div className="flex gap-2">
                <Input value={newIssue} onChange={e => setNewIssue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddIssue(); }}
                  placeholder="새 이슈 추가..." className="border-nu-ink/15 bg-transparent" />
                <Button onClick={handleAddIssue} disabled={addingIssue}
                  className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[12px] uppercase tracking-widest shrink-0">
                  <Plus size={13} /> 추가
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── 빠른 회고 */}
        <TabsContent value="retro">
          <QuickRetro meetingId={meetingId} userId={userId} canEdit={canEdit} />
        </TabsContent>

        {/* ── 탭 동기화 */}
        <TabsContent value="wiki-sync">
          <AiErrorBoundary fallbackTitle="탭 동기화 오류">
          <WikiSyncPanel 
            meetingId={meetingId} 
            groupId={groupId} 
            meetingContent={[
              meeting.summary || "",
              meeting.description || "",
              (meeting as any).next_topic || "",
              meeting.title || "",
              ...meetingNotes,
            ].filter(Boolean).join("\n\n")} 
          />
          </AiErrorBoundary>
        </TabsContent>

        {/* ── 주간 다이제스트 */}
        <TabsContent value="digest">
          <AiErrorBoundary fallbackTitle="주간 다이제스트 오류">
          <WeeklyDigestEngine
            groupId={groupId}
            meetingId={meetingId}
            autoTrigger={meeting.status === "completed"}
            onDigestSaved={(digest) => setPreviousDigest(digest)}
          />
          </AiErrorBoundary>
        </TabsContent>

        {/* ── 출석 */}
        <TabsContent value="attendance">
          <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={18} className="text-nu-blue" />
              <h3 className="font-head text-lg font-extrabold text-nu-ink">출석 체크</h3>
            </div>
            <MeetingAttendanceCheck meetingId={meetingId} groupId={groupId} canEdit={canEdit} />
          </div>
        </TabsContent>
      </Tabs>
      </div>

        {/* Side Panel Area (Split View Document Viewer) */}
        {isSplitView && (
          <div className="lg:flex-1 lg:sticky lg:top-8 w-full animate-in fade-in slide-in-from-right-4 duration-500 overflow-hidden">
            <div className="bg-nu-paper border-2 border-nu-ink shadow-2xl flex flex-col h-[85vh] lg:h-[calc(100vh-80px)]">
              {previewData ? (
                <div className="flex-1 flex flex-col h-full">
                  <div className="flex items-center justify-between px-5 py-4 border-b-2 border-nu-ink bg-nu-ink text-nu-paper">
                    <div className="min-w-0 pr-4">
                      <p className="font-head text-[13px] font-black truncate uppercase tracking-tight">{previewData.name}</p>
                      <p className="font-mono-nu text-[11px] text-nu-paper/60 truncate uppercase tracking-widest mt-0.5">Live Document Review</p>
                    </div>
                    <button onClick={() => setPreviewData(null)} className="p-1.5 text-nu-paper/60 hover:text-nu-paper">
                      <X size={18} />
                    </button>
                  </div>
                  
                  {/* Iframe */}
                  <div className="flex-1 bg-nu-white overflow-hidden relative">
                    <iframe 
                      src={getEmbedUrl(previewData.url)}
                      className="w-full h-full border-0"
                      allow="autoplay; encrypted-media; fullscreen"
                    />
                  </div>
                  
                  <div className="p-4 bg-nu-cream/30 border-t border-nu-ink/5">
                    <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-[0.2em]">Contextual Workspace</p>
                    <p className="text-[12px] text-nu-graphite mt-1">자료를 보면서 동시에 회의록을 작성하세요.</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-nu-muted">
                  <div className="w-20 h-20 bg-nu-ink/[0.03] rounded-full flex items-center justify-center mb-4">
                    <Eye size={32} className="opacity-20 text-nu-pink" />
                  </div>
                  <p className="font-head text-sm font-bold text-nu-ink/40 uppercase tracking-widest">Select a resource to pin</p>
                  <p className="text-[13px] mt-2 max-w-[200px] leading-relaxed">자료 공유 탭에서 '눈' 아이콘을 클릭하면 이 패널에 문서가 고정되어 회의 중에 함께 볼 수 있습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resource Preview Modal (Desktop/Standard mode) */}
      {!isSplitView && (
        <ResourcePreviewModal 
          isOpen={!!previewData}
          onClose={() => setPreviewData(null)}
          url={previewData?.url || ""}
          name={previewData?.name || ""}
        />
      )}

      {/* Conclude progress / error modal */}
      <ConcludeProgressModal
        open={concludeOpen}
        step={concludeStep}
        error={concludeError}
        onRetry={() => { setConcludeError(null); handleCompleteMeeting(); }}
        onClose={() => { setConcludeOpen(false); setConcludeError(null); }}
      />

      {/* Best Practice Promote Modal */}
      {showPromote && meeting && (
        <BestPracticePromote
          sourceType="meeting"
          sourceId={meetingId}
          groupId={groupId}
          sourceName={meeting.title}
          sourceContent={meeting.summary || undefined}
          onClose={() => setShowPromote(false)}
          onPromoted={() => {
            setShowPromote(false);
            toast.success("베스트 프랙티스로 승격되었습니다!");
          }}
        />
      )}

      {/* L14 — 회의록 → 결정 자동 추출 */}
      <MeetingDecisionsExtractor
        meetingId={meetingId}
        candidateProjects={userProjects}
        open={extractDecisionsOpen}
        onClose={() => setExtractDecisionsOpen(false)}
      />
    </div>
  );
}

/* ── Attendance Check Component ──────────────────────────────────────────── */
function MeetingAttendanceCheck({ meetingId, groupId, canEdit }: { meetingId: string; groupId: string; canEdit: boolean }) {
  const [members, setMembers] = useState<{ userId: string; nickname: string; attended: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [{ data: gm }, { data: att }] = await Promise.all([
        supabase.from("group_members").select("user_id, profile:profiles(nickname)").eq("group_id", groupId).eq("status", "active"),
        supabase.from("meeting_attendances").select("user_id").eq("meeting_id", meetingId),
      ]);
      const attendedSet = new Set((att || []).map((a: any) => a.user_id));
      setMembers((gm || []).map((m: any) => ({ userId: m.user_id, nickname: m.profile?.nickname || "?", attended: attendedSet.has(m.user_id) })));
      setLoading(false);
    }
    load();
  }, [meetingId, groupId]);

  async function toggleAttendance(userId: string, currently: boolean) {
    if (!canEdit) return;
    if (currently) await supabase.from("meeting_attendances").delete().eq("meeting_id", meetingId).eq("user_id", userId);
    else await supabase.from("meeting_attendances").upsert({ meeting_id: meetingId, user_id: userId }, { onConflict: "meeting_id,user_id" });
    setMembers(prev => prev.map(m => m.userId === userId ? { ...m, attended: !currently } : m));
  }

  const attendedCount = members.filter(m => m.attended).length;
  if (loading) return <div className="animate-pulse h-20 bg-nu-cream/30" />;

  return (
    <div>
      <p className="font-mono-nu text-[12px] text-nu-muted mb-4">
        출석: {attendedCount}/{members.length}명
        {members.length > 0 && <span className="ml-2 text-nu-pink">({Math.round((attendedCount / members.length) * 100)}%)</span>}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {members.map(m => (
          <button key={m.userId} onClick={() => toggleAttendance(m.userId, m.attended)} disabled={!canEdit}
            className={`flex items-center gap-2.5 px-3 py-2.5 border-[2px] transition-all font-mono-nu text-[13px] ${
              m.attended ? "bg-green-50 border-green-400 text-green-700" : "border-nu-ink/15 text-nu-muted hover:border-nu-ink/30"
            } ${canEdit ? "cursor-pointer" : "cursor-default"}`}>
            {m.attended
              ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
              : <div className="w-3.5 h-3.5 rounded-full border-[2px] border-nu-ink/20 shrink-0" />
            }
            <span className="truncate">{m.nickname}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Meeting Timer ─── */
function MeetingTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const tick = () => {
      const diff = Math.max(0, Date.now() - start);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(
        h > 0
          ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
          : `${m}:${String(s).padStart(2, "0")}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  return (
    <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200">
      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      <span className="font-mono-nu text-[12px] uppercase tracking-widest text-green-700 font-bold">
        회의 진행 중
      </span>
      <span className="font-mono-nu text-[13px] text-green-800 font-black tabular-nums">
        {elapsed}
      </span>
    </div>
  );
}
