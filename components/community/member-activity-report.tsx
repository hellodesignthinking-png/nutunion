"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageSquare, Calendar, Briefcase, Users, BookOpen, FileText, Star, Loader2 } from "lucide-react";

interface MemberReport {
  nickname: string;
  name: string;
  email: string;
  specialty: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  created_at: string;
  // Activity stats
  crewCount: number;
  crewNames: string[];
  projectCount: number;
  projectNames: string[];
  postCount: number;
  commentCount: number;
  meetingCount: number;
  eventCount: number;
  tasksDone: number;
  recentPosts: { content: string; created_at: string; source: string }[];
}

export function MemberActivityReport({ userId }: { userId: string }) {
  const [report, setReport] = useState<MemberReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadReport();
  }, [userId]);

  async function loadReport() {
    const supabase = createClient();

    // Profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!profile) { setLoading(false); return; }

    // Crews
    const { data: crews } = await supabase
      .from("group_members")
      .select("role, groups(name)")
      .eq("user_id", userId)
      .eq("status", "active");

    // Projects
    const { data: projects } = await supabase
      .from("project_members")
      .select("role, projects(title)")
      .eq("user_id", userId);

    // Posts count
    const { count: postCount } = await supabase
      .from("crew_posts")
      .select("*", { count: "exact", head: true })
      .eq("author_id", userId);

    // Project updates count
    const { count: updateCount } = await supabase
      .from("project_updates")
      .select("*", { count: "exact", head: true })
      .eq("author_id", userId);

    // Comments count
    const { count: commentCount } = await supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("author_id", userId);

    // Events attended
    const { count: eventCount } = await supabase
      .from("event_attendees")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "registered");

    // Tasks completed
    const { count: tasksDone } = await supabase
      .from("project_tasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_to", userId)
      .eq("status", "done");

    // Meetings organized/attended (as organizer)
    const { count: meetingCount } = await supabase
      .from("meetings")
      .select("*", { count: "exact", head: true })
      .eq("organizer_id", userId);

    // Recent posts (last 5 across crew posts + project updates)
    const { data: recentCrewPosts } = await supabase
      .from("crew_posts")
      .select("content, created_at, groups(name)")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: recentUpdates } = await supabase
      .from("project_updates")
      .select("content, created_at, projects(title)")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .limit(3);

    const recentPosts = [
      ...(recentCrewPosts || []).map((p: any) => ({
        content: p.content,
        created_at: p.created_at,
        source: `크루: ${p.groups?.name || ""}`,
      })),
      ...(recentUpdates || []).map((p: any) => ({
        content: p.content,
        created_at: p.created_at,
        source: `프로젝트: ${p.projects?.title || ""}`,
      })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    setReport({
      nickname: profile.nickname || "",
      name: profile.name || "",
      email: profile.email || "",
      specialty: profile.specialty,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      role: profile.role,
      created_at: profile.created_at,
      crewCount: crews?.length || 0,
      crewNames: (crews || []).map((c: any) => {
        const g = Array.isArray(c.groups) ? c.groups[0] : c.groups;
        return g?.name || "";
      }).filter(Boolean),
      projectCount: projects?.length || 0,
      projectNames: (projects || []).map((p: any) => {
        const proj = Array.isArray(p.projects) ? p.projects[0] : p.projects;
        return proj?.title || "";
      }).filter(Boolean),
      postCount: (postCount || 0) + (updateCount || 0),
      commentCount: commentCount || 0,
      meetingCount: meetingCount || 0,
      eventCount: eventCount || 0,
      tasksDone: tasksDone || 0,
      recentPosts,
    });
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-nu-muted" size={20} />
      </div>
    );
  }

  if (!report) return null;

  const catColors: Record<string, string> = {
    space: "bg-nu-blue",
    culture: "bg-nu-amber",
    platform: "bg-nu-ink",
    vibe: "bg-nu-pink",
  };

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "오늘";
    if (days < 30) return `${days}일 전`;
    if (days < 365) return `${Math.floor(days / 30)}개월 전`;
    return `${Math.floor(days / 365)}년 전`;
  }

  // Activity score
  const activityScore = report.postCount * 3 + report.commentCount * 1 + report.eventCount * 5 + report.tasksDone * 4 + report.meetingCount * 5;
  const level = activityScore >= 50 ? "매우 활발" : activityScore >= 20 ? "활발" : activityScore >= 5 ? "보통" : "신규";
  const levelColor = activityScore >= 50 ? "text-green-600 bg-green-50" : activityScore >= 20 ? "text-nu-blue bg-nu-blue/10" : activityScore >= 5 ? "text-nu-amber bg-nu-amber/10" : "text-nu-muted bg-nu-cream";

  return (
    <div className="bg-nu-white border border-nu-ink/[0.06] overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-start gap-4">
        {report.avatar_url ? (
          <img src={report.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-nu-cream flex items-center justify-center font-head text-xl font-bold text-nu-ink shrink-0">
            {report.nickname.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-head text-base font-bold">{report.nickname}</h3>
            <span className={`font-mono-nu text-[8px] uppercase tracking-widest px-2 py-0.5 ${levelColor}`}>{level}</span>
            {report.specialty && (
              <span className={`font-mono-nu text-[7px] uppercase tracking-widest px-1.5 py-0.5 text-white ${catColors[report.specialty] || "bg-nu-gray"}`}>
                {report.specialty}
              </span>
            )}
          </div>
          <p className="text-xs text-nu-muted">{report.name} · 가입 {timeAgo(report.created_at)}</p>
          {report.bio && <p className="text-xs text-nu-gray mt-1 line-clamp-2">{report.bio}</p>}
        </div>
      </div>

      {/* Activity stats grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-nu-ink/[0.04] border-t border-b border-nu-ink/[0.06]">
        {[
          { icon: Users, label: "크루", value: report.crewCount, color: "text-nu-blue" },
          { icon: Briefcase, label: "프로젝트", value: report.projectCount, color: "text-green-600" },
          { icon: MessageSquare, label: "포스트", value: report.postCount, color: "text-nu-pink" },
          { icon: Calendar, label: "이벤트", value: report.eventCount, color: "text-nu-amber" },
          { icon: BookOpen, label: "미팅", value: report.meetingCount, color: "text-nu-blue" },
          { icon: Star, label: "완료태스크", value: report.tasksDone, color: "text-green-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-nu-white p-3 text-center">
            <stat.icon size={14} className={`mx-auto mb-1 ${stat.color}`} />
            <p className="font-head text-lg font-bold">{stat.value}</p>
            <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Expandable detail */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full py-2 text-center font-mono-nu text-[10px] text-nu-muted hover:text-nu-pink transition-colors"
      >
        {expanded ? "접기 ▲" : "상세 활동 보기 ▼"}
      </button>

      {expanded && (
        <div className="p-5 border-t border-nu-ink/[0.04] space-y-4">
          {/* Crews */}
          {report.crewNames.length > 0 && (
            <div>
              <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1">소속 크루</span>
              <div className="flex flex-wrap gap-1.5">
                {report.crewNames.map((name) => (
                  <span key={name} className="text-[11px] bg-nu-cream px-2 py-0.5">{name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {report.projectNames.length > 0 && (
            <div>
              <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1">참여 프로젝트</span>
              <div className="flex flex-wrap gap-1.5">
                {report.projectNames.map((name) => (
                  <span key={name} className="text-[11px] bg-green-50 text-green-700 px-2 py-0.5">{name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recent posts */}
          {report.recentPosts.length > 0 && (
            <div>
              <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-2">최근 활동</span>
              <div className="space-y-2">
                {report.recentPosts.map((p, i) => (
                  <div key={i} className="text-xs border-l-2 border-nu-pink/20 pl-3 py-1">
                    <p className="text-nu-graphite line-clamp-2">{p.content}</p>
                    <p className="text-nu-muted mt-0.5 font-mono-nu text-[9px]">{p.source} · {timeAgo(p.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
