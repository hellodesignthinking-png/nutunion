"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  TrendingUp, BookOpen, Brain, Sparkles,
  Calendar, FileText, Users, ChevronRight,
} from "lucide-react";

interface GrowthStats {
  totalMeetings: number;
  completedMeetings: number;
  totalWikiPages: number;
  totalDigests: number;
  latestDigest: string | null;
  latestDigestDate: string | null;
  recentMeetingTitle: string | null;
  recentMeetingDate: string | null;
}

export function GroupGrowthWidget({ groupId }: { groupId: string }) {
  const [stats, setStats] = useState<GrowthStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [meetingsRes, completedRes, wikiRes, digestRes, latestDigestRes, recentMeetingRes] = await Promise.allSettled([
        supabase.from("meetings").select("id", { count: "exact", head: true }).eq("group_id", groupId),
        supabase.from("meetings").select("id", { count: "exact", head: true }).eq("group_id", groupId).eq("status", "completed"),
        supabase.from("wiki_topics").select("id").eq("group_id", groupId),
        supabase.from("wiki_ai_analyses").select("id", { count: "exact", head: true }).eq("group_id", groupId).eq("analysis_type", "weekly_digest"),
        supabase.from("wiki_ai_analyses").select("content, created_at").eq("group_id", groupId).eq("analysis_type", "weekly_digest").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("meetings").select("title, scheduled_at").eq("group_id", groupId).eq("status", "completed").order("scheduled_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      // Count wiki pages across all topics
      let totalWikiPages = 0;
      if (wikiRes.status === "fulfilled" && wikiRes.value.data) {
        const topicIds = wikiRes.value.data.map(t => t.id);
        if (topicIds.length > 0) {
          const { count } = await supabase.from("wiki_pages").select("id", { count: "exact", head: true }).in("topic_id", topicIds);
          totalWikiPages = count || 0;
        }
      }

      let latestDigestText: string | null = null;
      let latestDigestDate: string | null = null;
      if (latestDigestRes.status === "fulfilled" && latestDigestRes.value.data) {
        try {
          const parsed = JSON.parse(latestDigestRes.value.data.content);
          latestDigestText = parsed.digest || parsed.nextMeetingContext || null;
          latestDigestDate = latestDigestRes.value.data.created_at;
        } catch { /* ignore */ }
      }

      setStats({
        totalMeetings: meetingsRes.status === "fulfilled" ? (meetingsRes.value.count || 0) : 0,
        completedMeetings: completedRes.status === "fulfilled" ? (completedRes.value.count || 0) : 0,
        totalWikiPages,
        totalDigests: digestRes.status === "fulfilled" ? (digestRes.value.count || 0) : 0,
        latestDigest: latestDigestText,
        latestDigestDate,
        recentMeetingTitle: recentMeetingRes.status === "fulfilled" ? recentMeetingRes.value.data?.title || null : null,
        recentMeetingDate: recentMeetingRes.status === "fulfilled" ? recentMeetingRes.value.data?.scheduled_at || null : null,
      });
      setLoading(false);
    }
    load();
  }, [groupId]);

  if (loading) return <div className="h-48 bg-nu-cream/30 animate-pulse" />;
  if (!stats) return null;

  const hasActivity = stats.totalMeetings > 0 || stats.totalWikiPages > 0;

  return (
    <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-nu-ink to-nu-ink/90 text-nu-paper px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={14} className="text-nu-pink" />
          <span className="font-mono-nu text-[12px] font-bold uppercase tracking-[0.2em] text-nu-pink">
            Growth_Dashboard
          </span>
        </div>
        <p className="text-[13px] text-nu-paper/60">
          AI가 추적하는 너트 성장 현황
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 border-b border-nu-ink/[0.08]">
        {[
          { icon: Calendar, value: stats.totalMeetings, label: "미팅", color: "text-nu-blue" },
          { icon: BookOpen, value: stats.completedMeetings, label: "완료", color: "text-nu-pink" },
          { icon: FileText, value: stats.totalWikiPages, label: "탭", color: "text-nu-amber" },
          { icon: Brain, value: stats.totalDigests, label: "다이제스트", color: "text-purple-600" },
        ].map((s, i) => (
          <div key={i} className={`text-center py-4 ${i < 3 ? "border-r border-nu-ink/[0.06]" : ""}`}>
            <s.icon size={14} className={`mx-auto ${s.color} mb-1`} />
            <div className="font-head text-xl font-extrabold text-nu-ink">{s.value}</div>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Latest digest preview */}
      {stats.latestDigest && (
        <div className="px-5 py-4 border-b border-nu-ink/[0.06]">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="text-purple-500" />
            <span className="font-mono-nu text-[11px] uppercase tracking-widest text-purple-600 font-bold">
              최근 다이제스트
            </span>
            {stats.latestDigestDate && (
              <span className="font-mono-nu text-[10px] text-nu-muted ml-auto">
                {new Date(stats.latestDigestDate).toLocaleDateString("ko", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
          <p className="text-[13px] text-nu-gray leading-relaxed line-clamp-3">
            {stats.latestDigest}
          </p>
        </div>
      )}

      {/* Recent meeting */}
      {stats.recentMeetingTitle && (
        <div className="px-5 py-3 border-b border-nu-ink/[0.06]">
          <div className="flex items-center gap-1.5">
            <BookOpen size={10} className="text-nu-blue shrink-0" />
            <span className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">최근 완료:</span>
            <span className="text-[13px] text-nu-ink font-medium truncate">{stats.recentMeetingTitle}</span>
            {stats.recentMeetingDate && (
              <span className="font-mono-nu text-[10px] text-nu-muted ml-auto shrink-0">
                {new Date(stats.recentMeetingDate).toLocaleDateString("ko", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      {hasActivity ? (
        <Link
          href={`/groups/${groupId}/wiki`}
          className="flex items-center justify-between px-5 py-3 text-[13px] font-mono-nu uppercase tracking-widest text-nu-pink no-underline hover:bg-nu-pink/5 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles size={12} /> 탭에서 성장 기록 보기
          </span>
          <ChevronRight size={14} />
        </Link>
      ) : (
        <div className="px-5 py-4 text-center">
          <p className="text-[13px] text-nu-muted">첫 미팅을 만들어 성장을 시작하세요!</p>
        </div>
      )}
    </div>
  );
}
