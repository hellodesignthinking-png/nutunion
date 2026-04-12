"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Brain, Loader2, TrendingUp, TrendingDown,
  ArrowRight, Sparkles, GitBranch, History,
  Lightbulb, AlertTriangle, CheckCircle2
} from "lucide-react";

interface EvolutionAnalysis {
  periodLabel: string;
  topicEvolutions: {
    topic: string;
    shift: string;
    direction: "growth" | "shift" | "decline" | "stable";
    confidence: number;
  }[];
  conceptMap: {
    concept: string;
    firstMention: string;
    currentStatus: "active" | "dormant" | "evolved";
    evolutionPath: string;
  }[];
  recommendations: {
    type: "expand" | "consolidate" | "archive" | "connect";
    title: string;
    description: string;
  }[];
  overallHealth: {
    score: number;
    breadth: number;
    depth: number;
    connectivity: number;
    freshness: number;
  };
}

export function MonthlyEvolutionAnalysis({ groupId }: { groupId: string }) {
  const [analysis, setAnalysis] = useState<EvolutionAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      // Get topics
      const { data: topics } = await supabase
        .from("wiki_topics")
        .select("id, name")
        .eq("group_id", groupId);

      const topicIds = (topics || []).map(t => t.id);
      if (topicIds.length === 0) {
        toast.info("분석할 위키 데이터가 아직 없습니다.");
        setLoading(false);
        return;
      }

      // Get pages
      const { data: allPages } = await supabase
        .from("wiki_pages")
        .select("id, title, topic_id, created_at, updated_at, version")
        .in("topic_id", topicIds);

      const pageIds = (allPages || []).map(p => p.id);

      // Get contributions this month vs last month
      let thisMonthContribs: any[] = [];
      let prevMonthContribs: any[] = [];
      if (pageIds.length > 0) {
        const { data: tc } = await supabase
          .from("wiki_contributions")
          .select("user_id, page_id, created_at")
          .in("page_id", pageIds)
          .gte("created_at", monthStart.toISOString());
        thisMonthContribs = tc || [];

        const { data: pc } = await supabase
          .from("wiki_contributions")
          .select("user_id, page_id, created_at")
          .in("page_id", pageIds)
          .gte("created_at", prevMonthStart.toISOString())
          .lt("created_at", monthStart.toISOString());
        prevMonthContribs = pc || [];
      }

      // Get links
      const { data: links } = await supabase
        .from("wiki_page_links")
        .select("source_page_id, target_page_id")
        .in("source_page_id", pageIds.length > 0 ? pageIds : ["00000000-0000-0000-0000-000000000000"]);

      // --- Topic Evolutions ---
      const topicContribsThisMonth: Record<string, number> = {};
      const topicContribsPrevMonth: Record<string, number> = {};

      thisMonthContribs.forEach(c => {
        const page = (allPages || []).find(p => p.id === c.page_id);
        if (page) {
          const topicName = (topics || []).find(t => t.id === page.topic_id)?.name || "";
          topicContribsThisMonth[topicName] = (topicContribsThisMonth[topicName] || 0) + 1;
        }
      });

      prevMonthContribs.forEach(c => {
        const page = (allPages || []).find(p => p.id === c.page_id);
        if (page) {
          const topicName = (topics || []).find(t => t.id === page.topic_id)?.name || "";
          topicContribsPrevMonth[topicName] = (topicContribsPrevMonth[topicName] || 0) + 1;
        }
      });

      const topicEvolutions = (topics || []).map(t => {
        const thisMonth = topicContribsThisMonth[t.name] || 0;
        const prevMonth = topicContribsPrevMonth[t.name] || 0;
        const pagesInTopic = (allPages || []).filter(p => p.topic_id === t.id);

        let direction: "growth" | "shift" | "decline" | "stable" = "stable";
        let confidence = 50;
        if (thisMonth > prevMonth * 1.3) { direction = "growth"; confidence = Math.min(95, 60 + thisMonth * 5); }
        else if (thisMonth < prevMonth * 0.5 && prevMonth > 0) { direction = "decline"; confidence = 70; }
        else if (thisMonth > 0 && prevMonth > 0) { direction = "stable"; confidence = 60; }
        else if (thisMonth > 0 && prevMonth === 0) { direction = "growth"; confidence = 75; }

        const shift = direction === "growth"
          ? `이번 달 ${thisMonth}건의 편집이 이루어지며 활발히 성장 중. (${pagesInTopic.length}개 문서 보유)`
          : direction === "decline"
          ? `지난 달(${prevMonth}건) 대비 활동이 감소(${thisMonth}건). 관심 재환기가 필요합니다.`
          : direction === "stable"
          ? `안정적인 활동(${thisMonth}건). 기존 내용의 품질 향상에 집중하세요.`
          : `이번 달 새롭게 활동이 시작되었습니다. (${thisMonth}건 편집)`;

        return { topic: t.name, shift, direction, confidence };
      }).sort((a, b) => {
        const order = { growth: 0, shift: 1, stable: 2, decline: 3 };
        return order[a.direction] - order[b.direction];
      });

      // --- Concept Map ---
      const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
      const conceptMap = (allPages || []).map(p => {
        const recentEdits = thisMonthContribs.filter(c => c.page_id === p.id).length;
        const currentStatus: "active" | "dormant" | "evolved" =
          recentEdits > 3 ? "active" :
          recentEdits > 0 ? "evolved" : "dormant";

        const topicName = (topics || []).find(t => t.id === p.topic_id)?.name || "";

        return {
          concept: p.title,
          firstMention: p.created_at,
          currentStatus,
          evolutionPath: `${topicName} 주제 소속 · v${p.version} · 이번 달 ${recentEdits}건 편집`,
        };
      }).slice(0, 8);

      // --- Health Scores ---
      const totalPages = (allPages || []).length;
      const totalTopics = (topics || []).length;
      const totalLinks = (links || []).length;
      const recentlyEdited = (allPages || []).filter(p => new Date(p.updated_at) > thirtyDaysAgo).length;
      const avgPagesPerTopic = totalTopics > 0 ? totalPages / totalTopics : 0;

      const breadth = Math.min(100, totalTopics * 20); // Up to 5 topics = 100
      const depth = Math.min(100, avgPagesPerTopic * 15); // Up to ~7 pages/topic = 100
      const connectivity = Math.min(100, totalLinks * 10); // Up to 10 links = 100
      const freshness = totalPages > 0 ? Math.round((recentlyEdited / totalPages) * 100) : 0;
      const score = Math.round((breadth + depth + connectivity + freshness) / 4);

      // --- Recommendations ---
      const recommendations: EvolutionAnalysis["recommendations"] = [];
      const growthTopics = topicEvolutions.filter(t => t.direction === "growth");
      const declineTopics = topicEvolutions.filter(t => t.direction === "decline");
      const dormantPages = conceptMap.filter(c => c.currentStatus === "dormant");

      if (growthTopics.length > 0) {
        recommendations.push({
          type: "expand",
          title: `${growthTopics[0].topic} 심화 문서 작성`,
          description: `빠르게 성장하는 주제입니다. 하위 문서 구조를 설계하여 지식을 체계화하세요.`,
        });
      }
      if (totalLinks < totalPages * 0.5) {
        recommendations.push({
          type: "connect",
          title: `문서 간 교차 참조 강화 필요`,
          description: `현재 ${totalLinks}개의 링크가 있습니다. 문서 간 연결을 추가하여 지식 그래프를 풍부하게 만드세요.`,
        });
      }
      if (dormantPages.length > 0) {
        recommendations.push({
          type: "archive",
          title: `${dormantPages.length}개 휴면 문서 정리 필요`,
          description: `최근 1달간 편집이 없는 문서가 있습니다. 아카이브 처리하거나 업데이트를 진행하세요.`,
        });
      }
      if (declineTopics.length > 0) {
        recommendations.push({
          type: "consolidate",
          title: `${declineTopics[0].topic} 관심 재환기`,
          description: `활동이 감소 중인 주제입니다. 다음 미팅에서 재논의하거나 다른 주제와 통합을 검토하세요.`,
        });
      }
      if (recommendations.length === 0) {
        recommendations.push({
          type: "expand",
          title: "지식 베이스 확장을 시작하세요",
          description: "위키에 더 많은 주제와 문서를 추가하여 팀의 지식 자산을 성장시키세요.",
        });
      }

      setAnalysis({
        periodLabel: `${now.getFullYear()}년 ${now.getMonth() + 1}월`,
        topicEvolutions,
        conceptMap,
        recommendations,
        overallHealth: { score, breadth, depth, connectivity, freshness },
      });

      toast.success("실 데이터 기반 월간 지식 진화 분석이 완료되었습니다!");
    } catch (err: any) {
      toast.error(err.message || "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const directionConfig = {
    growth: { icon: <TrendingUp size={14} />, color: "text-green-500", bg: "bg-green-500/10", label: "성장" },
    shift: { icon: <ArrowRight size={14} />, color: "text-nu-blue", bg: "bg-nu-blue/10", label: "전환" },
    decline: { icon: <TrendingDown size={14} />, color: "text-red-400", bg: "bg-red-400/10", label: "감소" },
    stable: { icon: <CheckCircle2 size={14} />, color: "text-gray-400", bg: "bg-gray-400/10", label: "안정" },
  };

  const statusConfig = {
    active: { color: "bg-green-400", label: "활성" },
    dormant: { color: "bg-gray-300", label: "휴면" },
    evolved: { color: "bg-nu-blue", label: "진화" },
  };

  const recTypeConfig = {
    expand: { icon: <TrendingUp size={14} />, color: "text-green-500", border: "border-green-500/20" },
    connect: { icon: <GitBranch size={14} />, color: "text-nu-blue", border: "border-nu-blue/20" },
    archive: { icon: <History size={14} />, color: "text-gray-400", border: "border-gray-400/20" },
    consolidate: { icon: <Lightbulb size={14} />, color: "text-nu-amber", border: "border-nu-amber/20" },
  };

  if (!analysis) {
    return (
      <div className="bg-gradient-to-br from-nu-ink via-[#1a1a2e] to-nu-ink text-white p-10 text-center border-[2px] border-nu-ink">
        <div className="relative inline-block mb-6">
          <Brain size={56} className="text-white/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles size={24} className="text-nu-pink animate-pulse" />
          </div>
        </div>
        <h3 className="font-head text-2xl font-extrabold mb-3">월간 지식 진화 분석</h3>
        <p className="text-sm text-white/50 max-w-lg mx-auto mb-3 leading-relaxed">
          지난 한 달간 축적된 모든 회의록과 위키 데이터를 교차 분석하여,
          각 주제의 관점 변화와 지식 성장 패턴을 시각화합니다.
        </p>
        <p className="font-mono-nu text-[9px] text-white/25 uppercase tracking-widest mb-8">
          최소 1개 이상의 토픽과 문서가 필요합니다
        </p>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="bg-nu-pink text-white px-10 py-4 font-mono-nu text-xs font-bold uppercase tracking-widest hover:bg-nu-pink/80 transition-all shadow-[0_0_30px_rgba(233,30,99,0.3)] hover:shadow-[0_0_50px_rgba(233,30,99,0.5)] flex items-center gap-3 mx-auto disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
          교차 분석 실행
        </button>
        {loading && (
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-center gap-3 text-xs text-white/40 font-mono-nu">
              <div className="w-2 h-2 rounded-full bg-nu-pink animate-ping" />
              전체 회의록 스캔 중...
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Health Score */}
      <div className="bg-white border-[2px] border-nu-ink p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-3">
            <Brain size={22} className="text-nu-pink" /> 지식 건강도 — {analysis.periodLabel}
          </h3>
          <div className="flex items-center gap-2">
            <span className="font-head text-4xl font-extrabold text-nu-ink">{analysis.overallHealth.score}</span>
            <span className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">/100</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            { label: "Breadth", value: analysis.overallHealth.breadth, desc: "주제 다양성" },
            { label: "Depth", value: analysis.overallHealth.depth, desc: "깊이" },
            { label: "Connectivity", value: analysis.overallHealth.connectivity, desc: "연결성" },
            { label: "Freshness", value: analysis.overallHealth.freshness, desc: "최신성" },
          ]).map(metric => (
            <div key={metric.label} className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" stroke="#f0f0f0" strokeWidth="6" fill="none" />
                  <circle
                    cx="32" cy="32" r="28"
                    stroke="#e91e63"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${(metric.value / 100) * 175.9} 175.9`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-head text-sm font-bold text-nu-ink">
                  {metric.value}
                </span>
              </div>
              <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">{metric.label}</p>
              <p className="text-[10px] text-nu-muted">{metric.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Topic Evolutions */}
      <div className="bg-white border-[2px] border-nu-ink/[0.08] p-6">
        <h4 className="font-head text-lg font-extrabold text-nu-ink mb-6 flex items-center gap-2">
          <TrendingUp size={18} className="text-nu-blue" /> 주제별 관점 변화
        </h4>
        <div className="space-y-4">
          {analysis.topicEvolutions.map((te, i) => {
            const cfg = directionConfig[te.direction];
            return (
              <div key={i} className="border-[2px] border-nu-ink/[0.08] hover:border-nu-pink/30 transition-all p-5 group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`p-1.5 ${cfg.bg} ${cfg.color}`}>{cfg.icon}</span>
                    <h5 className="font-head text-base font-bold text-nu-ink group-hover:text-nu-pink transition-colors">{te.topic}</h5>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono-nu text-[9px] font-bold uppercase tracking-widest ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <div className="w-16 h-1.5 bg-nu-ink/5 rounded-full overflow-hidden">
                      <div className="h-full bg-nu-pink rounded-full" style={{ width: `${te.confidence}%` }} />
                    </div>
                    <span className="font-mono-nu text-[8px] text-nu-muted">{te.confidence}%</span>
                  </div>
                </div>
                <p className="text-sm text-nu-graphite leading-relaxed">{te.shift}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Concept Timeline */}
      <div className="bg-nu-ink text-white p-8 border-[2px] border-nu-ink">
        <h4 className="font-head text-lg font-extrabold mb-6 flex items-center gap-2">
          <History size={18} className="text-nu-pink" /> 개념 생애 주기 (Concept Lifecycle)
        </h4>
        <div className="space-y-4">
          {analysis.conceptMap.map((c, i) => {
            const st = statusConfig[c.currentStatus];
            return (
              <div key={i} className="flex items-start gap-4 py-4 border-b border-white/10 last:border-0">
                <div className={`w-3 h-3 rounded-full ${st.color} shrink-0 mt-1.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-head text-sm font-bold">{c.concept}</span>
                    <span className="font-mono-nu text-[8px] px-1.5 py-0.5 bg-white/10 uppercase tracking-widest">
                      {st.label}
                    </span>
                  </div>
                  <p className="font-mono-nu text-[9px] text-white/40 mb-1">
                    첫 등장: {new Date(c.firstMention).toLocaleDateString("ko")}
                  </p>
                  <p className="text-xs text-white/60 leading-relaxed">
                    {c.evolutionPath}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="bg-white border-[2px] border-nu-ink p-6">
        <h4 className="font-head text-lg font-extrabold text-nu-ink mb-6 flex items-center gap-2">
          <AlertTriangle size={18} className="text-nu-amber" /> AI 액션 권고
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysis.recommendations.map((r, i) => {
            const rc = recTypeConfig[r.type];
            return (
              <div key={i} className={`border-[2px] ${rc.border} p-5 hover:shadow-md transition-all group`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={rc.color}>{rc.icon}</span>
                  <span className={`font-mono-nu text-[9px] font-bold uppercase tracking-widest ${rc.color}`}>
                    {r.type}
                  </span>
                </div>
                <h5 className="font-head text-sm font-bold text-nu-ink mb-2 group-hover:text-nu-pink transition-colors">
                  {r.title}
                </h5>
                <p className="text-xs text-nu-muted leading-relaxed">{r.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
