import { createClient } from "@/lib/supabase/server";
import {
  Users,
  Layers,
  Calendar,
  FileText,
  Briefcase,
  UserPlus,
  FolderGit2,
  MessageSquare,
  Pencil,
  Upload,
  UserCog,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { count: userCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: groupCount } = await supabase
    .from("groups")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: eventCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .gte("start_at", new Date().toISOString());

  const { count: contentCount } = await supabase
    .from("page_content")
    .select("*", { count: "exact", head: true });

  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // Recent signups
  const { data: recentUsers } = await supabase
    .from("profiles")
    .select("id, nickname, email, avatar_url, role, can_create_crew, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  // Recent project updates
  const { data: recentProjectUpdates } = await supabase
    .from("project_updates")
    .select("id, content, type, created_at, author:profiles!project_updates_author_id_fkey(nickname, avatar_url), project:projects!project_updates_project_id_fkey(title)")
    .order("created_at", { ascending: false })
    .limit(5);

  // Recent crew posts
  const { data: recentCrewPosts } = await supabase
    .from("crew_posts")
    .select("id, content, type, created_at, author:profiles!crew_posts_author_id_fkey(nickname, avatar_url), group:groups!crew_posts_group_id_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  const stats = [
    { label: "총 회원", count: userCount || 0, icon: Users, color: "bg-nu-blue/10 text-nu-blue", href: "/admin/users" },
    { label: "활성 소모임", count: groupCount || 0, icon: Layers, color: "bg-nu-pink/10 text-nu-pink", href: "/admin/groups" },
    { label: "예정 일정", count: eventCount || 0, icon: Calendar, color: "bg-nu-yellow/10 text-nu-amber", href: "/admin" },
    { label: "콘텐츠 항목", count: contentCount || 0, icon: FileText, color: "bg-nu-ink/5 text-nu-ink", href: "/admin/content" },
    { label: "활성 프로젝트", count: projectCount || 0, icon: Briefcase, color: "bg-green-50 text-green-600", href: "/admin/projects" },
  ];

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("ko", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getRoleBadge(role: string, canCreateCrew: boolean) {
    if (role === "admin") {
      return <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-pink text-white px-2 py-0.5 inline-block">Admin</span>;
    }
    if (canCreateCrew) {
      return <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-blue/10 text-nu-blue px-2 py-0.5 inline-block">Creator</span>;
    }
    return <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-ink/5 text-nu-muted px-2 py-0.5 inline-block">Member</span>;
  }

  const updateTypeLabels: Record<string, string> = {
    post: "게시글",
    milestone_update: "마일스톤",
    status_change: "상태변경",
    member_joined: "멤버합류",
    announcement: "공지",
    event_recap: "일정정리",
  };

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-8">
        관리자 대시보드
      </h1>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-nu-white border border-nu-ink/[0.08] p-6 hover:border-nu-ink/20 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 flex items-center justify-center ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <div>
                <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
                  {stat.label}
                </p>
                <p className="font-head text-3xl font-extrabold">{stat.count}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions + System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        {/* Quick Actions */}
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
          <h2 className="font-head text-sm font-bold text-nu-ink mb-4">빠른 작업</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "회원 등급 관리", href: "/admin/users", icon: UserCog, color: "text-nu-pink" },
              { label: "소모임 관리", href: "/admin/groups", icon: Layers, color: "text-nu-blue" },
              { label: "프로젝트 관리", href: "/admin/projects", icon: Briefcase, color: "text-green-600" },
              { label: "콘텐츠 수정", href: "/admin/content", icon: Pencil, color: "text-nu-amber" },
              { label: "미디어 업로드", href: "/admin/media", icon: Upload, color: "text-nu-graphite" },
              { label: "사이트 보기", href: "/", icon: ExternalLink, color: "text-nu-graphite" },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 px-4 py-3 border border-nu-ink/[0.06] hover:border-nu-ink/20 hover:bg-nu-ink/[0.02] transition-colors no-underline"
              >
                <action.icon size={16} className={action.color} />
                <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
          <h2 className="font-head text-sm font-bold text-nu-ink mb-4">시스템 상태</h2>
          <div className="flex flex-col gap-3">
            {[
              { label: "Supabase 연결", status: "활성" },
              { label: "Storage 활성", status: "활성" },
              { label: "Realtime 활성", status: "활성" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                <span className="font-mono-nu text-[11px] tracking-widest text-nu-graphite">{item.label}</span>
                <span className="ml-auto font-mono-nu text-[10px] uppercase tracking-widest text-green-600">{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Sections — 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Members + Projects */}
        <div className="flex flex-col gap-6">
        {/* Recent Signups */}
        <div className="bg-nu-white border border-nu-ink/[0.08]">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-nu-ink/[0.08]">
            <UserPlus size={16} className="text-nu-blue" />
            <h2 className="font-head text-sm font-bold text-nu-ink">최근 가입 회원</h2>
          </div>
          <div className="divide-y divide-nu-ink/[0.04]">
            {(recentUsers || []).length === 0 && (
              <div className="p-6 text-center text-nu-muted text-sm">가입 회원이 없습니다</div>
            )}
            {(recentUsers || []).map((u: any) => (
              <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-nu-ink/5 flex items-center justify-center shrink-0 overflow-hidden">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-mono-nu text-[10px] text-nu-muted uppercase">
                      {(u.nickname || u.email || "?").charAt(0)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{u.nickname || "unnamed"}</span>
                    {getRoleBadge(u.role, u.can_create_crew)}
                  </div>
                  <p className="text-[11px] text-nu-muted truncate">{u.email}</p>
                </div>
                <span className="font-mono-nu text-[10px] text-nu-muted shrink-0">
                  {formatDate(u.created_at)}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/admin/users"
            className="block text-center py-3 border-t border-nu-ink/[0.08] font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:bg-nu-blue/5 transition-colors"
          >
            전체 보기
          </Link>
        </div>

        {/* Recent Project Activity */}
        <div className="bg-nu-white border border-nu-ink/[0.08]">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-nu-ink/[0.08]">
            <FolderGit2 size={16} className="text-green-600" />
            <h2 className="font-head text-sm font-bold text-nu-ink">최근 프로젝트 활동</h2>
          </div>
          <div className="divide-y divide-nu-ink/[0.04]">
            {(recentProjectUpdates || []).length === 0 && (
              <div className="p-6 text-center text-nu-muted text-sm">프로젝트 활동이 없습니다</div>
            )}
            {(recentProjectUpdates || []).map((u: any) => (
              <div key={u.id} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 bg-nu-ink/5 flex items-center justify-center shrink-0 overflow-hidden">
                    {u.author?.avatar_url ? (
                      <img src={u.author.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-mono-nu text-[8px] text-nu-muted uppercase">
                        {(u.author?.nickname || "?").charAt(0)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium truncate">{u.author?.nickname || "unknown"}</span>
                  <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-green-50 text-green-600 px-1.5 py-0.5 shrink-0">
                    {updateTypeLabels[u.type] || u.type}
                  </span>
                </div>
                <p className="text-xs text-nu-muted truncate pl-7">{u.project?.title || "unknown project"}</p>
                <p className="text-xs text-nu-graphite truncate pl-7 mt-0.5">{u.content}</p>
                <p className="font-mono-nu text-[10px] text-nu-muted pl-7 mt-1">{formatDate(u.created_at)}</p>
              </div>
            ))}
          </div>
          <Link
            href="/admin/projects"
            className="block text-center py-3 border-t border-nu-ink/[0.08] font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:bg-nu-blue/5 transition-colors"
          >
            전체 보기
          </Link>
        </div>
        </div>

        {/* Right column: Crews */}
        <div className="flex flex-col gap-6">
        {/* Recent Crew Activity */}
        <div className="bg-nu-white border border-nu-ink/[0.08]">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-nu-ink/[0.08]">
            <MessageSquare size={16} className="text-nu-pink" />
            <h2 className="font-head text-sm font-bold text-nu-ink">최근 크루 활동</h2>
          </div>
          <div className="divide-y divide-nu-ink/[0.04]">
            {(recentCrewPosts || []).length === 0 && (
              <div className="p-6 text-center text-nu-muted text-sm">크루 활동이 없습니다</div>
            )}
            {(recentCrewPosts || []).map((p: any) => (
              <div key={p.id} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 bg-nu-ink/5 flex items-center justify-center shrink-0 overflow-hidden">
                    {p.author?.avatar_url ? (
                      <img src={p.author.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-mono-nu text-[8px] text-nu-muted uppercase">
                        {(p.author?.nickname || "?").charAt(0)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium truncate">{p.author?.nickname || "unknown"}</span>
                  <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-nu-pink/10 text-nu-pink px-1.5 py-0.5 shrink-0">
                    {updateTypeLabels[p.type] || p.type}
                  </span>
                </div>
                <p className="text-xs text-nu-muted truncate pl-7">{p.group?.name || "unknown crew"}</p>
                <p className="text-xs text-nu-graphite truncate pl-7 mt-0.5">{p.content}</p>
                <p className="font-mono-nu text-[10px] text-nu-muted pl-7 mt-1">{formatDate(p.created_at)}</p>
              </div>
            ))}
          </div>
          <Link
            href="/admin/groups"
            className="block text-center py-3 border-t border-nu-ink/[0.08] font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:bg-nu-blue/5 transition-colors"
          >
            전체 보기
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
