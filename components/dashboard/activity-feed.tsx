import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Users, Rocket, BookOpen, Calendar as CalendarIcon, TrendingUp, MessageSquare } from "lucide-react";
import { EmptyActivityFeed } from "@/components/empty/empty-state";

/**
 * Activity Feed — "너트 네트워크의 맥박"
 *
 * 집계 소스 (테이블 join):
 *   - crew_posts (너트 게시물)
 *   - group_members (신규 합류)
 *   - project_milestones (마일스톤 완료)
 *   - project_applications (볼트 지원)
 *   - bolt_taps (탭 발행)
 *   - stiffness_events (와셔 티어업)
 *
 * 스코프: 내가 속한 너트 / 참여 볼트에서 발생한 최근 24h 활동
 */

type Event = {
  id: string;
  type: string;
  emoji: string;
  color: string;
  text: string;
  actorName?: string;
  targetName?: string;
  href?: string;
  actionLabel?: string;
  at: string;
};

const DOT_COLORS: Record<string, string> = {
  "nut.post": "#22c55e",
  "nut.join": "#3b82f6",
  "bolt.milestone": "#f59e0b",
  "bolt.applicant": "#ec4899",
  "tap.published": "#a855f7",
  "stiffness.tierup": "#f43f5e",
  "event.soon": "#06b6d4",
};

export async function DashboardActivityFeed({ userId }: { userId: string }) {
  const supabase = await createClient();

  // 내가 속한 너트/볼트 ID
  const [{ data: myGroups }, { data: myBolts }] = await Promise.all([
    supabase.from("group_members").select("group_id, role").eq("user_id", userId).eq("status", "active"),
    supabase.from("project_members").select("project_id, role").eq("user_id", userId),
  ]);

  const groupIds = (myGroups || []).map((m: any) => m.group_id);
  const boltIds = (myBolts || []).map((m: any) => m.project_id);
  const iAmPm = new Set(
    (myBolts || []).filter((m: any) => m.role === "lead" || m.role === "pm").map((m: any) => m.project_id)
  );

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [postsRes, joinsRes, msRes, appsRes, tapsRes] = await Promise.all([
    groupIds.length > 0
      ? supabase.from("crew_posts")
          .select("id, content, type, created_at, group_id, author:profiles!crew_posts_author_id_fkey(id, nickname), group:groups!crew_posts_group_id_fkey(id, name)")
          .in("group_id", groupIds)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    groupIds.length > 0
      ? supabase.from("group_members")
          .select("user_id, group_id, joined_at, profile:profiles!group_members_user_id_fkey(id, nickname), group:groups!group_members_group_id_fkey(id, name)")
          .in("group_id", groupIds)
          .eq("status", "active")
          .gte("joined_at", since)
          .order("joined_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    boltIds.length > 0
      ? supabase.from("project_milestones")
          .select("id, title, project_id, status, updated_at, project:projects(id, title)")
          .in("project_id", boltIds)
          .eq("status", "completed")
          .gte("updated_at", since)
          .order("updated_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    boltIds.length > 0
      ? supabase.from("project_applications")
          .select("id, project_id, status, created_at, applicant:profiles!project_applications_applicant_id_fkey(id, nickname), project:projects(id, title)")
          .in("project_id", [...iAmPm])
          .eq("status", "pending")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    boltIds.length > 0
      ? supabase.from("bolt_taps")
          .select("id, title, project_id, updated_at, project:projects(id, title)")
          .in("project_id", boltIds)
          .gte("updated_at", since)
          .eq("is_retrospective_submitted", true)
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  const events: Event[] = [];

  for (const p of (postsRes.data || []) as any[]) {
    const g = Array.isArray(p.group) ? p.group[0] : p.group;
    const a = Array.isArray(p.author) ? p.author[0] : p.author;
    events.push({
      id: `post-${p.id}`,
      type: "nut.post",
      emoji: "💬",
      color: DOT_COLORS["nut.post"],
      text: `${a?.nickname || "누군가"}가 ${g?.name || "너트"}에 새 글을 올렸어요`,
      actorName: a?.nickname, targetName: g?.name,
      href: `/groups/${p.group_id}`,
      actionLabel: "보기",
      at: p.created_at,
    });
  }
  for (const j of (joinsRes.data || []) as any[]) {
    if (j.user_id === userId) continue;
    const g = Array.isArray(j.group) ? j.group[0] : j.group;
    const p = Array.isArray(j.profile) ? j.profile[0] : j.profile;
    events.push({
      id: `join-${j.user_id}-${j.group_id}`,
      type: "nut.join",
      emoji: "👋",
      color: DOT_COLORS["nut.join"],
      text: `${p?.nickname || "새 와셔"}가 ${g?.name || "너트"}에 합류했어요`,
      href: `/groups/${j.group_id}`,
      actionLabel: "반갑게 인사",
      at: j.joined_at,
    });
  }
  for (const m of (msRes.data || []) as any[]) {
    const p = Array.isArray(m.project) ? m.project[0] : m.project;
    events.push({
      id: `ms-${m.id}`,
      type: "bolt.milestone",
      emoji: "🏁",
      color: DOT_COLORS["bolt.milestone"],
      text: `${p?.title || "볼트"}의 "${m.title}" 마일스톤이 완료됐어요`,
      href: `/projects/${m.project_id}`,
      actionLabel: "회고 작성",
      at: m.updated_at,
    });
  }
  for (const a of (appsRes.data || []) as any[]) {
    const p = Array.isArray(a.project) ? a.project[0] : a.project;
    const ap = Array.isArray(a.applicant) ? a.applicant[0] : a.applicant;
    events.push({
      id: `app-${a.id}`,
      type: "bolt.applicant",
      emoji: "📋",
      color: DOT_COLORS["bolt.applicant"],
      text: `${ap?.nickname || "와셔"}가 ${p?.title || "볼트"}에 지원했어요`,
      href: `/projects/${a.project_id}/applications`,
      actionLabel: "검토",
      at: a.created_at,
    });
  }
  for (const t of (tapsRes.data || []) as any[]) {
    const p = Array.isArray(t.project) ? t.project[0] : t.project;
    events.push({
      id: `tap-${t.id}`,
      type: "tap.published",
      emoji: "📚",
      color: DOT_COLORS["tap.published"],
      text: `${p?.title || "볼트"}의 탭 회고가 발행됐어요`,
      href: `/projects/${t.project_id}/tap`,
      actionLabel: "읽기",
      at: t.updated_at,
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const top = events.slice(0, 10);

  return (
    <section className="reader-shell mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="reader-h2">피드</h2>
        <span className="reader-meta">최근 24시간 · {events.length}건</span>
      </div>

      {top.length === 0 ? (
        <EmptyActivityFeed hasNuts={groupIds.length > 0} />
      ) : (
        <ol className="list-none m-0 p-0 space-y-0 reader-card">
          {top.map((e, i) => (
            <li key={e.id} className={`flex items-start gap-3 py-3 ${i < top.length - 1 ? "border-b border-[color:var(--reader-border-soft)]" : ""}`}>
              <div className="w-1.5 h-1.5 rounded-full mt-[9px] shrink-0" style={{ background: e.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] leading-[1.6] text-[color:var(--reader-text)]">
                  <span className="mr-1">{e.emoji}</span>
                  {e.text}
                </p>
                <div className="flex items-center gap-3 mt-1 reader-meta">
                  <time>{formatDistanceToNow(new Date(e.at), { addSuffix: true, locale: ko })}</time>
                  {e.href && e.actionLabel && (
                    <Link href={e.href} className="reader-link">{e.actionLabel} →</Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
