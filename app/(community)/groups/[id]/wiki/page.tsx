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
  CheckCircle2,
  Circle,
  Clock,
  Lock,
  Unlock,
  ExternalLink,
  ChevronDown,
  Flag,
  Edit3,
  Star,
} from "lucide-react";
import lazyLoad from "next/dynamic";
import { WikiTopicCreator } from "@/components/wiki/wiki-topic-creator";
import { WikiSearchBar } from "@/components/wiki/wiki-search-bar";
import { WikiTabGoalEditor } from "@/components/wiki/wiki-tab-goal-editor";

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
const AskWiki = lazyLoad(() => import("@/components/wiki/ask-wiki").then(m => m.AskWiki), {
  loading: () => <WikiSkeleton h="h-16" />,
});

export const revalidate = 60;

export default async function GroupWikiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group } = await supabase
    .from("groups")
    .select("name, host_id, wiki_tab_goal, wiki_tab_description, wiki_tab_status, wiki_tab_published_slug, wiki_tab_published_at")
    .eq("id", id)
    .single();
  if (!group) notFound();

  const isHost = group.host_id === user.id;
  const tabStatus: "building" | "ready" | "published" = (group as any).wiki_tab_status || "building";
  const tabGoal: string | null = (group as any).wiki_tab_goal || null;
  const tabPublishedSlug: string | null = (group as any).wiki_tab_published_slug || null;
  const tabPublishedAt: string | null = (group as any).wiki_tab_published_at || null;

  // Fetch topics with page counts — ordered by creation (manual order)
  const { data: topics } = await supabase
    .from("wiki_topics")
    .select("id, name, description, is_public, published_at")
    .eq("group_id", id)
    .order("created_at");

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
        .select(`id, title, updated_at, version, last_updated_by, topic_id,
          topic:wiki_topics(name),
          author:profiles!wiki_pages_last_updated_by_fkey(nickname, avatar_url)`)
        .in("topic_id", topicIds)
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase.from("wiki_pages").select("id, topic_id", { count: "exact" }).in("topic_id", topicIds),
      supabase.from("group_members").select("user_id", { count: "exact", head: true })
        .eq("group_id", id).eq("status", "active"),
    ]);

    recentPages = rpResult.data || [];
    totalPages = (allPagesResult.data || []).length;
    memberCountFinal = memberCountResult.count || 0;

    (allPagesResult.data || []).forEach(p => {
      topicPageCounts[p.topic_id] = (topicPageCounts[p.topic_id] || 0) + 1;
    });
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
        supabase.from("wiki_contributions").select("id", { count: "exact", head: true }).in("page_id", allPageIds),
        supabase.from("wiki_page_links").select("source_page_id", { count: "exact", head: true }).in("source_page_id", allPageIds),
        supabase.from("wiki_contributions").select("user_id").in("page_id", allPageIds)
          .gte("created_at", thirtyDaysAgo.toISOString()),
        supabase.from("wiki_contributions")
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
    const { count: mc } = await supabase.from("group_members")
      .select("user_id", { count: "exact", head: true })
      .eq("group_id", id).eq("status", "active");
    memberCountFinalVal = mc || 0;
  }

  // ── Tab completion scoring ──
  // A section is "complete" if it has ≥2 pages with content
  const completedSections = (topics || []).filter(t => (topicPageCounts[t.id] || 0) >= 2).length;
  const totalSections = (topics || []).length;
  const sectionCompletionPct = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;
  // Overall tab readiness: section completion (60%) + resources (20%) + contributions (20%)
  const resourceScore = Math.min(totalResources * 5, 20);
  const contribScore = Math.min(totalContributions * 2, 20);
  const tabReadinessPct = Math.min(
    Math.round(sectionCompletionPct * 0.6 + resourceScore + contribScore),
    100
  );
  const isReadyToPublish = tabReadinessPct >= 70 && totalSections > 0 && totalPages > 0;

  const linkDensity = totalPages > 0 ? Math.min(Math.round((totalLinks / totalPages) * 50), 100) : 0;
  const participationRate = memberCountFinalVal > 0 ? Math.min(Math.round((activeContributorsCount / memberCountFinalVal) * 100), 100) : 0;

  return (
    <div className="min-h-screen bg-nu-paper relative">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #0d0d0d 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

      {/* ════════════════════════════════════════════════
          HERO: 너트 탭 제작 현황
          ════════════════════════════════════════════════ */}
      <div className="border-b-[3px] border-nu-ink bg-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #0d0d0d 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 md:py-10 relative z-10">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 font-mono-nu text-[12px] text-nu-muted uppercase tracking-widest mb-6">
            <Link href={`/groups/${id}`} className="hover:text-nu-ink no-underline transition-colors">{group.name}</Link>
            <ChevronRight size={12} />
            <span className="text-nu-ink font-bold">너트 탭</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

            {/* ── Left: Tab Goal & Status ── */}
            <div>
              {/* Status badge */}
              <div className="flex items-center gap-2 mb-4">
                <div className={`flex items-center gap-2 px-3 py-1.5 border-[2px] border-nu-ink font-mono-nu text-[11px] font-bold uppercase tracking-widest ${
                  tabStatus === "published"
                    ? "bg-green-500 text-white"
                    : isReadyToPublish
                    ? "bg-nu-amber text-nu-ink"
                    : "bg-nu-cream text-nu-ink"
                }`}>
                  {tabStatus === "published"
                    ? <><CheckCircle2 size={12} /> 발행 완료</>
                    : isReadyToPublish
                    ? <><Flag size={12} /> 발행 준비 완료</>
                    : <><Clock size={12} /> 제작 중</>
                  }
                </div>
                {tabStatus === "published" && tabPublishedAt && (
                  <span className="font-mono-nu text-[11px] text-nu-muted">
                    {new Date(tabPublishedAt).toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric" })} 발행
                  </span>
                )}
              </div>

              {/* Tab goal title — editable by host */}
              <WikiTabGoalEditor
                groupId={id}
                tabGoal={tabGoal}
                tabDescription={(group as any).wiki_tab_description || null}
                groupName={group.name}
                isHost={isHost}
                tabStatus={tabStatus}
                tabPublishedSlug={tabPublishedSlug}
                readinessPct={tabReadinessPct}
                isReadyToPublish={isReadyToPublish}
              />
            </div>

            {/* ── Right: Completion ring + pipeline ── */}
            <div className="space-y-4">
              {/* Completion meter */}
              <div className="bg-nu-ink text-white p-5 border-[3px] border-nu-ink shadow-[6px_6px_0px_0px_rgba(13,13,13,0.15)]">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono-nu text-[11px] uppercase tracking-widest text-white/50">탭 완성도</span>
                  <span className={`font-head text-3xl font-extrabold ${
                    tabReadinessPct >= 70 ? "text-green-400" : tabReadinessPct >= 40 ? "text-nu-amber" : "text-nu-pink"
                  }`}>{tabReadinessPct}%</span>
                </div>
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-4">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      tabReadinessPct >= 70 ? "bg-green-400" : "bg-nu-pink"
                    }`}
                    style={{ width: `${tabReadinessPct}%` }}
                  />
                </div>
                {/* Sub-scores */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "섹션 완성", value: sectionCompletionPct, sub: `${completedSections}/${totalSections}` },
                    { label: "자료 축적", value: Math.min(resourceScore * 5, 100), sub: `${totalResources}건` },
                    { label: "팀 기여", value: Math.min(contribScore * 5, 100), sub: `${totalContributions}회` },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <div className="font-mono-nu text-[10px] text-white/30 uppercase tracking-widest mb-1">{s.label}</div>
                      <div className="font-head text-base font-extrabold text-white">{s.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5-step pipeline */}
              <div className="bg-nu-cream/40 border-[2px] border-nu-ink/10 p-4">
                <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mb-3">탭 완성 프로세스</p>
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                  {[
                    { icon: Users, label: "회의", active: true, done: recentPages.length > 0 },
                    { icon: Library, label: "자료", active: totalResources > 0, done: totalResources >= 3 },
                    { icon: Brain, label: "AI합성", active: totalContributions > 0, done: sectionCompletionPct >= 30 },
                    { icon: Edit3, label: "섹션완성", active: completedSections > 0, done: completedSections === totalSections && totalSections > 0 },
                    { icon: Flag, label: "탭발행", active: isReadyToPublish, done: tabStatus === "published" },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-1 shrink-0">
                      {i > 0 && <ChevronRight size={10} className="text-nu-ink/20 shrink-0" />}
                      <div className={`flex flex-col items-center gap-1 px-2 py-1.5 ${
                        step.done ? "opacity-100" : step.active ? "opacity-70" : "opacity-25"
                      }`}>
                        <div className={`w-7 h-7 flex items-center justify-center border-2 ${
                          step.done
                            ? "bg-green-500 border-green-600 text-white"
                            : step.active
                            ? "bg-nu-pink/10 border-nu-pink/30 text-nu-pink"
                            : "bg-nu-cream border-nu-ink/10 text-nu-muted"
                        }`}>
                          {step.done
                            ? <CheckCircle2 size={14} className="text-white" />
                            : <step.icon size={13} />
                          }
                        </div>
                        <span className="font-mono-nu text-[9px] text-nu-muted whitespace-nowrap">{step.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Search + Add Section ── */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <WikiSearchBar groupId={id} />
            {isHost && (
              <WikiTopicCreator groupId={id} />
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          MAIN CONTENT
          ════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10">

        {/* ── AI Ask ── */}
        <section className="mb-10">
          <AskWiki groupId={id} />
        </section>

        {/* ════════════════════════════════════════════════
            SECTION A: 섹션들 — "탭의 재료"
            작은 섹션들이 모여 최종 탭이 완성됩니다
            ════════════════════════════════════════════════ */}
        <section className="mb-14">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
              <Target size={20} className="text-nu-pink" />
              탭 섹션 현황
            </h2>
            <span className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">
              {completedSections}/{totalSections} 섹션 완성
            </span>
          </div>
          <p className="font-mono-nu text-[12px] text-nu-muted mb-6">
            각 섹션에 충분한 내용이 채워지면 최종 탭이 완성됩니다 — 회의와 자료로 하나씩 채워가세요
          </p>

          {topics && topics.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topics.map((topic, i) => {
                const pageCount = topicPageCounts[topic.id] || 0;
                const lastUpdate = topicLatestUpdate[topic.id];
                const isSectionDone = pageCount >= 2;
                const isSectionStarted = pageCount >= 1;

                const bgColors = ["bg-nu-pink", "bg-nu-blue", "bg-[#ff6f00]", "bg-green-500", "bg-purple-500", "bg-cyan-600", "bg-red-500", "bg-teal-500"];
                const accentColor = bgColors[i % bgColors.length];

                return (
                  <Link
                    key={topic.id}
                    href={`/groups/${id}/wiki/topics/${topic.id}`}
                    className="group bg-white border-[3px] border-nu-ink no-underline shadow-[4px_4px_0px_0px_rgba(13,13,13,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(13,13,13,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex flex-col"
                  >
                    {/* Color header bar */}
                    <div className={`${accentColor} px-4 py-2 flex items-center justify-between`}>
                      <span className="font-mono-nu text-[10px] text-white/80 font-bold uppercase tracking-widest">
                        섹션 {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className={`font-mono-nu text-[10px] font-bold px-2 py-0.5 ${
                        isSectionDone
                          ? "bg-white/25 text-white"
                          : isSectionStarted
                          ? "bg-white/15 text-white/70"
                          : "bg-black/15 text-white/50"
                      }`}>
                        {isSectionDone ? "✓ 완성" : isSectionStarted ? "작성 중" : "미시작"}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-head text-sm font-extrabold text-nu-ink group-hover:text-nu-pink transition-colors mb-1">
                        {topic.name}
                      </h3>
                      <p className="text-[12px] text-nu-muted leading-relaxed flex-1 line-clamp-2">
                        {topic.description || "이 섹션을 채우면 탭이 한 단계 완성됩니다"}
                      </p>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono-nu text-[10px] text-nu-muted">페이지</span>
                          <span className="font-mono-nu text-[10px] font-bold text-nu-ink">{pageCount} / 2+</span>
                        </div>
                        <div className="h-1.5 bg-nu-cream rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isSectionDone ? "bg-green-500" : "bg-nu-pink"}`}
                            style={{ width: `${Math.min((pageCount / 2) * 100, 100)}%` }}
                          />
                        </div>
                        {lastUpdate && (
                          <p className="font-mono-nu text-[9px] text-nu-muted/50 mt-1 text-right">
                            {new Date(lastUpdate).toLocaleDateString("ko", { month: "short", day: "numeric" })} 수정
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer arrow */}
                    <div className="px-4 py-2 border-t border-nu-ink/5 flex items-center justify-between">
                      <span className="font-mono-nu text-[10px] text-nu-muted">섹션 편집하기</span>
                      <ArrowRight size={12} className="text-nu-ink/20 group-hover:text-nu-pink group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                );
              })}

              {/* Add section card — host only */}
              {isHost && (
                <div className="border-[3px] border-dashed border-nu-ink/20 p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[180px] hover:border-nu-pink/40 hover:bg-nu-pink/[0.02] transition-colors">
                  <Plus size={20} className="text-nu-ink/20" />
                  <p className="font-head text-sm font-bold text-nu-muted">새 섹션 추가</p>
                  <p className="font-mono-nu text-[11px] text-nu-muted/60">위의 검색창에서 추가</p>
                </div>
              )}
            </div>
          ) : (
            <div className="border-[3px] border-dashed border-nu-ink/15 p-14 text-center bg-white">
              <Brain size={36} className="mx-auto mb-4 text-nu-ink/10" />
              <p className="font-head text-base font-bold text-nu-ink mb-2">아직 섹션이 없습니다</p>
              <p className="text-sm text-nu-muted max-w-sm mx-auto mb-4">
                섹션은 최종 탭의 챕터(장)입니다. 팀이 다룰 주제를 섹션으로 만들면 회의와 자료가 쌓이면서 탭이 완성됩니다.
              </p>
              {isHost && (
                <p className="font-mono-nu text-[12px] text-nu-pink font-bold">위의 검색창에서 첫 섹션을 추가해보세요 →</p>
              )}
            </div>
          )}
        </section>

        {/* ════════════════════════════════════════════════
            SECTION B: 주간 워크플로우 (탭 재료 투입)
            회의 + 자료 → AI 합성 → 섹션 강화
            ════════════════════════════════════════════════ */}
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-nu-ink flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-head text-lg font-extrabold text-nu-ink">탭 재료 투입</h2>
              <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">회의·자료 → AI 합성 → 섹션 강화 → 탭 완성</p>
            </div>
          </div>
          <p className="font-mono-nu text-[12px] text-nu-muted mb-6 ml-11">
            이번 주 쌓인 회의록과 자료가 AI 통합을 거쳐 각 섹션의 내용을 강화합니다
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-head text-base font-bold text-nu-ink flex items-center gap-2">
                  <Library size={16} className="text-[#ff6f00]" /> 자료 투입
                </h3>
                <span className="font-mono-nu text-[10px] text-nu-muted uppercase">이번 주 {weeklyResourceCount}건</span>
              </div>
              <WeeklyResourceFeed groupId={id} userId={user.id} />
            </section>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-head text-base font-bold text-nu-ink flex items-center gap-2">
                  <Sparkles size={16} className="text-nu-pink" /> AI 지식 합성
                </h3>
                <span className="font-mono-nu text-[10px] text-nu-muted uppercase">섹션 내용 자동 강화</span>
              </div>
              <WeeklySynthesisEngine groupId={id} isHost={isHost} />
            </section>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            SECTION C: 최종 탭 미리보기
            이것이 완성·발행될 너트 탭입니다
            ════════════════════════════════════════════════ */}
        <section className="mb-14">
          {/* Header with publish CTA */}
          <div className="flex items-start sm:items-center justify-between gap-4 mb-5 flex-wrap">
            <div>
              <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
                <BookOpen size={20} className="text-nu-blue" />
                최종 탭 미리보기
              </h2>
              <p className="font-mono-nu text-[12px] text-nu-muted mt-1">
                섹션들이 완성되면 이 문서가 너트 탭으로 발행됩니다
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {tabStatus === "published" && tabPublishedSlug && (
                <Link
                  href={`/wiki/${tabPublishedSlug}`}
                  target="_blank"
                  className="flex items-center gap-2 font-mono-nu text-[11px] uppercase tracking-widest px-4 py-2.5 bg-green-500 text-white border-[3px] border-nu-ink shadow-[3px_3px_0px_0px_rgba(13,13,13,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(13,13,13,1)] transition-all font-bold no-underline"
                >
                  <ExternalLink size={12} /> 발행된 탭 보기
                </Link>
              )}

              <div className={`flex items-center gap-1.5 font-mono-nu text-[11px] px-3 py-1.5 border-[2px] ${
                tabStatus === "published"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : isReadyToPublish
                  ? "border-nu-amber bg-nu-amber/10 text-nu-amber"
                  : "border-nu-ink/10 bg-nu-cream/50 text-nu-muted"
              }`}>
                {tabStatus === "published"
                  ? <><Lock size={11} /> 발행됨</>
                  : isReadyToPublish
                  ? <><Unlock size={11} /> 발행 가능</>
                  : <><Clock size={11} /> {tabReadinessPct}% 완성</>
                }
              </div>
            </div>
          </div>

          <UnifiedTabView groupId={id} groupName={group.name} isHost={isHost} groupId2={id} />
        </section>

        {/* ════════════════════════════════════════════════
            SECTION D: 분석 및 인사이트
            ════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* Left Column */}
          <div className="lg:col-span-8 space-y-14">

            {/* Knowledge Graph */}
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
                  <GitBranch size={20} className="text-nu-blue" /> 지식 그래프
                </h2>
                <span className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest bg-nu-cream px-3 py-1 border border-nu-ink/10">
                  섹션 · 페이지 · 자료 연결 구조
                </span>
              </div>
              <KnowledgeGraph groupId={id} />
            </section>

            {/* Recent Changes */}
            <section className="bg-nu-ink text-white p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
              <div className="absolute top-0 right-0 w-48 h-48 bg-nu-pink/[0.06] rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-head text-lg font-extrabold flex items-center gap-2">
                    <History size={18} className="text-nu-pink" /> 탭 작성 기록
                  </h2>
                  <span className="font-mono-nu text-[10px] text-white/25 uppercase tracking-widest">{recentPages.length}건</span>
                </div>
                <div className="space-y-0">
                  {recentPages.length > 0 ? (
                    recentPages.slice(0, 6).map((page, i) => {
                      const isRecent = Date.now() - new Date(page.updated_at).getTime() < 3 * 24 * 60 * 60 * 1000;
                      return (
                        <div key={page.id} className="flex gap-4 group">
                          <div className="flex flex-col items-center w-5 shrink-0">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${i === 0 ? "bg-nu-pink shadow-[0_0_6px_rgba(233,30,99,0.4)]" : isRecent ? "bg-nu-pink/30" : "bg-white/15"}`} />
                            {i < Math.min(recentPages.length, 6) - 1 && <div className="w-px flex-1 bg-white/10" />}
                          </div>
                          <div className="flex-1 pb-4 min-w-0">
                            <Link href={`/groups/${id}/wiki/pages/${page.id}`} className="block text-sm font-bold text-white no-underline hover:text-nu-pink transition-colors truncate">
                              {page.title}
                            </Link>
                            <div className="flex items-center gap-2 mt-0.5 font-mono-nu text-[10px] text-white/25">
                              <span>섹션: {(page as any).topic?.name}</span>
                              <span>· v{page.version}</span>
                              <span>· {new Date(page.updated_at).toLocaleDateString("ko", { month: "short", day: "numeric" })}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-white/30 text-xs">아직 탭 작성 기록이 없습니다</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

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

          {/* Right Column */}
          <div className="lg:col-span-4 space-y-8">

            {/* Tab readiness metrics */}
            <section className="bg-nu-ink text-white p-5 border-[2px] border-nu-ink relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-nu-pink/[0.08] rounded-full blur-2xl" />
              <h3 className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 mb-5 flex items-center gap-2 relative">
                <Star size={13} className="text-nu-pink" /> 탭 완성 지표
              </h3>
              <div className="space-y-4 relative">
                {[
                  { label: "섹션 완성도", value: sectionCompletionPct, color: "bg-nu-pink", textColor: "text-nu-pink", desc: `${completedSections}/${totalSections} 완성` },
                  { label: "자료 풍부도", value: Math.min(totalResources * 10, 100), color: "bg-[#ff6f00]", textColor: "text-[#ff6f00]", desc: `${totalResources}건` },
                  { label: "팀 기여도", value: participationRate, color: "bg-nu-blue", textColor: "text-nu-blue", desc: `${activeContributorsCount}/${memberCountFinalVal}명` },
                ].map(m => (
                  <div key={m.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] text-white/60">{m.label}</span>
                      <span className={`font-mono-nu text-[12px] font-bold ${m.textColor}`}>{m.value}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full ${m.color} rounded-full transition-all duration-700`} style={{ width: `${m.value}%` }} />
                    </div>
                    <p className="font-mono-nu text-[10px] text-white/20 mt-1">{m.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="font-mono-nu text-[11px] text-white/30 uppercase tracking-widest">종합 완성도</span>
                <span className="font-head text-xl font-extrabold text-nu-pink">
                  {tabReadinessPct}<span className="text-[12px] text-white/30 ml-0.5">%</span>
                </span>
              </div>
            </section>

            {/* Activity feed */}
            <section className="bg-white border-[2px] border-nu-ink/[0.08]">
              <div className="p-4 border-b border-nu-ink/5 flex items-center justify-between">
                <h3 className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
                  <Sparkles size={12} className="text-nu-pink" /> 기여 활동
                </h3>
                <span className="font-mono-nu text-[9px] text-nu-muted uppercase">{activityFeed.length}건</span>
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
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-nu-blue/10 flex items-center justify-center font-head text-[10px] font-bold text-nu-blue shrink-0">
                              {(a.contributor?.nickname || "U").charAt(0)}
                            </div>
                          )}
                          <span className="font-head text-[13px] font-bold text-nu-ink truncate">
                            {isAI ? "AI 합성" : (a.contributor?.nickname || "?")}
                          </span>
                          <span className="font-mono-nu text-[9px] text-nu-muted/40 ml-auto shrink-0">
                            {new Date(a.created_at).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        {a.page && (
                          <Link href={`/groups/${id}/wiki/pages/${a.page.id}`} className="text-[13px] text-nu-blue no-underline hover:underline truncate block ml-7">
                            {a.page.title}
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Sparkles size={24} className="mx-auto mb-2 text-nu-ink/10" />
                  <p className="font-mono-nu text-[12px] text-nu-muted">기여 활동을 시작해보세요</p>
                </div>
              )}
            </section>

            <section>
              <h2 className="font-head text-base font-extrabold text-nu-ink mb-4 flex items-center gap-2">
                <Trophy size={16} className="text-yellow-500" /> 탭 제작 챔피언
              </h2>
              <ContributionLeaderboard groupId={id} />
            </section>

            <section>
              <h2 className="font-head text-base font-extrabold text-nu-ink mb-4 flex items-center gap-2">
                <Users size={16} className="text-nu-pink" /> 인적 자원
              </h2>
              <HumanCapitalVisual groupId={id} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
