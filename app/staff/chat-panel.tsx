"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MessageCircle, X, Send, Search, ChevronLeft, Loader2,
  EyeOff, Eye, Pin, PinOff, RefreshCw, Users, User,
} from "lucide-react";
import { toast } from "sonner";

interface GChatSpace {
  id: string;          // e.g. "spaces/xxxx"
  displayName: string;
  type: string;        // ROOM, DM, etc.
  spaceType: string;
  hidden?: boolean;
  pinned?: boolean;
}

interface Message {
  id: string;
  content: string;
  sender_name: string;
  created_at: string;
}

const STORAGE_KEY = "nutunion-gchat-prefs";

function loadPrefs(): Record<string, { hidden?: boolean; pinned?: boolean }> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function savePrefs(prefs: Record<string, { hidden?: boolean; pinned?: boolean }>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [spaces, setSpaces] = useState<GChatSpace[]>([]);
  const [activeSpace, setActiveSpace] = useState<GChatSpace | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  // Load user info
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", user.id)
        .single();
      setUserName(profile?.nickname || "Staff");
    }
    init();
  }, []);

  // Load Google Chat spaces
  const loadSpaces = useCallback(async () => {
    if (spacesLoading) return;
    setSpacesLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/google/chat");
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401) {
          setError("Google 계정을 연결해주세요 (프로필 → Google Workspace 연결)");
        } else {
          setError(data.hint || data.detail || "Google Chat 로드 실패");
        }
        setSpacesLoading(false);
        return;
      }
      const data = await res.json();
      const prefs = loadPrefs();

      const loaded: GChatSpace[] = (data.spaces || []).map((s: any) => ({
        id: s.id,
        displayName: s.displayName || "이름 없는 스페이스",
        type: s.type,
        spaceType: s.spaceType,
        hidden: prefs[s.id]?.hidden || false,
        pinned: prefs[s.id]?.pinned || false,
      }));

      setSpaces(loaded);
    } catch {
      setError("Google Chat 연결 오류");
    }
    setSpacesLoading(false);
  }, [spacesLoading]);

  // Load messages for a space
  const loadMessages = useCallback(async (space: GChatSpace) => {
    setLoading(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/google/chat?spaceId=${encodeURIComponent(space.id)}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setMessages((data.messages || []).reverse().map((m: any) => ({
          id: m.id,
          content: m.text || "",
          sender_name: m.sender || "Unknown",
          created_at: m.createTime,
        })));
      } else {
        toast.error("메시지를 불러올 수 없습니다");
      }
    } catch {
      toast.error("메시지 로드 오류");
    }
    setLoading(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  // Send message
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !activeSpace) return;
    const text = input.trim();
    setSending(true);

    // Optimistic update
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      content: text,
      sender_name: userName,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setInput("");
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch("/api/google/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spaceId: activeSpace.id, text }),
      });
      if (!res.ok) {
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
        setInput(text);
        toast.error("메시지 전송 실패");
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setInput(text);
      toast.error("Google Chat 연결 오류");
    }
    setSending(false);
  }

  // Toggle pin/hide
  function togglePref(spaceId: string, key: "pinned" | "hidden") {
    const prefs = loadPrefs();
    if (!prefs[spaceId]) prefs[spaceId] = {};
    prefs[spaceId][key] = !prefs[spaceId][key];
    // If pinning, unhide
    if (key === "pinned" && prefs[spaceId].pinned) prefs[spaceId].hidden = false;
    // If hiding, unpin
    if (key === "hidden" && prefs[spaceId].hidden) prefs[spaceId].pinned = false;
    savePrefs(prefs);
    setSpaces(prev => prev.map(s =>
      s.id === spaceId ? { ...s, [key]: prefs[spaceId][key], ...(key === "pinned" && prefs[spaceId].pinned ? { hidden: false } : {}), ...(key === "hidden" && prefs[spaceId].hidden ? { pinned: false } : {}) } : s
    ));
  }

  function openSpace(space: GChatSpace) {
    setActiveSpace(space);
    loadMessages(space);
  }

  function handleOpen() {
    setIsOpen(!isOpen);
    if (!loaded.current) {
      loaded.current = true;
      loadSpaces();
    }
  }

  // Filter & sort spaces
  const visibleSpaces = spaces
    .filter(s => showHidden || !s.hidden)
    .filter(s => !search || s.displayName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

  const pinnedSpaces = visibleSpaces.filter(s => s.pinned);
  const groupSpaces = visibleSpaces.filter(s => !s.pinned && (s.type === "ROOM" || s.spaceType === "SPACE"));
  const dmSpaces = visibleSpaces.filter(s => !s.pinned && s.type === "DM");
  const otherSpaces = visibleSpaces.filter(s => !s.pinned && s.type !== "ROOM" && s.spaceType !== "SPACE" && s.type !== "DM");

  const hiddenCount = spaces.filter(s => s.hidden).length;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleOpen}
        className={`fixed bottom-6 right-6 z-[450] w-14 h-14 rounded-full flex items-center justify-center cursor-pointer border-none shadow-lg transition-all ${
          isOpen ? "bg-nu-ink text-white" : "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105"
        }`}
        aria-label="Google Chat"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[449] w-[380px] h-[560px] bg-white border border-nu-ink/15 shadow-2xl flex flex-col overflow-hidden">
          {!activeSpace ? (
            /* ── Space List ── */
            <>
              <div className="px-4 py-3 border-b border-nu-ink/[0.08] bg-indigo-600 text-white flex items-center justify-between shrink-0">
                <h3 className="font-head text-sm font-bold flex items-center gap-2">
                  <MessageCircle size={16} /> Google Chat
                </h3>
                <div className="flex items-center gap-1">
                  {hiddenCount > 0 && (
                    <button onClick={() => setShowHidden(!showHidden)}
                      className="p-1.5 bg-transparent border-none cursor-pointer text-white/60 hover:text-white transition-colors"
                      aria-label={showHidden ? "숨긴 항목 감추기" : "숨긴 항목 보기"}
                      title={showHidden ? "숨긴 항목 감추기" : `숨긴 항목 ${hiddenCount}개 보기`}
                    >
                      {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  )}
                  <button onClick={() => { loaded.current = false; loadSpaces(); }}
                    className="p-1.5 bg-transparent border-none cursor-pointer text-white/60 hover:text-white transition-colors"
                    aria-label="새로고침"
                  >
                    <RefreshCw size={14} className={spacesLoading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="px-4 py-3 bg-red-50 border-b border-red-200">
                  <p className="text-[11px] text-red-600">{error}</p>
                </div>
              )}

              {/* Search */}
              <div className="px-3 py-2 border-b border-nu-ink/5 shrink-0">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-nu-muted" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="스페이스 검색..."
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-nu-ink/10 bg-transparent outline-none focus:border-indigo-300"
                  />
                </div>
              </div>

              {/* Space list */}
              <div className="flex-1 overflow-y-auto">
                {spacesLoading && spaces.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-indigo-400" />
                  </div>
                ) : visibleSpaces.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <MessageCircle size={28} className="mx-auto mb-2 text-nu-ink/10" />
                    <p className="font-mono-nu text-[10px] text-nu-muted">
                      {search ? "검색 결과가 없습니다" : error ? "Google 계정을 연결해주세요" : "스페이스가 없습니다"}
                    </p>
                  </div>
                ) : (
                  <>
                    {pinnedSpaces.length > 0 && (
                      <SpaceGroup label="📌 고정" spaces={pinnedSpaces} onSelect={openSpace} onToggle={togglePref} />
                    )}
                    {groupSpaces.length > 0 && (
                      <SpaceGroup label="스페이스" spaces={groupSpaces} onSelect={openSpace} onToggle={togglePref} />
                    )}
                    {dmSpaces.length > 0 && (
                      <SpaceGroup label="다이렉트 메시지" spaces={dmSpaces} onSelect={openSpace} onToggle={togglePref} />
                    )}
                    {otherSpaces.length > 0 && (
                      <SpaceGroup label="기타" spaces={otherSpaces} onSelect={openSpace} onToggle={togglePref} />
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            /* ── Chat View ── */
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-nu-ink/[0.08] bg-indigo-600 text-white flex items-center gap-3 shrink-0">
                <button onClick={() => { setActiveSpace(null); setMessages([]); }}
                  className="p-1 bg-transparent border-none cursor-pointer text-white/80 hover:text-white" aria-label="뒤로">
                  <ChevronLeft size={16} />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-head text-sm font-bold truncate">{activeSpace.displayName}</h3>
                  <p className="font-mono-nu text-[8px] uppercase tracking-widest text-white/60">
                    Google Chat · {activeSpace.type === "DM" ? "DM" : "Space"}
                  </p>
                </div>
                <button onClick={() => loadMessages(activeSpace)}
                  className="p-1.5 bg-transparent border-none cursor-pointer text-white/60 hover:text-white" aria-label="새로고침">
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-nu-ink/[0.01]">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-indigo-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle size={24} className="mx-auto mb-2 text-nu-ink/10" />
                    <p className="font-mono-nu text-[10px] text-nu-muted">메시지가 없습니다</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.sender_name === userName;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[75%]">
                          {!isMe && (
                            <p className="font-mono-nu text-[8px] text-nu-muted mb-0.5">{msg.sender_name}</p>
                          )}
                          <div className={`px-3 py-2 text-sm whitespace-pre-wrap ${
                            isMe
                              ? "bg-indigo-600 text-white rounded-tl-lg rounded-bl-lg rounded-br-lg"
                              : "bg-white text-nu-ink border border-nu-ink/[0.06] rounded-tr-lg rounded-br-lg rounded-bl-lg"
                          }`}>
                            {msg.content}
                          </div>
                          <p className={`font-mono-nu text-[7px] text-nu-muted/50 mt-0.5 ${isMe ? "text-right" : ""}`}>
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="px-3 py-2 border-t border-nu-ink/[0.08] bg-white shrink-0">
                <div className="flex gap-2">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                    placeholder="메시지 입력... (Enter 전송)"
                    rows={1}
                    className="flex-1 px-3 py-2 text-sm border border-nu-ink/10 bg-transparent outline-none resize-none focus:border-indigo-300"
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    className="px-3 bg-indigo-600 text-white border-none cursor-pointer hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}

function SpaceGroup({ label, spaces, onSelect, onToggle }: {
  label: string;
  spaces: GChatSpace[];
  onSelect: (s: GChatSpace) => void;
  onToggle: (id: string, key: "pinned" | "hidden") => void;
}) {
  return (
    <div>
      <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted px-4 pt-3 pb-1 font-bold">{label}</p>
      {spaces.map(s => (
        <div
          key={s.id}
          className={`flex items-center gap-2 w-full px-4 py-2.5 hover:bg-indigo-50/50 transition-colors group ${s.hidden ? "opacity-40" : ""}`}
        >
          <button
            onClick={() => onSelect(s)}
            className="flex items-center gap-3 flex-1 min-w-0 text-left bg-transparent border-none cursor-pointer p-0"
          >
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
              s.type === "DM" ? "bg-amber-100" : "bg-indigo-100"
            }`}>
              {s.type === "DM"
                ? <User size={13} className="text-amber-600" />
                : <Users size={13} className="text-indigo-600" />
              }
            </div>
            <p className="font-head text-xs font-bold text-nu-ink truncate">{s.displayName}</p>
          </button>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => onToggle(s.id, "pinned")}
              className="p-1 bg-transparent border-none cursor-pointer text-nu-muted hover:text-indigo-600 transition-colors"
              title={s.pinned ? "고정 해제" : "고정"}
            >
              {s.pinned ? <PinOff size={11} /> : <Pin size={11} />}
            </button>
            <button onClick={() => onToggle(s.id, "hidden")}
              className="p-1 bg-transparent border-none cursor-pointer text-nu-muted hover:text-red-500 transition-colors"
              title={s.hidden ? "표시" : "숨기기"}
            >
              {s.hidden ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
