import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import DOMPurify from "isomorphic-dompurify";
import { BookOpen, Brain, ChevronRight, Users, FileText, Clock, GitBranch, Tag } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 60;

// ── Markdown → HTML renderer (server-safe) ──
function renderMarkdown(md: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return escape(md)
    .replace(/### (.+)/g, '<h3 class="font-head text-base font-bold mt-6 mb-2 text-nu-ink">$1</h3>')
    .replace(/## (.+)/g, '<h2 class="font-head text-lg font-extrabold mt-8 mb-3 text-nu-ink border-b border-nu-ink/10 pb-2">$1</h2>')
    .replace(/# (.+)/g, '<h1 class="font-head text-xl font-extrabold mt-10 mb-4 text-nu-ink">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-nu-ink">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-nu-cream/50 px-1.5 py-0.5 text-nu-pink font-mono-nu text-xs border border-nu-ink/10">$1</code>')
    .replace(/^- (.+)/gm, '<li class="ml-4 list-disc text-sm text-nu-graphite leading-relaxed">$1</li>')
    .replace(/^\d+\. (.+)/gm, '<li class="ml-4 list-decimal text-sm text-nu-graphite leading-relaxed">$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-nu-blue hover:text-nu-pink underline" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^---$/gm, '<hr class="my-6 border-nu-ink/10" />')
    .replace(/\n\n/g, '<div class="h-3"></div>')
    .replace(/\n/g, '<br/>');
}

// ── SEO Metadata ──
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: topic, error: topicError } = await supabase
    .from("wiki_topics")
    .select("name, public_description")
    .eq("public_slug", slug)
    .eq("is_public", true)
    .single();

  if (topicError || !topic) return { title: "탭을 찾을 수 없습니다 — nutunion" };

  const title = `${topic.name} — nutunion Wiki`;
  const description = (topic.public_description || `${topic.name}에 대한 nutunion 공개 위키 문서`).slice(0, 160);
  const canonical = `https://nutunion.co.kr/wiki/${slug}`;
  const ogImage = "/hero-risograph.png";

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function PublicWikiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: topic, error: topicError } = await supabase
    .from("wiki_topics")
    .select("id, name, description, public_description, published_at, group_id")
    .eq("public_slug", slug)
    .eq("is_public", true)
    .single();

  if (topicError || !topic) notFound();

  // Parallel fetches
  const [groupRes, pagesRes, contribRes] = await Promise.all([
    supabase.from("groups").select("name").eq("id", topic.group_id).single(),
    supabase
      .from("wiki_pages")
      .select("id, title, content, version, updated_at, last_updated_by, author:profiles!wiki_pages_last_updated_by_fkey(nickname)")
      .eq("topic_id", topic.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("wiki_contributions")
      .select("user_id, contributor:profiles!wiki_contributions_user_id_fkey(nickname)")
      .in("page_id",
        (await supabase.from("wiki_pages").select("id").eq("topic_id", topic.id)).data?.map(p => p.id) || []
      ),
  ]);

  const group = groupRes.data;
  const pageList = pagesRes.data || [];
  const contributors = contribRes.data || [];

  // Unique contributors
  const uniqueContributors = Array.from(
    new Map(contributors.map((c: any) => [c.user_id, c.contributor?.nickname || "멤버"])).entries()
  ).slice(0, 8);

  // Total word count
  const totalChars = pageList.reduce((sum, p: any) => sum + (p.content?.length || 0), 0);
  const readingMinutes = Math.max(1, Math.ceil(totalChars / 500));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: topic.name,
    description: topic.public_description || `${topic.name}에 대한 nutunion 공개 위키 문서`,
    datePublished: topic.published_at || undefined,
    author: { "@type": "Organization", name: "nutunion" },
    publisher: {
      "@type": "Organization",
      name: "nutunion",
      logo: { "@type": "ImageObject", url: "https://nutunion.co.kr/icon-512.png" },
    },
    mainEntityOfPage: `https://nutunion.co.kr/wiki/${slug}`,
  };

  return (
    <div className="min-h-screen bg-nu-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ── Header ── */}
      <div className="border-b-[3px] border-nu-ink bg-gradient-to-br from-nu-cream/50 via-white to-nu-cream/30 relative overflow-hidden">
        <div className="absolute -right-32 -top-32 w-96 h-96 bg-nu-pink/[0.03] rounded-full blur-3xl" />
        <div className="absolute -left-32 -bottom-32 w-96 h-96 bg-nu-blue/[0.03] rounded-full blur-3xl" />

        <div className="max-w-5xl mx-auto px-6 md:px-8 py-10 relative z-10">
          <div className="flex items-center gap-2 font-mono-nu text-[12px] text-nu-muted uppercase tracking-widest mb-6">
            <Link href="/" className="hover:text-nu-ink no-underline transition-colors">NutUnion</Link>
            <ChevronRight size={10} />
            <span>Public Wiki</span>
            <ChevronRight size={10} />
            <span className="text-nu-ink font-bold">{topic.name}</span>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-nu-ink flex items-center justify-center -rotate-2 shrink-0">
              <Brain size={28} className="text-white" />
            </div>
            <div>
              <h1 className="font-head text-3xl md:text-4xl font-extrabold text-nu-ink tracking-tight leading-tight">
                {topic.name}
              </h1>
              <p className="font-mono-nu text-[12px] text-nu-pink uppercase tracking-[0.2em] font-bold mt-0.5">
                Open Knowledge Base
              </p>
            </div>
          </div>

          {topic.public_description && (
            <p className="text-sm text-nu-graphite leading-relaxed max-w-2xl">{topic.public_description}</p>
          )}

          {/* Stats bar */}
          <div className="flex items-center gap-5 mt-6 flex-wrap">
            {group && (
              <span className="flex items-center gap-1.5 font-mono-nu text-[11px] text-nu-muted">
                <Users size={11} /> {group.name}
              </span>
            )}
            <span className="flex items-center gap-1.5 font-mono-nu text-[11px] text-nu-muted">
              <FileText size={11} /> {pageList.length} pages
            </span>
            <span className="flex items-center gap-1.5 font-mono-nu text-[11px] text-nu-muted">
              <Clock size={11} /> {readingMinutes}분 읽기
            </span>
            <span className="flex items-center gap-1.5 font-mono-nu text-[11px] text-nu-muted">
              <Users size={11} /> {uniqueContributors.length}명 기여
            </span>
            {topic.published_at && (
              <span className="font-mono-nu text-[11px] text-nu-muted">
                Published {new Date(topic.published_at).toLocaleDateString("ko")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Content Layout ── */}
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Sidebar: Table of Contents */}
          <aside className="lg:col-span-3 order-2 lg:order-1">
            <div className="lg:sticky lg:top-8 space-y-6">
              {/* TOC */}
              {pageList.length > 1 && (
                <nav className="bg-white border-[2px] border-nu-ink/[0.08] p-4">
                  <h3 className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-muted mb-3 flex items-center gap-1.5">
                    <BookOpen size={11} /> 목차
                  </h3>
                  <ul className="space-y-1.5">
                    {pageList.map((page: any, i: number) => (
                      <li key={page.id}>
                        <a
                          href={`#page-${page.id}`}
                          className="text-xs text-nu-graphite hover:text-nu-pink no-underline transition-colors flex items-center gap-2"
                        >
                          <span className="font-mono-nu text-[10px] text-nu-muted/50 w-4">{String(i + 1).padStart(2, "0")}</span>
                          <span className="truncate">{page.title}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}

              {/* Contributors */}
              {uniqueContributors.length > 0 && (
                <div className="bg-white border-[2px] border-nu-ink/[0.08] p-4">
                  <h3 className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-muted mb-3 flex items-center gap-1.5">
                    <Users size={11} /> 기여자
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueContributors.map(([uid, name]) => (
                      <span key={uid} className="font-mono-nu text-[11px] px-2 py-1 bg-nu-cream border border-nu-ink/5 text-nu-ink">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="bg-nu-ink text-white p-4 border-[2px] border-nu-ink">
                <h3 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3">
                  Knowledge Stats
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] text-white/60">총 문자수</span>
                    <span className="font-mono-nu text-[12px] font-bold text-nu-pink">{totalChars.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] text-white/60">총 버전</span>
                    <span className="font-mono-nu text-[12px] font-bold text-nu-blue">
                      {pageList.reduce((sum: number, p: any) => sum + p.version, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] text-white/60">최근 업데이트</span>
                    <span className="font-mono-nu text-[12px] font-bold text-nu-amber">
                      {pageList[0] ? new Date(pageList[0].updated_at).toLocaleDateString("ko", { month: "short", day: "numeric" }) : "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-9 order-1 lg:order-2">
            {pageList.length > 0 ? (
              <div className="space-y-10">
                {pageList.map((page: any) => (
                  <article key={page.id} id={`page-${page.id}`} className="bg-white border-[2px] border-nu-ink/[0.08] scroll-mt-8">
                    {/* Page header */}
                    <div className="px-8 pt-8 pb-4 border-b border-nu-ink/5">
                      <div className="flex items-start justify-between gap-4">
                        <h2 className="font-head text-2xl font-extrabold text-nu-ink flex items-center gap-2">
                          <BookOpen size={20} className="text-nu-blue shrink-0" />
                          {page.title}
                        </h2>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest bg-nu-cream px-2 py-1 flex items-center gap-1">
                            <GitBranch size={8} /> v{page.version}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 font-mono-nu text-[10px] text-nu-muted">
                        <span>by {page.author?.nickname || "Unknown"}</span>
                        <span>·</span>
                        <span>{new Date(page.updated_at).toLocaleDateString("ko", { year: "numeric", month: "short", day: "numeric" })}</span>
                        <span>·</span>
                        <span>{Math.max(1, Math.ceil((page.content?.length || 0) / 500))}분 읽기</span>
                      </div>
                    </div>

                    {/* Page content */}
                    <div
                      className="px-8 py-6 prose prose-sm max-w-none text-nu-graphite leading-relaxed [&_h1]:scroll-mt-8 [&_h2]:scroll-mt-8 [&_h3]:scroll-mt-8"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(page.content || "")) }}
                    />
                  </article>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white border-[2px] border-dashed border-nu-ink/15">
                <BookOpen size={48} className="mx-auto mb-4 text-nu-ink/10" />
                <p className="text-sm text-nu-muted font-medium">아직 공개된 페이지가 없습니다</p>
                <p className="text-xs text-nu-muted/50 mt-1">곧 지식이 공유될 예정입니다</p>
              </div>
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-nu-ink/10 text-center">
          <div className="inline-flex items-center gap-2 font-mono-nu text-[11px] text-nu-muted/40 uppercase tracking-widest">
            <Brain size={12} />
            Powered by NutUnion Living Wiki
          </div>
        </div>
      </div>
    </div>
  );
}
