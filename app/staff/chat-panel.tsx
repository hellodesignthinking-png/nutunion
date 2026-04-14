"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, X, Send, Hash, Users, Search, ChevronLeft, ExternalLink, Loader2, Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ChatRoom {
  id: string;
  name: string;
  type: "team" | "project" | "dm" | "gchat";
  lastMessage?: string;
  lastAt?: string;
  gchatSpaceId?: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  created_at: string;
  source?: "internal" | "gchat";
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [staffMembers, setStaffMembers] = useState<{ id: string; nickname: string }[]>([]);
  const [search, setSearch] = useState("");
  const [showNewDM, setShowNewDM] = useState(false);
  const [tableReady, setTableReady] = useState<boolean | null>(null);
  const [gchatSpaces, setGchatSpaces] = useState<any[]>([]);
  const [gchatLoaded, setGchatLoaded] = useState(false);
  const [gchatError, setGchatError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check table exists & load initial data
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", user.id)
        .single();
      setUserName(profile?.nickname || "Staff");

      // Staff members for DM
      const { data: staff } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("role", ["staff", "admin"])
        .neq("id", user.id);
      setStaffMembers(staff || []);

      // Check if staff_chat_messages table exists by trying a select
      const { error: tableErr } = await supabase
        .from("staff_chat_messages")
        .select("id")
        .limit(1);

      if (tableErr) {
        console.warn("staff_chat_messages table not found:", tableErr.message);
        setTableReady(false);
      } else {
        setTableReady(true);
      }

      // Build rooms from staff projects
      const { data: myProjects } = await supabase
        .from("staff_project_members")
        .select("project:staff_projects(id, title)")
        .eq("user_id", user.id);

      const projectRooms: ChatRoom[] = (myProjects || [])
        .filter((m: any) => m.project)
        .map((m: any) => ({
          id: `project-${m.project.id}`,
          name: m.project.title,
          type: "project" as const,
        }));

      const generalRoom: ChatRoom = {
        id: "team-general",
        name: "전체 스태프",
        type: "team",
      };

      const allRooms = [generalRoom, ...projectRooms];
      setRooms(allRooms);

      // Load previews
      if (!tableErr) {
        for (const room of allRooms) {
          const { data } = await supabase
            .from("staff_chat_messages")
            .select("content, created_at")
            .eq("room_id", room.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) {
            setRooms(prev => prev.map(r =>
              r.id === room.id ? { ...r, lastMessage: data.content?.slice(0, 40), lastAt: data.created_at } : r
            ));
          }
        }
      }
    }
    init();
  }, []);

  // Load Google Chat spaces
  async function loadGchatSpaces() {
    if (gchatLoaded) return;
    try {
      const res = await fetch("/api/google/chat");
      if (res.ok) {
        const data = await res.json();
        const gchatRooms: ChatRoom[] = (data.spaces || []).map((s: any) => ({
          id: `gchat-${s.id}`,
          name: s.displayName || "Google Chat",
          type: "gchat" as const,
          gchatSpaceId: s.id,
        }));
        setGchatSpaces(data.spaces || []);
        setRooms(prev => [...prev, ...gchatRooms]);
      } else {
        setGchatError(true);
      }
    } catch {
      setGchatError(true);
    }
    setGchatLoaded(true);
  }

  // Load messages
  const loadMessages = useCallback(async (room: ChatRoom) => {
    setLoading(true);
    setMessages([]);

    if (room.type === "gchat" && room.gchatSpaceId) {
      try {
        const res = await fetch(`/api/google/chat?spaceId=${encodeURIComponent(room.gchatSpaceId)}&limit=30`);
        if (res.ok) {
          const data = await res.json();
          setMessages((data.messages || []).reverse().map((m: any) => ({
            id: m.id,
            content: m.text,
            sender_id: "",
            sender_name: m.sender,
            created_at: m.createTime,
            source: "gchat" as const,
          })));
        }
      } catch { /* */ }
    } else if (tableReady) {
      const supabase = createClient();
      const { data } = await supabase
        .from("staff_chat_messages")
        .select("id, content, sender_id, metadata, created_at")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true })
        .limit(50);

      if (data) {
        // Resolve sender names
        const senderIds = [...new Set(data.map(m => m.sender_id).filter(Boolean))];
        let nameMap: Record<string, string> = {};
        if (senderIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, nickname")
            .in("id", senderIds);
          (profiles || []).forEach(p => { nameMap[p.id] = p.nickname || "Unknown"; });
        }

        setMessages(data.map(m => ({
          id: m.id,
          content: m.content,
          sender_id: m.sender_id,
          sender_name: nameMap[m.sender_id] || (m.metadata as any)?.sender_name || "Unknown",
          created_at: m.created_at,
          source: "internal" as const,
        })));
      }
    }

    setLoading(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [tableReady]);

  // Realtime subscription
  useEffect(() => {
    if (!activeRoom || activeRoom.type === "gchat" || !tableReady) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`staff-chat-${activeRoom.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "staff_chat_messages",
        filter: `room_id=eq.${activeRoom.id}`,
      }, (payload: any) => {
        const n = payload.new;
        if (n.sender_id === userId) return; // Skip own (already added optimistically)
        const senderName = staffMembers.find(s => s.id === n.sender_id)?.nickname
          || (n.metadata as any)?.sender_name || "Unknown";
        setMessages(prev => [...prev, {
          id: n.id,
          content: n.content,
          sender_id: n.sender_id,
          sender_name: senderName,
          created_at: n.created_at,
          source: "internal",
        }]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeRoom, staffMembers, userId, tableReady]);

  // Send message
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !activeRoom) return;
    const text = input.trim();
    setSending(true);

    if (activeRoom.type === "gchat" && activeRoom.gchatSpaceId) {
      try {
        const res = await fetch("/api/google/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spaceId: activeRoom.gchatSpaceId, text }),
        });
        if (res.ok) {
          setInput("");
          await loadMessages(activeRoom);
        } else {
          toast.error("Google Chat 전송 실패");
        }
      } catch {
        toast.error("Google Chat 연결 오류");
      }
    } else if (tableReady) {
      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      const optimisticMsg: Message = {
        id: tempId,
        content: text,
        sender_id: userId,
        sender_name: userName,
        created_at: new Date().toISOString(),
        source: "internal",
      };
      setMessages(prev => [...prev, optimisticMsg]);
      setInput("");
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

      const supabase = createClient();
      const { data, error } = await supabase.from("staff_chat_messages").insert({
        room_id: activeRoom.id,
        room_type: activeRoom.type === "dm" ? "dm" : activeRoom.type === "project" ? "project" : "team",
        sender_id: userId,
        content: text,
        metadata: { sender_name: userName },
      }).select("id").single();

      if (error) {
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setInput(text); // Restore input
        toast.error(`메시지 전송 실패: ${error.message}`);
        console.error("Chat insert error:", error);
      } else if (data) {
        // Replace temp id with real id
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id } : m));
        // Update room preview
        setRooms(prev => prev.map(r =>
          r.id === activeRoom.id ? { ...r, lastMessage: text.slice(0, 40), lastAt: new Date().toISOString() } : r
        ));
      }
    } else {
      toast.error("채팅 테이블이 준비되지 않았습니다. SQL 마이그레이션을 실행해주세요.");
    }

    setSending(false);
  }

  function openRoom(room: ChatRoom) {
    setActiveRoom(room);
    loadMessages(room);
    setShowNewDM(false);
  }

  function startDM(memberId: string, memberName: string) {
    const roomId = `dm-${[userId, memberId].sort().join("-")}`;
    const dmRoom: ChatRoom = { id: roomId, name: memberName, type: "dm" };
    setRooms(prev => prev.some(r => r.id === roomId) ? prev : [...prev, dmRoom]);
    openRoom(dmRoom);
  }

  const filteredRooms = search
    ? rooms.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : rooms;

  const grouped = {
    team: filteredRooms.filter(r => r.type === "team"),
    project: filteredRooms.filter(r => r.type === "project"),
    dm: filteredRooms.filter(r => r.type === "dm"),
    gchat: filteredRooms.filter(r => r.type === "gchat"),
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => { setIsOpen(!isOpen); if (!gchatLoaded) loadGchatSpaces(); }}
        className={`fixed bottom-6 right-6 z-[450] w-14 h-14 rounded-full flex items-center justify-center cursor-pointer border-none shadow-lg transition-all ${
          isOpen ? "bg-nu-ink text-white" : "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105"
        }`}
        aria-label="채팅"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[449] w-[380px] h-[560px] bg-white border border-nu-ink/15 shadow-2xl flex flex-col overflow-hidden">
          {!activeRoom ? (
            /* ── Room List ── */
            <>
              <div className="px-4 py-3 border-b border-nu-ink/[0.08] bg-indigo-600 text-white flex items-center justify-between shrink-0">
                <h3 className="font-head text-sm font-bold flex items-center gap-2">
                  <MessageCircle size={16} /> 스태프 채팅
                </h3>
                <button onClick={() => setShowNewDM(!showNewDM)} className="p-1 bg-transparent border-none cursor-pointer text-white/80 hover:text-white" aria-label="새 대화">
                  <Plus size={16} />
                </button>
              </div>

              {/* Table not ready warning */}
              {tableReady === false && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2">
                  <AlertCircle size={12} className="text-red-500 shrink-0" />
                  <p className="font-mono-nu text-[8px] text-red-600">
                    DB 테이블 미생성. Supabase SQL Editor에서 031_staff_chat.sql 실행 필요
                  </p>
                </div>
              )}

              {/* Search */}
              <div className="px-3 py-2 border-b border-nu-ink/5 shrink-0">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-nu-muted" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="채널 검색..."
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-nu-ink/10 bg-transparent outline-none focus:border-indigo-300"
                  />
                </div>
              </div>

              {/* New DM picker */}
              {showNewDM && (
                <div className="border-b border-nu-ink/[0.08] bg-indigo-50/50 px-3 py-2 max-h-32 overflow-y-auto shrink-0">
                  <p className="font-mono-nu text-[8px] uppercase tracking-widest text-indigo-600 font-bold mb-1">다이렉트 메시지</p>
                  {staffMembers.map(s => (
                    <button key={s.id} onClick={() => startDM(s.id, s.nickname || "Unknown")}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-left hover:bg-indigo-100 transition-colors bg-transparent border-none cursor-pointer">
                      <div className="w-5 h-5 rounded-full bg-indigo-200 flex items-center justify-center font-head text-[8px] font-bold text-indigo-600">
                        {(s.nickname || "U").charAt(0)}
                      </div>
                      <span className="text-xs text-nu-ink">{s.nickname}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Room list */}
              <div className="flex-1 overflow-y-auto">
                {grouped.team.length > 0 && (
                  <RoomGroup label="팀" rooms={grouped.team} onSelect={openRoom}
                    icon={(r) => <Users size={14} className="text-indigo-500" />} />
                )}
                {grouped.project.length > 0 && (
                  <RoomGroup label="프로젝트" rooms={grouped.project} onSelect={openRoom}
                    icon={(r) => <Hash size={14} className="text-green-500" />} />
                )}
                {grouped.dm.length > 0 && (
                  <RoomGroup label="다이렉트" rooms={grouped.dm} onSelect={openRoom}
                    icon={(r) => <div className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center font-head text-[7px] font-bold text-amber-700">{r.name.charAt(0)}</div>} />
                )}
                {grouped.gchat.length > 0 && (
                  <RoomGroup label="Google Chat" rooms={grouped.gchat} onSelect={openRoom}
                    icon={(r) => <MessageCircle size={14} className="text-blue-500" />} />
                )}
                {gchatError && (
                  <div className="px-4 py-3">
                    <p className="font-mono-nu text-[8px] text-nu-muted">Google Chat 미연결</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── Chat View ── */
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-nu-ink/[0.08] bg-indigo-600 text-white flex items-center gap-3 shrink-0">
                <button onClick={() => { setActiveRoom(null); setMessages([]); }}
                  className="p-1 bg-transparent border-none cursor-pointer text-white/80 hover:text-white" aria-label="뒤로">
                  <ChevronLeft size={16} />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-head text-sm font-bold truncate">{activeRoom.name}</h3>
                  <p className="font-mono-nu text-[8px] uppercase tracking-widest text-white/60">
                    {activeRoom.type === "gchat" ? "Google Chat" : activeRoom.type === "dm" ? "다이렉트" : activeRoom.type === "project" ? "프로젝트" : "팀"}
                  </p>
                </div>
                {activeRoom.type === "gchat" && (
                  <span className="font-mono-nu text-[7px] px-2 py-0.5 bg-white/20 uppercase tracking-widest">외부</span>
                )}
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
                    <p className="font-mono-nu text-[10px] text-nu-muted">첫 메시지를 보내보세요</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.sender_id === userId;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%]`}>
                          {!isMe && (
                            <p className="font-mono-nu text-[8px] text-nu-muted mb-0.5 flex items-center gap-1">
                              {msg.source === "gchat" && <ExternalLink size={7} className="text-blue-400" />}
                              {msg.sender_name}
                            </p>
                          )}
                          <div className={`px-3 py-2 text-sm whitespace-pre-wrap ${
                            isMe
                              ? "bg-indigo-600 text-white rounded-tl-lg rounded-bl-lg rounded-br-lg"
                              : msg.source === "gchat"
                              ? "bg-blue-50 text-nu-ink border border-blue-100 rounded-tr-lg rounded-br-lg rounded-bl-lg"
                              : "bg-white text-nu-ink border border-nu-ink/[0.06] rounded-tr-lg rounded-br-lg rounded-bl-lg"
                          }`}>
                            {msg.content}
                          </div>
                          <p className={`font-mono-nu text-[7px] text-nu-muted/50 mt-0.5 ${isMe ? "text-right" : ""}`}>
                            {new Date(msg.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
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
                    placeholder={tableReady === false ? "DB 테이블 미생성..." : "메시지 입력... (Enter 전송)"}
                    disabled={tableReady === false && activeRoom.type !== "gchat"}
                    rows={1}
                    className="flex-1 px-3 py-2 text-sm border border-nu-ink/10 bg-transparent outline-none resize-none focus:border-indigo-300 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim() || (tableReady === false && activeRoom.type !== "gchat")}
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

function RoomGroup({ label, rooms, onSelect, icon }: {
  label: string;
  rooms: ChatRoom[];
  onSelect: (r: ChatRoom) => void;
  icon: (r: ChatRoom) => React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted px-4 pt-3 pb-1 font-bold">{label}</p>
      {rooms.map(r => (
        <button
          key={r.id}
          onClick={() => onSelect(r)}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-indigo-50/50 transition-colors bg-transparent border-none cursor-pointer"
        >
          {icon(r)}
          <div className="flex-1 min-w-0">
            <p className="font-head text-xs font-bold text-nu-ink truncate">{r.name}</p>
            {r.lastMessage && (
              <p className="font-mono-nu text-[8px] text-nu-muted truncate">{r.lastMessage}</p>
            )}
          </div>
          {r.lastAt && (
            <span className="font-mono-nu text-[7px] text-nu-muted/50 shrink-0">
              {new Date(r.lastAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
