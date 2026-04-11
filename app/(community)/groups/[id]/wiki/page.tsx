import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Plus,
  History,
  Users,
  ChevronRight,
  Brain,
  Sparkles,
  GitBranch,
  ArrowRight,
  BookOpen,
  Trophy,
  BarChart3,
  Zap,
  Target
} from "lucide-react";
import { HumanCapitalVisual } from "@/components/wiki/human-capital-visual";
import { KnowledgeGraph } from "@/components/wiki/knowledge-graph";
import { ContributionLeaderboard } from "@/components/wiki/contribution-leaderboard";
import { WeeklyInsightNewsletter } from "@/components/wiki/weekly-insight-newsletter";
import { MonthlyEvolutionAnalysis } from "@/components/wiki/monthly-evolution-analysis";
import { WikiTopicCreator } from "@/components/wiki/wiki-topic-creator";
import { WikiSearchBar } from "@/components/wiki/wiki-search-bar";

export const dynamic = "force-dynamic";

export default async function GroupWikiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group } = await supabase.from("groups").select("name, host_id").eq("id", id).single();
  if (!group) notFound();

  const isHost = group.host_id === user.id;

  // Fetch topics with page counts
  const { data: topics } = await supabase
    .from("wiki_topics")
    .select("id, name, description")
    .eq("group_id", id)
    .order("name");

  // Fetch recent pages across all topics
  const topicIds = (topics || []).map(t => t.id);
  let recentPages: any[] = [];
  let totalPages = 0;
  let totalContributions = 0;
  let totalLinks = 0;
  let activeContributorsCount = 0;
  let memberCountFinal = 0;
  let activityFeed: any[] = [];
  const topicPageCounts: Record<string, number> = {};

  if (topicIds.length > 0) {
    // ── Round 1: Run recentPages + allPages + memberCount in parallel ──
    const [rpResult, allPagesResult, memberCountResult] = await Promise.all([
      supabase
        .from("wiki_pages")
        .select(`
          id,
          title,
          updated_at,
          version,
          last_updated_by,
          topic_id,
          topic:wiki_topics(name),
          author:profiles!wiki_pages_last_updated_by_fkey(nickname)
        `)
        .in("topic_id", topicIds)
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("wiki_pages")
        .select("id, topic_id")
        .in("topic_id", topicIds),
      supabase
        .from("group_members")
        .select("user_id", { count: "exact", head: true })
        .eq("group_id", id)
        .eq("status", "active"),
    ]);

    recentPages = rpResult.data || [];
    totalPages = (allPagesResult.data || []).length;
    memberCountFinal = memberCountResult.count || 0;

    // Count pages per topic
    (allPagesResult.data || []).forEach(p => {
      topicPageCounts[p.topic_id] = (topicPageCounts[p.topic_id] || 0) + 1;
    });

    const allPageIds = (allPagesResult.data || []).map(p => p.id);
    if (allPageIds.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // ── Round 2: Run contributions + links + recentContribs + activity feed in parallel ──
      const [contribResult, linkResult, recentContribResult, activityFeedResult] = await Promise.all([
        supabase
          .from("wiki_contributions")
          .select("id", { count: "exact", head: true })
          .in("page_id", allPageIds),
        supabase
          .from("wiki_page_links")
          .select("source_page_id", { count: "exact", head: true })
          .in("source_page_id", allPageIds),
        supabase
          .from("wiki_contributions")
          .select("user_id")
          .in("page_id", allPageIds)
          .gte("created_at", thirtyDaysAgo.toISOString()),
        supabase
          .from("wiki_contributions")
          .select("change_summary, created_at, contributor:profiles!wiki_contributions_user_id_fkey(nickname), page:wiki_pages!wiki_contributions_page_id_fkey(id, title)")
          .in("page_id", allPageIds)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      totalContributions = contribResult.count || 0;
      totalLinks = linkResult.count || 0;
      activeContributorsCount = new Set((recentContribResult.data || []).map(c => c.user_id)).size;
      activityFeed = (activityFeedResult.data || []) as any[];
    }
  }

  // If no topics, still need memberCount
  let memberCountFinalVal = 0;
  if (topicIds.length > 0) {
    memberCountFinalVal = memberCountFinal;
  } else {
    const { count: mc } = await supabase
      .from("group_members")
      .select("user_id", { count: "exact", head: true })
      .eq("group_id", id)
      .eq("status", "active");
    memberCountFinalVal = mc || 0;
  }

  // Compute real metrics
  const linkDensity = totalPages > 0 ? Math.min(Math.round((totalLinks / totalPages) * 50), 100) : 0;
  const participationRate = memberCountFinalVal > 0 ? Math.min(Math.round((activeContributorsCount / memberCountFinalVal) * 100), 100) : 0;

  return (
    <div className="min-h-screen bg-nu-paper">
      {/* ── Hero Header ─────────────────────────────── */}
      <div className="border-b-[3px] border-nu-ink bg-gradient-to-br from-nu-cream/50 via-white to-nu-cream/30 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -right-32 -top-32 w-96 h-96 bg-nu-pink/[0.03] rounded-full blur-3xl" />
        <div className="absolute -left-32 -bottom-32 w-96 h-96 bg-nu-blue/[0.03] rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #0d0d0d 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="max-w-7xl mx-auto px-8 py-12 relative z-10">
          <div className="flex items-center gap-2 font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mb-6">
            <Link href={`/groups/${id}`} className="hover:text-nu-ink no-underline transition-colors">{group.name}</Link>
            <ChevronRight size={12} />
            <span className="text-nu-ink font-bold">성장하는 소셜링</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
            <div className="flex-1 max-w-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 bg-nu-ink flex items-center justify-center -rotate-3">
                  <Brain size={28} className="text-white" />
                </div>
                <div>
                  <h1 className="font-head text-4xl md:text-5xl font-extrabold text-nu-ink tracking-tight leading-none">
                    Living Wiki
                  </h1>
                  <p className="font-mono-nu text-[10px] text-nu-pink uppercase tracking-[0.3em] font-bold">
                    Intelligent Knowledge Base
                  </p>
                </div>
              </div>
              <p className="text-nu-graphite leading-relaxed text-sm font-medium mt-4 max-w-xl">
                기록 → 분석 → 구조화 → 연결의 선순환 구조로 성장하는 지식 저장소.
                모든 미팅의 결론, 모든 구성원의 통찰이 연결되어 팀의 공유 뇌가 됩니다.
              </p>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="bg-white border-[2px] border-nu-ink p-4 text-center min-w-[100px]">
                <p className="font-head text-3xl font-extrabold text-nu-ink">{topics?.length || 0}</p>
                <p className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest mt-1">Topics</p>
              </div>
              <div className="bg-white border-[2px] border-nu-ink p-4 text-center min-w-[100px]">
                <p className="font-head text-3xl font-extrabold text-nu-pink">{totalPages}</p>
                <p className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest mt-1">Pages</p>
              </div>
              <div className="bg-white border-[2px] border-nu-ink p-4 text-center min-w-[100px]">
                <p className="font-head text-3xl font-extrabold text-nu-blue">{memberCountFinalVal}</p>
                <p className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest mt-1">Members</p>
              </div>
            </div>
          </div>

          {/* Search + Actions */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <WikiSearchBar groupId={id} />
            <WikiTopicCreator groupId={id} />
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-8 py-12">

        {/* Knowledge Graph Section */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-head text-2xl font-extrabold text-nu-ink flex items-center gap-3">
              <GitBranch size={24} className="text-nu-blue" /> 지식 그래프 (Knowledge Graph)
            </h2>
            <span className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest bg-nu-cream px-3 py-1 border border-nu-ink/10">
              Interactive · Drag to explore
            </span>
          </div>
          <KnowledgeGraph groupId={id} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* ── Left Column (8 cols) ─────────────────── */}
          <div className="lg:col-span-8 space-y-16">

            {/* Topic Explorer */}
            <section>
              <h2 className="font-head text-2xl font-extrabold text-nu-ink mb-6 flex items-center gap-3">
                <Brain size={24} className="text-nu-pink" /> 주제별 위키 (Topic Wiki)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topics && topics.length > 0 ? (
                  topics.map((topic, i) => (
                    <Link
                      key={topic.id}
                      href={`/groups/${id}/wiki/topics/${topic.id}`}
                      className="group bg-white border-[2px] border-nu-ink p-6 no-underline hover:border-nu-pink transition-all flex flex-col justify-between min-h-[160px] relative overflow-hidden"
                    >
                      {/* Decorative corner */}
                      <div className={`absolute -right-6 -top-6 w-16 h-16 rounded-full opacity-10 ${
                        ["bg-nu-pink", "bg-nu-blue", "bg-nu-amber", "bg-green-500"][i % 4]
                      }`} />

                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-head text-lg font-bold text-nu-ink group-hover:text-nu-pink transition-colors">
                            {topic.name}
                          </h3>
                          <span className="font-mono-nu text-[8px] bg-nu-ink/5 px-1.5 py-0.5 text-nu-muted">
                            {topicPageCounts[topic.id] || 0} pages
                          </span>
                        </div>
                        <p className="text-xs text-nu-muted leading-relaxed line-clamp-2">
                          {topic.description || "이 주제에 대한 설명을 추가해주세요."}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-nu-ink/5 pt-4 relative z-10">
                        <span className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">
                          Explore Wiki
                        </span>
                        <ArrowRight size={14} className="text-nu-ink group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="col-span-2 border-[2px] border-dashed border-nu-ink/15 p-16 text-center bg-white/50">
                    <Brain size={40} className="mx-auto mb-4 text-nu-ink/15" />
                    <p className="text-nu-muted text-sm font-medium mb-2">아직 등록된 주제가 없습니다.</p>
                    <p className="text-xs text-nu-muted">위의 '새 주제' 버튼으로 첫 번째 지식 주제를 생성하세요.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Recent Changes Timeline */}
            <section className="bg-nu-ink text-white p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-head text-xl font-extrabold flex items-center gap-3">
                    <History size={20} className="text-nu-pink" /> 최근 지식 동기화
                  </h2>
                  <span className="font-mono-nu text-[9px] text-white/30 uppercase tracking-widest">
                    Live Feed
                  </span>
                </div>

                <div className="space-y-0">
                  {recentPages.length > 0 ? (
                    recentPages.map((page, i) => (
                      <div key={page.id} className="flex gap-4 group">
                        {/* Timeline line */}
                        <div className="flex flex-col items-center w-6 shrink-0">
                          <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                            i === 0 ? "bg-nu-pink border-nu-pink" : "bg-transparent border-white/20"
                          }`} />
                          {i < recentPages.length - 1 && <div className="w-px flex-1 bg-white/10" />}
                        </div>

                        <div className="flex-1 pb-6">
                          <Link
                            href={`/groups/${id}/wiki/pages/${page.id}`}
                            className="block font-head text-sm font-bold text-white no-underline hover:text-nu-pink transition-colors"
                          >
                            {page.title}
                          </Link>
                          <div className="flex items-center gap-3 mt-1 font-mono-nu text-[9px] text-white/30 uppercase tracking-widest">
                            <span className="flex items-center gap-1">
                              <BookOpen size={9} /> {(page as any).topic?.name}
                            </span>
                            <span>•</span>
                            <span>v{page.version}</span>
                            <span>•</span>
                            <span>by {(page as any).author?.nickname || "Unknown"}</span>
                            <span>•</span>
                            <span>{new Date(page.updated_at).toLocaleDateString("ko")}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-white/30 text-xs italic py-4">최근 업데이트된 문서가 없습니다.</p>
                  )}
                </div>
              </div>
            </section>

            {/* Weekly Insight Newsletter */}
            <section>
              <h2 className="font-head text-2xl font-extrabold text-nu-ink mb-6 flex items-center gap-3">
                <BarChart3 size={24} className="text-nu-amber" /> 주간 인사이트 다이제스트
              </h2>
              <WeeklyInsightNewsletter groupId={id} />
            </section>

            {/* Monthly Evolution Analysis */}
            <section>
              <h2 className="font-head text-2xl font-extrabold text-nu-ink mb-6 flex items-center gap-3">
                <Zap size={24} className="text-purple-500" /> 월간 지식 진화 분석
              </h2>
              <MonthlyEvolutionAnalysis groupId={id} />
            </section>
          </div>

          {/* ── Right Column (4 cols) ────────────────── */}
          <div className="lg:col-span-4 space-y-12">

            {/* Activity Feed */}
            {activityFeed.length > 0 && (
              <section className="bg-white border-[2px] border-nu-ink/[0.08]">
                <div className="p-4 border-b border-nu-ink/5">
                  <h3 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
                    <Sparkles size={14} className="text-nu-pink" /> 최근 활동 피드
                  </h3>
                </div>
                <div className="divide-y divide-nu-ink/5">
                  {activityFeed.map((a: any, i: number) => (
                    <div key={i} className="px-4 py-3 hover:bg-nu-cream/20 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-full bg-nu-pink/10 flex items-center justify-center font-head text-[8px] font-bold text-nu-pink shrink-0">
                          {(a.contributor?.nickname || "U").charAt(0)}
                        </div>
                        <span className="font-head text-[11px] font-bold text-nu-ink">{a.contributor?.nickname || "Unknown"}</span>
                      </div>
                      {a.page && (
                        <Link
                          href={`/groups/${id}/wiki/pages/${a.page.id}`}
                          className="text-xs text-nu-blue no-underline hover:underline truncate block"
                        >
                          {a.page.title}
                        </Link>
                      )}
                      <p className="font-mono-nu text-[8px] text-nu-muted mt-1">
                        {a.change_summary || "편집"} · {new Date(a.created_at).toLocaleDateString("ko", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Knowledge Champions */}
            <section>
              <h2 className="font-head text-lg font-extrabold text-nu-ink mb-6 flex items-center gap-2">
                <Trophy size={18} className="text-yellow-500" /> Knowledge Champions
              </h2>
              <ContributionLeaderboard groupId={id} />
            </section>

            {/* Human Capital */}
            <section>
              <h2 className="font-head text-lg font-extrabold text-nu-ink mb-6 flex items-center gap-2">
                <Users size={18} className="text-nu-pink" /> Human Capital
              </h2>
              <HumanCapitalVisual groupId={id} />
            </section>

            {/* Wiki Strategy */}
            <section className="bg-nu-cream p-6 border-[2px] border-nu-ink">
              <h3 className="font-mono-nu text-[11px] font-bold text-nu-ink uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Sparkles size={14} className="text-nu-pink" /> Growth Protocol
              </h3>
              <ul className="space-y-4 font-mono-nu text-[10px] text-nu-muted leading-relaxed">
                <li className="flex gap-3">
                  <span className="w-6 h-6 bg-nu-pink text-white flex items-center justify-center shrink-0 font-bold text-[9px]">01</span>
                  <div>
                    <span className="text-nu-ink font-bold block mb-0.5">Record → Analyze</span>
                    미팅 기록을 AI가 분석하여 핵심 개념을 추출합니다.
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 bg-nu-blue text-white flex items-center justify-center shrink-0 font-bold text-[9px]">02</span>
                  <div>
                    <span className="text-nu-ink font-bold block mb-0.5">Structure → Connect</span>
                    추출된 지식을 위키에 구조화하고 서로 연결합니다.
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 bg-nu-amber text-white flex items-center justify-center shrink-0 font-bold text-[9px]">03</span>
                  <div>
                    <span className="text-nu-ink font-bold block mb-0.5">Evolve → Grow</span>
                    지속적인 업데이트로 팀의 뇌가 진화합니다.
                  </div>
                </li>
              </ul>
            </section>

            {/* Quick Stats */}
            <section className="bg-nu-ink text-white p-6 border-[2px] border-nu-ink">
              <h3 className="font-mono-nu text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4 flex items-center gap-2">
                <Target size={14} className="text-nu-pink" /> Knowledge Metrics
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">지식 커버리지</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-nu-pink rounded-full" style={{ width: `${Math.min((topics?.length || 0) * 15, 100)}%` }} />
                    </div>
                    <span className="font-mono-nu text-[10px] text-nu-pink font-bold">
                      {Math.min((topics?.length || 0) * 15, 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">연결 밀도</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-nu-blue rounded-full" style={{ width: `${linkDensity}%` }} />
                    </div>
                    <span className="font-mono-nu text-[10px] text-nu-blue font-bold">{linkDensity}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/60">참여 활성도</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-nu-amber rounded-full" style={{ width: `${participationRate}%` }} />
                    </div>
                    <span className="font-mono-nu text-[10px] text-nu-amber font-bold">{participationRate}%</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
