"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Bell,
  X,
  Check,
  Award,
  Shield,
  Calendar,
  DollarSign,
  MessageCircle,
  Layers,
  ClipboardList,
  Sparkles,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  category: string;
  link_url: string | null;
  actor_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  actor?: {
    id: string;
    avatar_url: string | null;
    full_name: string | null;
  };
}

type NotificationCategory = "전체" | "볼트" | "너트" | "정산" | "시스템";

const categoryMap: Record<NotificationCategory, string> = {
  "전체": "all",
  "볼트": "project",
  "너트": "group",
  "정산": "settlement",
  "시스템": "system",
};

const typeIconMap: Record<
  string,
  { icon: any; color: string }
> = {
  project_update: { icon: Layers, color: "text-nu-blue" },
  milestone_complete: { icon: CheckCircle2, color: "text-nu-pink" },
  settlement_ready: { icon: DollarSign, color: "text-nu-amber" },
  endorsement: { icon: Award, color: "text-green-600" },
  badge_earned: { icon: Shield, color: "text-purple-600" },
  meeting_reminder: { icon: Calendar, color: "text-nu-blue" },
  task_assigned: { icon: ClipboardList, color: "text-nu-muted" },
  comment: { icon: MessageCircle, color: "text-nu-muted" },
  best_practice: { icon: Sparkles, color: "text-nu-pink" },
};

function getIconComponent(type: string): any {
  const config = typeIconMap[type];
  return config?.icon || Bell;
}

function getTypeColor(type: string): string {
  const config = typeIconMap[type];
  return config?.color || "text-nu-muted";
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "방금 전";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export function NotificationCenter() {
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<NotificationCategory>("전체");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const pageSize = 20;

  // Get current user
  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    }
    getUser();
  }, []);

  // Load initial notifications
  useEffect(() => {
    if (!userId) return;

    const loadNotifications = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(pageSize);

        const { data, error } = await query;
        if (error) throw error;

        setNotifications(data || []);
        setHasMore((data?.length || 0) >= pageSize);
      } catch (error) {
        console.error("Failed to load notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [userId]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:user_id=eq.${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  // Load more notifications
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !userId) return;

    setLoadingMore(true);
    try {
      const offset = (page + 1) * pageSize;
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      const newNotifs = data || [];
      setNotifications((prev) => [...prev, ...newNotifs]);
      setPage((prev) => prev + 1);
      setHasMore(newNotifs.length >= pageSize);
    } catch (error) {
      console.error("Failed to load more notifications:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [page, userId, hasMore, loadingMore]);

  // Mark notification as read
  const handleMarkAsRead = useCallback(
    async (notificationId: string, linkUrl?: string | null) => {
      try {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", notificationId);

        if (error) throw error;

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );

        if (linkUrl) {
          router.push(linkUrl);
        }
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    },
    [supabase, router]
  );

  // Mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, [userId, supabase]);

  // Filter notifications
  const filteredNotifications = useMemo(
    () =>
      notifications.filter((n) => {
        if (selectedCategory === "전체") return true;
        const categoryKey = categoryMap[selectedCategory];
        return n.category === categoryKey;
      }),
    [notifications, selectedCategory]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  // Group notifications by time period
  const groupedNotifications = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    const groups: { label: string; items: Notification[] }[] = [];
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const older: Notification[] = [];

    for (const n of filteredNotifications) {
      const created = new Date(n.created_at);
      if (created >= todayStart) today.push(n);
      else if (created >= yesterdayStart) yesterday.push(n);
      else older.push(n);
    }

    if (today.length > 0) groups.push({ label: "오늘", items: today });
    if (yesterday.length > 0) groups.push({ label: "어제", items: yesterday });
    if (older.length > 0) groups.push({ label: "이전", items: older });

    return groups;
  }, [filteredNotifications]);

  // Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 hover:bg-nu-ink/5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nu-pink focus-visible:ring-offset-2"
        aria-label={`알림 센터${unreadCount > 0 ? ` — 읽지 않은 알림 ${unreadCount}개` : ""}`}
        aria-expanded={open}
      >
        <Bell size={20} className="text-nu-ink" />
        {unreadCount > 0 && (
          <div className="absolute top-1 right-1 w-5 h-5 bg-nu-pink rounded-full flex items-center justify-center">
            <span className="font-mono-nu text-[9px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          </div>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-nu-white border-2 border-nu-ink shadow-2xl rounded-lg overflow-hidden flex flex-col max-h-[70vh] animate-in slide-in-from-top-2 duration-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-nu-ink/10">
            <h2 className="font-head text-sm font-bold text-nu-ink">
              알림 센터
            </h2>
            <button
              onClick={handleMarkAllAsRead}
              className="text-[11px] font-mono-nu font-bold text-nu-blue hover:text-nu-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nu-blue focus-visible:ring-offset-1"
              aria-label="모든 알림을 읽음으로 표시"
            >
              모두 읽음
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 px-4 py-3 border-b border-nu-ink/10 overflow-x-auto">
            {(["전체", "볼트", "너트", "정산", "시스템"] as NotificationCategory[]).map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setPage(0);
                  }}
                  className={`px-3 py-1.5 text-[11px] font-bold font-mono-nu rounded-full whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? "bg-nu-pink text-white"
                      : "bg-nu-ink/5 text-nu-ink hover:bg-nu-ink/10"
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-nu-blue" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-nu-muted">
                <Bell size={24} className="text-nu-muted/20 mb-2" />
                <p className="text-sm">새로운 알림이 없습니다</p>
              </div>
            ) : (
              <div>
                {groupedNotifications.map((group) => (
                  <div key={group.label}>
                    <div className="sticky top-0 z-10 px-4 py-1.5 bg-nu-cream/60 backdrop-blur-sm border-b border-nu-ink/5">
                      <span className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-muted">
                        {group.label}
                      </span>
                    </div>
                    <div className="divide-y divide-nu-ink/5">
                      {group.items.map((notification) => {
                        const IconComponent = getIconComponent(notification.type);
                        const iconColor = getTypeColor(notification.type);

                        return (
                          <button
                            key={notification.id}
                            onClick={() =>
                              handleMarkAsRead(
                                notification.id,
                                notification.link_url
                              )
                            }
                            aria-label={`${notification.title}${!notification.is_read ? " — 읽지 않음" : ""}`}
                            className={`w-full px-4 py-3 text-left hover:bg-nu-ink/5 transition-colors ${
                              !notification.is_read
                                ? "bg-nu-pink/5"
                                : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Actor Avatar or Icon */}
                              {notification.actor?.avatar_url ? (
                                <img
                                  src={notification.actor.avatar_url}
                                  alt={notification.actor.full_name || ""}
                                  className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
                                />
                              ) : (
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-nu-ink/10`}>
                                  <IconComponent
                                    size={16}
                                    className={iconColor}
                                  />
                                </div>
                              )}

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-head text-sm font-bold text-nu-ink truncate">
                                    {notification.title}
                                  </p>
                                  {!notification.is_read && (
                                    <div className="w-2 h-2 rounded-full bg-nu-pink flex-shrink-0 mt-2" />
                                  )}
                                </div>
                                {notification.body && (
                                  <p className="text-xs text-nu-muted mt-1 line-clamp-2">
                                    {notification.body}
                                  </p>
                                )}
                                <p className="font-mono-nu text-[9px] text-nu-muted/60 mt-1.5">
                                  {timeAgo(notification.created_at)}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Load More Button */}
          {hasMore && filteredNotifications.length > 0 && (
            <div className="border-t border-nu-ink/10 px-4 py-3">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full px-4 py-2 text-[11px] font-bold font-mono-nu text-nu-blue hover:text-nu-ink transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    로딩 중...
                  </span>
                ) : (
                  "더 보기"
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
