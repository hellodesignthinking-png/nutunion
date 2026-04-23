"use client";

/**
 * MsgBubble — 단일 채팅 메시지 버블 (memo).
 *
 * - 시스템 메시지 / 일반 메시지 렌더 분기
 * - 답글 미리보기 + 편집 모드 + 리액션 배지
 * - 이미지 / 오디오 / 파일 첨부
 * - Hover 액션 (좋아요/답글/수정/삭제)
 */

import { memo, useMemo, useState } from "react";
import Image from "next/image";
import { FileIcon, Download, Sparkles, FolderOpen, CornerUpLeft, Heart, X, Copy, Check, UserPlus, XCircle, CheckCircle, Briefcase, DollarSign, Megaphone, BarChart3, Pin } from "lucide-react";
import { toast } from "sonner";
import { decodeAction, type ChatAction } from "@/lib/chat/chat-actions";
import { FONT_PX, META_PX, type ChatFontSize } from "@/lib/chat/chat-prefs";
import { timeLabel as formatTimeLabel } from "@/lib/chat/chat-format";
import { ImageLightbox } from "./image-lightbox";
import { AudioWaveform } from "./audio-waveform";
import { UserProfilePopover } from "./user-profile-popover";

export interface Reaction {
  emoji: string;
  user_id: string;
}

export interface Msg {
  id: string;
  room_id: string;
  sender_id: string;
  content?: string | null;
  attachment_url?: string | null;
  attachment_type?: "image" | "file" | "audio" | "video" | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  is_system?: boolean;
  auto_indexed_as?: "file_attachment" | "meeting_note" | null;
  linked_resource_id?: string | null;
  reply_to?: string | null;
  created_at: string;
  edited_at?: string | null;
  sender?: { id: string; nickname: string; avatar_url?: string | null } | null;
  reactions?: Reaction[];
  unread_count?: number;
  total_members?: number;
}

export interface MsgBubbleProps {
  msg: Msg;
  mine: boolean;
  showSender: boolean;
  showTime: boolean;
  groupedWithPrev: boolean;
  parent?: Msg | null;
  meId?: string | null;
  fontSize?: ChatFontSize;
  isEditing?: boolean;
  editDraft?: string;
  onEditChange?: (v: string) => void;
  onEditSave?: () => void;
  onEditCancel?: () => void;
  onReply?: () => void;
  onReact?: (emoji: string) => void;
  onDelete?: () => void;
  onStartEdit?: () => void;
  /** 방의 group/project id — 자동 인덱싱 시스템 메시지의 링크 URL 구성용 */
  roomGroupId?: string | null;
  roomProjectId?: string | null;
}

export const MsgBubble = memo(function MsgBubble({
  msg,
  mine,
  showSender,
  showTime,
  groupedWithPrev,
  parent,
  meId,
  fontSize = "medium",
  isEditing,
  editDraft,
  onEditChange,
  onEditSave,
  onEditCancel,
  onReply,
  onReact,
  onDelete,
  onStartEdit,
  roomGroupId,
  roomProjectId,
}: MsgBubbleProps) {
  const bodyPx = FONT_PX[fontSize];
  const metaPx = META_PX[fontSize];
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const canOpenProfile = !mine && !!msg.sender?.id;

  const copyContent = async () => {
    const text = msg.content || msg.attachment_url || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("복사 실패");
    }
  };

  const reactionArr = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const r of msg.reactions || []) {
      const g = map.get(r.emoji) || { count: 0, mine: false };
      g.count++;
      if (r.user_id === meId) g.mine = true;
      map.set(r.emoji, g);
    }
    return Array.from(map.entries()).map(([emoji, g]) => ({ emoji, ...g }));
  }, [msg.reactions, meId]);

  const timeLabel = useMemo(() => formatTimeLabel(msg.created_at), [msg.created_at]);

  if (msg.is_system) {
    // 액션 페이로드가 포함된 시스템 메시지 → 인터랙티브 카드
    const decoded = decodeAction(msg.content);
    if (decoded) {
      return (
        <div className="flex justify-center" id={`msg-${msg.id}`}>
          <ActionCard action={decoded.action} displayText={decoded.displayText} meId={meId} />
        </div>
      );
    }

    // 자료실 자동 등록 시스템 메시지 → 해당 자료로 점프하는 링크 chip
    // (trigger 090: project_resources INSERT 시 "○○님이 자료실에 '...'을(를) 올렸어요 📎")
    if (msg.auto_indexed_as === "file_attachment" && msg.linked_resource_id) {
      const url =
        roomGroupId
          ? `/groups/${roomGroupId}/resources?focus=${encodeURIComponent(msg.linked_resource_id)}`
          : roomProjectId
            ? `/projects/${roomProjectId}?focus=${encodeURIComponent(msg.linked_resource_id)}`
            : null;
      if (url) {
        return (
          <div className="flex justify-center" id={`msg-${msg.id}`}>
            <a
              href={url}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono-nu text-nu-pink px-3 py-1 bg-nu-pink/10 border border-nu-pink/30 rounded-full no-underline hover:bg-nu-pink/20 transition-colors"
              title="자료실에서 보기"
            >
              <FolderOpen size={11} />
              <span className="truncate max-w-[80vw]">{msg.content || "자료실 자동 등록"}</span>
              <span className="opacity-60">→</span>
            </a>
          </div>
        );
      }
    }

    // 회의록 자동 저장 시스템 메시지 → 회의 상세 페이지 링크
    if (msg.auto_indexed_as === "meeting_note" && msg.linked_resource_id && roomGroupId) {
      return (
        <div className="flex justify-center" id={`msg-${msg.id}`}>
          <a
            href={`/groups/${roomGroupId}/meetings/${msg.linked_resource_id}`}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono-nu text-nu-blue px-3 py-1 bg-nu-blue/10 border border-nu-blue/30 rounded-full no-underline hover:bg-nu-blue/20 transition-colors"
            title="회의록 열기"
          >
            <Sparkles size={11} />
            <span className="truncate max-w-[80vw]">{msg.content || "회의록 자동 저장"}</span>
            <span className="opacity-60">→</span>
          </a>
        </div>
      );
    }

    return (
      <div className="flex justify-center" id={`msg-${msg.id}`}>
        <span className="text-[10px] font-mono-nu text-nu-muted px-2.5 py-0.5 bg-nu-ink/5 rounded-full">
          {msg.content || ""}
        </span>
      </div>
    );
  }

  const bubbleRadius = mine
    ? `rounded-2xl ${groupedWithPrev ? "rounded-tr-md" : ""} rounded-br-md`
    : `rounded-2xl ${groupedWithPrev ? "rounded-tl-md" : ""} rounded-bl-md`;

  return (
    <div
      id={`msg-${msg.id}`}
      className={`flex gap-2 group ${mine ? "flex-row-reverse" : "flex-row"} ${groupedWithPrev ? "mt-0.5" : "mt-2"}`}
    >
      {!mine && (
        <div className="shrink-0 w-8 h-8">
          {showSender ? (
            canOpenProfile ? (
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="w-8 h-8 rounded-full overflow-hidden hover:ring-2 hover:ring-nu-pink/40 transition-all"
                aria-label={`${msg.sender?.nickname || "사용자"} 프로필`}
              >
                {msg.sender?.avatar_url ? (
                  <Image
                    src={msg.sender.avatar_url}
                    alt=""
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover border border-nu-ink/10"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nu-pink/40 to-nu-blue/40 text-white text-[12px] font-bold flex items-center justify-center">
                    {(msg.sender?.nickname || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
            ) : msg.sender?.avatar_url ? (
              <Image
                src={msg.sender.avatar_url}
                alt=""
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover border border-nu-ink/10"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nu-pink/40 to-nu-blue/40 text-white text-[12px] font-bold flex items-center justify-center">
                {(msg.sender?.nickname || "?").charAt(0).toUpperCase()}
              </div>
            )
          ) : (
            <div className="w-8 h-8" />
          )}
        </div>
      )}
      <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
        {showSender && !mine && (
          canOpenProfile ? (
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="font-medium text-nu-graphite px-1 mb-0.5 hover:text-nu-pink transition-colors text-left"
              style={{ fontSize: metaPx + "px" }}
            >
              {msg.sender?.nickname || "익명"}
            </button>
          ) : (
            <span
              className="font-medium text-nu-graphite px-1 mb-0.5"
              style={{ fontSize: metaPx + "px" }}
            >
              {msg.sender?.nickname || "익명"}
            </span>
          )
        )}
        <div className={`flex items-end gap-1 ${mine ? "flex-row-reverse" : "flex-row"}`}>
          <div
            className={`relative px-3.5 py-2 leading-[1.45] break-words shadow-sm ${bubbleRadius} ${
              mine ? "bg-nu-pink text-white" : "bg-white text-nu-ink border border-nu-ink/10"
            }`}
            style={{ fontSize: bodyPx + "px" }}
          >
            {parent && (
              <button
                type="button"
                onClick={() => {
                  document.getElementById(`msg-${parent.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className={`block w-full text-left mb-1.5 px-2 py-1 rounded-md border-l-[2px] text-[11px] leading-tight ${
                  mine ? "bg-white/15 border-white/60 text-white/90" : "bg-nu-ink/5 border-nu-ink/30 text-nu-graphite"
                }`}
              >
                <div className={`font-mono-nu text-[9px] uppercase tracking-widest ${mine ? "text-white/70" : "text-nu-muted"}`}>
                  ↳ {parent.sender?.nickname || "익명"}
                </div>
                <div className="truncate max-w-full">
                  {parent.content ||
                    (parent.attachment_type === "image" ? "📷 사진" : parent.attachment_type === "audio" ? "🎙️ 녹음" : "📎 파일")}
                </div>
              </button>
            )}

            {isEditing ? (
              <div className="min-w-[200px]">
                <textarea
                  value={editDraft || ""}
                  onChange={(e) => onEditChange?.(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onEditSave?.();
                    }
                    if (e.key === "Escape") onEditCancel?.();
                  }}
                  autoFocus
                  rows={2}
                  className="w-full px-2 py-1 text-nu-ink bg-white border border-nu-ink/20 rounded text-[13px] resize-y"
                />
                <div className="flex items-center gap-1 mt-1 text-[10px] font-mono-nu">
                  <button onClick={onEditSave} className="px-2 py-0.5 bg-nu-ink text-white rounded">저장</button>
                  <button onClick={onEditCancel} className="px-2 py-0.5 border border-nu-ink/20 rounded">취소</button>
                </div>
              </div>
            ) : (
              msg.content && <div className="whitespace-pre-wrap">{msg.content}</div>
            )}
            {msg.edited_at && !isEditing && (
              <span className={`text-[9px] ml-1 font-mono-nu italic ${mine ? "text-white/60" : "text-nu-muted"}`}>· 수정됨</span>
            )}
            {msg.attachment_url && msg.attachment_type === "image" && (
              <>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="block mt-1 -mx-1 p-0 bg-transparent border-0 cursor-zoom-in"
                  aria-label="이미지 확대 보기"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={msg.attachment_url}
                    alt={msg.attachment_name || ""}
                    className="rounded-lg max-w-full max-h-72 object-cover"
                    loading="lazy"
                  />
                </button>
                {lightboxOpen && (
                  <ImageLightbox
                    src={msg.attachment_url}
                    alt={msg.attachment_name || ""}
                    onClose={() => setLightboxOpen(false)}
                  />
                )}
              </>
            )}
            {msg.attachment_url && msg.attachment_type === "audio" && (
              <AudioWaveform src={msg.attachment_url} mine={mine} />
            )}
            {msg.attachment_url && msg.attachment_type === "file" && (
              <a
                href={msg.attachment_url}
                target="_blank"
                rel="noopener"
                className={`mt-1 inline-flex items-center gap-2 no-underline px-2 py-1 rounded-md ${
                  mine ? "bg-white/15 text-white" : "bg-nu-ink/5 text-nu-ink"
                }`}
              >
                <FileIcon size={14} />
                <span className="underline">{msg.attachment_name || "파일"}</span>
                <Download size={12} className="opacity-60" />
              </a>
            )}
            {msg.auto_indexed_as && (() => {
              const href =
                msg.auto_indexed_as === "file_attachment" && msg.linked_resource_id
                  ? (roomGroupId
                      ? `/groups/${roomGroupId}/resources?focus=${encodeURIComponent(msg.linked_resource_id)}`
                      : roomProjectId
                        ? `/projects/${roomProjectId}?focus=${encodeURIComponent(msg.linked_resource_id)}`
                        : null)
                  : msg.auto_indexed_as === "meeting_note" && msg.linked_resource_id && roomGroupId
                    ? `/groups/${roomGroupId}/meetings/${msg.linked_resource_id}`
                    : null;
              const label =
                msg.auto_indexed_as === "file_attachment"
                  ? (<><FolderOpen size={9} /> 자료실 자동 등록 {href && <span className="opacity-70">→</span>}</>)
                  : (<><Sparkles size={9} /> 회의록 자동 저장 {href && <span className="opacity-70">→</span>}</>);
              const cls = `mt-1 text-[10px] font-mono-nu uppercase tracking-widest inline-flex items-center gap-1 ${
                mine ? "text-white/70" : "text-nu-graphite"
              } ${href ? "hover:underline cursor-pointer" : ""}`;
              return href ? (
                <a href={href} className={cls + " no-underline"}>{label}</a>
              ) : (
                <div className={cls}>{label}</div>
              );
            })()}

            {/* Hover 액션 */}
            <div
              className={`absolute -top-3 ${mine ? "left-0 -translate-x-full pl-0 pr-2" : "right-0 translate-x-full pr-0 pl-2"} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10`}
            >
              <div className="pointer-events-auto flex items-center gap-0.5 bg-white border border-nu-ink/15 rounded-full p-0.5 shadow-md">
                <button onClick={() => onReact?.("❤️")} className="p-1 hover:bg-nu-pink/10 rounded-full text-nu-pink" title="좋아요">
                  <Heart size={11} />
                </button>
                <button onClick={() => onReact?.("👍")} className="px-1 hover:bg-nu-ink/5 rounded-full text-[12px]">👍</button>
                <button onClick={() => onReact?.("😂")} className="px-1 hover:bg-nu-ink/5 rounded-full text-[12px]">😂</button>
                <button onClick={onReply} className="p-1 hover:bg-nu-ink/5 rounded-full text-nu-graphite" title="답글">
                  <CornerUpLeft size={11} />
                </button>
                {(msg.content || msg.attachment_url) && (
                  <button onClick={copyContent} className="p-1 hover:bg-nu-ink/5 rounded-full text-nu-graphite" title="복사">
                    {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                  </button>
                )}
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/chat/rooms/${msg.room_id}/pins`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ message_id: msg.id }),
                      });
                      if (res.status === 501) {
                        toast.error("091 마이그레이션 실행 후 사용 가능");
                        return;
                      }
                      if (!res.ok) throw new Error((await res.json()).error || "실패");
                      toast.success("고정됨 📌");
                    } catch (e: any) {
                      toast.error(e.message || "고정 실패");
                    }
                  }}
                  className="p-1 hover:bg-nu-ink/5 rounded-full text-nu-graphite"
                  title="상단 고정"
                >
                  <Pin size={11} />
                </button>
                {mine && onStartEdit && (
                  <button onClick={onStartEdit} className="p-1 hover:bg-nu-ink/5 rounded-full text-nu-graphite text-[10px]" title="수정">✏</button>
                )}
                {mine && onDelete && (
                  <button onClick={onDelete} className="p-1 hover:bg-red-100 rounded-full text-red-600" title="삭제">
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 시간 + 읽음 */}
          {showTime && (
            <div className={`flex flex-col items-${mine ? "end" : "start"} gap-0 pb-0.5 shrink-0`}>
              {mine && !(msg as any)._pending && (msg.unread_count || 0) > 0 && (msg.total_members || 0) > 1 && (
                <span
                  className="font-head text-[10px] font-extrabold text-[#FFCC00] tabular-nums leading-none"
                  title={`안 읽은 사람 ${msg.unread_count}명`}
                >
                  {msg.unread_count}
                </span>
              )}
              {(msg as any)._pending ? (
                <span className="text-[9px] font-mono-nu text-nu-muted italic leading-none">전송중</span>
              ) : (
                <span className="text-[10px] font-mono-nu text-nu-muted tabular-nums leading-none" suppressHydrationWarning>
                  {timeLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 프로필 팝오버 */}
        {profileOpen && msg.sender?.id && (
          <UserProfilePopover
            userId={msg.sender.id}
            nickname={msg.sender.nickname}
            avatarUrl={msg.sender.avatar_url}
            onClose={() => setProfileOpen(false)}
          />
        )}

        {/* 리액션 배지 */}
        {reactionArr.length > 0 && (
          <div className={`flex items-center gap-1 mt-1 flex-wrap ${mine ? "justify-end" : "justify-start"}`}>
            {reactionArr.map(({ emoji, count, mine: reactedByMe }) => (
              <button
                key={emoji}
                onClick={() => onReact?.(emoji)}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors ${
                  reactedByMe
                    ? "border-nu-pink bg-nu-pink/10 text-nu-ink"
                    : "border-nu-ink/15 bg-white hover:bg-nu-cream/40 text-nu-graphite"
                }`}
              >
                <span>{emoji}</span>
                <span className="font-mono-nu tabular-nums text-[10px]">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ─── ActionCard — 시스템 메시지에 인터랙티브 카드 (승인/거절 등) ───

function ActionCard({
  action,
  displayText,
  meId,
}: {
  action: ChatAction;
  displayText: string;
  meId?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState<"approved" | "rejected" | null>(null);

  if (action.type === "join_request") {
    const isHost = meId === action.host_id;
    const handle = async (act: "approve" | "reject") => {
      if (busy || resolved) return;
      setBusy(true);
      try {
        const res = await fetch(
          `/api/groups/${action.group_id}/members/${action.applicant_id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: act }),
          },
        );
        if (!res.ok) throw new Error((await res.json()).error || "실패");
        setResolved(act === "approve" ? "approved" : "rejected");
        toast.success(act === "approve" ? "가입 승인됨" : "가입 거절됨");
      } catch (e: any) {
        toast.error(e.message || "처리 실패");
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="flex flex-col gap-2 px-4 py-3 bg-white border border-nu-ink/15 rounded-xl shadow-sm max-w-sm">
        <div className="flex items-center gap-2">
          <UserPlus size={15} className="text-nu-pink shrink-0" />
          <span className="text-[13px] font-bold text-nu-ink">가입 신청</span>
        </div>
        <p className="text-[13px] text-nu-graphite leading-snug">{displayText}</p>
        {resolved === "approved" && (
          <div className="flex items-center gap-1.5 text-[12px] text-green-700 font-semibold">
            <CheckCircle size={14} /> 승인 완료
          </div>
        )}
        {resolved === "rejected" && (
          <div className="flex items-center gap-1.5 text-[12px] text-nu-muted font-semibold">
            <XCircle size={14} /> 거절됨
          </div>
        )}
        {isHost && !resolved && (
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => handle("approve")}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-nu-pink text-white rounded-full text-[12px] font-bold hover:bg-nu-ink disabled:opacity-40 transition-colors"
            >
              <CheckCircle size={12} /> 승인
            </button>
            <button
              onClick={() => handle("reject")}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 border border-nu-ink/20 text-nu-graphite rounded-full text-[12px] font-bold hover:bg-nu-ink/5 disabled:opacity-40 transition-colors"
            >
              <XCircle size={12} /> 거절
            </button>
          </div>
        )}
        {!isHost && !resolved && (
          <div className="text-[11px] text-nu-muted">호스트가 승인하면 알림을 받아요</div>
        )}
      </div>
    );
  }

  // 볼트 지원서 승인 카드
  if (action.type === "project_application") {
    const isLead = meId === action.lead_id;
    const handle = async (act: "approve" | "reject") => {
      if (busy || resolved) return;
      setBusy(true);
      try {
        const res = await fetch(
          `/api/projects/${action.project_id}/applications/${action.applicant_id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: act }),
          },
        );
        if (!res.ok) throw new Error((await res.json()).error || "실패");
        setResolved(act === "approve" ? "approved" : "rejected");
        toast.success(act === "approve" ? "지원 승인됨" : "지원 거절됨");
      } catch (e: any) {
        toast.error(e.message || "처리 실패");
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="flex flex-col gap-2 px-4 py-3 bg-white border border-nu-ink/15 rounded-xl shadow-sm max-w-sm">
        <div className="flex items-center gap-2">
          <Briefcase size={15} className="text-nu-blue shrink-0" />
          <span className="text-[13px] font-bold text-nu-ink">볼트 지원서</span>
        </div>
        <p className="text-[13px] text-nu-graphite leading-snug">{displayText}</p>
        {resolved === "approved" && (
          <div className="flex items-center gap-1.5 text-[12px] text-green-700 font-semibold">
            <CheckCircle size={14} /> 승인 완료
          </div>
        )}
        {resolved === "rejected" && (
          <div className="flex items-center gap-1.5 text-[12px] text-nu-muted font-semibold">
            <XCircle size={14} /> 거절됨
          </div>
        )}
        {isLead && !resolved && (
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => handle("approve")}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-nu-blue text-white rounded-full text-[12px] font-bold hover:bg-nu-ink disabled:opacity-40 transition-colors"
            >
              <CheckCircle size={12} /> 승인
            </button>
            <button
              onClick={() => handle("reject")}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 border border-nu-ink/20 text-nu-graphite rounded-full text-[12px] font-bold hover:bg-nu-ink/5 disabled:opacity-40 transition-colors"
            >
              <XCircle size={12} /> 거절
            </button>
          </div>
        )}
        {!isLead && !resolved && (
          <div className="text-[11px] text-nu-muted">리더 검토 대기 중</div>
        )}
      </div>
    );
  }

  // 정산/결제 승인 대기 카드 (영수증 inline 미리보기 포함)
  if (action.type === "payment_pending") {
    const receiptUrl = (action as any).receipt_url as string | null | undefined;
    const receiptMime = (action as any).receipt_mime as string | null | undefined;
    const receiptMemo = (action as any).memo as string | null | undefined;
    const isImage = receiptUrl
      ? /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(receiptUrl) || receiptMime?.startsWith?.("image/")
      : false;
    const isPdf = receiptUrl
      ? /\.pdf$/i.test(receiptUrl) || receiptMime?.includes?.("pdf")
      : false;
    const handle = async (act: "approve" | "reject") => {
      if (busy || resolved) return;
      setBusy(true);
      try {
        const res = await fetch(
          `/api/finance/settlements/${action.settlement_id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: act }),
          },
        );
        if (!res.ok) throw new Error((await res.json()).error || "실패");
        setResolved(act === "approve" ? "approved" : "rejected");
        toast.success(act === "approve" ? "정산 승인됨" : "정산 거절됨");
      } catch (e: any) {
        toast.error(e.message || "처리 실패");
      } finally {
        setBusy(false);
      }
    };
    const amountLabel = `${action.amount.toLocaleString()} ${action.currency || "KRW"}`;
    return (
      <div className="flex flex-col gap-2 px-4 py-3 bg-white border border-nu-ink/15 rounded-xl shadow-sm max-w-sm">
        <div className="flex items-center gap-2">
          <DollarSign size={15} className="text-[#22C55E] shrink-0" />
          <span className="text-[13px] font-bold text-nu-ink">정산 승인 대기</span>
        </div>
        <p className="text-[13px] text-nu-graphite leading-snug">{displayText}</p>
        <div className="font-mono tabular-nums text-[15px] font-bold text-nu-ink bg-[#22C55E]/10 px-3 py-1.5 rounded-md">
          {amountLabel}
        </div>
        {receiptMemo && (
          <p className="text-[12px] text-nu-graphite italic border-l-2 border-nu-ink/10 pl-2">
            📝 {receiptMemo}
          </p>
        )}
        {receiptUrl && (
          <div className="mt-1 border border-nu-ink/10 rounded-lg overflow-hidden bg-nu-ink/5">
            {isImage ? (
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptUrl}
                  alt="영수증"
                  className="w-full max-h-56 object-contain bg-white"
                  loading="lazy"
                />
              </a>
            ) : isPdf ? (
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-[12px] text-nu-ink no-underline hover:bg-nu-ink/5"
              >
                <FileIcon size={14} className="text-red-600" />
                <span className="flex-1 truncate">영수증 PDF</span>
                <Download size={12} className="opacity-60" />
              </a>
            ) : (
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-[12px] text-nu-ink no-underline hover:bg-nu-ink/5"
              >
                <FileIcon size={14} />
                <span className="flex-1 truncate">영수증 파일</span>
                <Download size={12} className="opacity-60" />
              </a>
            )}
          </div>
        )}
        {resolved === "approved" && (
          <div className="flex items-center gap-1.5 text-[12px] text-green-700 font-semibold">
            <CheckCircle size={14} /> 정산 승인 완료
          </div>
        )}
        {resolved === "rejected" && (
          <div className="flex items-center gap-1.5 text-[12px] text-nu-muted font-semibold">
            <XCircle size={14} /> 반려됨
          </div>
        )}
        {!resolved && (
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => handle("approve")}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-[#22C55E] text-white rounded-full text-[12px] font-bold hover:bg-nu-ink disabled:opacity-40 transition-colors"
            >
              <CheckCircle size={12} /> 승인
            </button>
            <button
              onClick={() => handle("reject")}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 border border-nu-ink/20 text-nu-graphite rounded-full text-[12px] font-bold hover:bg-nu-ink/5 disabled:opacity-40 transition-colors"
            >
              <XCircle size={12} /> 반려
            </button>
          </div>
        )}
      </div>
    );
  }

  // 공지 카드 — severity 별 색상 차등
  if ((action as any).type === "announcement") {
    const severity = (action as any).severity || "info";
    const theme = {
      info: {
        bg: "bg-nu-pink/10",
        border: "border-nu-pink",
        text: "text-nu-pink",
        label: "공지",
        pulse: "",
      },
      warning: {
        bg: "bg-amber-100",
        border: "border-amber-500",
        text: "text-amber-700",
        label: "⚠ 중요",
        pulse: "",
      },
      urgent: {
        bg: "bg-red-100",
        border: "border-red-600",
        text: "text-red-700",
        label: "🚨 긴급",
        pulse: "animate-pulse",
      },
    }[severity as "info" | "warning" | "urgent"] || {
      bg: "bg-nu-pink/10",
      border: "border-nu-pink",
      text: "text-nu-pink",
      label: "공지",
      pulse: "",
    };
    return (
      <div className={`flex flex-col gap-2 px-4 py-3 ${theme.bg} border-l-4 ${theme.border} rounded-md max-w-lg ${theme.pulse}`}>
        <div className="flex items-center gap-2">
          <Megaphone size={15} className={`${theme.text} shrink-0`} />
          <span className={`text-[12px] font-mono-nu uppercase tracking-widest font-bold ${theme.text}`}>
            {theme.label}
          </span>
        </div>
        <p className="text-[14px] text-nu-ink leading-relaxed whitespace-pre-wrap font-semibold">
          {displayText}
        </p>
      </div>
    );
  }

  // 투표 카드
  if ((action as any).type === "poll") {
    return <PollCard action={action as any} displayText={displayText} />;
  }

  // 미지원 액션 타입은 텍스트로만 표시
  return (
    <span className="text-[11px] text-nu-muted px-3 py-1 bg-nu-ink/5 rounded-full">
      {displayText || "시스템 메시지"}
    </span>
  );
}

// ─── PollCard — 서버 영구 저장 + 실시간 sync ───
import { useEffect as useEff, useState as useSt } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

function PollCard({
  action,
  displayText,
}: {
  action: { type: "poll"; poll_id?: string; question: string; options: string[]; closes_at?: string };
  displayText: string;
}) {
  const hasServer = !!action.poll_id;
  const [counts, setCounts] = useSt<number[]>(() => action.options.map(() => 0));
  const [myChoices, setMyChoices] = useSt<number[]>([]);
  const [busy, setBusy] = useSt(false);
  const [migration, setMigration] = useSt(false);
  const [closed, setClosed] = useSt(false);
  const [closesAt, setClosesAt] = useSt<string | null>(action.closes_at || null);
  const [now, setNow] = useSt<number>(() => Date.now());

  const total = counts.reduce((s, n) => s + n, 0);

  // 1초마다 now tick (마감까지 남은 시간 실시간 표시)
  useEff(() => {
    if (!closesAt || closed) return;
    const i = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(i);
  }, [closesAt, closed]);

  const remainingMs = closesAt ? new Date(closesAt).getTime() - now : 0;
  const locallyClosed = closed || (closesAt && remainingMs <= 0);

  // 서버 데이터 로드 + realtime 구독
  useEff(() => {
    if (!hasServer) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/polls/${action.poll_id}`, { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 501) setMigration(true);
          return;
        }
        const j = await res.json();
        if (cancelled) return;
        if (Array.isArray(j.counts)) setCounts(j.counts);
        if (Array.isArray(j.my_choices)) setMyChoices(j.my_choices);
        if (typeof j.closed === "boolean") setClosed(j.closed);
        if (j.closes_at) setClosesAt(j.closes_at);
      } catch {}
    }
    load();

    const supabase = createSupabaseClient();
    const channelName = `poll-${action.poll_id}-${Math.random().toString(36).slice(2, 6)}`;
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${action.poll_id}` },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [action.poll_id, hasServer]);

  async function vote(idx: number) {
    if (busy || locallyClosed) return;
    // 서버 모드
    if (hasServer && !migration) {
      setBusy(true);
      try {
        const res = await fetch(`/api/polls/${action.poll_id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ option_idx: idx, toggle: true }),
        });
        if (res.status === 501) {
          setMigration(true);
        } else if (res.status === 410) {
          setClosed(true);
          toast.error("마감된 투표입니다");
        } else if (res.ok) {
          const j = await res.json();
          if (Array.isArray(j.counts)) setCounts(j.counts);
          if (Array.isArray(j.my_choices)) setMyChoices(j.my_choices);
          if (typeof j.closed === "boolean") setClosed(j.closed);
        }
      } catch {}
      finally { setBusy(false); }
      return;
    }
    // 로컬 모드 (서버 없거나 마이그 미적용)
    setCounts((prev) => {
      const next = [...prev];
      if (myChoices.includes(idx)) next[idx] = Math.max(0, next[idx] - 1);
      else {
        if (myChoices.length > 0) next[myChoices[0]] = Math.max(0, next[myChoices[0]] - 1);
        next[idx] = next[idx] + 1;
      }
      return next;
    });
    setMyChoices((prev) => (prev.includes(idx) ? [] : [idx]));
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-white border border-nu-ink/15 rounded-xl shadow-sm max-w-md w-full">
      <div className="flex items-center gap-2 flex-wrap">
        <BarChart3 size={15} className="text-[#9333EA] shrink-0" />
        <span className="text-[12px] font-mono-nu uppercase tracking-widest font-bold text-[#9333EA]">
          투표 {hasServer && !migration && !locallyClosed && <span className="ml-1 px-1.5 py-0.5 bg-[#9333EA]/10 text-[#9333EA] text-[9px] rounded-full">LIVE</span>}
        </span>
        {locallyClosed && (
          <span className="px-1.5 py-0.5 bg-nu-ink/10 text-nu-ink text-[9px] font-mono-nu rounded-full">
            🏁 마감
          </span>
        )}
        {closesAt && !locallyClosed && (
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-mono-nu tabular-nums rounded-full">
            ⏰ {formatRemaining(remainingMs)} 남음
          </span>
        )}
      </div>
      <p className="text-[14px] font-bold text-nu-ink leading-snug">{action.question || displayText}</p>
      <div className="space-y-1.5 mt-1">
        {action.options.map((opt, i) => {
          const count = counts[i] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const chosen = myChoices.includes(i);
          return (
            <button
              key={i}
              onClick={() => vote(i)}
              disabled={busy || !!locallyClosed}
              className={`w-full text-left px-3 py-2 rounded-md border transition-colors relative overflow-hidden ${
                chosen ? "border-[#9333EA] bg-[#9333EA]/5" : "border-nu-ink/15 hover:bg-nu-ink/5"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-[#9333EA]/10 transition-all"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between text-[13px]">
                <span className="font-semibold text-nu-ink">
                  {chosen && "✓ "}{opt}
                </span>
                <span className="font-mono tabular-nums text-[12px] text-nu-graphite">
                  {count > 0 && `${count}표 · `}{pct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {total > 0 && (
        <div className="text-[11px] font-mono-nu text-nu-muted text-right">
          총 {total}표 {hasServer && !migration && "· 실시간 집계"}
        </div>
      )}
      {migration && (
        <div className="text-[10px] text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
          ⚠ 091 마이그레이션 실행 후 영구 저장됩니다
        </div>
      )}
    </div>
  );
}

/** 남은 시간 포맷 — "2일 3시간", "15분 20초", "30초" */
function formatRemaining(ms: number): string {
  if (ms <= 0) return "0초";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}일 ${h}시간`;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${sec}초`;
  return `${sec}초`;
}
