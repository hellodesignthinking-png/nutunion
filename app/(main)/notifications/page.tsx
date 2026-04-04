"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import type { Notification } from "@/lib/types";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setNotifications(data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function markAsRead(id: string) {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }

  async function markAllRead() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success("모든 알림을 읽음 처리했습니다");
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const typeIcons: Record<string, string> = {
    event_reminder: "bg-nu-blue/10 text-nu-blue",
    group_invite: "bg-nu-pink/10 text-nu-pink",
    waitlist_promoted: "bg-green-50 text-green-600",
    group_accepted: "bg-nu-yellow/10 text-nu-amber",
  };

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">
            알림
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-nu-muted mt-1">
              읽지 않은 알림 {unreadCount}개
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-blue hover:underline flex items-center gap-1.5"
          >
            <CheckCheck size={14} /> 모두 읽음
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-nu-white border border-nu-ink/[0.08] p-5 animate-pulse">
              <div className="h-4 w-48 bg-nu-cream mb-2" />
              <div className="h-3 w-72 bg-nu-cream" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-12 text-center">
          <Bell size={24} className="mx-auto text-nu-muted mb-3" />
          <p className="text-nu-gray">알림이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.is_read && markAsRead(n.id)}
              className={`text-left bg-nu-white border p-5 flex items-start gap-4 transition-colors w-full ${
                n.is_read
                  ? "border-nu-ink/[0.06] opacity-60"
                  : "border-nu-pink/20 hover:border-nu-pink/40"
              }`}
            >
              <div
                className={`w-10 h-10 flex items-center justify-center shrink-0 ${
                  typeIcons[n.type] || "bg-nu-cream text-nu-gray"
                }`}
              >
                <Bell size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-head text-sm font-bold text-nu-ink">
                    {n.title}
                  </h3>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-nu-pink shrink-0" />
                  )}
                </div>
                {n.body && (
                  <p className="text-xs text-nu-gray mt-1 line-clamp-2">
                    {n.body}
                  </p>
                )}
                <p className="font-mono-nu text-[10px] text-nu-muted mt-2">
                  {timeAgo(n.created_at)}
                </p>
              </div>
              {!n.is_read && (
                <Check size={14} className="text-nu-muted mt-1 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
