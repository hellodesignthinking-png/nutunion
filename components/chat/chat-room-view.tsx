"use client";

/**
 * ChatRoomView — 선택된 방의 메시지 타임라인 + 입력창.
 *
 * 성능 최적화 포인트:
 *  - 초기 로드: room meta + messages 병렬 fetch
 *  - Realtime INSERT: payload + 로컬 profile 캐시로 추가 쿼리 없음
 *  - last_read_at: 2초 debounce (쓰기 폭주 방지)
 *  - scrollIntoView: 긴 목록에선 instant (smooth 비용 방지)
 *
 * Realtime:
 *  - chat_messages INSERT/UPDATE/DELETE 구독
 *  - Presence 로 접속자 추적
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { toastErrorOnce } from "@/lib/chat/toast-dedupe";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  X,
  CornerUpLeft,
} from "lucide-react";
import { MsgBubble, type Msg } from "./msg-bubble";
import { ThreadPanel } from "./thread-panel";
import { ChatErrorBoundary } from "./chat-error-boundary";
import { ChatHeader } from "./chat-header";
import { ChatInputBar } from "./chat-input-bar";
import { PinnedBanner } from "./pinned-banner";
import { RoomMembersSheet } from "./room-members-sheet";
import { useChatFontSize } from "@/lib/chat/chat-prefs";
import { sameMinute, dayLabel } from "@/lib/chat/chat-format";

interface PresenceUser {
  user_id: string;
  nickname?: string;
  avatar_url?: string | null;
}

interface Props {
  roomId: string;
  onBack?: () => void;
  onMessage?: () => void;
  /** 부모 패널이 이미 헤더를 제공할 때 (chat-dock-panel) → 내부 헤더 숨김 */
  embedded?: boolean;
  /** 부모가 높이를 제어할 때 (h-full 로 부모 맞춤) */
  fullHeight?: boolean;
}

/** 기본 export — ErrorBoundary 로 감싼 버전. 내부 예외 시 앱 전체 중단 방지. */
export function ChatRoomView(props: Props) {
  return (
    <ChatErrorBoundary resetKey={props.roomId}>
      <ChatRoomViewInner {...props} />
    </ChatErrorBoundary>
  );
}

function ChatRoomViewInner({ roomId, onBack, onMessage, embedded = false, fullHeight = false }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [fontSize, setFontSizePref] = useChatFontSize();
  // P2-10 가상 스크롤: 렌더 윈도우 상한 (기본 200, 사용자가 "이전 더보기" 누르면 200씩 증가)
  const [renderWindow, setRenderWindow] = useState(200);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreServer, setHasMoreServer] = useState(true);
  const [stickyBottom, setStickyBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // textarea ref는 ChatInputBar 내부에서 관리 — 외부에서 focus 필요할 때만 이벤트로
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const meIdRef = useRef<string | null>(null);
  const profileCacheRef = useRef<Map<string, { id: string; nickname: string; avatar_url?: string | null }>>(new Map());
  const readUpdateTimerRef = useRef<number | null>(null);

  // last_read_at 갱신
  //  - immediate=true: 방 열림·focus 시 즉시 호출 → 목록 badge 즉시 해제
  //  - immediate=false: 메시지 수신 시 2초 debounce (쓰기 폭주 방지)
  //  호출 후 onMessage 트리거 → 부모 목록 re-fetch 로 unread_count 반영
  const markAsRead = useCallback(
    async (immediate = false) => {
      const run = async () => {
        const myId = meIdRef.current;
        if (!myId) return;
        try {
          await fetch(`/api/chat/rooms/${roomId}/read`, { method: "POST" });
        } catch {}
        onMessage?.();
      };
      if (immediate) {
        if (readUpdateTimerRef.current) window.clearTimeout(readUpdateTimerRef.current);
        await run();
      } else {
        if (readUpdateTimerRef.current) window.clearTimeout(readUpdateTimerRef.current);
        readUpdateTimerRef.current = window.setTimeout(run, 2000);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId],
  );
  const scheduleReadUpdate = useCallback(() => markAsRead(false), [markAsRead]);

  // 초기 로드 + Realtime 구독
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        setMeId(auth.user.id);
        meIdRef.current = auth.user.id;
      }

      // 병렬 fetch — room meta + messages 동시에
      const [metaRes, msgRes] = await Promise.all([
        fetch(`/api/chat/rooms/${roomId}`, { cache: "no-store" }).catch(() => null),
        fetch(`/api/chat/rooms/${roomId}/messages?limit=50`, { cache: "no-store" }),
      ]);

      if (!cancelled) {
        if (metaRes?.ok) {
          const metaJson = await metaRes.json();
          if (metaJson.room) setRoomInfo(metaJson.room);
        }
        const json = await msgRes.json();
        const msgs = (json.messages || []) as Msg[];
        setMessages(msgs);
        const tm = msgs.find((m) => m.total_members !== undefined)?.total_members ?? 0;
        setTotalMembers(tm);
        // 로컬 profile 캐시 초기화
        for (const m of msgs) {
          if (m.sender) profileCacheRef.current.set(m.sender.id, m.sender);
        }
        setLoading(false);
        // 방이 열리자마자 즉시 read 갱신 → 목록 배지 제거
        markAsRead(true);
      }
    })();

    // Realtime — 고유 채널 이름으로 중복 구독 방지
    const channelName = `chat-room-${roomId}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: "user_id" } },
    });

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const m = payload.new as any;
          // 캐시에서 sender 우선 → 없으면 API 로 조회 (RLS 우회 - service_role 경유)
          let sender = profileCacheRef.current.get(m.sender_id);
          if (!sender) {
            try {
              const res = await fetch(`/api/profiles/${m.sender_id}`, { cache: "force-cache" });
              if (res.ok) {
                const data = await res.json();
                if (data?.id) {
                  sender = { id: data.id, nickname: data.nickname, avatar_url: data.avatar_url };
                  profileCacheRef.current.set(m.sender_id, sender!);
                }
              }
            } catch {}
            // fallback: supabase 직접 — RLS 허용 시
            if (!sender) {
              const { data } = await supabase
                .from("profiles")
                .select("id, nickname, avatar_url")
                .eq("id", m.sender_id)
                .maybeSingle();
              if (data) {
                sender = data as any;
                profileCacheRef.current.set(m.sender_id, data as any);
              }
            }
          }
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            const tempIdx = prev.findIndex(
              (x) =>
                (x as any)._temp &&
                x.sender_id === m.sender_id &&
                (x.content || "") === (m.content || "") &&
                (x.attachment_url || null) === (m.attachment_url || null),
            );
            if (tempIdx >= 0) {
              const next = [...prev];
              next[tempIdx] = { ...m, sender: sender || null, unread_count: 0, total_members: totalMembers } as Msg;
              return next;
            }
            return [...prev, { ...m, sender: sender || null, unread_count: 0, total_members: totalMembers } as Msg];
          });
          onMessage?.();

          // 다른 사람 메시지면 — 방이 포커스 상태이므로 즉시 read 갱신
          // (bot 시야 밖일 수도 있지만 방을 열어둔 상태면 "읽음"으로 간주해도 안전)
          const myId = meIdRef.current;
          if (myId && m.sender_id !== myId) {
            if (typeof document !== "undefined" && !document.hidden) {
              markAsRead(true);
            } else {
              scheduleReadUpdate();
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const m = payload.new as any;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, content: m.content, edited_at: m.edited_at } : x)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const m = payload.old as any;
          setMessages((prev) => prev.filter((x) => x.id !== m.id));
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, PresenceUser[]>;
        const list: PresenceUser[] = [];
        for (const key in state) {
          const first = state[key]?.[0];
          if (first) list.push(first);
        }
        setOnlineUsers(list);
      });

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("nickname, avatar_url")
        .eq("id", me.user.id)
        .maybeSingle();
      await channel.track({
        user_id: me.user.id,
        nickname: (p as any)?.nickname || "익명",
        avatar_url: (p as any)?.avatar_url || null,
      });
    });

    return () => {
      cancelled = true;
      if (readUpdateTimerRef.current) window.clearTimeout(readUpdateTimerRef.current);
      // P1-5: profile 캐시 정리 (roomId 전환 시 메모리 누적 방지)
      profileCacheRef.current.clear();
      // P1-6: 명시적 unsubscribe → removeChannel 순서
      channel.unsubscribe().catch(() => {});
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // P1-4: 메시지 추가 시 스크롤 — rAF 로 DOM 리플로우 후 측정
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (nearBottom || loading || stickyBottom) {
        el.scrollTop = el.scrollHeight;
        setNewCount(0);
      } else if (messages.length > 0) {
        // 위를 보고 있는 동안 새 메시지 도착 → 카운터 증가
        setNewCount((c) => c + 1);
      }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, loading]);

  // 스크롤 위치에 따라 stickyBottom 토글
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      setStickyBottom(nearBottom);
      if (nearBottom) setNewCount(0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setNewCount(0);
    setStickyBottom(true);
  }, []);

  // 창 포커스 복귀 시 → 즉시 read 갱신 (back 에서 돌아온 뒤 배지 정리)
  useEffect(() => {
    const onFocus = () => markAsRead(true);
    const onVis = () => {
      if (!document.hidden) markAsRead(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [markAsRead]);

  // P2-10 고도화: adaptive renderWindow — 맨 아래에 있고 messages 수가 폭증하면
  // 오래된 메시지를 자동으로 DOM 에서 제거해 렌더 비용 억제 (최소 200개 유지)
  useEffect(() => {
    if (messages.length < 600) return;
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom && renderWindow > 200) {
      setRenderWindow(200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // textarea auto-grow 는 ChatInputBar 가 자체적으로 처리

  // P2-9: Escape 키로 첨부 시트/설정 닫기
  useEffect(() => {
    if (!showAttachMenu && !showSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showAttachMenu) setShowAttachMenu(false);
      if (showSettings) setShowSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAttachMenu, showSettings]);

  async function send() {
    if (!draft.trim() || sending) return;
    const text = draft.trim();
    const replyId = replyTo?.id || null;
    const myId = meIdRef.current || meId;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const optimistic: Msg = {
      id: tempId,
      room_id: roomId,
      sender_id: myId || "",
      content: text,
      reply_to: replyId,
      created_at: new Date().toISOString(),
      sender: myId ? profileCacheRef.current.get(myId) || { id: myId, nickname: "", avatar_url: null } : null,
      reactions: [],
      unread_count: 0,
      total_members: totalMembers,
      ...{ _temp: true, _pending: true },
    } as any;
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setReplyTo(null);
    setSending(true);

    try {
      const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, reply_to: replyId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "전송 실패");
      if (data?.message?.id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? ({ ...m, ...data.message, _temp: false, _pending: false } as any) : m,
          ),
        );
      }
      onMessage?.();
    } catch (err: any) {
      toast.error(err.message || "전송 실패");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      if (replyId) setReplyTo(messages.find((m) => m.id === replyId) || null);
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(messageId: string) {
    if (!confirm("이 메시지를 삭제하시겠습니까?")) return;
    const before = messages;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    try {
      const res = await fetch(`/api/chat/messages/${messageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "삭제 실패");
    } catch (err: any) {
      toast.error(err.message);
      setMessages(before);
    }
  }

  function startEditing(m: Msg) {
    setEditingId(m.id);
    setEditDraft(m.content || "");
  }

  async function saveEdit() {
    if (!editingId) return;
    const id = editingId;
    const content = editDraft.trim();
    if (!content) {
      setEditingId(null);
      return;
    }
    setEditingId(null);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content, edited_at: new Date().toISOString() } : m)));
    try {
      const res = await fetch(`/api/chat/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "수정 실패");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    try {
      await fetch(`/api/chat/messages/${messageId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const list = m.reactions || [];
          const existsIdx = list.findIndex((r) => r.emoji === emoji && r.user_id === meId);
          if (existsIdx >= 0) {
            return { ...m, reactions: list.filter((_, i) => i !== existsIdx) };
          }
          return { ...m, reactions: [...list, { emoji, user_id: meId || "" }] };
        }),
      );
    } catch {
      toastErrorOnce("리액션 실패", "reaction-fail");
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadProgress(0);
    try {
      const { uploadFile: upload } = await import("@/lib/storage/upload-client");
      const result = await upload(file, {
        prefix: "chat",
        scopeId: roomId,
        onProgress: (pct) => setUploadProgress(pct),
      });

      const res = await fetch(`/api/chat/rooms/${roomId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.url,
          name: result.name,
          mime: result.mime,
          size: result.size,
          storage_type: result.storage,
          storage_key: result.key,
        }),
      });

      const rawText = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(rawText);
      } catch {
        json = { error: rawText.slice(0, 200) };
      }
      if (!res.ok) {
        const detail = [json.error, json.details, json.hint].filter(Boolean).join(" · ");
        throw new Error(detail || `업로드 실패 (${res.status})`);
      }
      if (!json.message) throw new Error("서버 응답에 메시지가 없어요");

      if (json.indexed === "file_attachment") toast.success(`자료실 자동 등록 · ${result.storage.toUpperCase()}`);
      else if (json.indexed === "meeting_note") toast.success("회의록 생성 중 · AI 요약은 잠시 후 완료", { duration: 5000 });
      else toast.success(`업로드 완료 · ${result.storage.toUpperCase()}`);
      onMessage?.();
    } catch (err: any) {
      toast.error(err.message || "업로드 실패");
    } finally {
      setUploading(false);
      setUploadProgress(null);
      setShowAttachMenu(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRecRef.current = rec;
      recChunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && recChunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(recChunksRef.current, { type: mime });
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const file = new File([blob], `recording_${Date.now()}.webm`, { type: mime });
        await uploadFile(file);
      };
      rec.start();
      setRecording(true);
      setShowAttachMenu(false);
    } catch (err: any) {
      toast.error(err?.name === "NotAllowedError" ? "마이크 권한이 필요합니다" : "녹음 시작 실패");
    }
  }

  const headerTitle =
    roomInfo?.type === "dm"
      ? roomInfo?.dm_peer?.nickname || roomInfo?.name || "DM"
      : roomInfo?.type === "nut"
        ? `🥜 ${roomInfo?.group?.name || "너트"}`
        : roomInfo?.type === "bolt"
          ? `🔩 ${roomInfo?.project?.title || "볼트"}`
          : "채팅방";

  const resourceLink =
    roomInfo?.project_id
      ? `/projects/${roomInfo.project_id}`
      : roomInfo?.group_id
        ? `/groups/${roomInfo.group_id}`
        : null;

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.types?.includes("Files")) setDragOver(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDragOver(false);
  }, []);
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);
  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer?.files || []);
      for (const f of files.slice(0, 5)) {
        await uploadFile(f);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roomId],
  );

  // P2-10: 렌더할 메시지 윈도우 — 최근 renderWindow 개만 DOM 에
  const visibleMessages = useMemo(() => {
    if (messages.length <= renderWindow) return messages;
    return messages.slice(messages.length - renderWindow);
  }, [messages, renderWindow]);
  const hiddenCount = messages.length - visibleMessages.length;

  // 서버에서 이전 메시지 페이지 더 가져오기 (before cursor)
  async function loadOlderFromServer() {
    if (loadingMore || !hasMoreServer) return;
    const first = messages[0];
    if (!first) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/chat/rooms/${roomId}/messages?limit=50&before=${encodeURIComponent(first.created_at)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("load failed");
      const json = await res.json();
      const older = (json.messages || []) as Msg[];
      if (older.length === 0) {
        setHasMoreServer(false);
      } else {
        for (const m of older) {
          if (m.sender) profileCacheRef.current.set(m.sender.id, m.sender);
        }
        // 서버 응답은 이미 ascending order 로 reverse 되어 있음
        setMessages((prev) => {
          const existingIds = new Set(prev.map((x) => x.id));
          const merged = [...older.filter((m) => !existingIds.has(m.id)), ...prev];
          return merged;
        });
        // 윈도우도 함께 확장
        setRenderWindow((w) => w + older.length);
      }
    } catch (err) {
      toastErrorOnce("이전 메시지 불러오기 실패", "load-older-fail");
    } finally {
      setLoadingMore(false);
    }
  }

  // 렌더 윈도우만 확장 (이미 로드된 것)
  function expandWindow() {
    setRenderWindow((w) => Math.min(messages.length, w + 200));
  }

  // 날짜 구분선 계산 — 이전 메시지와 날짜가 다르면 표시
  const withSeparators = useMemo(() => {
    const out: Array<{ type: "msg" | "sep"; msg?: Msg; label?: string }> = [];
    let lastDay = "";
    for (const m of visibleMessages) {
      const d = new Date(m.created_at);
      const day = d.toISOString().slice(0, 10);
      if (day !== lastDay) {
        out.push({ type: "sep", label: dayLabel(d) });
        lastDay = day;
      }
      out.push({ type: "msg", msg: m });
    }
    return out;
  }, [visibleMessages]);

  // P2-1: 너트 브랜드 톤의 따뜻한 크림 배경 (기존 카카오 블루그레이 → 너트 시그니처)
  const containerClass = fullHeight
    ? "flex flex-col h-full relative bg-[#FAF6F2] chat-system-font"
    : embedded
      ? "flex flex-col h-full relative bg-[#FAF6F2] chat-system-font"
      : "flex flex-col h-[calc(100dvh-200px)] relative bg-[#FAF6F2] chat-system-font";

  return (
    <div
      className={containerClass}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* 드래그 오버레이 */}
      {dragOver && (
        <div className="absolute inset-0 z-20 bg-nu-pink/10 border-[3px] border-dashed border-nu-pink flex items-center justify-center pointer-events-none">
          <div className="bg-white/95 px-6 py-4 border-[2.5px] border-nu-pink rounded-[var(--ds-radius-lg)] shadow-lg">
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold mb-1">
              여기에 놓아 업로드
            </div>
            <div className="text-[13px] text-nu-ink">사진·파일·녹음 · 최대 5개 한 번에</div>
          </div>
        </div>
      )}

      {/* 헤더 — embedded 면 숨김 (부모 패널이 제공) */}
      {!embedded && (
        <ChatHeader
          title={headerTitle}
          totalMembers={totalMembers}
          onlineUsers={onlineUsers}
          resourceLink={resourceLink}
          onBack={onBack}
          fontSize={fontSize}
          onChangeFontSize={setFontSizePref}
          showSettings={showSettings}
          onToggleSettings={() => setShowSettings((v) => !v)}
          onCloseSettings={() => setShowSettings(false)}
          onOpenMembers={() => setShowMembers(true)}
        />
      )}

      {/* 참여자 시트 */}
      {showMembers && (
        <RoomMembersSheet roomId={roomId} meId={meId} onClose={() => setShowMembers(false)} />
      )}

      {/* 고정 메시지 배너 (공지/중요 pin) */}
      <PinnedBanner roomId={roomId} />

      {/* 메시지 타임라인 — 너트 크림 + 은은한 종이 질감 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-1"
        style={{
          scrollBehavior: "auto",
          backgroundColor: "#FAF6F2",
          backgroundImage:
            "radial-gradient(rgba(13,13,13,0.025) 1px, transparent 1px), radial-gradient(rgba(13,13,13,0.015) 1px, transparent 1px)",
          backgroundSize: "24px 24px, 48px 48px",
          backgroundPosition: "0 0, 12px 12px",
        }}
      >
        {/* P2-10: 이전 메시지 더보기 (로컬 또는 서버 페이지) */}
        {!loading && messages.length > 0 && (hiddenCount > 0 || hasMoreServer) && (
          <div className="flex justify-center py-2">
            <button
              onClick={() => {
                if (hiddenCount > 0) expandWindow();
                else loadOlderFromServer();
              }}
              disabled={loadingMore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-nu-ink/15 rounded-full text-[11px] font-semibold text-nu-graphite hover:bg-nu-ink/5 disabled:opacity-40"
            >
              {loadingMore ? (
                <>
                  <Loader2 size={11} className="animate-spin" /> 불러오는 중…
                </>
              ) : hiddenCount > 0 ? (
                <>↑ 이전 메시지 {hiddenCount > 200 ? "200개 더" : `${hiddenCount}개`}</>
              ) : (
                <>↑ 더 이전 대화 불러오기</>
              )}
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={16} className="animate-spin text-nu-muted" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center py-8 px-6 max-w-sm">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-nu-pink/10 flex items-center justify-center">
                <span className="text-2xl">👋</span>
              </div>
              <div className="font-head text-[16px] font-bold text-nu-ink mb-1">첫 메시지를 보내보세요</div>
              <p className="text-[12px] text-nu-graphite leading-relaxed">
                사진은 <strong>자료실</strong>로, 녹음은 <strong>회의록</strong>으로 자동 저장돼요.
              </p>
            </div>
          </div>
        ) : (
          withSeparators.map((it, i) => {
            if (it.type === "sep") {
              return (
                <div key={`sep-${i}`} className="flex items-center justify-center py-2">
                  <span className="text-[10px] font-mono-nu uppercase tracking-widest text-nu-muted px-2.5 py-0.5 bg-white border border-nu-ink/10 rounded-full">
                    {it.label}
                  </span>
                </div>
              );
            }
            const m = it.msg!;
            const msgsOnly = visibleMessages;
            const idx = msgsOnly.findIndex((x) => x.id === m.id);
            const prev = idx > 0 ? msgsOnly[idx - 1] : null;
            const next = idx < msgsOnly.length - 1 ? msgsOnly[idx + 1] : null;
            const mine = m.sender_id === meId;
            const prevSameSender = prev && prev.sender_id === m.sender_id && !prev.is_system && sameMinute(prev.created_at, m.created_at);
            const nextSameSender = next && next.sender_id === m.sender_id && !next.is_system && sameMinute(m.created_at, next.created_at);
            const showSender = !mine && !prevSameSender;
            // P2-2: 시간 표시 — (a) 연속 발신자의 마지막 메시지이거나 (b) 다음 메시지와 10분 이상 차이
            const gapMin = next
              ? (new Date(next.created_at).getTime() - new Date(m.created_at).getTime()) / 60000
              : Infinity;
            const showTime = !nextSameSender || gapMin >= 10;
            const parent = m.reply_to ? msgsOnly.find((x) => x.id === m.reply_to) : null;
            const isEditing = editingId === m.id;
            return (
              <MsgBubble
                key={m.id}
                msg={m}
                mine={mine}
                showSender={showSender}
                showTime={showTime}
                groupedWithPrev={!!prevSameSender}
                parent={parent || null}
                meId={meId}
                fontSize={fontSize}
                isEditing={isEditing}
                editDraft={editDraft}
                onEditChange={setEditDraft}
                onEditSave={saveEdit}
                onEditCancel={() => setEditingId(null)}
                onReply={() => setReplyTo(m)}
                onReact={(emoji) => toggleReaction(m.id, emoji)}
                onDelete={() => deleteMessage(m.id)}
                onStartEdit={() => startEditing(m)}
                onOpenThread={() => setThreadParentId(m.id)}
                roomGroupId={roomInfo?.group_id || null}
                roomProjectId={roomInfo?.project_id || null}
              />
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* 녹음 상태 */}
      {recording && (
        <div className="px-3 py-2 border-t border-nu-pink/30 bg-nu-pink/10 flex items-center gap-2 text-[12px] text-nu-pink font-bold shrink-0">
          <span className="w-2 h-2 bg-nu-pink rounded-full animate-pulse" />
          녹음 중 · 중지 버튼을 눌러 전송하세요
        </div>
      )}

      {/* 업로드 진행률 */}
      {uploading && (
        <div className="px-3 py-2 border-t border-nu-blue/30 bg-nu-blue/5 shrink-0">
          <div className="flex items-center justify-between text-[11px] font-mono-nu text-nu-blue mb-1">
            <span>업로드 중…</span>
            {uploadProgress !== null && <span className="tabular-nums">{uploadProgress}%</span>}
          </div>
          <div className="h-1 bg-nu-ink/10 rounded-full overflow-hidden">
            <div className="h-full bg-nu-blue transition-all" style={{ width: `${uploadProgress ?? 20}%` }} />
          </div>
        </div>
      )}

      {/* 답글 중 표시 */}
      {replyTo && (
        <div className="px-3 py-2 border-t border-nu-blue/30 bg-nu-blue/5 flex items-start gap-2 text-[12px] shrink-0">
          <CornerUpLeft size={12} className="text-nu-blue mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono-nu text-nu-blue font-bold uppercase tracking-widest">
              답글 · {replyTo.sender?.nickname || "익명"}
            </div>
            <div className="text-nu-graphite truncate">
              {replyTo.content ||
                (replyTo.attachment_type === "image" ? "📷 사진" : replyTo.attachment_type === "audio" ? "🎙️ 녹음" : "📎 파일")}
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} className="shrink-0 p-1 hover:bg-nu-blue/10 rounded text-nu-muted">
            <X size={12} />
          </button>
        </div>
      )}

      {/* 새 메시지 floating 버튼 — 위를 보고 있을 때 새 메시지 도착하면 */}
      {!stickyBottom && newCount > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-[80px] left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 px-4 py-2 bg-nu-pink text-white rounded-full text-[12px] font-bold shadow-lg hover:bg-nu-ink active:scale-95 transition-all animate-slide-up"
          aria-label={`새 메시지 ${newCount}개 아래로`}
        >
          ↓ 새 메시지 {newCount}개
        </button>
      )}

      {/* 입력창 + 카카오톡 스타일 첨부 시트 */}
      <ChatInputBar
        draft={draft}
        setDraft={setDraft}
        onSend={send}
        sending={sending}
        uploading={uploading}
        recording={recording}
        onToggleRecording={toggleRecording}
        onUpload={uploadFile}
        showAttachMenu={showAttachMenu}
        setShowAttachMenu={setShowAttachMenu}
        groupId={roomInfo?.group_id || null}
        projectId={roomInfo?.project_id || null}
      />
      {threadParentId && (
        <ThreadPanel
          parentMessageId={threadParentId}
          meId={meId}
          onClose={() => setThreadParentId(null)}
        />
      )}
    </div>
  );
}
