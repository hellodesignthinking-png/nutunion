"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Send, Loader2 } from "lucide-react";
import type { ChatMessage } from "@/lib/types";

interface ChatRoomProps {
  roomType: "crew" | "project";
  roomId: string;
  userId: string;
  userNickname: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return new Date(dateStr).toLocaleDateString("ko", { month: "short", day: "numeric" });
}

export function ChatRoom({ roomType, roomId, userId, userNickname }: ChatRoomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Load initial messages
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("chat_messages")
        .select("*, sender:profiles!chat_messages_sender_id_fkey(nickname, avatar_url)")
        .eq("room_type", roomType)
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(100);
      setMessages((data as any[]) || []);
      setLoading(false);
    }
    load();
  }, [roomType, roomId]);

  // Subscribe to realtime
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${roomType}:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          // Only process messages for this room type
          if (newMsg.room_type !== roomType) return;
          // Avoid duplicate if this message was sent by us (already in state from optimistic update)
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return prev;
          });
          // Fetch sender info
          try {
            const { data: sender } = await supabase
              .from("profiles")
              .select("nickname, avatar_url")
              .eq("id", newMsg.sender_id)
              .single();
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, { ...newMsg, sender: (sender as any) || undefined }];
            });
          } catch {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, { ...newMsg }];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomType, roomId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);

    await supabase.from("chat_messages").insert({
      room_type: roomType,
      room_id: roomId,
      sender_id: userId,
      content: input.trim(),
    });

    setInput("");
    setSending(false);
  }

  return (
    <div className="flex flex-col h-[600px] bg-nu-white border border-nu-ink/[0.06]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-nu-ink/[0.06] flex items-center justify-between">
        <span className="font-head text-sm font-bold">팀 채팅</span>
        <span className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">
          {messages.length}개 메시지
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-nu-muted" size={20} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-nu-muted text-sm">아직 메시지가 없습니다</p>
              <p className="text-nu-muted/60 text-xs mt-1">첫 번째 메시지를 보내보세요!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === userId;
            const nickname = msg.sender?.nickname || "익명";
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}
              >
                {!isMe && (
                  <div className="w-7 h-7 rounded-full bg-nu-cream flex items-center justify-center font-head text-[10px] font-bold text-nu-ink shrink-0 mt-0.5">
                    {nickname.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className={`max-w-[70%] ${isMe ? "text-right" : ""}`}>
                  {!isMe && (
                    <span className="font-mono-nu text-[9px] text-nu-muted block mb-0.5">
                      {nickname}
                    </span>
                  )}
                  <div
                    className={`inline-block px-3.5 py-2 text-sm leading-relaxed ${
                      isMe
                        ? "bg-nu-pink text-white rounded-tl-xl rounded-tr-sm rounded-bl-xl rounded-br-xl"
                        : "bg-nu-cream/70 text-nu-ink rounded-tl-sm rounded-tr-xl rounded-bl-xl rounded-br-xl"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="font-mono-nu text-[8px] text-nu-muted/60 block mt-0.5">
                    {timeAgo(msg.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="px-4 py-3 border-t border-nu-ink/[0.06] flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요..."
          className="flex-1 bg-nu-cream/50 border border-nu-ink/10 px-4 py-2.5 text-sm focus:outline-none focus:border-nu-pink/40 transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="px-4 py-2.5 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
