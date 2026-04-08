"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Bell, Check, CheckCheck, Users, Calendar, Briefcase,
  Star, MessageSquare, UserPlus, AlertCircle, ArrowRight, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { PageHero } from "@/components/shared/page-hero";
import type { Notification } from "@/lib/types";

// ─── 타입별 설정 ────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, {
  icon: any; color: string; bg: string; label: string; getLink?: (meta: any) => string
}> = {
  group_invite:       { icon: Users,        color: "text-nu-blue",   bg: "bg-nu-blue/10",   label: "소모임 초대",   getLink: (m) => m?.group_id ? `/groups/${m.group_id}` : "/groups" },
  group_accepted:     { icon: UserPlus,     color: "text-green-600", bg: "bg-green-50",     label: "가입 승인",    getLink: (m) => m?.group_id ? `/groups/${m.group_id}` : "/groups" },
  group_rejected:     { icon: AlertCircle,  color: "text-nu-red",    bg: "bg-red-50",       label: "가입 거절",    getLink: (_) => "/groups" },
  event_reminder:     { icon: Calendar,     color: "text-nu-amber",  bg: "bg-nu-amber/10",  label: "일정 알림",    getLink: (m) => m?.group_id && m?.event_id ? `/groups/${m.group_id}/events/${m.event_id}` : "/dashboard" },
  waitlist_promoted:  { icon: Star,         color: "text-nu-pink",   bg: "bg-nu-pink/10",   label: "대기 → 승인",  getLink: (m) => m?.group_id ? `/groups/${m.group_id}` : "/groups" },
  project_invite:     { icon: Briefcase,    color: "text-green-600", bg: "bg-green-50",     label: "프로젝트 초대", getLink: (m) => m?.project_id ? `/projects/${m.project_id}` : "/projects" },
  post_reply:         { icon: MessageSquare,color: "text-nu-pink",   bg: "bg-nu-pink/10",   label: "답글",        getLink: (m) => m?.group_id ? `/groups/${m.group_id}` : "/dashboard" },
  mention:            { icon: MessageSquare,color: "text-nu-blue",   bg: "bg-nu-blue/10",   label: "멘션",        getLink: (_) => "/dashboard" },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type] || { icon: Bell, color: "text-nu-muted", bg: "bg-nu-cream", label: type, getLink: () => "/dashboard" };
}

function parseMetadata(meta: any) {
  if (!meta) return {};
  if (typeof meta === "string") { try { return JSON.parse(meta); } catch { return {}; } }
  return meta;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return d === 1 ? "어제" : `${d}일 전`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]   = useState(true);
  const [userId, setUserId]     = useState<string | null>(null);
  const [filter, setFilter]     = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(60);

    setNotifications(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 실시간 구독
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("notif-page")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
          toast.info((payload.new as any).title || "새 알림이 도착했습니다");
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  async function markAsRead(id: string) {
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success("모든 알림을 읽음 처리했습니다");
  }

  async function deleteNotif(id: string) {
    const supabase = createClient();
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  async function deleteAll() {
    if (!userId) return;
    if (!confirm("모든 알림을 삭제하시겠습니까?")) return;
    const supabase = createClient();
    await supabase.from("notifications").delete().eq("user_id", userId);
    setNotifications([]);
    toast.success("모든 알림이 삭제되었습니다");
  }

  const displayed = filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // 날짜 그룹핑
  function getGroup(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = diff / 3600000;
    if (h < 24) return "오늘";
    if (h < 48) return "어제";
    if (h < 168) return "이번 주";
    return "이전";
  }

  const grouped = displayed.reduce<Record<string, Notification[]>>((acc, n) => {
    const g = getGroup(n.created_at);
    if (!acc[g]) acc[g] = [];
    acc[g].push(n);
    return acc;
  }, {});

  const groups = ["오늘", "어제", "이번 주", "이전"].filter((g) => grouped[g]?.length);

  return (
    <div className="bg-nu-paper min-h-screen pb-20">
      <PageHero 
        category="Updates"
        title="Notifications"
        description={unreadCount > 0 ? `읽지 않은 알림이 ${unreadCount}개 있습니다. 최근 활동 소식을 확인하세요.` : "모든 알림을 읽었습니다. 새로운 소식이 있으면 알려드릴게요."}
      />

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Actions bar if any */}
        <div className="flex items-center justify-end gap-3 mb-8">
           {unreadCount > 0 && (
             <button onClick={markAllRead}
               className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-blue hover:bg-nu-blue/5 px-4 py-2 border border-nu-blue/20 transition-all">
               <CheckCheck size={12} className="inline mr-1" /> Mark All Read
             </button>
           )}
           {notifications.length > 0 && (
             <button onClick={deleteAll}
               className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-muted hover:text-nu-red px-4 py-2 border border-nu-ink/10 hover:border-nu-red/30 transition-all">
               <Trash2 size={12} className="inline mr-1" /> Clear All
             </button>
           )}
        </div>

      {/* Filter tabs */}
      <div className="flex border-b border-nu-ink/[0.08] mb-6">
        {(["all", "unread"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`font-mono-nu text-[11px] uppercase tracking-widest px-5 py-2.5 border-b-2 transition-colors ${filter === f ? "border-nu-pink text-nu-pink" : "border-transparent text-nu-muted hover:text-nu-ink"}`}>
            {f === "all" ? `전체 (${notifications.length})` : `읽지 않음 (${unreadCount})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-nu-white border border-nu-ink/[0.08] p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-nu-cream shrink-0" />
                <div className="flex-1"><div className="h-4 w-40 bg-nu-cream mb-2" /><div className="h-3 w-64 bg-nu-cream" /></div>
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-16 text-center">
          <Bell size={32} className="mx-auto text-nu-muted/30 mb-4" />
          <p className="text-nu-gray text-sm font-medium">알림이 없습니다</p>
          <p className="text-nu-muted text-xs mt-1">소모임이나 프로젝트에서 활동이 있으면 여기에 표시됩니다</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-16 text-center">
          <CheckCheck size={32} className="mx-auto text-green-500/60 mb-4" />
          <p className="text-nu-gray text-sm">읽지 않은 알림이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group}>
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-3">{group}</p>
              <div className="space-y-2">
                {grouped[group].map((n) => {
                  const cfg    = getConfig(n.type);
                  const meta   = parseMetadata((n as any).metadata);
                  const href   = cfg.getLink ? cfg.getLink(meta) : "/dashboard";
                  const CfgIcon = cfg.icon;

                  return (
                    <div key={n.id}
                      className={`bg-nu-white border flex items-start gap-4 p-4 transition-all group ${n.is_read ? "border-nu-ink/[0.05] opacity-70" : "border-nu-pink/20 shadow-sm"}`}>
                      {/* Icon */}
                      <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${cfg.bg}`}>
                        <CfgIcon size={16} className={cfg.color} />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`font-mono-nu text-[8px] uppercase tracking-widest px-1.5 py-0.5 ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-nu-pink shrink-0" />}
                        </div>
                        <p className="text-sm font-medium text-nu-ink">{n.title}</p>
                        {(n as any).body && (
                          <p className="text-xs text-nu-gray mt-0.5 line-clamp-2">{(n as any).body}</p>
                        )}
                        <p className="font-mono-nu text-[10px] text-nu-muted mt-1.5">{timeAgo(n.created_at)}</p>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {href && href !== "/dashboard" && (
                          <Link href={href} onClick={() => !n.is_read && markAsRead(n.id)}
                            className="p-1.5 text-nu-muted hover:text-nu-blue transition-colors">
                            <ArrowRight size={14} />
                          </Link>
                        )}
                        {!n.is_read && (
                          <button onClick={() => markAsRead(n.id)}
                            className="p-1.5 text-nu-muted hover:text-green-600 transition-colors" title="읽음 처리">
                            <Check size={14} />
                          </button>
                        )}
                        <button onClick={() => deleteNotif(n.id)}
                          className="p-1.5 text-nu-muted hover:text-nu-red transition-colors" title="삭제">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
