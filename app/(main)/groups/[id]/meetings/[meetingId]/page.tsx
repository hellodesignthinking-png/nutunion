"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Meeting, MeetingAgenda, Profile } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AgendaList } from "@/components/meetings/agenda-list";
import { MeetingNotes } from "@/components/meetings/meeting-notes";
import { GoogleCalendarButton } from "@/components/integrations/google-calendar-button";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Play,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; className: string }> = {
  upcoming: { label: "예정", className: "bg-nu-blue/10 text-nu-blue border-nu-blue/20" },
  in_progress: { label: "진행 중", className: "bg-nu-amber/10 text-nu-amber border-nu-amber/20" },
  completed: { label: "완료", className: "bg-nu-pink/10 text-nu-pink border-nu-pink/20" },
  cancelled: { label: "취소됨", className: "bg-nu-red/10 text-nu-red border-nu-red/20" },
};

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const meetingId = params.meetingId as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  // Status action states
  const [showSummaryInput, setShowSummaryInput] = useState(false);
  const [summary, setSummary] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Next topic
  const [nextTopic, setNextTopic] = useState("");
  const [savingNextTopic, setSavingNextTopic] = useState(false);

  const loadMeeting = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: meetingData } = await supabase
      .from("meetings")
      .select(
        "*, organizer:profiles!meetings_organizer_id_fkey(id, nickname, avatar_url)"
      )
      .eq("id", meetingId)
      .single();

    if (!meetingData) return;
    setMeeting(meetingData);
    setNextTopic(meetingData.next_topic || "");

    // Check edit permission
    const { data: membership } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    const { data: group } = await supabase
      .from("groups")
      .select("host_id")
      .eq("id", groupId)
      .single();

    const isHostOrOrganizer =
      group?.host_id === user.id || meetingData.organizer_id === user.id;
    setCanEdit(
      isHostOrOrganizer ||
        membership?.role === "host" ||
        membership?.role === "moderator"
    );

    // Get crew members for assignment
    const { data: membersData } = await supabase
      .from("group_members")
      .select("profile:profiles(*)")
      .eq("group_id", groupId)
      .eq("status", "active");

    if (membersData) {
      const profiles = membersData
        .map((m: any) => m.profile)
        .filter(Boolean) as Profile[];
      setMembers(profiles);
    }

    setLoading(false);
  }, [groupId, meetingId]);

  useEffect(() => {
    loadMeeting();
  }, [loadMeeting]);

  async function handleStartMeeting() {
    setActionLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("meetings")
      .update({ status: "in_progress" })
      .eq("id", meetingId);

    if (error) {
      toast.error("상태 변경에 실패했습니다");
    } else {
      toast.success("미팅이 시작되었습니다!");
      await loadMeeting();
    }
    setActionLoading(false);
  }

  async function handleCompleteMeeting() {
    if (!summary.trim()) {
      toast.error("미팅 요약을 입력해주세요");
      return;
    }
    setActionLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("meetings")
      .update({ status: "completed", summary: summary.trim() })
      .eq("id", meetingId);

    if (error) {
      toast.error("상태 변경에 실패했습니다");
    } else {
      toast.success("미팅이 완료되었습니다!");
      setShowSummaryInput(false);
      await loadMeeting();
    }
    setActionLoading(false);
  }

  async function handleSaveNextTopic() {
    setSavingNextTopic(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("meetings")
      .update({ next_topic: nextTopic.trim() || null })
      .eq("id", meetingId);

    if (error) {
      toast.error("저장에 실패했습니다");
    } else {
      toast.success("다음 주제가 저장되었습니다");
    }
    setSavingNextTopic(false);
  }

  if (loading || !meeting) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-nu-cream/50 w-64" />
          <div className="h-4 bg-nu-cream/50 w-96" />
          <div className="h-64 bg-nu-cream/50" />
        </div>
      </div>
    );
  }

  const date = new Date(meeting.scheduled_at);
  const cfg = statusConfig[meeting.status] || statusConfig.upcoming;

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Badge className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
          {meeting.organizer && (
            <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-1">
              <User size={12} />
              {meeting.organizer.nickname}
            </span>
          )}
        </div>
        <h1 className="font-head text-3xl font-extrabold text-nu-ink">
          {meeting.title}
        </h1>
        {meeting.description && (
          <p className="text-nu-gray mt-2 max-w-2xl">{meeting.description}</p>
        )}
      </div>

      {/* Meeting info */}
      <div className="bg-nu-white border border-nu-ink/[0.08] p-6 mb-6">
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-nu-pink" />
            <span className="text-sm">
              {date.toLocaleDateString("ko", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-nu-blue" />
            <span className="text-sm">
              {date.toLocaleTimeString("ko", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              ({meeting.duration_min}분)
            </span>
          </div>
          {meeting.location && (
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-nu-amber" />
              <span className="text-sm">{meeting.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Google Calendar button */}
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

      {/* Summary for completed meetings */}
      {meeting.status === "completed" && meeting.summary && (
        <div className="bg-nu-pink/5 border border-nu-pink/20 p-5 mb-6">
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink font-bold mb-2">
            미팅 요약
          </p>
          <p className="text-sm text-nu-ink leading-relaxed">
            {meeting.summary}
          </p>
        </div>
      )}

      {/* Status actions */}
      {canEdit && (
        <div className="mb-6 flex flex-wrap gap-3">
          {meeting.status === "upcoming" && (
            <Button
              onClick={handleStartMeeting}
              disabled={actionLoading}
              className="bg-nu-blue text-nu-paper hover:bg-nu-blue/90 font-mono-nu text-[11px] uppercase tracking-widest"
            >
              <Play size={14} /> 미팅 시작
            </Button>
          )}
          {meeting.status === "in_progress" && !showSummaryInput && (
            <Button
              onClick={() => setShowSummaryInput(true)}
              className="bg-nu-pink text-nu-paper hover:bg-nu-pink/90 font-mono-nu text-[11px] uppercase tracking-widest"
            >
              <CheckCircle2 size={14} /> 미팅 완료
            </Button>
          )}
          {showSummaryInput && (
            <div className="w-full bg-nu-white border border-nu-ink/[0.08] p-5">
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray mb-2">
                미팅 요약
              </p>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="미팅에서 논의된 내용을 요약해주세요"
                rows={3}
                className="border-nu-ink/15 bg-transparent resize-none mb-3"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleCompleteMeeting}
                  disabled={actionLoading}
                  className="bg-nu-pink text-nu-paper hover:bg-nu-pink/90 font-mono-nu text-[11px] uppercase tracking-widest"
                >
                  {actionLoading ? "저장 중..." : "완료 처리"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSummaryInput(false)}
                  className="font-mono-nu text-[11px] uppercase tracking-widest"
                >
                  취소
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="agendas">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="agendas" className="font-mono-nu text-[11px] uppercase tracking-widest">
            안건
          </TabsTrigger>
          <TabsTrigger value="notes" className="font-mono-nu text-[11px] uppercase tracking-widest">
            노트 & 기록
          </TabsTrigger>
          <TabsTrigger value="next" className="font-mono-nu text-[11px] uppercase tracking-widest">
            다음 주제
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agendas">
          <AgendaList
            meetingId={meetingId}
            canEdit={canEdit}
            members={members}
          />
        </TabsContent>

        <TabsContent value="notes">
          <MeetingNotes
            meetingId={meetingId}
            members={members}
            userId={userId}
          />
        </TabsContent>

        <TabsContent value="next">
          <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb size={18} className="text-nu-amber" />
              <h3 className="font-head text-lg font-extrabold text-nu-ink">
                다음 미팅 주제
              </h3>
            </div>
            <Textarea
              value={nextTopic}
              onChange={(e) => setNextTopic(e.target.value)}
              placeholder="다음 미팅에서 논의할 주제를 적어주세요"
              rows={4}
              className="border-nu-ink/15 bg-transparent resize-none mb-3"
              disabled={!canEdit}
            />
            {canEdit && (
              <Button
                onClick={handleSaveNextTopic}
                disabled={savingNextTopic}
                className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest"
              >
                {savingNextTopic ? "저장 중..." : "저장"}
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
