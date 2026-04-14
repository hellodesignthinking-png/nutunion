import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { PageHero } from "@/components/shared/page-hero";
import { Heart, Share2, MessageCircle, Eye, Crown, Search } from "lucide-react";

export const revalidate = 60;

// Strip markdown syntax for preview
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/>\s/g, "")
    .replace(/[-+*]\s/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\n/g, " ")
    .trim();
}

// Relative time
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

const CATEGORY_COLORS: Record<string, string> = {
  Space: "bg-nu-blue text-white",
  Culture: "bg-nu-pink text-white",
  Platform: "bg-nu-green text-white",
  Vibe: "bg-purple-600 text-white",
};

const CATEGORY_LABELS: Record<string, string> = {
  전체: "전체",
  Space: "Space",
  Culture: "Culture",
  Platform: "Platform",
  Vibe: "Vibe",
};

export default async function CommunityWikiPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const supabase = await createClient();

  let wikiPages: any[] = [];
  let bestPages: any[] = [];

  try {
    // Fetch all published wiki pages across all groups
    let query = supabase
      .from("wiki_pages")
      .select(`
        id, title, content, version, created_at, updated_at,
        topic:wiki_topics!wiki_pages_topic_id_fkey(id, name, group_id, is_public,
          group:groups!wiki_topics_group_id_fkey(id, name, category)
        ),
        author:profiles!wiki_pages_created_by_fkey(id, nickname, avatar_url)
      `)
      .order("updated_at", { ascending: false })
      .limit(50);

    const { data, error } = await query;

    if (!error && data) {
      // Filter by category if specified
      let filtered = data;
      if (category && category !== "전체") {
        filtered = filtered.filter(
          (p: any) => p.topic?.group?.category === category
        );
      }
      // Filter by search query
      if (q) {
        const lower = q.toLowerCase();
        filtered = filtered.filter(
          (p: any) =>
            p.title?.toLowerCase().includes(lower) ||
            p.content?.toLowerCase().includes(lower)
        );
      }
      wikiPages = filtered;
    }

    // Fetch best (most liked) pages - separate query for top 3
    // We'll use the same data and sort by a heuristic (version as proxy for engagement)
    // Since we don't have a likes column, we use version count as popularity proxy
    const allPages = data || [];
    bestPages = [...allPages]
      .sort((a: any, b: any) => (b.version || 1) - (a.version || 1))
      .slice(0, 3);
  } catch {
    // Graceful fallback - tables may not exist yet
    wikiPages = [];
    bestPages = [];
  }

  const activeCategory = category || "전체";

  return (
    <>
      <PageHero
        category="Community Wiki"
        title="탭 아카이브"
        description="모든 너트에서 만들어진 지식의 나사산"
      />

      <div className="max-w-7xl mx-auto px-6 md:px-8 py-10">
        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-10 pb-6 border-b-[2px] border-nu-ink/10">
          <div className="flex gap-2 flex-wrap">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <Link
                key={key}
                href={`/wiki${key !== "전체" ? `?category=${key}` : ""}${q ? `${key !== "전체" ? "&" : "?"}q=${q}` : ""}`}
                className={`font-mono-nu text-[10px] uppercase tracking-[0.12em] px-4 py-2 border-[2px] no-underline transition-all ${
                  activeCategory === key
                    ? "border-nu-ink bg-nu-ink text-nu-paper font-bold"
                    : "border-nu-ink/20 text-nu-graphite hover:border-nu-ink/50"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          <form action="/wiki" method="GET" className="relative w-full sm:w-auto">
            {category && category !== "전체" && (
              <input type="hidden" name="category" value={category} />
            )}
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted"
            />
            <input
              type="text"
              name="q"
              defaultValue={q || ""}
              placeholder="제목 검색..."
              className="font-mono-nu text-[11px] pl-9 pr-4 py-2.5 border-[2px] border-nu-ink/20 bg-transparent w-full sm:w-[220px] focus:border-nu-ink focus:outline-none placeholder:text-nu-muted"
            />
          </form>
        </div>

        {/* BEST Section */}
        {bestPages.length > 0 && !q && activeCategory === "전체" && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Crown size={18} className="text-amber-500" />
              <h2 className="font-head text-lg font-extrabold uppercase tracking-tight">
                베스트
              </h2>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-amber-400/40 to-transparent" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {bestPages.map((page: any) => {
                const group = page.topic?.group;
                const catColor =
                  CATEGORY_COLORS[group?.category] || "bg-nu-graphite text-white";
                const preview = stripMarkdown(page.content || "").slice(0, 200);
                const groupId = page.topic?.group_id || group?.id;

                return (
                  <Link
                    key={page.id}
                    href={`/groups/${groupId}/wiki/pages/${page.id}`}
                    className="group relative block border-[2px] border-amber-400/60 bg-gradient-to-br from-amber-50/50 to-nu-paper p-6 no-underline hover:border-amber-500 transition-all"
                  >
                    {/* BEST badge */}
                    <span className="absolute top-3 right-3 font-mono-nu text-[8px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 bg-gradient-to-r from-amber-400 to-pink-400 text-white">
                      BEST
                    </span>

                    {/* Group badge */}
                    <span
                      className={`inline-block font-mono-nu text-[8px] uppercase tracking-[0.15em] px-2 py-0.5 mb-3 ${catColor}`}
                    >
                      {group?.name || "Unknown"}
                    </span>

                    {/* Topic */}
                    <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest mb-1.5">
                      {page.topic?.name}
                    </p>

                    {/* Title */}
                    <h3 className="font-head text-base font-extrabold text-nu-ink leading-snug mb-2 group-hover:text-nu-pink transition-colors">
                      {page.title}
                    </h3>

                    {/* Preview */}
                    <p className="text-[11px] text-nu-graphite leading-relaxed line-clamp-3 mb-4">
                      {preview || "내용 없음"}
                    </p>

                    {/* Author + date */}
                    <div className="flex items-center gap-2 mt-auto">
                      {page.author?.avatar_url ? (
                        <img
                          src={page.author.avatar_url}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-nu-pink/20 flex items-center justify-center">
                          <span className="text-[7px] font-bold text-nu-pink">
                            {(page.author?.nickname || "?")[0]}
                          </span>
                        </div>
                      )}
                      <span className="font-mono-nu text-[9px] text-nu-muted">
                        {page.author?.nickname || "익명"}
                      </span>
                      <span className="text-nu-muted/30">|</span>
                      <span className="font-mono-nu text-[9px] text-nu-muted">
                        {timeAgo(page.updated_at)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Main Grid */}
        {wikiPages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {wikiPages.map((page: any) => {
              const group = page.topic?.group;
              const catColor =
                CATEGORY_COLORS[group?.category] || "bg-nu-graphite text-white";
              const preview = stripMarkdown(page.content || "").slice(0, 150);
              const groupId = page.topic?.group_id || group?.id;

              return (
                <article
                  key={page.id}
                  className="border-[2px] border-nu-ink/10 bg-nu-paper hover:border-nu-ink/30 transition-all flex flex-col"
                >
                  <div className="p-5 flex-1 flex flex-col">
                    {/* Group badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className={`font-mono-nu text-[8px] uppercase tracking-[0.15em] px-2 py-0.5 ${catColor}`}
                      >
                        {group?.name || "Unknown"}
                      </span>
                      <span className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest">
                        {page.topic?.name}
                      </span>
                    </div>

                    {/* Title */}
                    <Link
                      href={`/groups/${groupId}/wiki/pages/${page.id}`}
                      className="no-underline"
                    >
                      <h3 className="font-head text-[15px] font-extrabold text-nu-ink leading-snug mb-2 hover:text-nu-pink transition-colors">
                        {page.title}
                      </h3>
                    </Link>

                    {/* Preview */}
                    <p className="text-[11px] text-nu-graphite leading-relaxed line-clamp-3 mb-4 flex-1">
                      {preview || "내용 없음"}
                    </p>

                    {/* Author + date */}
                    <div className="flex items-center gap-2 mb-4">
                      {page.author?.avatar_url ? (
                        <img
                          src={page.author.avatar_url}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-nu-pink/20 flex items-center justify-center">
                          <span className="text-[7px] font-bold text-nu-pink">
                            {(page.author?.nickname || "?")[0]}
                          </span>
                        </div>
                      )}
                      <span className="font-mono-nu text-[9px] text-nu-muted">
                        {page.author?.nickname || "익명"}
                      </span>
                      <span className="text-nu-muted/30">|</span>
                      <span className="font-mono-nu text-[9px] text-nu-muted">
                        {timeAgo(page.updated_at)}
                      </span>
                    </div>

                    {/* Stats + actions */}
                    <div className="pt-3 border-t border-nu-ink/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 font-mono-nu text-[9px] text-nu-muted">
                          <Eye size={11} /> {page.version || 1}
                        </span>
                        <span className="flex items-center gap-1 font-mono-nu text-[9px] text-nu-muted">
                          <Heart size={11} /> 0
                        </span>
                        <span className="flex items-center gap-1 font-mono-nu text-[9px] text-nu-muted">
                          <MessageCircle size={11} /> 0
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="font-mono-nu text-[8px] uppercase tracking-[0.1em] px-2.5 py-1 border border-nu-ink/10 text-nu-muted hover:text-nu-pink hover:border-nu-pink/30 transition-colors flex items-center gap-1"
                          title="좋아요"
                        >
                          <Heart size={10} /> 좋아요
                        </button>
                        <button
                          className="font-mono-nu text-[8px] uppercase tracking-[0.1em] px-2.5 py-1 border border-nu-ink/10 text-nu-muted hover:text-nu-blue hover:border-nu-blue/30 transition-colors flex items-center gap-1"
                          title="공유"
                        >
                          <Share2 size={10} /> 공유
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="text-center py-20 border-[2px] border-dashed border-nu-ink/10">
            <p className="font-head text-xl font-extrabold text-nu-ink/30 mb-2">
              아직 탭 페이지가 없습니다
            </p>
            <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">
              너트에서 탭을 작성하면 여기에 모입니다
            </p>
          </div>
        )}
      </div>
    </>
  );
}
