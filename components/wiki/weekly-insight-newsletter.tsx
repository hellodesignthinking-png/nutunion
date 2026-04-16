"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, Brain, TrendingUp, TrendingDown,
  Loader2, BarChart3, RefreshCw,
  BookOpen, Calendar, Target, Lightbulb
} from "lucide-react";

interface WeeklyDigestData {
  weekStart: string;
  weekEnd: string;
  topPages: { pageId: string; title: string; views: number; edits: number }[];
  topContributors: { userId: string; nickname: string; contributions: number }[];
  keyInsights: string;
  trendAnalysis: {
    totalEdits: number;
    editsDelta: number;
    totalViews: number;
    viewsDelta: number;
    activeContributors: number;
    contributorsDelta: number;
    hotTopics: string[];
    emergingConcepts: string[];
  };
  dailyActivity: { day: string; edits: number; views: number }[];
}

export function WeeklyInsightNewsletter({ groupId, isHost = false }: { groupId: string; isHost?: boolean }) {
  const [digest, setDigest] = useState<WeeklyDigestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "trends" | "insights">("overview");

  // Load real data from Supabase
  const generateDigest = async () => {
    setGenerating(true);
    try {
      const supabase = createClient();

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(weekStart.getDate() - 7);

      const weekStartISO = weekStart.toISOString();
      const prevWeekStartISO = prevWeekStart.toISOString();
      const nowISO = now.toISOString();

      // Get topics for this group
      const { data: topics } = await supabase
        .from("wiki_topics")
        .select("id, name")
        .eq("group_id", groupId);

      const topicIds = (topics || []).map(t => t.id);
      if (topicIds.length === 0) {
        toast.info("분석할 탭 데이터가 아직 없습니다. 먼저 주제와 문서를 추가하세요.");
        setGenerating(false);
        return;
      }

      // Get pages
      const { data: allPages } = await supabase
        .from("wiki_pages")
        .select("id, title, topic_id, created_at, updated_at")
        .in("topic_id", topicIds);

      const pageIds = (allPages || []).map(p => p.id);
      if (pageIds.length === 0) {
        toast.info("분석할 탭 페이지가 아직 없습니다.");
        setGenerating(false);
        return;
      }

      // ── Parallelized queries for performance ──
      const [contribsResult, prevContribsResult, viewsResult, prevViewsResult] = await Promise.all([
        supabase
          .from("wiki_contributions")
          .select("id, user_id, page_id, created_at")
          .in("page_id", pageIds)
          .gte("created_at", weekStartISO),
        supabase
          .from("wiki_contributions")
          .select("id, user_id")
          .in("page_id", pageIds)
          .gte("created_at", prevWeekStartISO)
          .lt("created_at", weekStartISO),
        supabase
          .from("wiki_page_views")
          .select("id, page_id, user_id, viewed_at")
          .in("page_id", pageIds)
          .gte("viewed_at", weekStartISO),
        supabase
          .from("wiki_page_views")
          .select("id")
          .in("page_id", pageIds)
          .gte("viewed_at", prevWeekStartISO)
          .lt("viewed_at", weekStartISO),
      ]);

      const thisWeekContribs = contribsResult.data || [];
      const prevWeekContribs = prevContribsResult.data || [];
      const thisWeekViews = viewsResult.data || [];
      const prevWeekViews = prevViewsResult.data || [];

      // --- Compute metrics ---
      const totalEdits = thisWeekContribs.length;
      const prevEdits = prevWeekContribs.length;
      const editsDelta = prevEdits > 0 ? Math.round(((totalEdits - prevEdits) / prevEdits) * 100) : (totalEdits > 0 ? 100 : 0);

      const totalViews = thisWeekViews.length;
      const prevViews = prevWeekViews.length;
      const viewsDelta = prevViews > 0 ? Math.round(((totalViews - prevViews) / prevViews) * 100) : (totalViews > 0 ? 100 : 0);

      const activeContributors = new Set(thisWeekContribs.map(c => c.user_id)).size;
      const prevActiveContributors = new Set(prevWeekContribs.map(c => c.user_id)).size;
      const contributorsDelta = prevActiveContributors > 0 ? Math.round(((activeContributors - prevActiveContributors) / prevActiveContributors) * 100) : (activeContributors > 0 ? 100 : 0);

      // Top pages (by edits this week)
      const pageEditCounts: Record<string, number> = {};
      const pageViewCounts: Record<string, number> = {};
      thisWeekContribs.forEach(c => { pageEditCounts[c.page_id] = (pageEditCounts[c.page_id] || 0) + 1; });
      thisWeekViews.forEach(v => { pageViewCounts[v.page_id] = (pageViewCounts[v.page_id] || 0) + 1; });

      const topPages = (allPages || [])
        .map(p => ({
          pageId: p.id,
          title: p.title,
          edits: pageEditCounts[p.id] || 0,
          views: pageViewCounts[p.id] || 0,
          score: (pageEditCounts[p.id] || 0) * 3 + (pageViewCounts[p.id] || 0),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // Top contributors
      const contribByUser: Record<string, number> = {};
      thisWeekContribs.forEach(c => { contribByUser[c.user_id] = (contribByUser[c.user_id] || 0) + 1; });

      const topUserIds = Object.entries(contribByUser).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", topUserIds.map(u => u[0]));

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p.nickname; });

      const topContributors = topUserIds.map(([uid, count]) => ({
        userId: uid,
        nickname: profileMap[uid] || "Unknown",
        contributions: count,
      }));

      // Hot topics (topics with most activity)
      const topicActivity: Record<string, number> = {};
      (thisWeekContribs).forEach(c => {
        const page = (allPages || []).find(p => p.id === c.page_id);
        if (page) {
          const topicName = (topics || []).find(t => t.id === page.topic_id)?.name;
          if (topicName) topicActivity[topicName] = (topicActivity[topicName] || 0) + 1;
        }
      });
      const hotTopics = Object.entries(topicActivity).sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 5);

      // Emerging concepts: pages created this week
      const newPages = (allPages || []).filter(p => new Date(p.created_at) >= weekStart);
      const emergingConcepts = newPages.map(p => p.title).slice(0, 5);

      // Daily activity breakdown
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      const dailyEdits: Record<string, number> = {};
      const dailyViews: Record<string, number> = {};
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + d);
        const key = dayNames[day.getDay()];
        dailyEdits[key] = 0;
        dailyViews[key] = 0;
      }
      thisWeekContribs.forEach(c => {
        const key = dayNames[new Date(c.created_at).getDay()];
        dailyEdits[key] = (dailyEdits[key] || 0) + 1;
      });
      thisWeekViews.forEach(v => {
        const key = dayNames[new Date(v.viewed_at).getDay()];
        dailyViews[key] = (dailyViews[key] || 0) + 1;
      });
      const dailyActivity = ["월", "화", "수", "목", "금", "토", "일"].map(day => ({
        day,
        edits: dailyEdits[day] || 0,
        views: dailyViews[day] || 0,
      }));

      // Generate insights text
      const insights = [
        `## 이번 주 핵심 인사이트`,
        ``,
        hotTopics.length > 0 ? `### 🔥 Hot Topic: ${hotTopics[0]}` : `### 🔥 아직 활동 데이터가 충분하지 않습니다`,
        hotTopics.length > 0 ? `이번 주 가장 활발한 논의가 이루어진 주제입니다. ${topicActivity[hotTopics[0]] || 0}개의 편집이 이루어졌습니다.` : `주제와 문서를 추가하여 지식 베이스를 성장시켜 보세요.`,
        ``,
        emergingConcepts.length > 0 ? `### 💡 새로운 문서 등장` : `### 💡 이번 주 새로 생성된 문서가 없습니다`,
        ...emergingConcepts.map(c => `- **${c}**`),
        ``,
        `### 📊 지식 성장 지표`,
        `이번 주 총 **${totalEdits}개** 편집, **${totalViews}개** 조회가 발생했습니다.`,
        activeContributors > 0 ? `**${activeContributors}명**의 구성원이 활발히 기여하고 있습니다.` : `아직 이번 주 기여한 구성원이 없습니다.`,
      ].join("\n");

      setDigest({
        weekStart: weekStart.toISOString().slice(0, 10),
        weekEnd: now.toISOString().slice(0, 10),
        topPages,
        topContributors,
        keyInsights: insights,
        trendAnalysis: {
          totalEdits,
          editsDelta,
          totalViews,
          viewsDelta,
          activeContributors,
          contributorsDelta,
          hotTopics,
          emergingConcepts,
        },
        dailyActivity,
      });

      toast.success("실 데이터 기반 주간 인사이트가 생성되었습니다!");
      setPublished(false); // Reset publish state for new digest
    } catch (err: any) {
      toast.error(err.message || "생성 중 오류가 발생했습니다");
    } finally {
      setGenerating(false);
    }
  };

  // Publish to wiki_newsletters table
  const handlePublish = async () => {
    if (!digest) return;
    setPublishing(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("wiki_newsletters").insert({
        group_id: groupId,
        week_start: digest.weekStart,
        week_end: digest.weekEnd,
        top_pages: digest.topPages,
        top_contributors: digest.topContributors,
        key_insights: digest.keyInsights,
        status: "published",
      });
      if (error) throw error;
      setPublished(true);
      toast.success("뉴스레터가 발행되었습니다!");
    } catch (err: any) {
      toast.error(err.message || "발행에 실패했습니다");
    } finally {
      setPublishing(false);
    }
  };

  const DeltaIndicator = ({ value }: { value: number }) => (
    <span className={`inline-flex items-center gap-0.5 font-mono-nu text-[12px] font-bold ${value >= 0 ? "text-green-500" : "text-red-400"}`}>
      {value >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {value >= 0 ? "+" : ""}{value}%
    </span>
  );

  if (!digest) {
    return (
      <div className="bg-gradient-to-br from-nu-cream/50 to-white border-[2px] border-nu-ink p-10 text-center">
        <div className="relative inline-block mb-6">
          <BarChart3 size={48} className="text-nu-ink/10" />
          <Sparkles size={20} className="text-nu-pink absolute -top-1 -right-1 animate-pulse" />
        </div>
        <h3 className="font-head text-2xl font-extrabold text-nu-ink mb-3">주간 인사이트 다이제스트</h3>
        <p className="text-sm text-nu-muted max-w-md mx-auto mb-2 leading-relaxed">
          실 DB 데이터를 분석하여 핫 토픽, 성장 지표, 그리고 다음 주 주목할 주제를 정리합니다.
        </p>
        <p className="font-mono-nu text-[11px] text-nu-pink uppercase tracking-widest mb-8">
          Real Data Analysis · No Mock
        </p>
        {isHost ? (
          <button
            onClick={generateDigest}
            disabled={generating}
            className="bg-nu-ink text-white px-10 py-4 font-mono-nu text-xs font-bold uppercase tracking-widest hover:bg-nu-pink transition-all shadow-[4px_4px_0px_rgba(233,30,99,0.3)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] flex items-center gap-3 mx-auto disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
            이번 주 다이제스트 생성
          </button>
        ) : (
          <p className="font-mono-nu text-[12px] text-nu-muted uppercase tracking-widest">
            호스트만 다이제스트를 생성할 수 있습니다
          </p>
        )}
      </div>
    );
  }

  const maxDailyVal = Math.max(...digest.dailyActivity.map(d => Math.max(d.edits, d.views)), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-nu-ink text-white p-6 border-[2px] border-nu-ink">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-mono-nu text-[11px] uppercase tracking-widest text-white/40 mb-1">Weekly Insight Digest · Real Data</p>
            <h3 className="font-head text-xl font-extrabold">
              {digest.weekStart} → {digest.weekEnd}
            </h3>
          </div>
          {isHost && (
            <button
              onClick={generateDigest}
              disabled={generating}
              className="p-2 bg-white/10 border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50"
              title="다이제스트 재생성"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </button>
          )}
          {isHost && (!published ? (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="px-4 py-2 bg-nu-pink border border-nu-pink/50 font-mono-nu text-[11px] font-bold uppercase tracking-widest hover:bg-nu-pink/80 transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {publishing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Publish
            </button>
          ) : (
            <span className="px-4 py-2 bg-green-500/20 border border-green-400/30 font-mono-nu text-[11px] font-bold uppercase tracking-widest text-green-300 flex items-center gap-1.5">
              ✓ Published
            </span>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 p-4">
            <p className="font-mono-nu text-[10px] text-white/40 uppercase tracking-widest mb-1">Total Edits</p>
            <div className="flex items-end gap-2">
              <span className="font-head text-2xl font-extrabold">{digest.trendAnalysis.totalEdits}</span>
              <DeltaIndicator value={digest.trendAnalysis.editsDelta} />
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 p-4">
            <p className="font-mono-nu text-[10px] text-white/40 uppercase tracking-widest mb-1">Total Views</p>
            <div className="flex items-end gap-2">
              <span className="font-head text-2xl font-extrabold">{digest.trendAnalysis.totalViews}</span>
              <DeltaIndicator value={digest.trendAnalysis.viewsDelta} />
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 p-4">
            <p className="font-mono-nu text-[10px] text-white/40 uppercase tracking-widest mb-1">Contributors</p>
            <div className="flex items-end gap-2">
              <span className="font-head text-2xl font-extrabold">{digest.trendAnalysis.activeContributors}</span>
              <DeltaIndicator value={digest.trendAnalysis.contributorsDelta} />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b-[2px] border-nu-ink/10">
        {(["overview", "trends", "insights"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-mono-nu text-[12px] font-bold uppercase tracking-widest transition-all border-b-[2px] -mb-[2px] ${
              activeTab === tab
                ? "border-nu-pink text-nu-pink"
                : "border-transparent text-nu-muted hover:text-nu-ink"
            }`}
          >
            {tab === "overview" ? "📊 Overview" : tab === "trends" ? "📈 Trends" : "💡 Insights"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border-[2px] border-nu-ink/[0.08] p-6">
            <h4 className="font-mono-nu text-[12px] font-bold text-nu-ink uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <BookOpen size={14} className="text-nu-blue" /> Top Pages This Week
            </h4>
            <div className="space-y-3">
              {digest.topPages.length > 0 ? digest.topPages.map((p, i) => (
                <div key={p.pageId} className="flex items-center gap-3 group">
                  <span className="font-head text-lg font-extrabold text-nu-ink/20 w-6">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-head text-sm font-bold text-nu-ink truncate group-hover:text-nu-pink transition-colors">{p.title}</p>
                    <p className="font-mono-nu text-[11px] text-nu-muted">
                      {p.views} views · {p.edits} edits
                    </p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-nu-muted italic">이번 주 활동이 없습니다.</p>
              )}
            </div>
          </div>

          <div className="bg-white border-[2px] border-nu-ink/[0.08] p-6">
            <h4 className="font-mono-nu text-[12px] font-bold text-nu-ink uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Target size={14} className="text-nu-pink" /> Top Contributors
            </h4>
            <div className="space-y-3">
              {digest.topContributors.length > 0 ? digest.topContributors.map((c, i) => (
                <div key={c.userId} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-head text-sm font-bold border-2 ${
                    i === 0 ? "bg-yellow-50 border-yellow-400 text-yellow-600" :
                    i === 1 ? "bg-gray-50 border-gray-400 text-gray-600" :
                    "bg-amber-50 border-amber-400 text-amber-600"
                  }`}>
                    {c.nickname.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-head text-sm font-bold text-nu-ink">{c.nickname}</p>
                    <p className="font-mono-nu text-[11px] text-nu-muted">{c.contributions} contributions</p>
                  </div>
                  <div className="w-16">
                    <div className="h-1.5 bg-nu-ink/5 rounded-full overflow-hidden">
                      <div className="h-full bg-nu-pink rounded-full" style={{ width: `${digest.topContributors[0] ? (c.contributions / digest.topContributors[0].contributions) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-nu-muted italic">이번 주 기여자가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "trends" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-nu-pink text-white p-6 border-[2px] border-nu-ink">
            <h4 className="font-mono-nu text-[12px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              🔥 Hot Topics
            </h4>
            <div className="space-y-3">
              {digest.trendAnalysis.hotTopics.length > 0 ? digest.trendAnalysis.hotTopics.map((topic, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/10 p-3 border border-white/20">
                  <span className="font-head text-lg font-extrabold text-white/30">{i + 1}</span>
                  <span className="font-head text-sm font-bold">{topic}</span>
                </div>
              )) : (
                <p className="text-white/50 text-xs italic">활동 데이터를 더 쌓아주세요.</p>
              )}
            </div>
          </div>

          <div className="bg-white border-[2px] border-nu-ink p-6">
            <h4 className="font-mono-nu text-[12px] font-bold text-nu-ink uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Lightbulb size={14} className="text-nu-amber" /> 이번 주 신규 문서
            </h4>
            <div className="space-y-3">
              {digest.trendAnalysis.emergingConcepts.length > 0 ? digest.trendAnalysis.emergingConcepts.map((concept, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border border-nu-ink/10 hover:border-nu-pink/40 transition-all group">
                  <div className="w-8 h-8 bg-nu-amber/10 flex items-center justify-center shrink-0">
                    <Sparkles size={14} className="text-nu-amber" />
                  </div>
                  <div>
                    <p className="font-head text-sm font-bold text-nu-ink group-hover:text-nu-pink transition-colors">{concept}</p>
                    <p className="font-mono-nu text-[10px] text-nu-muted uppercase">NEW THIS WEEK</p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-nu-muted italic">이번 주 새로 생성된 문서가 없습니다.</p>
              )}
            </div>
          </div>

          {/* Real Activity Chart */}
          <div className="md:col-span-2 bg-white border-[2px] border-nu-ink/[0.08] p-6">
            <h4 className="font-mono-nu text-[12px] font-bold text-nu-ink uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Calendar size={14} /> Weekly Activity Distribution
            </h4>
            <div className="flex items-end gap-2 h-32">
              {digest.dailyActivity.map(({ day, edits, views }) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5 items-end" style={{ height: 100 }}>
                    <div className="flex-1 bg-nu-blue/20 rounded-t-sm transition-all hover:bg-nu-blue/40" style={{ height: `${maxDailyVal > 0 ? (views / maxDailyVal) * 100 : 0}%` }} />
                    <div className="flex-1 bg-nu-pink/30 rounded-t-sm transition-all hover:bg-nu-pink/50" style={{ height: `${maxDailyVal > 0 ? (edits / maxDailyVal) * 100 : 0}%` }} />
                  </div>
                  <span className="font-mono-nu text-[11px] text-nu-muted">{day}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 justify-end">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-nu-blue/20 rounded-sm" />
                <span className="font-mono-nu text-[10px] text-nu-muted">Views</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-nu-pink/30 rounded-sm" />
                <span className="font-mono-nu text-[10px] text-nu-muted">Edits</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "insights" && (
        <div className="bg-white border-[2px] border-nu-ink/[0.08] p-8">
          <div className="prose prose-sm max-w-none prose-headings:font-head prose-headings:text-nu-ink prose-headings:tracking-tight prose-h2:text-lg prose-h2:font-extrabold prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-base prose-h3:font-bold prose-h3:mt-4 prose-p:text-nu-graphite prose-p:leading-relaxed prose-li:text-nu-graphite prose-strong:text-nu-ink">
            {digest.keyInsights.split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h2 key={i}>{line.slice(3)}</h2>;
              if (line.startsWith("### ")) return <h3 key={i}>{line.slice(4)}</h3>;
              if (line.startsWith("- **")) {
                const match = line.match(/- \*\*(.+?)\*\*/);
                if (match) return <li key={i}><strong>{match[1]}</strong></li>;
              }
              if (line.startsWith("- ")) return <li key={i}>{line.slice(2)}</li>;
              if (line.trim() === "") return <br key={i} />;
              return <p key={i}>{line}</p>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
