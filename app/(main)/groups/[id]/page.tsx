import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, Users, Settings, Plus, MapPin, Clock, MessageCircle, BookOpen, FolderOpen } from "lucide-react";
import { GroupActions } from "@/components/groups/group-actions";
import { CrewActivityFeed } from "@/components/crews/crew-activity-feed";
import { CrewProjects } from "@/components/crews/crew-projects";
import { ExternalLinks } from "@/components/integrations/external-links";
import { WorkspaceLinks } from "@/components/integrations/workspace-links";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: group } = await supabase.from("groups").select("name, description").eq("id", id).single();
  return {
    title: group ? `${group.name} — nutunion` : "소모임 — nutunion",
    description: group?.description || "nutunion 소모임",
  };
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group } = await supabase
    .from("groups")
    .select("*, host:profiles!groups_host_id_fkey(id, nickname, avatar_url)")
    .eq("id", id)
    .single();

  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("*, profile:profiles(*)")
    .eq("group_id", id)
    .eq("status", "active")
    .order("joined_at");

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("group_id", id)
    .gte("start_at", new Date().toISOString())
    .order("start_at")
    .limit(10);

  // Also fetch upcoming meetings
  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, title, scheduled_at, duration_min, location, status")
    .eq("group_id", id)
    .in("status", ["upcoming", "in_progress"])
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(10);

  // Check all membership states (including pending/waitlist)
  const { data: userMembership } = await supabase
    .from("group_members")
    .select("status")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const isMember = members?.some((m) => m.user_id === user.id);
  const isHost = group.host_id === user.id;
  const membershipStatus = userMembership?.status as "active" | "pending" | "waitlist" | null;

  const catColors: Record<string, string> = {
    space: "bg-nu-blue",
    culture: "bg-nu-amber",
    platform: "bg-nu-ink",
    vibe: "bg-nu-pink",
  };

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-8">
        <div>
          <span
            className={`inline-block font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1 text-white mb-3 ${catColors[group.category] || "bg-nu-gray"}`}
          >
            {group.category}
          </span>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">
            {group.name}
          </h1>
          <p className="text-nu-gray mt-2 max-w-xl">{group.description}</p>
          <p className="font-mono-nu text-[10px] text-nu-muted mt-3">
            호스트: {group.host?.nickname || "알 수 없음"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(isMember || isHost) && (
            <>
              <Link
                href={`/groups/${id}/meetings`}
                className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-blue text-nu-paper no-underline hover:bg-nu-blue/90 transition-colors inline-flex items-center gap-2"
              >
                <BookOpen size={14} /> 미팅
              </Link>
              <Link
                href={`/groups/${id}/chat`}
                className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-colors inline-flex items-center gap-2"
              >
                <MessageCircle size={14} /> 채팅
              </Link>
              <Link
                href={`/groups/${id}/resources`}
                className="font-mono-nu text-[11px] uppercase tracking-widest px-4 py-3 border border-nu-ink/20 text-nu-graphite no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-2"
              >
                <FolderOpen size={14} /> 리소스
              </Link>
            </>
          )}
          {isHost && (
            <>
              <Link
                href={`/groups/${id}/events/create`}
                className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-pink text-nu-paper no-underline hover:bg-nu-pink/90 transition-colors inline-flex items-center gap-2"
              >
                <Plus size={14} /> 일정 추가
              </Link>
              <Link
                href={`/groups/${id}/settings`}
                className="font-mono-nu text-[11px] uppercase tracking-widest px-4 py-3 border border-nu-ink/20 text-nu-graphite no-underline hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-2"
              >
                <Settings size={14} />
              </Link>
            </>
          )}
          {!isHost && (
            <GroupActions groupId={id} userId={user.id} maxMembers={group.max_members} memberCount={members?.length || 0} membershipStatus={membershipStatus} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Events */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-head text-xl font-extrabold flex items-center gap-2">
              <Calendar size={18} /> 다가오는 일정
            </h2>
            {isMember && (
              <Link
                href={`/groups/${id}/schedule`}
                className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink no-underline hover:underline"
              >
                캘린더 보기
              </Link>
            )}
          </div>

          {(() => {
            // Combine events and meetings into one sorted list
            const allItems = [
              ...(events || []).map((evt: any) => ({
                id: evt.id,
                title: evt.title,
                dateTime: evt.start_at,
                location: evt.location,
                maxAttendees: evt.max_attendees,
                type: "event" as const,
              })),
              ...(meetings || []).map((mtg: any) => ({
                id: mtg.id,
                title: mtg.title,
                dateTime: mtg.scheduled_at,
                location: mtg.location,
                duration: mtg.duration_min,
                type: "meeting" as const,
              })),
            ].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

            if (allItems.length === 0) {
              return (
                <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
                  <p className="text-nu-gray">예정된 일정이 없습니다</p>
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-3">
                {allItems.map((item) => (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={item.type === "event" ? `/groups/${id}/events/${item.id}` : `/groups/${id}/meetings/${item.id}`}
                    className="bg-nu-white border border-nu-ink/[0.08] p-5 flex items-center gap-5 no-underline hover:border-nu-pink/30 transition-colors"
                  >
                    <div className={`w-14 h-14 flex flex-col items-center justify-center shrink-0 ${item.type === "meeting" ? "bg-nu-blue/10" : "bg-nu-pink/10"}`}>
                      <span className={`font-head text-lg font-extrabold leading-none ${item.type === "meeting" ? "text-nu-blue" : "text-nu-pink"}`}>
                        {new Date(item.dateTime).getDate()}
                      </span>
                      <span className={`font-mono-nu text-[9px] uppercase ${item.type === "meeting" ? "text-nu-blue/70" : "text-nu-pink/70"}`}>
                        {new Date(item.dateTime).toLocaleDateString("ko", { month: "short" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-head text-sm font-bold text-nu-ink truncate">
                          {item.title}
                        </h3>
                        {item.type === "meeting" && (
                          <span className="font-mono-nu text-[8px] uppercase tracking-wider px-1.5 py-0.5 bg-nu-blue/10 text-nu-blue">미팅</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-nu-muted">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(item.dateTime).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}
                          {item.type === "meeting" && item.duration && ` (${item.duration}분)`}
                        </span>
                        {item.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} />
                            {item.location}
                          </span>
                        )}
                        {item.type === "event" && item.maxAttendees && (
                          <span className="flex items-center gap-1">
                            <Users size={12} />
                            최대 {item.maxAttendees}명
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            );
          })()}

          {/* Activity Feed */}
          <div className="mt-8">
            <h2 className="font-head text-xl font-extrabold flex items-center gap-2 mb-4">
              활동
            </h2>
            <CrewActivityFeed groupId={id} userId={user.id} initialPosts={[]} canPost={!!isMember} isHost={isHost} isAdmin={false} />
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* Workspace Links (Slack, Notion, Google, etc.) */}
          <div className="mb-6">
            <WorkspaceLinks
              workspaceType="crew"
              workspaceId={id}
              canEdit={isHost}
              kakaoUrl={group.kakao_chat_url}
              driveUrl={group.google_drive_url}
            />
          </div>

          {/* Linked Projects */}
          <div className="mb-8">
            <h2 className="font-head text-xl font-extrabold flex items-center gap-2 mb-4">
              연결된 프로젝트
            </h2>
            <CrewProjects groupId={id} />
          </div>

          {/* Members */}
          <h2 className="font-head text-xl font-extrabold flex items-center gap-2 mb-4">
            <Users size={18} /> 멤버 ({members?.length || 0})
          </h2>
          <div className="bg-nu-white border border-nu-ink/[0.08] p-4">
            <div className="flex flex-col gap-3">
              {members?.map((m: any) => (
                <div key={m.user_id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-nu-cream flex items-center justify-center font-head text-xs font-bold text-nu-ink">
                    {(m.profile?.nickname || "U").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.profile?.nickname}
                    </p>
                    <p className="text-[10px] text-nu-muted capitalize">
                      {m.role === "host" ? "호스트" : m.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
