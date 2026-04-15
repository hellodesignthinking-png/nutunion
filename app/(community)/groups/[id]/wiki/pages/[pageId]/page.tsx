import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { WikiPageViewer } from "@/components/wiki/wiki-page-viewer";
import { WikiFloatingTOC } from "@/components/wiki/wiki-floating-toc";
import type { Metadata } from "next";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string; pageId: string }> }): Promise<Metadata> {
  const { id: groupId, pageId } = await params;
  const supabase = await createClient();
  const { data: page } = await supabase.from("wiki_pages").select("title, content, updated_at, topic:wiki_topics(name)").eq("id", pageId).single();
  if (!page) return { title: "탭 페이지" };
  const desc = (page.content || "").replace(/[#*`\[\]]/g, "").slice(0, 160);
  const topicName = (page as any).topic?.name;
  return {
    title: `${page.title}${topicName ? ` — ${topicName}` : ""} | Wiki`,
    description: desc || page.title,
    openGraph: { title: page.title, description: desc, type: "article", modifiedTime: page.updated_at },
  };
}

export default async function WikiPageDetailPage({ params }: { params: Promise<{ id: string; pageId: string }> }) {
  const { id: groupId, pageId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group } = await supabase.from("groups").select("name").eq("id", groupId).single();
  if (!group) notFound();

  const { data: page } = await supabase
    .from("wiki_pages")
    .select(`
      id, title, content, version, updated_at, created_at,
      last_updated_by, created_by, topic_id,
      topic:wiki_topics(id, name),
      updater:profiles!wiki_pages_last_updated_by_fkey(nickname),
      author:profiles!wiki_pages_created_by_fkey(nickname)
    `)
    .eq("id", pageId)
    .single();

  if (!page) notFound();

  // Fetch version history + contributions + record view — all in parallel
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [versionsResult, contribsResult] = await Promise.all([
    supabase
      .from("wiki_page_versions")
      .select("*, editor:profiles!wiki_page_versions_edited_by_fkey(nickname)")
      .eq("page_id", pageId)
      .order("version", { ascending: false })
      .limit(20),
    supabase
      .from("wiki_contributions")
      .select("*, contributor:profiles!wiki_contributions_user_id_fkey(nickname)")
      .eq("page_id", pageId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const versions = versionsResult.data;
  const contributions = contribsResult.data;

  // Record page view — deduplicate: max 1 view per user per page per day (fire-and-forget)
  try {
    const { count: viewedToday } = await supabase
      .from("wiki_page_views")
      .select("id", { count: "exact", head: true })
      .eq("page_id", pageId)
      .eq("user_id", user.id)
      .gte("created_at", todayStart.toISOString());
    if (!viewedToday || viewedToday === 0) {
      await supabase.from("wiki_page_views").insert({ page_id: pageId, user_id: user.id });
    }
  } catch {
    // Non-critical
  }

  return (
    <div className="min-h-screen bg-nu-paper">
      {/* Header */}
      <div className="border-b-[3px] border-nu-ink bg-white py-6">
        <div className="max-w-4xl mx-auto px-8">
          <nav className="flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted flex-wrap">
            <Link href={`/groups/${groupId}`} className="hover:text-nu-ink no-underline">{group.name}</Link>
            <ChevronRight size={10} />
            <Link href={`/groups/${groupId}/wiki`} className="hover:text-nu-ink no-underline">Wiki</Link>
            <ChevronRight size={10} />
            {(page as any).topic && (
              <>
                <Link href={`/groups/${groupId}/wiki/topics/${(page as any).topic.id}`} className="hover:text-nu-ink no-underline">
                  {(page as any).topic.name}
                </Link>
                <ChevronRight size={10} />
              </>
            )}
            <span className="text-nu-ink truncate max-w-[200px]">{page.title}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-10 flex gap-0">
        <div className="flex-1 min-w-0 max-w-4xl">
          <WikiPageViewer
            page={page as any}
            groupId={groupId}
            versions={versions || []}
            contributions={contributions || []}
          />
        </div>
        <WikiFloatingTOC contentSelector=".wiki-page-content" title="이 문서의 목차" />
      </div>
    </div>
  );
}
