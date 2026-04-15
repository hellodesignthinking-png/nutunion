"use client";

import { useState, useRef, useEffect } from "react";
import { Brain, Loader2, Send, X, Sparkles, MessageCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AskWiki({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleAsk() {
    const q = query.trim();
    if (!q || loading) return;

    setMessages(prev => [...prev, { role: "user", content: q }]);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/ask-wiki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, question: q }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "응답을 받을 수 없습니다");
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `죄송합니다. ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-gradient-to-r from-nu-ink to-nu-graphite text-white p-4 flex items-center gap-3 hover:from-nu-graphite hover:to-nu-ink transition-all group border-[2px] border-nu-ink"
      >
        <div className="w-10 h-10 bg-nu-pink/20 flex items-center justify-center shrink-0 group-hover:bg-nu-pink/30 transition-colors">
          <Brain size={20} className="text-nu-pink" />
        </div>
        <div className="flex-1 text-left">
          <p className="font-head text-sm font-bold">Ask Wiki</p>
          <p className="font-mono-nu text-[9px] text-white/40 uppercase tracking-widest">
            AI에게 이 너트의 지식을 질문하세요
          </p>
        </div>
        <MessageCircle size={16} className="text-white/30 group-hover:text-nu-pink transition-colors" />
      </button>
    );
  }

  return (
    <div className="bg-white border-[2px] border-nu-ink overflow-hidden">
      {/* Header */}
      <div className="bg-nu-ink text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-nu-pink" />
          <span className="font-head text-sm font-bold">Ask Wiki</span>
          <span className="font-mono-nu text-[8px] text-white/30 uppercase tracking-widest">AI 지식 비서</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="max-h-64 overflow-y-auto p-4 space-y-3 bg-nu-cream/20">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <Sparkles size={20} className="mx-auto mb-2 text-nu-pink/30" />
            <p className="text-xs text-nu-muted mb-2">이 너트의 위키 내용을 기반으로 답변합니다</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {["운영 규칙이 뭐야?", "최근 논의된 주제는?", "핵심 결정사항 요약"].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setQuery(suggestion); }}
                  className="font-mono-nu text-[9px] px-2 py-1 bg-white border border-nu-ink/10 text-nu-muted hover:border-nu-pink hover:text-nu-pink transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-3 py-2 text-xs leading-relaxed ${
              msg.role === "user"
                ? "bg-nu-ink text-white"
                : "bg-white border border-nu-ink/10 text-nu-graphite"
            }`}>
              {msg.role === "assistant" && (
                <p className="font-mono-nu text-[7px] text-nu-pink uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Brain size={8} /> AI
                </p>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-nu-ink/10 px-3 py-2 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-nu-pink" />
              <span className="text-xs text-nu-muted">위키를 검색하고 있습니다...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-nu-ink/10 p-3 flex items-center gap-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAsk(); }}
          placeholder="위키에 대해 질문하세요..."
          className="flex-1 text-sm px-3 py-2 bg-nu-cream/30 border border-nu-ink/10 focus:border-nu-pink focus:outline-none transition-colors"
          disabled={loading}
        />
        <button
          onClick={handleAsk}
          disabled={loading || !query.trim()}
          className="p-2 bg-nu-ink text-white hover:bg-nu-pink transition-colors disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
