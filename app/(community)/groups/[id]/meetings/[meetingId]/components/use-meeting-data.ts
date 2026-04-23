"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Meeting, Profile } from "@/lib/types";
import { toast } from "sonner";

export interface LinkedIssue {
  id: string;
  title: string;
  status: "open" | "resolved";
  created_at: string;
}

export interface SharedResource {
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

export interface ResourceReply {
  id: string;
  resource_id: string;
  content: string;
  created_by: string;
  created_at: string;
  author?: { nickname: string | null };
}

export function useMeetingData(meetingId: string, groupId: string) {
  const [meeting, setMeeting]       = useState<Meeting | null>(null);
  const [groupName, setGroupName]   = useState("");
  const [members, setMembers]       = useState<Profile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [userId, setUserId]         = useState<string | null>(null);
  const [canEdit, setCanEdit]       = useState(false);
  const [resources, setResources]   = useState<SharedResource[]>([]);
  const [issues, setIssues]         = useState<LinkedIssue[]>([]);
  const [meetingNotes, setMeetingNotes] = useState<string[]>([]);
  const [previousDigest, setPreviousDigest] = useState<string | null>(null);
  const [nextTopic, setNextTopic]   = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // 미팅 조회 — 조직자 join 포함, 실패 시 기본 조회
    let meetingData: any = null;
    try {
      const { data } = await supabase
        .from("meetings")
        .select("*, organizer:profiles!meetings_organizer_id_fkey(id, nickname, avatar_url)")
        .eq("id", meetingId)
        .single();
      meetingData = data;
    } catch {
      const { data } = await supabase.from("meetings").select("*").eq("id", meetingId).single();
      meetingData = data;
    }
    if (!meetingData) {
      // FK join 없이 재시도
      const { data } = await supabase.from("meetings").select("*").eq("id", meetingId).single();
      meetingData = data;
    }

    const groupRes = await supabase.from("groups").select("host_id, name").eq("id", groupId).single();
    const groupData = groupRes.data;
    if (!meetingData) return;

    setMeeting(meetingData);
    setNextTopic(meetingData.next_topic || "");
    setGroupName(groupData?.name || "너트");

    // 편집 권한
    const { data: membership } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    const isHostOrOrganizer =
      groupData?.host_id === user.id || meetingData.organizer_id === user.id;
    setCanEdit(
      isHostOrOrganizer ||
      membership?.role === "host" ||
      membership?.role === "moderator"
    );

    // 멤버 목록
    const { data: membersData } = await supabase
      .from("group_members")
      .select("profile:profiles(*)")
      .eq("group_id", groupId)
      .eq("status", "active");
    if (membersData)
      setMembers(membersData.map((m: any) => m.profile).filter(Boolean) as Profile[]);

    // 병렬 부가 데이터
    const [resourcesRes, issuesRes, notesRes, digestRes] = await Promise.allSettled([
      (async () => {
        const { data: resData, error } = await supabase
          .from("meeting_resources")
          .select("*, author:profiles!meeting_resources_created_by_fkey(nickname)")
          .eq("meeting_id", meetingId)
          .order("created_at");
        if (error || !resData) return null;
        const withReplies = await Promise.all(
          resData.map(async (r: any) => {
            const { data: replies } = await supabase
              .from("meeting_resource_replies")
              .select("*, author:profiles!meeting_resource_replies_created_by_fkey(nickname)")
              .eq("resource_id", r.id)
              .order("created_at");
            return { ...r, replies: replies || [] };
          })
        );
        return withReplies;
      })(),
      supabase.from("meeting_issues").select("*").eq("meeting_id", meetingId).order("created_at"),
      supabase.from("meeting_notes").select("content, type").eq("meeting_id", meetingId).order("created_at"),
      supabase
        .from("wiki_ai_analyses")
        .select("content")
        .eq("group_id", groupId)
        .eq("analysis_type", "weekly_digest")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (resourcesRes.status === "fulfilled" && resourcesRes.value)
      setResources(resourcesRes.value as SharedResource[]);
    if (issuesRes.status === "fulfilled" && issuesRes.value.data)
      setIssues(issuesRes.value.data as LinkedIssue[]);
    if (notesRes.status === "fulfilled" && notesRes.value.data) {
      setMeetingNotes(
        notesRes.value.data.map((n: any) => {
          const prefix =
            n.type === "decision" ? "[결정] " : n.type === "action_item" ? "[액션] " : "";
          return prefix + n.content;
        })
      );
    }
    if (digestRes.status === "fulfilled" && digestRes.value.data?.content) {
      try {
        const parsed = JSON.parse(digestRes.value.data.content);
        setPreviousDigest(parsed.nextMeetingContext || parsed.digest || null);
      } catch { /* ignore */ }
    }

    setLoading(false);
  }, [meetingId, groupId]);

  return {
    meeting, groupName, members, loading, userId, canEdit,
    resources, setResources,
    issues, setIssues,
    meetingNotes,
    previousDigest, setPreviousDigest,
    nextTopic, setNextTopic,
    reload: load,
    setMeeting,
  };
}

// ── 미팅 필드 업데이트 ─────────────────────────────────────
export async function updateMeetingField(meetingId: string, field: string, value: any) {
  const supabase = createClient();
  const { error } = await supabase.from("meetings").update({ [field]: value }).eq("id", meetingId);
  if (error) { toast.error("수정에 실패했습니다"); return false; }
  return true;
}

// ── 자료 추가 ──────────────────────────────────────────────
export async function addResource(
  meetingId: string,
  groupId: string,
  userId: string,
  res: { title: string; url: string; type: SharedResource["type"]; description: string }
): Promise<SharedResource | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("meeting_resources")
    .insert({ meeting_id: meetingId, ...res, created_by: userId })
    .select("*, author:profiles!meeting_resources_created_by_fkey(nickname)")
    .single();
  if (error) { toast.error("자료 추가에 실패했습니다"); return null; }

  // file_attachments 동기 (non-critical)
  try {
    await supabase.from("file_attachments").insert({
      target_type: "group",
      target_id: groupId,
      uploaded_by: userId,
      file_name: `[회의] ${res.title.trim()}`,
      file_url: res.url.trim(),
      file_type: res.url.includes("drive.google") ? "drive-link" : "url-link",
      file_size: null,
    });
  } catch { /* non-critical */ }

  toast.success("자료가 추가되었습니다");
  return { ...data, replies: [] } as SharedResource;
}

// ── 이슈 추가 ──────────────────────────────────────────────
export async function addIssue(
  meetingId: string,
  title: string,
  userId: string
): Promise<LinkedIssue | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("meeting_issues")
    .insert({ meeting_id: meetingId, title, status: "open", created_by: userId })
    .select()
    .single();
  if (error) { toast.error("이슈 추가에 실패했습니다"); return null; }
  return data as LinkedIssue;
}

// ── 이슈 토글 ──────────────────────────────────────────────
export async function toggleIssueStatus(issue: LinkedIssue): Promise<"open" | "resolved" | null> {
  const next = issue.status === "open" ? "resolved" : "open";
  const supabase = createClient();
  const { error } = await supabase.from("meeting_issues").update({ status: next }).eq("id", issue.id);
  if (error) { toast.error("상태 변경에 실패했습니다"); return null; }
  return next as "open" | "resolved";
}
