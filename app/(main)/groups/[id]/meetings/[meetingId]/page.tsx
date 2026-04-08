"use client";

import { useEffect, useState, useCallback } from "react";
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
  Link2, ExternalLink, Plus, Trash2, AlertCircle, Zap,
} from "lucide-react";
import { toast } from "sonner";

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
  const [editingSummary, setEditingSummary]     = useState(false);
  const [editedSummary, setEditedSummary]       = useState("");

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

  const loadMeeting = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [{ data: meetingData }, { data: groupData }] = await Promise.all([
      supabase.from("meetings").select("*, organizer:profiles!meetings_organizer_id_fkey(id, nickname, avatar_url), secretary:profiles!meetings_secretary_id_fkey(nickname), speaker:profiles!meetings_speaker_id_fkey(nickname)").eq("id", meetingId).single(),
      supabase.from("groups").select("host_id, name").eq("id", groupId).single(),
    ]);

    if (!meetingData) return;
    setMeeting(meetingData);
    setNextTopic(meetingData.next_topic || "");
    setEditedSummary(meetingData.summary || "");
    setGroupName(groupData?.name || "소모임");

    // Edit permission
    const { data: membership } = await supabase
      .from("group_members").select("role").eq("group_id", groupId).eq("user_id", user.id).eq("status", "active").maybeSingle();
    const isHostOrOrganizer = groupData?.host_id === user.id || meetingData.organizer_id === user.id;
    setCanEdit(isHostOrOrganizer || membership?.role === "host" || membership?.role === "moderator");

    // Members
    const { data: membersData } = await supabase
      .from("group_members").select("profile:profiles(*)").eq("group_id", groupId).eq("status", "active");
    if (membersData) setMembers(membersData.map((m: any) => m.profile).filter(Boolean) as Profile[]);

    // Shared resources
    const { data: resData } = await supabase.from("meeting_resources").select("*, author:profiles!meeting_resources_created_by_fkey(nickname)").eq("meeting_id", meetingId).order("created_at");
    if (resData) {
      const resWithReplies = await Promise.all(resData.map(async (r: any) => {
        const { data: replies } = await supabase.from("meeting_resource_replies").select("*, author:profiles!meeting_resource_replies_created_by_fkey(nickname)").eq("resource_id", r.id).order("created_at");
        return { ...r, replies: replies || [] };
      }));
      setResources(resWithReplies as SharedResource[]);
    }

    // Linked issues
    const { data: issueData } = await supabase.from("meeting_issues").select("*").eq("meeting_id", meetingId).order("created_at");
    if (issueData) setIssues(issueData as LinkedIssue[]);

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
    else { toast.success("미팅이 시작되었습니다!"); await loadMeeting(); }
    setActionLoading(false);
  }

  async function handleCompleteMeeting() {
    if (!summary.trim()) { toast.error("미팅 요약을 입력해주세요"); return; }
    setActionLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("meetings").update({ status: "completed", summary: summary.trim() }).eq("id", meetingId);
    if (error) toast.error("상태 변경에 실패했습니다");
    else { toast.success("미팅이 완료되었습니다!"); setShowSummaryInput(false); await loadMeeting(); }
    setActionLoading(false);
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
    else { setResources(prev => [...prev, { ...data, replies: [] } as SharedResource]); setNewRes({ title: "", url: "", type: "link", description: "" }); setShowAdd(false); toast.success("자료가 추가되었습니다"); }
    setAddingRes(false);
  }

  async function handleDeleteResource(id: string) {
    if (!confirm("이 자료를 삭제하시겠습니까?")) return;
    const supabase = createClient();
    await supabase.from("meeting_resources").delete().eq("id", id);
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
    await supabase.from("meeting_issues").update({ status: next }).eq("id", issue.id);
    setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, status: next } : i));
  }

  async function handleDeleteIssue(id: string) {
    if (!confirm("이 이슈를 삭제하시겠습니까?")) return;
    const supabase = createClient();
    await supabase.from("meeting_issues").delete().eq("id", id);
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
    <div className="max-w-4xl mx-auto px-8 py-12">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 mb-6 font-mono-nu text-[11px] uppercase tracking-widest flex-wrap">
        <Link href={`/groups/${groupId}`}
          className="text-nu-muted hover:text-nu-ink no-underline flex items-center gap-1 transition-colors">
          <ArrowLeft size={12} /> {groupName}
        </Link>
        <ChevronRight size={12} className="text-nu-muted/40" />
        <Link href={`/groups/${groupId}/meetings`}
          className="text-nu-muted hover:text-nu-ink no-underline transition-colors">
          미팅
        </Link>
        <ChevronRight size={12} className="text-nu-muted/40" />
        <span className="text-nu-ink truncate max-w-[200px]">{meeting.title}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <Badge className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
          {meeting.organizer && (
            <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-1">
              <User size={12} />{meeting.organizer.nickname} (주최)
            </span>
          )}
        </div>
        <h1 className="font-head text-4xl font-extrabold text-nu-ink tracking-tight">{meeting.title}</h1>
        {meeting.description && <p className="text-nu-gray mt-2 max-w-2xl leading-relaxed">{meeting.description}</p>}
      </div>

      {/* Roles & Quick Assets Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
          <h3 className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-3 flex items-center gap-2">
            <Users size={12} /> 세션 역할
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">✍️ 서기</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-nu-ink">{(meeting as any).secretary?.nickname || "미지정"}</span>
                {canEdit && (
                  <select 
                    className="text-[10px] border border-nu-ink/10 bg-nu-cream/30 px-1 py-0.5"
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
                    className="text-[10px] border border-nu-ink/10 bg-nu-cream/30 px-1 py-0.5"
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
          <h3 className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-3 flex items-center gap-2">
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
                    className="flex-1 text-[10px] bg-transparent border border-nu-ink/10 px-2 py-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateMeetingField("log_url", (e.target as HTMLInputElement).value);
                      }
                    }}
                    defaultValue={(meeting as any).log_url || ""}
                  />
                  <Button variant="outline" className="h-6 px-2 text-[8px]" onClick={() => toast.info("링크를 입력하고 엔터를 눌러주세요")}>등록</Button>
                </div>
              )}
            </div>
          ) : (
             <p className="text-xs text-nu-muted italic py-4">등록된 링크가 없습니다.</p>
          )}
        </div>
      </div>

      {/* Meeting info */}
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
        </div>
      </div>

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

      {/* Completed summary */}
      {meeting.status === "completed" && (
        <div className="bg-nu-pink/5 border-[2px] border-nu-pink/20 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink font-bold flex items-center gap-1.5">
              <FileText size={12} /> 회의 요약
            </p>
            {canEdit && !editingSummary && (
              <button onClick={() => { setEditingSummary(true); setEditedSummary(meeting.summary || ""); }}
                className="font-mono-nu text-[10px] text-nu-pink hover:underline flex items-center gap-1">
                <Edit3 size={11} /> 수정
              </button>
            )}
          </div>
          {editingSummary ? (
            <div className="flex flex-col gap-2">
              <Textarea value={editedSummary} onChange={e => setEditedSummary(e.target.value)}
                rows={4} className="border-nu-ink/15 bg-nu-white resize-none text-sm" />
              <div className="flex gap-2">
                <Button onClick={handleSaveEditedSummary} className="bg-nu-pink text-nu-paper hover:bg-nu-pink/90 font-mono-nu text-[10px] uppercase tracking-widest">
                  <Save size={12} /> 저장
                </Button>
                <Button variant="outline" onClick={() => setEditingSummary(false)} className="font-mono-nu text-[10px] uppercase tracking-widest">취소</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-nu-ink leading-relaxed whitespace-pre-wrap">
              {meeting.summary || <span className="text-nu-muted italic">요약이 아직 작성되지 않았습니다.</span>}
            </p>
          )}
        </div>
      )}

      {/* Status actions */}
      {canEdit && (
        <div className="mb-6 flex flex-wrap gap-3">
          {meeting.status === "upcoming" && (
            <Button onClick={handleStartMeeting} disabled={actionLoading}
              className="bg-nu-blue text-nu-paper hover:bg-nu-blue/90 font-mono-nu text-[11px] uppercase tracking-widest">
              <Play size={14} /> 미팅 시작
            </Button>
          )}
          {meeting.status === "in_progress" && !showSummaryInput && (
            <Button onClick={() => setShowSummaryInput(true)}
              className="bg-nu-pink text-nu-paper hover:bg-nu-pink/90 font-mono-nu text-[11px] uppercase tracking-widest">
              <CheckCircle2 size={14} /> 미팅 완료
            </Button>
          )}
          {showSummaryInput && (
            <div className="w-full bg-nu-white border border-nu-ink/[0.08] p-5">
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray mb-2">회의 요약</p>
              <Textarea value={summary} onChange={e => setSummary(e.target.value)}
                placeholder="미팅에서 논의된 내용을 요약해주세요" rows={3}
                className="border-nu-ink/15 bg-transparent resize-none mb-3" />
              <div className="flex gap-2">
                <Button onClick={handleCompleteMeeting} disabled={actionLoading}
                  className="bg-nu-pink text-nu-paper hover:bg-nu-pink/90 font-mono-nu text-[11px] uppercase tracking-widest">
                  {actionLoading ? "저장 중..." : "완료 처리"}
                </Button>
                <Button variant="outline" onClick={() => setShowSummaryInput(false)} className="font-mono-nu text-[11px] uppercase tracking-widest">취소</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="agendas">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="agendas" className="font-mono-nu text-[11px] uppercase tracking-widest">안건</TabsTrigger>
          <TabsTrigger value="resources" className="font-mono-nu text-[11px] uppercase tracking-widest">자료 공유 ({resources.length})</TabsTrigger>
          <TabsTrigger value="notes" className="font-mono-nu text-[11px] uppercase tracking-widest">노트</TabsTrigger>
          <TabsTrigger value="next" className="font-mono-nu text-[11px] uppercase tracking-widest">다음 주제</TabsTrigger>
          <TabsTrigger value="attendance" className="font-mono-nu text-[11px] uppercase tracking-widest">출석</TabsTrigger>
        </TabsList>

        {/* ── 안건 */}
        <TabsContent value="agendas">
          <AgendaList meetingId={meetingId} canEdit={canEdit} members={members} />
        </TabsContent>

        {/* ── 자료 공유 */}
        <TabsContent value="resources">
          <div className="flex flex-col gap-4">
            {/* Add resource */}
            {(canEdit || true) && (
              <div className="bg-nu-white border border-nu-ink/[0.08]">
                <button onClick={() => setShowAdd(!showAdd)}
                  className="w-full flex items-center gap-2 p-4 font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink hover:text-nu-pink transition-colors">
                  <Plus size={14} /> 자료 추가하기 (Drive, 기사, 논문, 링크)
                </button>
                {showAdd && (
                  <div className="border-t border-nu-ink/[0.08] p-5 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray block mb-1">유형</label>
                        <select value={newRes.type} onChange={e => setNewRes(p => ({ ...p, type: e.target.value as SharedResource["type"] }))}
                          className="w-full px-3 py-2 border border-nu-ink/15 bg-transparent text-sm focus:outline-none focus:border-nu-pink">
                          <option value="drive">📁 Google Drive</option>
                          <option value="article">📰 기사/뉴스</option>
                          <option value="paper">📄 논문/리포트</option>
                          <option value="link">🔗 기타 링크</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray block mb-1">제목</label>
                        <Input value={newRes.title} onChange={e => setNewRes(p => ({ ...p, title: e.target.value }))}
                          placeholder="자료 제목" className="border-nu-ink/15 bg-transparent" />
                      </div>
                    </div>
                    <div>
                      <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray block mb-1">URL</label>
                      <Input value={newRes.url} onChange={e => setNewRes(p => ({ ...p, url: e.target.value }))}
                        placeholder="https://" className="border-nu-ink/15 bg-transparent" />
                    </div>
                    <div>
                      <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray block mb-1">설명 (선택)</label>
                      <Textarea value={newRes.description} onChange={e => setNewRes(p => ({ ...p, description: e.target.value }))}
                        placeholder="이 자료에 대한 간단한 설명" rows={2} className="border-nu-ink/15 bg-transparent resize-none" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleAddResource} disabled={addingRes}
                        className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[10px] uppercase tracking-widest">
                        {addingRes ? "추가 중..." : "추가"}
                      </Button>
                      <Button variant="outline" onClick={() => setShowAdd(false)} className="font-mono-nu text-[10px] uppercase tracking-widest">취소</Button>
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
                        <span className="font-mono-nu text-[9px] px-1.5 py-0.5 bg-nu-cream text-nu-muted uppercase">
                          {r.type === "drive" ? "Drive" : r.type === "article" ? "기사" : r.type === "paper" ? "논문" : "링크"}
                        </span>
                      </div>
                      {r.description && <p className="text-xs text-nu-muted mb-1">{r.description}</p>}
                      <p className="font-mono-nu text-[9px] text-nu-muted">{r.author?.nickname} · {new Date(r.created_at).toLocaleDateString("ko")}</p>
                    </div>
                    {(userId === r.created_by || canEdit) && (
                      <button onClick={() => handleDeleteResource(r.id)} className="text-nu-muted hover:text-nu-red transition-colors shrink-0">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Replies */}
                  {(r.replies?.length ?? 0) > 0 && (
                    <div className="border-t border-nu-ink/[0.05] px-4 pb-3">
                      {r.replies!.map(reply => (
                        <div key={reply.id} className="flex items-start gap-2 pt-3">
                          <div className="w-6 h-6 rounded-full bg-nu-cream flex items-center justify-center text-[10px] font-bold shrink-0">
                            {(reply.author?.nickname || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-mono-nu text-[10px] text-nu-muted">{reply.author?.nickname}</span>
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
                      className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-50">
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
                <h3 className="font-head text-lg font-extrabold text-nu-ink">다음 미팅 주제</h3>
              </div>
              <Textarea value={nextTopic} onChange={e => setNextTopic(e.target.value)}
                placeholder="다음 미팅에서 논의할 주제를 적어주세요" rows={4}
                className="border-nu-ink/15 bg-transparent resize-none mb-3" disabled={!canEdit} />
              {canEdit && (
                <Button onClick={handleSaveNextTopic} disabled={savingNextTopic}
                  className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest">
                  {savingNextTopic ? "저장 중..." : "저장"}
                </Button>
              )}
            </div>

            {/* Linked issues */}
            <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle size={18} className="text-nu-red" />
                <h3 className="font-head text-lg font-extrabold text-nu-ink">연계 이슈</h3>
                <span className="font-mono-nu text-[10px] text-nu-muted">{issues.filter(i => i.status === "open").length}개 오픈</span>
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
                    <span className={`font-mono-nu text-[9px] uppercase px-1.5 py-0.5 ${issue.status === "open" ? "bg-nu-red/10 text-nu-red" : "bg-green-50 text-green-600"}`}>
                      {issue.status === "open" ? "오픈" : "해결됨"}
                    </span>
                    {canEdit && (
                      <button onClick={() => handleDeleteIssue(issue.id)} className="text-nu-muted hover:text-nu-red transition-colors">
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
                  className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[10px] uppercase tracking-widest shrink-0">
                  <Plus size={13} /> 추가
                </Button>
              </div>
            </div>
          </div>
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
      <p className="font-mono-nu text-[10px] text-nu-muted mb-4">
        출석: {attendedCount}/{members.length}명
        {members.length > 0 && <span className="ml-2 text-nu-pink">({Math.round((attendedCount / members.length) * 100)}%)</span>}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {members.map(m => (
          <button key={m.userId} onClick={() => toggleAttendance(m.userId, m.attended)} disabled={!canEdit}
            className={`flex items-center gap-2.5 px-3 py-2.5 border-[2px] transition-all font-mono-nu text-[11px] ${
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
