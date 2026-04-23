"use client";

/**
 * UserProfilePopover — 채팅 버블의 아바타/닉네임 클릭 시 열리는 작은 팝오버.
 *
 * 모바일: 하단 시트 스타일, 데스크탑: 인라인 팝오버.
 * 버튼 2개: "프로필 보기" (/portfolio/[id]) / "1:1 대화" (DM 확보 후 이동)
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, User as UserIcon, MessageSquare, Loader2 } from "lucide-react";
import { openOrCreateDm } from "@/lib/chat/open-dm";

interface Props {
  userId: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  onClose: () => void;
  /** 채팅 페이지 내부면 라우팅 대신 activeRoom 을 바꾸기 위한 콜백 */
  onStartDm?: (roomId: string) => void;
}

export function UserProfilePopover({ userId, nickname, avatarUrl, onClose, onStartDm }: Props) {
  const router = useRouter();
  const [bio, setBio] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/profiles/${userId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setBio(data.bio || null);
        setJobTitle(data.job_title || data.specialty || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDm() {
    if (starting) return;
    setStarting(true);
    try {
      const roomId = await openOrCreateDm(userId);
      if (onStartDm) onStartDm(roomId);
      else router.push(`/chat?room=${roomId}`);
      onClose();
    } catch (e: any) {
      toast.error(e.message || "DM 시작 실패");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[900] bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="사용자 프로필"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-white sm:rounded-2xl rounded-t-3xl border-t-2 sm:border-2 border-nu-ink shadow-2xl overflow-hidden"
      >
        <div className="relative px-5 pt-5 pb-3">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 hover:bg-nu-ink/10 rounded-full"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-nu-ink/5 overflow-hidden shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={nickname || ""} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-nu-pink/40 to-nu-blue/40 text-white text-[20px] font-bold flex items-center justify-center">
                  {(nickname || "?").charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[16px] text-nu-ink truncate">{nickname || "익명"}</div>
              {loading ? (
                <div className="h-3 mt-1 w-24 bg-nu-ink/10 rounded animate-pulse" />
              ) : jobTitle ? (
                <div className="text-[11px] font-mono-nu uppercase tracking-widest text-nu-muted truncate">
                  {jobTitle}
                </div>
              ) : null}
            </div>
          </div>
          {bio && !loading && (
            <p className="mt-3 text-[13px] text-nu-graphite leading-relaxed line-clamp-3">{bio}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-0 border-t border-nu-ink/10">
          <button
            onClick={() => {
              router.push(`/portfolio/${userId}`);
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 py-3 text-[13px] font-semibold text-nu-ink hover:bg-nu-ink/5 border-r border-nu-ink/10"
          >
            <UserIcon size={14} />
            프로필 보기
          </button>
          <button
            onClick={handleDm}
            disabled={starting}
            className="flex items-center justify-center gap-1.5 py-3 text-[13px] font-bold text-white bg-nu-pink hover:bg-nu-ink disabled:opacity-50"
          >
            {starting ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
            1:1 대화
          </button>
        </div>
        <div className="sm:hidden h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
