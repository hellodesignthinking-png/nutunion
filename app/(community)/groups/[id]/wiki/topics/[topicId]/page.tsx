import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Brain, BookOpen, GitBranch, Plus
} from "lucide-react";
import { TopicDetailClient } from "@/components/wiki/topic-detail-client";
import type { Metadata } from "next";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string; topicId: string }> }): Promise<Metadata> {
  const { topicId } = await params;
  const supabase = await createClient();
  const { data: topic } = await supabase.from("wiki_topics").select("name, description").eq("id", topicId).single();
  if (!topic) return { title: "탭 토픽" };
  const { count } = await supabase.from("wiki_pages").select("id", { count: "exact", head: true }).eq("topic_id", topicId);
  return {
    title: `${topic.name} | Wiki`,
    description: topic.description || `${topic.name} — ${count || 0}개 문서`,
    openGraph: { title: topic.name, description: topic.description || `${count || 0}개 문서가 있는 탭 토픽` },
  };
}

export default async function TopicDetailPage({ params }: { params: Promise<{ id: string; topicId: string }> }) {
  const { id: groupId, topicId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group } = await supabase.from("groups").select("name, host_id").eq("id", groupId).single();
  if (!group) notFound();

  const { data: topic } = await supabase
    .from("wiki_topics")
    .select("id, name, description, is_public, public_slug")
    .eq("id", topicId)
    .single();

  if (!topic) notFound();

  const [pagesResult, topicStatsResult] = await Promise.all([
    supabase
      .from("wiki_pages")
      .select(`
        id, title, content, version, updated_at, created_at,
        last_updated_by, created_by,
        updater:profiles!wiki_pages_last_updated_by_fkey(nickname),
        author:profiles!wiki_pages_created_by_fkey(nickname)
      `)
      .eq("topic_id", topicId)
      .order("updated_at", { ascending: false }),
    // Get all page IDs for stats
    supabase
      .from("wiki_pages")
      .select("id")
      .eq("topic_id", topicId),
  ]);

  const pages = pagesResult.data || [];
  const pageIds = (topicStatsResult.data || []).map(p => p.id);

  // Compute stats in parallel
  let totalContribs = 0;
  let totalViews = 0;
  let activeContributors = 0;

  if (pageIds.length > 0) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [contribCount, viewCount, recentContribs] = await Promise.all([
      supabase.from("wiki_contributions").select("id", { count: "exact", head: true }).in("page_id", pageIds),
      supabase.from("wiki_page_views").select("id", { count: "exact", head: true }).in("page_id", pageIds),
      supabase.from("wiki_contributions").select("user_id").in("page_id", pageIds).gte("created_at", sevenDaysAgo.toISOString()),
    ]);

    totalContribs = contribCount.count || 0;
    totalViews = viewCount.count || 0;
    activeContributors = new Set((recentContribs.data || []).map(c => c.user_id)).size;
  }

  const isHost = group.host_id === user.id;

  return (
    <div className="min-h-screen bg-nu-paper">
      {/* Header */}
      <div className="border-b-[3px] border-nu-ink bg-nu-cream/30 py-10">
        <div className="max-w-5xl mx-auto px-8">
          <nav className="flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-4 flex-wrap">
            <Link href={`/groups/${groupId}`} className="hover:text-nu-ink no-underline">{group.name}</Link>
            <ChevronRight size={10} />
            <Link href={`/groups/${groupId}/wiki`} className="hover:text-nu-ink no-underline">Wiki</Link>
            <ChevronRight size={10} />
            <span className="text-nu-ink">{topic.name}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-head text-4xl font-extrabold text-nu-ink tracking-tight mb-2">
                {topic.name}
              </h1>
              <p className="text-sm text-nu-muted max-w-lg">{topic.description || "이 주제에 대한 설명을 추가해주세요."}</p>
            </div>
            {/* Topic Stats */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-center bg-white border-[2px] border-nu-ink/10 px-4 py-2 min-w-[70px]">
                <p className="font-head text-xl font-extrabold text-nu-ink">{pages.length}</p>
                <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">Pages</p>
              </div>
              <div className="text-center bg-white border-[2px] border-nu-ink/10 px-4 py-2 min-w-[70px]">
                <p className="font-head text-xl font-extrabold text-nu-blue">{totalContribs}</p>
                <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">Edits</p>
              </div>
              <div className="text-center bg-white border-[2px] border-nu-ink/10 px-4 py-2 min-w-[70px]">
                <p className="font-head text-xl font-extrabold text-nu-pink">{totalViews}</p>
                <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">Views</p>
              </div>
              {activeContributors > 0 && (
                <div className="text-center bg-white border-[2px] border-nu-ink/10 px-4 py-2 min-w-[70px]">
                  <p className="font-head text-xl font-extrabold text-green-500">{activeContributors}</p>
                  <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">Active (7d)</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-10">
        <TopicDetailClient
          groupId={groupId}
          topicId={topicId}
          topicName={topic.name}
          topicDescription={topic.description || ""}
          initialPages={(pages || []) as any}
          isHost={isHost}
          isPublic={topic.is_public || false}
          publicSlug={topic.public_slug || null}
        />
      </div>
    </div>
  );
}
