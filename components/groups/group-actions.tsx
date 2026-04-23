"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Clock, Users, XCircle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

interface GroupActionsProps {
  groupId: string;
  groupName: string;
  hostId: string;
  userId: string;
  maxMembers: number;
  memberCount: number;
  membershipStatus?: "active" | "pending" | "waitlist" | null;
}

export function GroupActions({
  groupId,
  groupName,
  hostId,
  userId,
  maxMembers,
  memberCount,
  membershipStatus,
}: GroupActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentMemberCount, setCurrentMemberCount] = useState(memberCount);

  // 실시간 인원 확인 (클라이언트 측)
  useEffect(() => {
    async function fetchCount() {
      const supabase = createClient();
      const { count } = await supabase.from("group_members").select("*", { count: "exact", head: true }).eq("group_id", groupId).eq("status", "active");
      if (count !== null) setCurrentMemberCount(count);
    }
    fetchCount();
  }, [groupId]);

  async function handleJoin() {
    setLoading(true);
    const supabase = createClient();

    // 항상 pending으로 신청 — 호스트 승인 필요
    const { error } = await supabase.from("group_members").insert({
      group_id: groupId,
      user_id: userId,
      role: "member",
      status: "pending",
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("이미 가입 신청한 너트입니다");
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    // 호스트에게 알림 전송
    await supabase.from("notifications").insert({
      user_id: hostId,
      type: "join_request",
      title: "가입 신청이 도착했습니다",
      body: `${groupName} 너트에 새 가입 신청이 있습니다. 설정에서 승인해주세요.`,
      metadata: { group_id: groupId },
      is_read: false,
    });

    // 너트 채팅방에도 시스템 메시지 (호스트가 바로 승인/거절 가능)
    try {
      const { data: me } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", userId)
        .maybeSingle();
      const nick = (me as any)?.nickname || "신청자";
      const { encodeAction } = await import("@/lib/chat/chat-actions");
      const content = encodeAction(
        {
          type: "join_request",
          group_id: groupId,
          applicant_id: userId,
          applicant_nick: nick,
          host_id: hostId,
        },
        `${nick}님이 ${groupName} 너트 가입을 신청했습니다`,
      );
      await fetch("/api/chat/system-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_id: groupId, content, ensure_room: true }),
      });
    } catch {}

    toast.success("가입 신청이 완료되었습니다. 관리자 승인을 기다려주세요.");
    router.refresh();
    setLoading(false);
  }

  async function handleCancelJoin() {
    if (!confirm("가입 신청을 취소하시겠습니까?")) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from("group_members").delete()
      .eq("group_id", groupId).eq("user_id", userId);
    toast.success("가입 신청이 취소되었습니다");
    router.refresh();
    setLoading(false);
  }

  async function handleLeave() {
    if (!confirm("정말 이 너트를 탈퇴하시겠습니까?")) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("group_members").delete()
      .eq("user_id", userId).eq("group_id", groupId);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    toast.success("너트에서 탈퇴했습니다");
    router.refresh();
    setLoading(false);
  }

  // ── 상태별 렌더 ──────────────────────────────────────────────────────
  if (membershipStatus === "active") {
    // 호스트는 탈퇴 버튼 없음
    if (userId === hostId) {
      return (
        <span className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-5 py-3 bg-green-600 text-white inline-flex items-center gap-2">
          <CheckCircle2 size={14} /> 참여중
        </span>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-5 py-3 bg-green-600 text-white inline-flex items-center gap-2">
          <CheckCircle2 size={14} /> 참여중
        </span>
        <button
          onClick={handleLeave}
          disabled={loading}
          className="font-mono-nu text-[12px] uppercase tracking-widest px-3 py-2.5 border border-nu-muted text-nu-muted hover:border-nu-red hover:text-nu-red transition-colors flex items-center gap-1"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} 너트 탈퇴
        </button>
      </div>
    );
  }

  if (membershipStatus === "pending") {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-amber text-white inline-flex items-center gap-2">
          <Clock size={14} /> 승인 대기중
        </span>
        <button
          onClick={handleCancelJoin}
          disabled={loading}
          className="font-mono-nu text-[12px] uppercase tracking-widest px-3 py-2.5 border border-nu-muted text-nu-muted hover:border-nu-red hover:text-nu-red transition-colors flex items-center gap-1"
        >
          <XCircle size={12} /> 취소
        </button>
      </div>
    );
  }

  if (membershipStatus === "waitlist") {
    return (
      <span className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-gray text-white inline-flex items-center gap-2">
        <Users size={14} /> 대기중
      </span>
    );
  }

  // 비회원 — 가입신청 버튼
  const isFull = currentMemberCount >= maxMembers;

  return (
    <button
      onClick={handleJoin}
      disabled={loading || isFull}
      id="group-join-btn"
      className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-50 flex items-center gap-2"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
      {isFull ? "인원 마감" : "가입 신청"}
    </button>
  );
}
