"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  User,
  Cloud,
  Calendar,
  Users,
  Check,
  X,
} from "lucide-react";

interface OnboardingChecklistProps {
  groupId: string;
  isHost: boolean;
}

export function OnboardingChecklist({
  groupId,
  isHost,
}: OnboardingChecklistProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage for dismissed state
    const dismissKey = `onboarding-checklist-dismissed-${groupId}`;
    const wasDismissed = localStorage.getItem(dismissKey) === "true";
    setIsDismissed(wasDismissed);
  }, [groupId]);

  const handleDismiss = () => {
    const dismissKey = `onboarding-checklist-dismissed-${groupId}`;
    localStorage.setItem(dismissKey, "true");
    setIsDismissed(true);
  };

  if (!mounted || isDismissed || !isHost) {
    return null;
  }

  const tasks = [
    {
      id: "profile",
      icon: User,
      title: "프로필 사진을 설정하세요",
      description: "팀원들이 당신을 쉽게 인식할 수 있도록",
      href: "/profile",
      completed: false,
    },
    {
      id: "drive",
      icon: Cloud,
      title: "구글 드라이브를 연결하세요",
      description: "자료 공유와 협업을 위해",
      href: `/groups/${groupId}/settings`,
      completed: false,
    },
    {
      id: "meeting",
      icon: Calendar,
      title: "첫 번째 미팅을 등록하세요",
      description: "팀의 첫 모임을 예약하기",
      href: `/groups/${groupId}/meetings/create`,
      completed: false,
    },
    {
      id: "invite",
      icon: Users,
      title: "팀원을 초대하세요",
      description: "그룹 공유 링크로 멤버 모으기",
      href: `/groups/${groupId}`,
      completed: false,
    },
  ];

  const completedCount = tasks.filter((t) => t.completed).length;
  const completionPct = Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="bg-nu-white border-[2px] border-nu-pink/30 p-6 rounded-sm mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-head text-sm font-bold text-nu-ink flex items-center gap-2">
            <span className="w-5 h-5 flex items-center justify-center text-xs font-black bg-nu-pink/20 text-nu-pink rounded-full">
              ✓
            </span>
            소모임 시작하기
          </h3>
          <p className="text-[11px] text-nu-muted mt-1">
            팀을 준비하기 위한 필수 단계들입니다
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-nu-muted hover:text-nu-ink transition-colors p-1"
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
            진행도
          </span>
          <span className="font-mono-nu text-[11px] font-bold text-nu-ink">
            {completedCount}/{tasks.length}
          </span>
        </div>
        <div className="h-2 bg-nu-cream rounded-full overflow-hidden">
          <div
            className="h-full bg-nu-pink transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {tasks.map((task) => {
          const IconComponent = task.icon;
          return (
            <Link
              key={task.id}
              href={task.href}
              className="block p-3 border border-nu-ink/[0.08] hover:border-nu-pink/40 hover:bg-nu-pink/5 transition-all no-underline group"
            >
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center rounded border border-nu-ink/20 group-hover:border-nu-pink/50 group-hover:bg-nu-pink/10 transition-colors">
                  <IconComponent size={12} className="text-nu-muted group-hover:text-nu-pink" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-nu-ink group-hover:text-nu-pink transition-colors">
                    {task.title}
                  </p>
                  <p className="text-[10px] text-nu-muted">
                    {task.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="text-[9px] text-nu-muted mt-4 pt-4 border-t border-nu-ink/[0.08]">
        이 체크리스트는 언제든 닫을 수 있습니다. 나중에 다시 보려면 설정에서 확인하세요.
      </p>
    </div>
  );
}
