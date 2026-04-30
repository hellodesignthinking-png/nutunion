"use client";

/**
 * ThreadPanel — Slack-style threaded reply panel.
 *
 * Desktop: 30% right side panel
 * Mobile: bottom sheet (BottomSheet)
 *
 * Loads parent + replies from /api/chat/messages/[id]/thread, allows posting
 * a reply via /api/chat/rooms/[room_id]/messages with parent_message_id.
 */
import { useEffect, useState, useCallback } from "react";
import { X, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import type { Msg } from "./msg-bubble";

export interface ThreadPanelProps {
  parentMessageId: string;
  meId?: string | null;
  onClose: () => void;
}

export function ThreadPanel({ parentMessageId, meId, onClose }: ThreadPanelProps) {
  const [parent, setParent] = useState<Msg | null>(null);
  const [replies, setReplies] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMobile(window.matchMedia("(max-width: 767px)").matches);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/messages/${parentMessageId}/thread`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `${res.status}`);
      }
      const j = await res.json();
      setParent(j.parent);
      setReplies(j.replies || []);
    } catch (e: any) {
      toast.error(`스레드 로드 실패: ${e.message || ""}`);
    } finally {
      setLoading(false);
    }
  }, [parentMessageId]);

  useEffect(() => {
    void load();
    // mark read (best-effort)
    void fetch(`/api/chat/messages/${parentMessageId}/thread/read`, { method: "POST" }).catch(() => {});
  }, [parentMessageId, load]);

  async function send() {
    if (!draft.trim() || !parent || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/rooms/${parent.room_id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim(), parent_message_id: parentMessageId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "실패");
      setDraft("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "전송 실패");
    } finally {
      setSending(false);
    }
  }

  const body = (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-8 text-nu-muted text-sm">
            <Loader2 className="animate-spin" size={16} />
            <span className="ml-2">스레드 불러오는 중…</span>
          </div>
        )}
        {parent && (
          <div className="border-l-[3px] border-nu-pink bg-nu-cream/40 p-2.5 rounded-r-md">
            <div className="text-[10px] font-mono-nu uppercase tracking-widest text-nu-muted mb-1">
              부모 메시지 — {parent.sender?.nickname || "익명"}
            </div>
            <div className="text-[13px] text-nu-ink whitespace-pre-wrap">
              {parent.content || (parent.attachment_url ? "📎 첨부" : "")}
            </div>
          </div>
        )}
        {replies.length === 0 && !loading && (
          <div className="text-center text-nu-muted text-[12px] py-6">아직 답글이 없어요. 첫 답글을 달아보세요 💬</div>
        )}
        {replies.map((r) => (
          <ReplyRow key={r.id} msg={r} mine={r.sender_id === meId} />
        ))}
      </div>
      <div className="border-t-[3px] border-nu-ink p-2 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="답글 입력… (Enter 전송)"
            className="flex-1 px-2.5 py-1.5 text-[13px] border-2 border-nu-ink rounded-md resize-y bg-nu-cream/30 outline-none focus:bg-white"
          />
          <button
            onClick={() => void send()}
            disabled={!draft.trim() || sending}
            className="px-3 py-2 bg-nu-pink text-white rounded-md border-[3px] border-nu-ink font-bold text-[12px] disabled:opacity-50 inline-flex items-center gap-1"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            전송
          </button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet open={true} onClose={onClose} title="🧵 스레드" maxHeight="80vh">
        <div className="h-[70vh]">{body}</div>
      </BottomSheet>
    );
  }

  return (
    <aside
      className="fixed right-0 top-0 h-screen w-[30vw] min-w-[360px] max-w-[480px] bg-white border-l-[3px] border-nu-ink z-40 flex flex-col shadow-xl"
      role="dialog"
      aria-label="스레드"
    >
      <div className="flex items-center justify-between px-3 h-12 border-b-[3px] border-nu-ink bg-nu-cream">
        <div className="font-head font-extrabold text-nu-ink text-[14px] tracking-tight">
          🧵 스레드 · {replies.length}답글
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-nu-ink/10 rounded-full"
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      </div>
      {body}
    </aside>
  );
}

function ReplyRow({ msg, mine }: { msg: Msg; mine: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%]">
        {!mine && (
          <div className="text-[10px] font-mono-nu text-nu-muted px-1 mb-0.5">
            {msg.sender?.nickname || "익명"}
          </div>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-[13px] leading-snug whitespace-pre-wrap break-words ${
            mine ? "bg-nu-pink text-white" : "bg-white border border-nu-ink/15 text-nu-ink"
          }`}
        >
          {msg.content || (msg.attachment_url ? "📎 첨부" : "")}
        </div>
      </div>
    </div>
  );
}
