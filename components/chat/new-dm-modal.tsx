"use client";

/**
 * NewDMModal — 회원 검색 → 1:1 DM 시작.
 *
 * - 닉네임/이름으로 검색 (300ms debounce)
 * - 클릭 시 /api/chat/rooms POST { dm_target } → /chat?room=ID 로 이동
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Search, X, Loader2, MessageSquare } from "lucide-react";

interface User {
  id: string;
  nickname: string;
  avatar_url?: string | null;
  specialty?: string | null;
}

export function NewDMModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      // 기본 — 최근 활동 유저 상위 15명 로드
      (async () => {
        setLoading(true);
        const supabase = createClient();
        const { data: me } = await supabase.auth.getUser();
        const { data } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url, specialty")
          .neq("id", me.user?.id || "00000000-0000-0000-0000-000000000000")
          .order("activity_score", { ascending: false, nullsFirst: false })
          .limit(15);
        setResults((data as User[]) || []);
        setLoading(false);
      })();
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: me } = await supabase.auth.getUser();
        const { data } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url, specialty")
          .or(`nickname.ilike.%${query}%,name.ilike.%${query}%`)
          .neq("id", me.user?.id || "00000000-0000-0000-0000-000000000000")
          .limit(20);
        setResults((data as User[]) || []);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  async function startDM(u: User) {
    setStarting(u.id);
    try {
      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dm_target: u.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.room_id) throw new Error(data.error || "DM 시작 실패");
      router.push(`/chat?room=${data.room_id}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setStarting(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-start sm:items-center justify-center p-4 pt-16 sm:pt-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="DM 시작"
        className="w-full max-w-md bg-white rounded-[var(--ds-radius-xl)] border border-nu-ink/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-nu-ink/10 bg-nu-cream/20">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-nu-pink" />
            <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold">
              New DM
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-nu-ink/10 rounded" aria-label="닫기">
            <X size={16} />
          </button>
        </header>

        <div className="p-3 border-b border-nu-ink/10">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="닉네임 / 이름 검색"
              autoFocus
              className="w-full pl-9 pr-3 py-2 border border-nu-ink/15 rounded text-[13px] focus:border-nu-pink outline-none"
            />
          </div>
        </div>

        <div className="max-h-[440px] overflow-auto">
          {loading ? (
            <div className="p-6 text-center">
              <Loader2 size={16} className="animate-spin inline-block text-nu-muted" />
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-nu-graphite">
              {query ? "검색 결과가 없어요" : "활동 중인 와셔가 없어요"}
            </div>
          ) : (
            <ul className="divide-y divide-nu-ink/[0.05]">
              {results.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => startDM(u)}
                    disabled={!!starting}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-nu-cream/30 disabled:opacity-50"
                  >
                    <div className="shrink-0 w-9 h-9 rounded-full bg-nu-ink/5 overflow-hidden">
                      {u.avatar_url ? (
                        <Image
                          src={u.avatar_url}
                          alt={u.nickname}
                          width={36}
                          height={36}
                          className="w-9 h-9 object-cover"
                        />
                      ) : (
                        <span className="flex items-center justify-center w-full h-full text-[11px] font-mono-nu text-nu-graphite">
                          {u.nickname.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] text-nu-ink truncate">
                        {u.nickname}
                      </div>
                      {u.specialty && (
                        <div className="text-[10px] font-mono-nu uppercase tracking-widest text-nu-muted">
                          {u.specialty}
                        </div>
                      )}
                    </div>
                    {starting === u.id ? (
                      <Loader2 size={14} className="animate-spin text-nu-muted shrink-0" />
                    ) : (
                      <MessageSquare size={14} className="text-nu-pink shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
