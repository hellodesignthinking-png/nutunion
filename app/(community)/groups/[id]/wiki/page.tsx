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
  Target,
  FileText,
  TrendingUp,
  Calendar,
  Library,
} from "lucide-react";
import lazyLoad from "next/dynamic";
import { WikiTopicCreator } from "@/components/wiki/wiki-topic-creator";
import { WikiSearchBar } from "@/components/wiki/wiki-search-bar";

function WikiSkeleton({ h = "h-64" }: { h?: string }) {
  return <div className={`${h} bg-nu-ink/[0.03] animate-pulse border-[2px] border-nu-ink/[0.08]`} />;
}

const KnowledgeGraph = lazyLoad(() => import("@/components/wiki/knowledge-graph").then(m => m.KnowledgeGraph), {
  loading: () => <WikiSkeleton h="h-80" />,
});
const WeeklyResourceFeed = lazyLoad(() => import("@/components/wiki/weekly-resource-feed").then(m => m.WeeklyResourceFeed), {
  loading: () => <WikiSkeleton />,
});
const WeeklySynthesisEngine = lazyLoad(() => import("@/components/wiki/weekly-synthesis-engine").then(m => m.WeeklySynthesisEngine), {
  loading: () => <WikiSkeleton />,
});
const ContributionLeaderboard = lazyLoad(() => import("@/components/wiki/contribution-leaderboard").then(m => m.ContributionLeaderboard), {
  loading: () => <WikiSkeleton h="h-48" />,
});
const HumanCapitalVisual = lazyLoad(() => import("@/components/wiki/human-capital-visual").then(m => m.HumanCapitalVisual), {
  loading: () => <WikiSkeleton h="h-48" />,
});
const WeeklyInsightNewsletter = lazyLoad(() => import("@/components/wiki/weekly-insight-newsletter").then(m => m.WeeklyInsightNewsletter), {
  loading: () => <WikiSkeleton h="h-72" />,
});
const MonthlyEvolutionAnalysis = lazyLoad(() => import("@/components/wiki/monthly-evolution-analysis").then(m => m.MonthlyEvolutionAnalysis), {
  loading: () => <WikiSkeleton h="h-72" />,
});
const UnifiedTabView = lazyLoad(() => import("@/components/wiki/unified-tab-view").then(m => m.UnifiedTabView), {
  loading: () => <WikiSkeleton h="h-96" />,
});

export const revalidate = 60;

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
  let totalResources = 0;
  let weeklyResourceCount = 0;
  const topicPageCounts: Record<string, number> = {};
  const topicLatestUpdate: Record<string, string> = {};

  // Fetch resource count
  const [resourceCountResult, weeklyResResult] = await Promise.all([
    supabase.from("wiki_weekly_resources").select("id", { count: "exact", head: true }).eq("group_id", id),
    supabase.from("wiki_weekly_resources").select("id", { count: "exact", head: true }).eq("group_id", id)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ]);
  totalResources = resourceCountResult.count || 0;
  weeklyResourceCount = weeklyResResult.count || 0;

  if (topicIds.length > 0) {
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
          author:profiles!wiki_pages_last_updated_by_fkey(nickname, avatar_url)
        `)
        .in("topic_id", topicIds)
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("wiki_pages")
        .select("id, topic_id", { count: "exact" })
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

    (allPagesResult.data || []).forEach(p => {
      topicPageCounts[p.topic_id] = (topicPageCounts[p.topic_id] || 0) + 1;
    });

    // Track latest update per topic from recent pages
    recentPages.forEach(p => {
      if (!topicLatestUpdate[p.topic_id] || p.updated_at > topicLatestUpdate[p.topic_id]) {
        topicLatestUpdate[p.topic_id] = p.updated_at;
      }
    });

    const allPageIds = (allPagesResult.data || []).map(p => p.id);
    if (allPageIds.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
          .select("change_summary, created_at, source_type, contributor:profiles!wiki_contributions_user_id_fkey(nickname, avatar_url), page:wiki_pages!wiki_contributions_page_id_fkey(id, title)")
          .in("page_id", allPageIds)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      totalContributions = contribResult.count || 0;
      totalLinks = linkResult.count || 0;
      activeContributorsCount = new Set((recentContribResult.data || []).map(c => c.user_id)).size;
      activityFeed = (activityFeedResult.data || []) as any[];
    }
  }

  let memberCountFinalVal = memberCountFinal;
  if (topicIds.length === 0) {
    const { count: mc } = await supabase
      .from("group_members")
      .select("user_id", { count: "exact", head: true })
      .eq("group_id", id)
      .eq("status", "active");
    memberCountFinalVal = mc || 0;
  }

  const linkDensity = totalPages > 0 ? Math.min(Math.round((totalLinks / totalPages) * 50), 100) : 0;
  const participationRate = memberCountFinalVal > 0 ? Math.min(Math.round((activeContributorsCount / memberCountFinalVal) * 100), 100) : 0;
  const knowledgeCoverage = Math.min((topics?.length || 0) * 15, 100);

  return (
    <div className="min-h-screen bg-nu-paper">
      {/* ── Hero Header ─────────────────────────────── */}
      <div className="border-b-[3px] border-nu-ink bg-gradient-to-br from-nu-cream/50 via-white to-nu-cream/30 relative overflow-hidden">
        <div className="absolute -right-32 -top-32 w-96 h-96 bg-nu-pink/[0.03] rounded-full blur-3xl" />
        <div className="absolute -left-32 -bottom-32 w-96 h-96 bg-nu-blue/[0.03] rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #0d0d0d 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 md:py-12 relative z-10">
          <div className="flex items-center gap-2 font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mb-6">
            <Link href={`/groups/${id}`} className="hover:text-nu-ink no-underline transition-colors">{group.name}</Link>
            <ChevronRight size={12} />
            <span className="text-nu-ink font-bold">탭</span>
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
                    함께 만드는 지식 생태계
                  </p>
                </div>
              </div>
              <p className="text-nu-graphite leading-relaxed text-sm font-medium mt-4 max-w-xl">
                매주 회의와 토론을 기반으로 AI가 하나의 문서를 강화합니다.
                자료와 회의록이 쌓이면서 논문형 공유 지식이 완성됩니다.
              </p>
            </div>

            {/* KPI Summary Cards — 5 metrics, responsive grid */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 shrink-0">
              {[
                { value: topics?.length || 0, label: "주제", color: "text-nu-ink", border: "border-nu-ink", icon: Brain },
                { value: totalPages, label: "페이지", color: "text-nu-pink", border: "border-nu-pink/40", icon: FileText },
                { value: totalResources, label: "자료", color: "text-[#ff6f00]", border: "border-[#ff6f00]/40", icon: Library },
                { value: totalContributions, label: "기여", color: "text-nu-blue", border: "border-nu-blue/40", icon: TrendingUp },
                { value: memberCountFinalVal, label: "멤버", color: "text-green-600", border: "border-green-500/40", icon: Users },
              ].map((kpi, i) => (
                <div key={i} className={`bg-white border-[2px] ${kpi.border} p-3 text-center min-w-0 relative overflow-hidden group hover:shadow-sm transition-shadow`}>
                  <kpi.icon size={32} className={`absolute -right-1 -top-1 ${kpi.color} opacity-[0.06]`} />
                  <p className={`font-head text-2xl md:text-3xl font-extrabold ${kpi.color} relative`}>{kpi.value}</p>
                  <p className="font-mono-nu text-[7px] text-nu-muted uppercase tracking-widest mt-0.5">{kpi.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Search + Actions */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <WikiSearchBar groupId={id} />
            <WikiTopicCreator groupId={id} />
          </div>
        </div>
      </div>

      {/* ── Weekly Growth Cycle Banner ────────────────── */}
      <div className="bg-nu-ink/[0.02] border-b border-nu-ink/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-hide pb-1">
            {[
              { icon: Users, label: "회의 · 토론", sub: "회의록 기록", color: "text-nu-blue", bgColor: "bg-nu-blue/10", active: false },
              { icon: Library, label: "자료 보강", sub: `${weeklyResourceCount}건 이번 주`, color: "text-[#ff6f00]", bgColor: "bg-[#ff6f00]/10", active: weeklyResourceCount > 0 },
              { icon: Brain, label: "AI 통합", sub: "회의록 → 탭", color: "text-nu-pink", bgColor: "bg-nu-pink/10", active: false },
              { icon: BookOpen, label: "통합 탭 강화", sub: `${totalPages}페이지`, color: "text-green-600", bgColor: "bg-green-500/10", active: totalPages > 0 },
              { icon: TrendingUp, label: "점진적 성장", sub: `${activeContributorsCount}명 기여`, color: "text-purple-600", bgColor: "bg-purple-500/10", active: activeContributorsCount > 0 },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-1 sm:gap-2 shrink-0">
                {i > 0 && <ArrowRight size={10} className="text-nu-ink/15 shrink-0 hidden sm:block" />}
                {i > 0 && <span className="text-nu-ink/15 sm:hidden text-[8px]">›</span>}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-sm ${step.bgColor} ${step.active ? "ring-1 ring-inset ring-current" : ""}`}>
                  <div className="relative">
                    <step.icon size={14} className={step.color} />
                    {step.active && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full" />}
                  </div>
                  <div>
                    <p className={`font-mono-nu text-[9px] font-bold uppercase tracking-wider ${step.color} whitespace-nowrap`}>{step.label}</p>
                    <p className="font-mono-nu text-[7px] text-nu-muted whitespace-nowrap">{step.sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 md:py-12">

        {/* ══════════════════════════════════════════════
            SECTION A: 통합 탭 (메인 문서)
            — 모든 주제가 하나의 문서로 조립됨
            ══════════════════════════════════════════════ */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
              <BookOpen size={20} className="text-nu-ink" /> 통합 탭
            </h2>
            <span className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest bg-nu-cream px-3 py-1 border border-nu-ink/10">
              회의 기반 · 주간 성장 · 논문형 문서
            </span>
          </div>
          <UnifiedTabView groupId={id} groupName={group.name} />
        </section>

        {/* ══════════════════════════════════════════════
            SECTION B: 주간 워크플로우 (입력 도구)
            — 회의록 + 자료 → AI 통합 → 탭 강화
            ══════════════════════════════════════════════ */}
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-nu-ink flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-head text-lg font-extrabold text-nu-ink">주간 워크플로우</h2>
              <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">자료 공유 → 회의 · 토론 → AI 통합 → 탭 강화</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Resource Feed */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-head text-base font-bold text-nu-ink flex items-center gap-2">
                  <Library size={16} className="text-[#ff6f00]" /> 주간 자료실
                </h3>
                <span className="font-mono-nu text-[8px] text-nu-muted uppercase">
                  이번 주 {weeklyResourceCount}건
                </span>
              </div>
              <WeeklyResourceFeed groupId={id} userId={user.id} />
            </section>

            {/* AI Knowledge Synthesis */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-head text-base font-bold text-nu-ink flex items-center gap-2">
                  <Sparkles size={16} className="text-nu-pink" /> AI 지식 통합
                </h3>
                <span className="font-mono-nu text-[8px] text-nu-muted uppercase">
                  회의록 + 자료 → 탭 강화
                </span>
              </div>
              <WeeklySynthesisEngine groupId={id} isHost={isHost} />
            </section>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            SECTION C: 구성 요소 & 분석
            ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* ── Left Column (8 cols) ─────────────────── */}
          <div className="lg:col-span-8 space-y-14">

            {/* ── Knowledge Graph ────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
                  <GitBranch size={20} className="text-nu-blue" /> 지식 그래프
                </h2>
                <span className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest bg-nu-cream px-3 py-1 border border-nu-ink/10">
                  섹션 · 페이지 · 자료 시각화
                </span>
              </div>
              <KnowledgeGraph groupId={id} />
            </section>

            {/* ── Section Management (구성 섹션) ──── */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
                  <Brain size={20} className="text-nu-pink" /> 구성 섹션
                </h2>
                <span className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest">
                  {topics?.length || 0}개 섹션이 통합 탭을 구성합니다
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {topics && topics.length > 0 ? (
                  topics.map((topic, i) => {
                    const pageCount = topicPageCounts[topic.id] || 0;
                    const lastUpdate = topicLatestUpdate[topic.id];
                    const colorClasses = ["border-l-nu-pink", "border-l-nu-blue", "border-l-[#ff6f00]", "border-l-green-500", "border-l-purple-500", "border-l-cyan-500"];
                    return (
                      <Link
                        key={topic.id}
                        href={`/groups/${id}/wiki/topics/${topic.id}`}
                        className={`group bg-white border-[2px] border-nu-ink/10 border-l-[4px] ${colorClasses[i % colorClasses.length]} p-4 no-underline hover:border-nu-ink/25 hover:shadow-sm transition-all`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono-nu text-[9px] text-nu-muted/40 font-bold">
                                §{String(i + 1).padStart(2, "0")}
                              </span>
                              <h3 className="font-head text-sm font-bold text-nu-ink group-hover:text-nu-pink transition-colors truncate">
                                {topic.name}
                              </h3>
                            </div>
                            <p className="text-[10px] text-nu-muted leading-relaxed mt-1 line-clamp-1">
                              {topic.description || "섹션을 편집하여 탭을 강화하세요"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono-nu text-[9px] text-nu-muted">{pageCount}p</span>
                            {lastUpdate && (
                              <span className="font-mono-nu text-[7px] text-nu-muted/40">
                                {new Date(lastUpdate).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                              </span>
                            )}
                            <ArrowRight size={12} className="text-nu-ink/20 group-hover:text-nu-pink transition-colors" />
                          </div>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="col-span-2 border-[2px] border-dashed border-nu-ink/15 p-10 text-center bg-white/50">
                    <Brain size={32} className="mx-auto mb-3 text-nu-ink/15" />
                    <p className="text-nu-muted text-sm font-medium mb-1">아직 등록된 섹션이 없습니다</p>
                    <p className="text-xs text-nu-muted/70">섹션(주제)을 생성하면 통합 탭의 목차가 됩니다</p>
                  </div>
                )}
              </div>
            </section>

            {/* ── Recent Changes ──────────────────── */}
            <section className="bg-nu-ink text-white p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
              <div className="absolute top-0 right-0 w-48 h-48 bg-nu-pink/[0.06] rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-head text-lg font-extrabold flex items-center gap-2">
                    <History size={18} className="text-nu-pink" /> 변경 기록
                  </h2>
                  <span className="font-mono-nu text-[8px] text-white/25 uppercase tracking-widest">
                    {recentPages.length}건
                  </span>
                </div>

                <div className="space-y-0">
                  {recentPages.length > 0 ? (
                    recentPages.slice(0, 6).map((page, i) => {
                      const isRecent = Date.now() - new Date(page.updated_at).getTime() < 3 * 24 * 60 * 60 * 1000;
                      return (
                        <div key={page.id} className="flex gap-4 group">
                          <div className="flex flex-col items-center w-5 shrink-0">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              i === 0 ? "bg-nu-pink shadow-[0_0_6px_rgba(233,30,99,0.4)]" : isRecent ? "bg-nu-pink/30" : "bg-white/15"
                            }`} />
                            {i < Math.min(recentPages.length, 6) - 1 && <div className="w-px flex-1 bg-white/10" />}
                          </div>
                          <div className="flex-1 pb-4 min-w-0">
                            <Link
                              href={`/groups/${id}/wiki/pages/${page.id}`}
                              className="block text-sm font-bold text-white no-underline hover:text-nu-pink transition-colors truncate"
                            >
                              {page.title}
                            </Link>
                            <div className="flex items-center gap-2 mt-0.5 font-mono-nu text-[8px] text-white/25">
                              <span>{(page as any).topic?.name}</span>
                              <span>· v{page.version}</span>
                              <span>· {(page as any).author?.nickname || "?"}</span>
                              <span>· {new Date(page.updated_at).toLocaleDateString("ko", { month: "short", day: "numeric" })}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-white/30 text-xs">아직 변경 기록이 없습니다</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── Weekly Insight & Monthly Evolution ── */}
            <section>
              <h2 className="font-head text-xl font-extrabold text-nu-ink mb-5 flex items-center gap-2">
                <BarChart3 size={20} className="text-nu-amber" /> 주간 인사이트
              </h2>
              <WeeklyInsightNewsletter groupId={id} isHost={isHost} />
            </section>

            <section>
              <h2 className="font-head text-xl font-extrabold text-nu-ink mb-5 flex items-center gap-2">
                <TrendingUp size={20} className="text-purple-500" /> 월간 진화 분석
              </h2>
              <MonthlyEvolutionAnalysis groupId={id} isHost={isHost} />
            </section>
          </div>

          {/* ── Right Column (4 cols) ────────────────── */}
          <div className="lg:col-span-4 space-y-8">

            {/* Knowledge Metrics */}
            <section className="bg-nu-ink text-white p-5 border-[2px] border-nu-ink relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-nu-pink/[0.08] rounded-full blur-2xl" />
              <h3 className="font-mono-nu text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 mb-5 flex items-center gap-2 relative">
                <Target size={13} className="text-nu-pink" /> 지식 지표
              </h3>
              <div className="space-y-4 relative">
                {[
                  { label: "섹션 커버리지", value: knowledgeCoverage, color: "bg-nu-pink", textColor: "text-nu-pink", desc: `${topics?.length || 0}개 섹션` },
                  { label: "연결 밀도", value: linkDensity, color: "bg-nu-blue", textColor: "text-nu-blue", desc: `${totalLinks}개 연결` },
                  { label: "참여 활성도", value: participationRate, color: "bg-nu-amber", textColor: "text-nu-amber", desc: `${activeContributorsCount}/${memberCountFinalVal}명` },
                ].map(m => (
                  <div key={m.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-white/60">{m.label}</span>
                      <span className={`font-mono-nu text-[10px] font-bold ${m.textColor}`}>{m.value}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${m.color} rounded-full transition-all duration-700`} style={{ width: `${m.value}%` }} />
                    </div>
                    <p className="font-mono-nu text-[8px] text-white/20 mt-1">{m.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="font-mono-nu text-[9px] text-white/30 uppercase tracking-widest">종합</span>
                <span className="font-head text-xl font-extrabold text-nu-pink">
                  {Math.round((knowledgeCoverage + linkDensity + participationRate) / 3)}
                  <span className="text-[10px] text-white/30 ml-0.5">/ 100</span>
                </span>
              </div>
            </section>

            {/* Activity Feed */}
            <section className="bg-white border-[2px] border-nu-ink/[0.08]">
              <div className="p-4 border-b border-nu-ink/5 flex items-center justify-between">
                <h3 className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
                  <Sparkles size={12} className="text-nu-pink" /> 기여 활동
                </h3>
                <span className="font-mono-nu text-[7px] text-nu-muted uppercase">{activityFeed.length}건</span>
              </div>
              {activityFeed.length > 0 ? (
                <div className="divide-y divide-nu-ink/5">
                  {activityFeed.slice(0, 8).map((a: any, i: number) => {
                    const isAI = a.source_type === "ai_synthesis";
                    return (
                      <div key={i} className={`px-4 py-3 hover:bg-nu-cream/20 transition-colors ${isAI ? "bg-nu-pink/[0.02]" : ""}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {isAI ? (
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-nu-pink to-purple-500 flex items-center justify-center shrink-0">
                              <Brain size={10} className="text-white" />
                            </div>
                          ) : a.contributor?.avatar_url ? (
                            <img src={a.contributor.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover border border-nu-ink/10" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-nu-blue/10 flex items-center justify-center font-head text-[8px] font-bold text-nu-blue shrink-0">
                              {(a.contributor?.nickname || "U").charAt(0)}
                            </div>
                          )}
                          <span className="font-head text-[11px] font-bold text-nu-ink truncate">
                            {isAI ? "AI 통합" : (a.contributor?.nickname || "?")}
                          </span>
                          <span className="font-mono-nu text-[7px] text-nu-muted/40 ml-auto shrink-0">
                            {new Date(a.created_at).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        {a.page && (
                          <Link href={`/groups/${id}/wiki/pages/${a.page.id}`} className="text-[11px] text-nu-blue no-underline hover:underline truncate block ml-7">
                            {a.page.title}
                          </Link>
                        )}
                        <p className="font-mono-nu text-[8px] text-nu-muted mt-0.5 line-clamp-1 ml-7">
                          {a.change_summary || "편집"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Sparkles size={24} className="mx-auto mb-2 text-nu-ink/10" />
                  <p className="font-mono-nu text-[10px] text-nu-muted">기여 활동을 시작해보세요</p>
                </div>
              )}
            </section>

            {/* Knowledge Champions */}
            <section>
              <h2 className="font-head text-base font-extrabold text-nu-ink mb-4 flex items-center gap-2">
                <Trophy size={16} className="text-yellow-500" /> 지식 챔피언
              </h2>
              <ContributionLeaderboard groupId={id} />
            </section>

            {/* Human Capital */}
            <section>
              <h2 className="font-head text-base font-extrabold text-nu-ink mb-4 flex items-center gap-2">
                <Users size={16} className="text-nu-pink" /> 인적 자원
              </h2>
              <HumanCapitalVisual groupId={id} />
            </section>

            {/* Growth Cycle Guide */}
            <section className="bg-nu-cream p-5 border-[2px] border-nu-ink">
              <h3 className="font-mono-nu text-[10px] font-bold text-nu-ink uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Calendar size={13} className="text-nu-pink" /> 주간 성장 사이클
              </h3>
              <ul className="space-y-3 font-mono-nu text-[10px] text-nu-muted leading-relaxed">
                {[
                  { num: "01", color: "bg-nu-blue", title: "회의 · 토론", desc: "주제에 대해 회의하고 회의록을 기록합니다" },
                  { num: "02", color: "bg-[#ff6f00]", title: "자료 보강", desc: "회의에서 나온 주제를 보강할 자료를 공유합니다" },
                  { num: "03", color: "bg-nu-pink", title: "AI 통합", desc: "회의록과 자료를 AI가 분석, 통합 탭을 강화합니다" },
                  { num: "04", color: "bg-green-600", title: "탭 성장", desc: "하나의 완성된 문서가 점진적으로 성장합니다" },
                  { num: "05", color: "bg-purple-600", title: "다음 주", desc: "이전 맥락 위에 새 회의 결과를 쌓아갑니다" },
                ].map(s => (
                  <li key={s.num} className="flex gap-3">
                    <span className={`w-5 h-5 ${s.color} text-white flex items-center justify-center shrink-0 font-bold text-[8px]`}>{s.num}</span>
                    <div>
                      <span className="text-nu-ink font-bold block text-[10px]">{s.title}</span>
                      <span className="text-[9px]">{s.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
