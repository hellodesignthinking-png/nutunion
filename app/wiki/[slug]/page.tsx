import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import DOMPurify from "isomorphic-dompurify";
import { BookOpen, Brain, ExternalLink, ChevronRight, Users, FileText } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 60;

// Generate metadata for SEO / OpenGraph
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: topic } = await supabase
    .from("wiki_topics")
    .select("name, public_description")
    .eq("public_slug", slug)
    .eq("is_public", true)
    .single();

  if (!topic) return { title: "위키를 찾을 수 없습니다" };

  return {
    title: `${topic.name} — NutUnion Wiki`,
    description: topic.public_description || `${topic.name}에 대한 공개 위키`,
    openGraph: {
      title: `${topic.name} — NutUnion Wiki`,
      description: topic.public_description || `${topic.name}에 대한 공개 위키`,
      type: "article",
    },
  };
}

export default async function PublicWikiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch published topic
  const { data: topic } = await supabase
    .from("wiki_topics")
    .select("id, name, description, public_description, published_at, group_id")
    .eq("public_slug", slug)
    .eq("is_public", true)
    .single();

  if (!topic) notFound();

  // Fetch group name
  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", topic.group_id)
    .single();

  // Fetch all pages under this topic
  const { data: pages } = await supabase
    .from("wiki_pages")
    .select("id, title, content, version, updated_at, last_updated_by, author:profiles!wiki_pages_last_updated_by_fkey(nickname)")
    .eq("topic_id", topic.id)
    .order("updated_at", { ascending: false });

  const pageList = pages || [];

  return (
    <div className="min-h-screen bg-nu-paper">
      {/* Header */}
      <div className="border-b-[3px] border-nu-ink bg-gradient-to-br from-nu-cream/50 via-white to-nu-cream/30">
        <div className="max-w-4xl mx-auto px-8 py-10">
          <div className="flex items-center gap-2 font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mb-4">
            <Link href="/" className="hover:text-nu-ink no-underline transition-colors">NutUnion</Link>
            <ChevronRight size={10} />
            <span>Public Wiki</span>
            <ChevronRight size={10} />
            <span className="text-nu-ink font-bold">{topic.name}</span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-nu-ink flex items-center justify-center -rotate-2">
              <Brain size={24} className="text-white" />
            </div>
            <div>
              <h1 className="font-head text-3xl md:text-4xl font-extrabold text-nu-ink tracking-tight">
                {topic.name}
              </h1>
              <p className="font-mono-nu text-[10px] text-nu-pink uppercase tracking-[0.2em] font-bold">
                Open Knowledge Base
              </p>
            </div>
          </div>

          {topic.public_description && (
            <p className="text-sm text-nu-graphite leading-relaxed mt-3 max-w-xl">
              {topic.public_description}
            </p>
          )}

          <div className="flex items-center gap-4 mt-4 font-mono-nu text-[9px] text-nu-muted">
            {group && <span className="flex items-center gap-1"><Users size={10} /> {group.name}</span>}
            <span className="flex items-center gap-1"><FileText size={10} /> {pageList.length} pages</span>
            {topic.published_at && (
              <span>Published {new Date(topic.published_at).toLocaleDateString("ko")}</span>
            )}
          </div>
        </div>
      </div>

      {/* Pages */}
      <div className="max-w-4xl mx-auto px-8 py-10">
        {pageList.length > 0 ? (
          <div className="space-y-8">
            {pageList.map((page: any) => (
              <article key={page.id} className="bg-white border-[2px] border-nu-ink/[0.08] p-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
                    <BookOpen size={18} className="text-nu-blue" />
                    {page.title}
                  </h2>
                  <span className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest">
                    v{page.version}
                  </span>
                </div>
                <div
                  className="prose prose-sm max-w-none text-nu-graphite leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content || "") }}
                />
                <div className="mt-4 pt-3 border-t border-nu-ink/5 flex items-center gap-3 font-mono-nu text-[8px] text-nu-muted">
                  <span>by {page.author?.nickname || "Unknown"}</span>
                  <span>·</span>
                  <span>{new Date(page.updated_at).toLocaleDateString("ko", { year: "numeric", month: "short", day: "numeric" })}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white border-[2px] border-dashed border-nu-ink/15">
            <BookOpen size={40} className="mx-auto mb-4 text-nu-ink/10" />
            <p className="text-sm text-nu-muted">아직 공개된 페이지가 없습니다</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="font-mono-nu text-[9px] text-nu-muted/50 uppercase tracking-widest">
            Powered by NutUnion Living Wiki
          </p>
        </div>
      </div>
    </div>
  );
}
