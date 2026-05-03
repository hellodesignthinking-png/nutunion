"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MessageCircle, Send, Loader2, CheckSquare, ListChecks, ShieldCheck,
  Sparkles, X, Trash2, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface ChatMessage {
  id: string;
  content: string;
  author_id: string;
  converted_to: Array<{ kind: string; id: string; at: string }>;
  parent_id: string | null;
  created_at: string;
  author?: { id: string; nickname: string; avatar_url: string | null } | Array<{ id: string; nickname: string; avatar_url: string | null }> | null;
}

interface Props {
  projectId: string;
  userId: string;
  isMember: boolean;
}

const KEYWORD_HINTS = {
  task:     ["할 거", "해야", "마감", "by ", "까지"],
  decision: ["결정", "확정", "채택", "승인", "정함", "정리됨"],
  risk:     ["문제", "이슈", "지연", "리스크", "안 됨", "안돼"],
};

function detectHints(content: string): Array<"task" | "decision" | "risk"> {
  const out: Array<"task" | "decision" | "risk"> = [];
  for (const k of ["task", "decision", "risk"] as const) {
    if (KEYWORD_HINTS[k].some((kw) => content.includes(kw))) out.push(k);
  }
  return out;
}

function pickAuthor(m: ChatMessage) {
  return Array.isArray(m.author) ? m.author[0] : m.author;
}

export function ProjectChatPanel({ projectId, userId, isMember }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/chat`);
      const j = await r.json();
      if (Array.isArray(j.messages)) setMessages(j.messages);
    } catch {} finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`project-chat:${projectId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "project_chat_messages",
        filter: `project_id=eq.${projectId}`,
      }, async (payload) => {
        const newId = (payload.new as { id: string; author_id: string }).id;
        const authorId = (payload.new as { author_id: string }).author_id;
        if (authorId === userId) return; // 자기 메시지는 이미 낙관 추가됨
        // 작성자 join 위해 한번 더 조회
        try {
          const r = await fetch(`/api/projects/${projectId}/chat`);
          const j = await r.json();
          if (Array.isArray(j.messages)) {
            setMessages(j.messages);
          }
        } catch {}
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, userId]);

  // 자동 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "전송 실패");
      setMessages((p) => [...p, j.message]);
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally { setSending(false); }
  }

  async function convert(m: ChatMessage, target: "task" | "decision" | "risk") {
    setActiveMenu(null);
    try {
      const r = await fetch(`/api/projects/chat/${m.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "실패");
      setMessages((p) => p.map((x) => x.id === m.id ? {
        ...x,
        converted_to: [...(x.converted_to || []), { kind: target, id: j.id, at: new Date().toISOString() }],
      } : x));
      toast.success({
        task: "→ 태스크 생성",
        decision: "→ 결정 등록",
        risk: "→ 리스크 등록",
      }[target]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    }
  }

  return (
    <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] flex flex-col h-[600px]">
      <div className="px-3 py-2 border-b-[2px] border-nu-ink/10 flex items-center gap-1.5">
        <MessageCircle size={13} className="text-nu-pink" />
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">프로젝트 채팅</span>
        <span className="font-mono-nu text-[9px] text-nu-muted">· {messages.length}건</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="text-[12px] text-nu-muted flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> 로드 중…</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-nu-muted">
            <Sparkles size={18} className="mx-auto mb-1.5 text-nu-muted/40" />
            <div className="text-[12px]">대화를 시작해 보세요</div>
            <div className="text-[10px] mt-0.5">메시지에서 바로 태스크 / 결정 / 리스크로 변환할 수 있어요</div>
          </div>
        ) : (
          messages.map((m) => {
            const author = pickAuthor(m);
            const isMine = m.author_id === userId;
            const hints = detectHints(m.content);
            return (
              <div key={m.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                <div className="w-7 h-7 rounded-full bg-nu-cream flex items-center justify-center font-head text-[11px] font-bold text-nu-ink shrink-0">
                  {(author?.nickname || "?").charAt(0).toUpperCase()}
                </div>
                <div className={`flex-1 min-w-0 ${isMine ? "text-right" : ""}`}>
                  <div className={`font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-0.5 ${isMine ? "" : ""}`}>
                    {author?.nickname || "?"} · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ko })}
                  </div>
                  <div className={`relative inline-block max-w-full ${isMine ? "bg-nu-pink/10 border-nu-pink/30" : "bg-white border-nu-ink/10"} border-[2px] px-2.5 py-1.5 text-left`}>
                    <p className="text-[13px] text-nu-ink whitespace-pre-wrap break-words leading-snug">{m.content}</p>
                    {hints.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {hints.map((h) => (
                          <button key={h} onClick={() => convert(m, h)}
                            className="font-mono-nu text-[8.5px] uppercase tracking-widest px-1 py-0.5 border border-nu-pink/30 text-nu-pink hover:bg-nu-pink hover:text-nu-paper inline-flex items-center gap-0.5">
                            {h === "task" ? <CheckSquare size={8} /> : h === "decision" ? <ListChecks size={8} /> : <ShieldCheck size={8} />}
                            → {h === "task" ? "태스크" : h === "decision" ? "결정" : "리스크"}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.converted_to && m.converted_to.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        {m.converted_to.map((c, i) => (
                          <span key={i} className="font-mono-nu text-[8.5px] uppercase tracking-widest bg-emerald-50 text-emerald-700 px-1 border border-emerald-200">
                            ✓ {c.kind === "task" ? "태스크" : c.kind === "decision" ? "결정" : "리스크"}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* 액션 메뉴 */}
                    <div className={`absolute top-0.5 ${isMine ? "left-0.5" : "right-0.5"}`}>
                      <button onClick={() => setActiveMenu(activeMenu === m.id ? null : m.id)} className="p-0.5 text-nu-muted/50 hover:text-nu-ink">
                        <MoreHorizontal size={10} />
                      </button>
                      {activeMenu === m.id && (
                        <div className={`absolute z-10 bg-nu-paper border-[2px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] mt-1 ${isMine ? "left-0" : "right-0"} flex flex-col`}>
                          <button onClick={() => convert(m, "task")}     className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-nu-cream inline-flex items-center gap-1 whitespace-nowrap"><CheckSquare size={10} /> 태스크</button>
                          <button onClick={() => convert(m, "decision")} className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-nu-cream inline-flex items-center gap-1 whitespace-nowrap"><ListChecks size={10} /> 결정</button>
                          <button onClick={() => convert(m, "risk")}     className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-nu-cream inline-flex items-center gap-1 whitespace-nowrap"><ShieldCheck size={10} /> 리스크</button>
                          <button onClick={() => setActiveMenu(null)}    className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-nu-cream inline-flex items-center gap-1 whitespace-nowrap text-nu-muted"><X size={10} /> 닫기</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 입력 */}
      {isMember && (
        <div className="border-t-[2px] border-nu-ink/10 p-2">
          <div className="flex items-end gap-1.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
              }}
              placeholder="메시지… (⌘Enter 로 전송) — '결정', '마감', '리스크' 등 키워드 입력 시 변환 칩 표시"
              rows={2}
              className="flex-1 px-2 py-1.5 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none resize-none"
            />
            <button onClick={send} disabled={sending || !draft.trim()}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite disabled:opacity-40 inline-flex items-center gap-1">
              {sending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} 전송
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
