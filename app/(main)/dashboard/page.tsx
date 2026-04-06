import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Calendar, Bell, ChevronRight, MapPin, Clock, Briefcase, Activity } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fetch user's groups
  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id, role, groups(id, name, category, description, max_members)")
    .eq("user_id", user.id)
    .eq("status", "active");

  // Fetch upcoming events from user's groups
  const groupIds = memberships?.map((m) => m.group_id) || [];
  const { data: events } = groupIds.length
    ? await supabase
        .from("events")
        .select("*")
        .in("group_id", groupIds)
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(5)
    : { data: [] };

  // Fetch user's projects
  const { data: projectMemberships } = await supabase
    .from("project_members")
    .select("project_id, role, projects(id, title, description, status, category)")
    .eq("user_id", user.id);

  // Notification count
  const { count: notifCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  const nickname = profile?.nickname || "멤버";
  const groupCount = memberships?.length || 0;
  const eventCount = events?.length || 0;
  const projectCount = projectMemberships?.length || 0;

  const catColors: Record<string, string> = {
    space: "bg-nu-blue",
    culture: "bg-nu-amber",
    platform: "bg-nu-ink",
    vibe: "bg-nu-pink",
  };

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-8">
        안녕하세요, {nickname}님
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-nu-blue/10 flex items-center justify-center">
            <Users size={20} className="text-nu-blue" />
          </div>
          <div>
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
              내 소모임
            </p>
            <p className="font-head text-2xl font-extrabold">{groupCount}</p>
          </div>
        </div>
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 flex items-center justify-center">
            <Briefcase size={20} className="text-green-600" />
          </div>
          <div>
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
              내 프로젝트
            </p>
            <p className="font-head text-2xl font-extrabold">{projectCount}</p>
          </div>
        </div>
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-nu-pink/10 flex items-center justify-center">
            <Calendar size={20} className="text-nu-pink" />
          </div>
          <div>
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
              다가오는 일정
            </p>
            <p className="font-head text-2xl font-extrabold">{eventCount}</p>
          </div>
        </div>
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-nu-yellow/10 flex items-center justify-center">
            <Bell size={20} className="text-nu-amber" />
          </div>
          <div>
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
              알림
            </p>
            <p className="font-head text-2xl font-extrabold">{notifCount || 0}</p>
          </div>
        </div>
      </div>

      {/* My Groups */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-head text-xl font-extrabold">내 소모임</h2>
          <Link
            href="/groups"
            className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink no-underline flex items-center gap-1 hover:underline"
          >
            전체보기 <ChevronRight size={14} />
          </Link>
        </div>
        {groupCount === 0 ? (
          <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
            <p className="text-nu-gray mb-4">아직 소모임이 없습니다</p>
            <Link
              href="/groups"
              className="font-mono-nu text-[11px] uppercase tracking-widest bg-nu-ink text-nu-paper px-6 py-3 no-underline hover:bg-nu-pink transition-colors inline-block"
            >
              소모임 탐색하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberships?.map((m: any) => {
              const g = m.groups;
              if (!g) return null;
              return (
                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className="group-card bg-nu-white border border-nu-ink/[0.08] p-5 no-underline block"
                >
                  <span
                    className={`inline-block font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 mb-3 text-white ${catColors[g.category] || "bg-nu-gray"}`}
                  >
                    {g.category}
                  </span>
                  <h3 className="font-head text-lg font-extrabold text-nu-ink mb-1">
                    {g.name}
                  </h3>
                  <p className="text-xs text-nu-gray line-clamp-2">
                    {g.description}
                  </p>
                  <span className="font-mono-nu text-[10px] text-nu-muted mt-3 block">
                    {m.role === "host" ? "호스트" : "멤버"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* My Projects */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-head text-xl font-extrabold">내 프로젝트</h2>
          <Link
            href="/projects"
            className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink no-underline flex items-center gap-1 hover:underline"
          >
            전체보기 <ChevronRight size={14} />
          </Link>
        </div>
        {projectCount === 0 ? (
          <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
            <p className="text-nu-gray mb-4">아직 참여 중인 프로젝트가 없습니다</p>
            <Link
              href="/projects"
              className="font-mono-nu text-[11px] uppercase tracking-widest bg-nu-ink text-nu-paper px-6 py-3 no-underline hover:bg-nu-pink transition-colors inline-block"
            >
              프로젝트 탐색하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectMemberships?.map((pm: any) => {
              const p = pm.projects;
              if (!p) return null;
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="bg-nu-white border border-nu-ink/[0.08] p-5 no-underline block hover:border-nu-pink/30 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase size={14} className="text-green-600" />
                    <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 ${p.status === "active" ? "bg-green-50 text-green-700" : "bg-nu-ink/5 text-nu-muted"}`}>
                      {p.status}
                    </span>
                  </div>
                  <h3 className="font-head text-lg font-extrabold text-nu-ink mb-1">
                    {p.title}
                  </h3>
                  <p className="text-xs text-nu-gray line-clamp-2">
                    {p.description}
                  </p>
                  <span className="font-mono-nu text-[10px] text-nu-muted mt-3 block">
                    {pm.role}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="mb-12">
        <h2 className="font-head text-xl font-extrabold mb-6 flex items-center gap-2">
          <Activity size={18} /> 최근 활동
        </h2>
        <RecentActivity userId={user.id} groupIds={groupIds} />
      </div>

      {/* Upcoming Events */}
      <div>
        <h2 className="font-head text-xl font-extrabold mb-6">다가오는 일정</h2>
        {eventCount === 0 ? (
          <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
            <p className="text-nu-gray">예정된 일정이 없습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {events?.map((evt: any) => (
              <Link
                key={evt.id}
                href={`/groups/${evt.group_id}/events/${evt.id}`}
                className="bg-nu-white border border-nu-ink/[0.08] p-5 flex items-center gap-5 no-underline hover:border-nu-pink/30 transition-colors"
              >
                <div className="w-14 h-14 bg-nu-pink/10 flex flex-col items-center justify-center shrink-0">
                  <span className="font-head text-lg font-extrabold text-nu-pink leading-none">
                    {new Date(evt.start_at).getDate()}
                  </span>
                  <span className="font-mono-nu text-[9px] uppercase text-nu-pink/70">
                    {new Date(evt.start_at).toLocaleDateString("ko", { month: "short" })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-head text-sm font-bold text-nu-ink truncate">
                    {evt.title}
                  </h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1 text-xs text-nu-muted">
                      <Clock size={12} />
                      {new Date(evt.start_at).toLocaleTimeString("ko", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {evt.location && (
                      <span className="flex items-center gap-1 text-xs text-nu-muted">
                        <MapPin size={12} />
                        {evt.location}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-nu-muted shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function RecentActivity({ userId, groupIds }: { userId: string; groupIds: string[] }) {
  const supabase = await (await import("@/lib/supabase/server")).createClient();

  // Fetch recent project updates from user's projects
  const { data: projUpdates } = await supabase
    .from("project_updates")
    .select("id, content, type, created_at, author:profiles!project_updates_author_id_fkey(nickname), project:projects!project_updates_project_id_fkey(title)")
    .order("created_at", { ascending: false })
    .limit(5);

  // Fetch recent crew posts from user's groups
  const { data: crewPosts } = groupIds.length > 0
    ? await supabase
        .from("crew_posts")
        .select("id, content, type, created_at, author:profiles!crew_posts_author_id_fkey(nickname), group:groups!crew_posts_group_id_fkey(name)")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  // Merge and sort
  const activities = [
    ...(projUpdates || []).map((u: any) => ({ ...u, source: "project", sourceName: u.project?.title })),
    ...(crewPosts || []).map((p: any) => ({ ...p, source: "crew", sourceName: p.group?.name })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);

  if (activities.length === 0) {
    return (
      <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
        <p className="text-nu-gray text-sm">최근 활동이 없습니다</p>
      </div>
    );
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  }

  return (
    <div className="flex flex-col gap-2">
      {activities.map((a: any) => (
        <div key={a.id} className="bg-nu-white border border-nu-ink/[0.06] p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-nu-cream flex items-center justify-center font-head text-[10px] font-bold text-nu-ink shrink-0">
            {(a.author?.nickname || "U").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium">{a.author?.nickname}</span>
              <span className={`font-mono-nu text-[8px] uppercase tracking-widest px-1.5 py-0.5 ${a.source === "project" ? "bg-green-50 text-green-600" : "bg-nu-blue/10 text-nu-blue"}`}>
                {a.source === "project" ? "프로젝트" : "크루"}
              </span>
              <span className="font-mono-nu text-[9px] text-nu-muted">{a.sourceName}</span>
              <span className="font-mono-nu text-[9px] text-nu-muted/60">{timeAgo(a.created_at)}</span>
            </div>
            <p className="text-xs text-nu-gray mt-1 line-clamp-2">{a.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
