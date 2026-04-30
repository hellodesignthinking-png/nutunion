"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Bell, X, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refresh();
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Realtime 구독 — 중복 방지 랜덤 suffix
      const uniq = Math.random().toString(36).slice(2, 8);
      channel = supabase
        .channel(`notif-bell-${user.id}-${uniq}`)
        .on("postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => refresh()
        )
        .subscribe();
    })();

    // Auth 상태 변경 시 재구독
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session?.user) refresh();
      else setItems([]);
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function refresh() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link_url, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setItems(data ?? []);
    setLoading(false);
  }

  const unreadCount = items.filter((n) => !n.is_read).length;

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (!res.ok) throw new Error("api");
    } catch {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("user_id", user.id).eq("is_read", false);
    }
  }

  async function markOne(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      if (!res.ok) throw new Error("api");
    } catch {
      const supabase = createClient();
      await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    }
  }

  return (
    <div className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`알림 ${unreadCount > 0 ? `${unreadCount}개 읽지 않음` : ""}`}
        className="relative w-9 h-9 flex items-center justify-center rounded-[var(--ds-radius-md)] hover:bg-[color:var(--neutral-50)] transition-colors"
      >
        <Bell size={16} className="text-[color:var(--neutral-700)]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 bg-[color:var(--liquid-primary)] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[90] bg-transparent cursor-default"
          />
          <div className="absolute right-0 top-11 z-[95] w-[380px] max-w-[calc(100vw-32px)] bg-white border border-[color:var(--neutral-100)] rounded-[var(--ds-radius-xl)] shadow-[var(--ds-shadow-lg)] overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--neutral-100)]">
              <div className="font-semibold text-[14px] text-[color:var(--neutral-900)]">알림</div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead} className="text-[11px] text-[color:var(--neutral-500)] hover:text-[color:var(--neutral-900)] px-2 py-1 inline-flex items-center gap-1">
                    <Check size={10} /> 모두 읽음
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="p-1 hover:bg-[color:var(--neutral-50)] rounded">
                  <X size={14} />
                </button>
              </div>
            </header>

            <ul className="list-none m-0 p-0 max-h-[420px] overflow-y-auto">
              {loading ? (
                <li className="p-6 text-center text-[13px] text-[color:var(--neutral-500)]">불러오는 중...</li>
              ) : items.length === 0 ? (
                <li className="p-8 text-center">
                  <p className="text-[13px] text-[color:var(--neutral-900)] font-medium mb-1">알림이 없어요</p>
                  <p className="text-[11px] text-[color:var(--neutral-500)]">활동이 쌓이면 여기에 모여요</p>
                </li>
              ) : (
                items.map((n) => (
                  <li key={n.id} className={`border-b border-[color:var(--neutral-100)] last:border-0 ${n.is_read ? "" : "bg-[color:var(--liquid-primary)]/[0.03]"}`}>
                    <Link
                      href={n.link_url || "/notifications"}
                      onClick={() => { if (!n.is_read) markOne(n.id); setOpen(false); }}
                      className="block p-3 no-underline hover:bg-[color:var(--neutral-50)]"
                    >
                      <div className="flex items-start gap-2">
                        {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--liquid-primary)] mt-2 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[color:var(--neutral-900)] line-clamp-1">{n.title}</p>
                          {n.body && <p className="text-[12px] text-[color:var(--neutral-500)] line-clamp-2 mt-0.5 leading-[1.5]">{n.body}</p>}
                          <time className="text-[10px] text-[color:var(--neutral-300)] mt-1 block">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ko })}
                          </time>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))
              )}
            </ul>

            <footer className="px-4 py-2.5 border-t border-[color:var(--neutral-100)] bg-[color:var(--neutral-25)]">
              <Link href="/notifications" className="block text-center text-[12px] text-[color:var(--neutral-700)] hover:text-[color:var(--neutral-900)] no-underline">
                전체 보기 →
              </Link>
            </footer>
          </div>
        </>
      )}
    </div>
  );
}
