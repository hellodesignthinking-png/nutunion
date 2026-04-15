"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  User, Cloud, Calendar, Users, Check, X, ChevronRight, Loader2,
} from "lucide-react";

interface OnboardingChecklistProps {
  groupId: string;
  isHost: boolean;
}

interface TaskStatus {
  profile: boolean;
  drive: boolean;
  meeting: boolean;
  invite: boolean;
}

export function OnboardingChecklist({ groupId, isHost }: OnboardingChecklistProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TaskStatus>({
    profile: false, drive: false, meeting: false, invite: false,
  });

  useEffect(() => {
    setMounted(true);
    const dismissKey = `onboarding-checklist-dismissed-${groupId}`;
    if (localStorage.getItem(dismissKey) === "true") {
      setIsDismissed(true);
      setLoading(false);
      return;
    }

    async function checkCompletion() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [profileRes, groupRes, meetingsRes, membersRes] = await Promise.allSettled([
        supabase.from("profiles").select("avatar_url").eq("id", user.id).single(),
        supabase.from("groups").select("google_drive_url").eq("id", groupId).single(),
        supabase.from("meetings").select("id", { count: "exact", head: true }).eq("group_id", groupId),
        supabase.from("group_members").select("user_id", { count: "exact", head: true })
          .eq("group_id", groupId).eq("status", "active"),
      ]);

      setStatus({
        profile: profileRes.status === "fulfilled" && !!profileRes.value.data?.avatar_url,
        drive: groupRes.status === "fulfilled" && !!groupRes.value.data?.google_drive_url,
        meeting: meetingsRes.status === "fulfilled" && (meetingsRes.value.count || 0) > 0,
        invite: membersRes.status === "fulfilled" && (membersRes.value.count || 0) > 1,
      });
      setLoading(false);
    }
    checkCompletion();
  }, [groupId]);

  const handleDismiss = () => {
    const dismissKey = `onboarding-checklist-dismissed-${groupId}`;
    localStorage.setItem(dismissKey, "true");
    setIsDismissed(true);
  };

  if (!mounted || isDismissed || !isHost) return null;

  const tasks = [
    {
      id: "profile",
      icon: User,
      title: "프로필 사진을 설정하세요",
      description: "팀원들이 당신을 쉽게 인식할 수 있도록",
      href: "/profile",
      actionLabel: "프로필 편집",
      completed: status.profile,
    },
    {
      id: "drive",
      icon: Cloud,
      title: "구글 드라이브를 연결하세요",
      description: "자료 공유와 협업을 위해",
      href: `/groups/${groupId}/settings`,
      actionLabel: "너트 설정 열기",
      completed: status.drive,
    },
    {
      id: "meeting",
      icon: Calendar,
      title: "첫 번째 미팅을 등록하세요",
      description: "팀의 첫 모임을 예약하기",
      href: `/groups/${groupId}/meetings/create`,
      actionLabel: "미팅 만들기",
      completed: status.meeting,
    },
    {
      id: "invite",
      icon: Users,
      title: "팀원을 초대하세요",
      description: "그룹 공유 링크로 멤버 모으기",
      href: `/groups/${groupId}/settings`,
      actionLabel: "너트 설정 열기",
      completed: status.invite,
    },
  ];

  const completedCount = tasks.filter((t) => t.completed).length;
  const completionPct = Math.round((completedCount / tasks.length) * 100);
  const allDone = completedCount === tasks.length;

  return (
    <div className={`bg-white border-[3px] p-5 mb-4 transition-colors ${
      allDone ? "border-green-500" : "border-nu-pink/40"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-head text-sm font-extrabold text-nu-ink flex items-center gap-2">
            {allDone ? (
              <span className="w-5 h-5 flex items-center justify-center bg-green-500 rounded-full shrink-0">
                <Check size={10} className="text-white" />
              </span>
            ) : (
              <span className="w-5 h-5 flex items-center justify-center text-xs font-black bg-nu-pink/20 text-nu-pink rounded-full shrink-0">
                ✓
              </span>
            )}
            너트 시작하기
          </h3>
          <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest mt-0.5">
            {allDone ? "모든 준비가 완료되었습니다 🎉" : "팀을 준비하기 위한 필수 단계들입니다"}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-nu-muted hover:text-nu-ink transition-colors p-1 shrink-0"
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">진행도</span>
          <span className="font-mono-nu text-[13px] font-bold text-nu-ink">
            {completedCount}/{tasks.length}
          </span>
        </div>
        <div className="h-1.5 bg-nu-cream overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${allDone ? "bg-green-500" : "bg-nu-pink"}`}
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="flex items-center justify-center py-4 gap-2 text-nu-muted">
          <Loader2 size={14} className="animate-spin" />
          <span className="font-mono-nu text-[12px]">확인 중...</span>
        </div>
      ) : (
        <div className="space-y-1">
          {tasks.map((task) => {
            const Icon = task.icon;
            return (
              <Link
                key={task.id}
                href={task.href}
                className={`flex items-center gap-3 p-3 border-[2px] transition-all no-underline group ${
                  task.completed
                    ? "border-green-200 bg-green-50 opacity-60 pointer-events-none"
                    : "border-nu-ink/[0.08] hover:border-nu-pink/40 hover:bg-nu-pink/[0.03]"
                }`}
              >
                {/* Completion indicator */}
                <div className={`w-6 h-6 rounded-full border-[2px] flex items-center justify-center shrink-0 transition-colors ${
                  task.completed
                    ? "bg-green-500 border-green-500"
                    : "border-nu-ink/20 group-hover:border-nu-pink/50"
                }`}>
                  {task.completed ? (
                    <Check size={10} className="text-white" />
                  ) : (
                    <Icon size={10} className="text-nu-muted group-hover:text-nu-pink transition-colors" />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold transition-colors ${
                    task.completed ? "line-through text-nu-muted" : "text-nu-ink group-hover:text-nu-pink"
                  }`}>
                    {task.title}
                  </p>
                  <p className="font-mono-nu text-[11px] text-nu-muted">{task.description}</p>
                </div>

                {/* Action label */}
                {!task.completed && (
                  <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {task.actionLabel} <ChevronRight size={11} />
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <p className="font-mono-nu text-[10px] text-nu-muted mt-4 pt-3 border-t border-nu-ink/[0.06]">
        체크리스트는 닫을 수 있습니다 · 다시 보려면 너트 설정에서 확인하세요
      </p>
    </div>
  );
}
