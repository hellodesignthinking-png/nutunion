"use client";

/**
 * RoomMembersSheet — 방 제목 클릭 시 열리는 참여자 목록 시트.
 *
 * 모바일: 하단 시트, 데스크탑: 우측 드로어.
 * - 접속 중 (online) 섹션 — profiles.last_seen_at 근거 (<5분)
 *   지원 안되면 "접속 상태 미지원" 안내
 * - 전체 참여자 섹션 — 각 행에 "1:1 대화" 버튼
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, MessageSquare, Loader2, Circle, User as UserIcon } from "lucide-react";
import { openOrCreateDm } from "@/lib/chat/open-dm";

interface Member {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  job_title: string | null;
  role: string;
  online: boolean | null;
  last_seen_at: string | null;
}

interface Props {
  roomId: string;
  meId?: string | null;
  onClose: () => void;
  /** 채팅 페이지 내부면 router 대신 방 전환 */
  onStartDm?: (roomId: string) => void;
}

export function RoomMembersSheet({ roomId, meId, onClose, onStartDm }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [presenceSupported, setPresenceSupported] = useState(true);
  const [dmBusy, setDmBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/rooms/${roomId}/members`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setMembers(data.members || []);
        setPresenceSupported(!!data.presence_supported);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDm(userId: string) {
    if (dmBusy) return;
    setDmBusy(userId);
    try {
      const rid = await openOrCreateDm(userId);
      if (onStartDm) onStartDm(rid);
      else router.push(`/chat?room=${rid}`);
      onClose();
    } catch (e: any) {
      toast.error(e.message || "DM 시작 실패");
    } finally {
      setDmBusy(null);
    }
  }

  const online = members.filter((m) => m.online === true);
  const all = members;

  return (
    <div
      className="fixed inset-0 z-[900] bg-black/40 flex items-end sm:items-stretch sm:justify-end"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="참여자 목록"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[380px] bg-white sm:border-l-2 border-nu-ink shadow-2xl flex flex-col max-h-[85vh] sm:max-h-full sm:h-full rounded-t-3xl sm:rounded-none"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-nu-ink/10 shrink-0">
          <div className="flex items-center gap-2">
            <UserIcon size={15} className="text-nu-pink" />
            <h2 className="font-bold text-[15px] text-nu-ink">참여자</h2>
            <span className="text-[12px] text-nu-muted tabular-nums">{all.length}명</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-nu-ink/10 rounded-full" aria-label="닫기">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 size={18} className="animate-spin inline-block text-nu-muted" />
            </div>
          ) : (
            <>
              {/* 접속 중 섹션 */}
              <section className="px-4 py-3 border-b border-nu-ink/5">
                <div className="flex items-center gap-1.5 mb-2 text-[10px] font-mono-nu uppercase tracking-widest text-nu-muted font-bold">
                  <Circle size={6} className="text-green-500 fill-green-500" />
                  접속 중 {presenceSupported ? `(${online.length}명)` : ""}
                </div>
                {!presenceSupported ? (
                  <p className="text-[11px] text-nu-muted italic">접속 상태 미지원 — 서버 스키마 업데이트 후 표시돼요</p>
                ) : online.length === 0 ? (
                  <p className="text-[11px] text-nu-muted">지금 접속 중인 사람이 없어요</p>
                ) : (
                  <ul className="space-y-1">
                    {online.map((m) => (
                      <MemberRow key={m.user_id} m={m} meId={meId} dmBusy={dmBusy} onDm={handleDm} />
                    ))}
                  </ul>
                )}
              </section>

              {/* 전체 참여자 */}
              <section className="px-4 py-3">
                <div className="mb-2 text-[10px] font-mono-nu uppercase tracking-widest text-nu-muted font-bold">
                  전체 참여자 ({all.length}명)
                </div>
                <ul className="space-y-1">
                  {all.map((m) => (
                    <MemberRow key={m.user_id} m={m} meId={meId} dmBusy={dmBusy} onDm={handleDm} />
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
        <div className="sm:hidden h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}

function MemberRow({
  m,
  meId,
  dmBusy,
  onDm,
}: {
  m: Member;
  meId?: string | null;
  dmBusy: string | null;
  onDm: (userId: string) => void;
}) {
  const isMe = m.user_id === meId;
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <div className="relative shrink-0">
        <div className="w-9 h-9 rounded-full bg-nu-ink/5 overflow-hidden">
          {m.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.avatar_url} alt={m.nickname} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-nu-pink/40 to-nu-blue/40 text-white text-[13px] font-bold flex items-center justify-center">
              {m.nickname.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        {m.online === true && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[13px] text-nu-ink truncate">{m.nickname}</span>
          {m.role === "host" && (
            <span className="text-[9px] font-mono-nu uppercase tracking-widest text-nu-pink px-1 py-0.5 bg-nu-pink/10 rounded">
              HOST
            </span>
          )}
          {isMe && <span className="text-[10px] text-nu-muted">· 나</span>}
        </div>
        {m.job_title && (
          <div className="text-[10px] font-mono-nu uppercase tracking-widest text-nu-muted truncate">
            {m.job_title}
          </div>
        )}
      </div>
      {!isMe && (
        <button
          onClick={() => onDm(m.user_id)}
          disabled={dmBusy === m.user_id}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-nu-pink border border-nu-pink/30 rounded-full hover:bg-nu-pink hover:text-white disabled:opacity-40 transition-colors"
          title="1:1 대화"
        >
          {dmBusy === m.user_id ? <Loader2 size={10} className="animate-spin" /> : <MessageSquare size={10} />}
          1:1
        </button>
      )}
    </li>
  );
}
