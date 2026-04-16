"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Brain, Sparkles, Loader2, CheckCircle2,
  ArrowRight, Save, BookOpen, ChevronDown, ChevronUp,
  Zap, TrendingUp, AlertCircle, Link as LinkIcon,
  FileText, RefreshCw, Plus, History, Clock,
} from "lucide-react";
import Link from "next/link";

interface WikiPageSuggestion {
  title: string;
  content: string;
  topicName: string;
  action: "create" | "update";
  tags: string[];
  sourceResources: string[];
  sourceMeetings?: string[];
  keyInsight: string;
}

interface CrossReference {
  fromPage: string;
  toPage: string;
  linkType: string;
  reason: string;
}

interface KnowledgeGap {
  topic: string;
  reason: string;
  suggestedAction: string;
}

interface SectionStatus {
  sectionName: string;
  completeness: number;
  missingAspects: string[];
}

interface SynthesisResult {
  weeklyTheme: string;
  consolidatedSummary: string;
  wikiPageSuggestions: WikiPageSuggestion[];
  crossReferences: CrossReference[];
  knowledgeGaps: (string | KnowledgeGap)[];
  tabCompletionAssessment?: {
    overallCompleteness: number;
    sectionStatuses: SectionStatus[];
    blockers: string[];
    estimatedWeeksToComplete: number;
  };
  growthMetrics: {
    newConceptsIntroduced: number;
    conceptsDeepened: number;
    connectionsDiscovered: number;
    evidenceStrength?: string;
  };
  nextWeekSuggestions: string[];
  compactionNote: string;
  _meta?: {
    newResourceCount: number;
    newMeetingCount: number;
    newNoteCount: number;
    driveDocsProcessed?: number;
    existingPageCount: number;
    isIncremental: boolean;
    lastSynthesisAt: string;
  };
}

interface SynthesisLog {
  id: string;
  weekStart: string;
  weekEnd: string;
  theme: string | null;
  pagesCreated: number;
  compactionNote: string | null;
  createdBy: string;
  createdAt: string;
  inputSummary: { newResourceCount?: number; newMeetingCount?: number; newNoteCount?: number };
}

interface CreatedPage {
  id: string;
  title: string;
  topicName: string;
  action: "create" | "update";
}

export function WeeklySynthesisEngine({ groupId, isHost }: { groupId: string; isHost: boolean }) {
  const [phase, setPhase] = useState<"idle" | "synthesizing" | "reviewing" | "applying" | "done">("idle");
  const [result, setResult] = useState<SynthesisResult | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [expandedPage, setExpandedPage] = useState<number | null>(null);
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<SynthesisLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [createdPages, setCreatedPages] = useState<CreatedPage[]>([]);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`/api/wiki/synthesis?groupId=${groupId}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.logs || []);
        }
      } catch { /* silent */ }
    }
    loadHistory();
  }, [groupId]);

  async function runSynthesis() {
    setPhase("synthesizing");
    setCreatedPages([]);
    setErrorDetail(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      const res = await fetch("/api/ai/wiki-synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `HTTP ${res.status} — ${await res.text().catch(() => "응답 없음")}`;
        }
        throw new Error(errMsg);
      }
      const data: SynthesisResult = await res.json();
      setResult(data);

      if (data.wikiPageSuggestions?.length > 0) {
        setSelectedPages(new Set(data.wikiPageSuggestions.map((_, i) => i)));
        setPhase("reviewing");
      } else {
        setPhase("done");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error
        ? error.name === "AbortError"
          ? "요청 시간이 초과되었습니다 (60초). 다시 시도해주세요."
          : (error.message || "통합 실패")
        : "통합 실패";
      setErrorDetail(msg);
      toast.error(msg);
      setPhase("idle");
    }
  }

  async function applySelectedPages() {
    if (!result || selectedPages.size === 0) return;
    setPhase("applying");

    const supabase = createClient();
    let created = 0;
    let failed = 0;
    const newlyCreated: CreatedPage[] = [];

    // Get user once before loop (avoid repeated auth calls)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("로그인이 필요합니다"); setPhase("idle"); return; }

    const sortedIndices = Array.from(selectedPages).sort();
    for (let i = 0; i < sortedIndices.length; i++) {
      const idx = sortedIndices[i];
      const suggestion = result.wikiPageSuggestions[idx];
      setApplyingIndex(i);

      try {
        // Find or create topic
        let topicId: string | null = null;
        const { data: existingTopics } = await supabase
          .from("wiki_topics")
          .select("id")
          .eq("group_id", groupId)
          .ilike("name", suggestion.topicName)
          .limit(1);

        if (existingTopics && existingTopics.length > 0) {
          topicId = existingTopics[0].id;
        } else {
          const { data: newTopic } = await supabase
            .from("wiki_topics")
            .insert({ group_id: groupId, name: suggestion.topicName, description: suggestion.keyInsight })
            .select("id")
            .single();
          topicId = newTopic?.id || null;
        }

        if (!topicId) { failed++; continue; }

        if (suggestion.action === "create") {
          const { data: inserted, error } = await supabase.from("wiki_pages").insert({
            topic_id: topicId,
            title: suggestion.title,
            content: suggestion.content,
            created_by: user.id,
            last_updated_by: user.id,
            version: 1,
          }).select("id").single();
          if (error || !inserted) { failed++; continue; }

          // Record contribution for knowledge growth tracking
          await supabase.from("wiki_contributions").insert({
            page_id: inserted.id,
            user_id: user.id,
            change_summary: `AI 지식 통합으로 페이지 생성: ${suggestion.keyInsight || suggestion.title}`,
            source_type: "ai_synthesis",
          });

          // Record first page version
          await supabase.from("wiki_page_versions").insert({
            page_id: inserted.id,
            version: 1,
            title: suggestion.title,
            content: suggestion.content,
            edited_by: user.id,
            change_summary: "AI 지식 통합으로 자동 생성",
          });

          newlyCreated.push({ id: inserted.id, title: suggestion.title, topicName: suggestion.topicName, action: "create" });
          created++;
        } else {
          // Update: find existing page by title and append content
          const { data: existingPage } = await supabase
            .from("wiki_pages")
            .select("id, content, version")
            .eq("topic_id", topicId)
            .ilike("title", suggestion.title)
            .limit(1)
            .maybeSingle();

          if (existingPage) {
            const newVersion = existingPage.version + 1;
            const newContent = existingPage.content + "\n\n---\n\n" + suggestion.content;
            const { error: updateError } = await supabase.from("wiki_pages").update({
              content: newContent,
              version: newVersion,
              last_updated_by: user.id,
            }).eq("id", existingPage.id);
            if (updateError) { failed++; continue; }

            // Record contribution & version
            await supabase.from("wiki_contributions").insert({
              page_id: existingPage.id,
              user_id: user.id,
              change_summary: `AI 지식 통합으로 내용 추가: ${suggestion.keyInsight || suggestion.title}`,
              source_type: "ai_synthesis",
            });

            await supabase.from("wiki_page_versions").insert({
              page_id: existingPage.id,
              version: newVersion,
              title: suggestion.title,
              content: newContent,
              edited_by: user.id,
              change_summary: "AI 지식 통합으로 내용 추가",
            });

            newlyCreated.push({ id: existingPage.id, title: suggestion.title, topicName: suggestion.topicName, action: "update" });
            created++;
          } else {
            // Page not found, create new
            const { data: inserted, error: insertError } = await supabase.from("wiki_pages").insert({
              topic_id: topicId,
              title: suggestion.title,
              content: suggestion.content,
              created_by: user.id,
              last_updated_by: user.id,
              version: 1,
            }).select("id").single();
            if (insertError || !inserted) { failed++; continue; }

            await supabase.from("wiki_contributions").insert({
              page_id: inserted.id,
              user_id: user.id,
              change_summary: `AI 지식 통합으로 페이지 생성: ${suggestion.keyInsight || suggestion.title}`,
              source_type: "ai_synthesis",
            });

            await supabase.from("wiki_page_versions").insert({
              page_id: inserted.id,
              version: 1,
              title: suggestion.title,
              content: suggestion.content,
              edited_by: user.id,
              change_summary: "AI 지식 통합으로 자동 생성",
            });

            newlyCreated.push({ id: inserted.id, title: suggestion.title, topicName: suggestion.topicName, action: "create" });
            created++;
          }
        }
      } catch {
        failed++;
      }
    }

    // ── Auto-create cross-references from AI suggestions ──
    let linkedCount = 0;
    if (result.crossReferences && result.crossReferences.length > 0) {
      try {
        // Fetch all pages for this group to resolve titles → ids
        const { data: allTopics } = await supabase
          .from("wiki_topics")
          .select("id")
          .eq("group_id", groupId);
        const tIds = (allTopics || []).map(t => t.id);
        if (tIds.length > 0) {
          const { data: allPages } = await supabase
            .from("wiki_pages")
            .select("id, title")
            .in("topic_id", tIds);
          const titleMap = new Map((allPages || []).map(p => [p.title.toLowerCase(), p.id]));

          for (const ref of result.crossReferences) {
            const sourceId = titleMap.get(ref.fromPage.toLowerCase());
            const targetId = titleMap.get(ref.toPage.toLowerCase());
            if (sourceId && targetId && sourceId !== targetId) {
              const linkType = (["reference", "extends", "contradicts", "prerequisite"].includes(ref.linkType))
                ? ref.linkType : "reference";
              await supabase.from("wiki_page_links").upsert({
                source_page_id: sourceId,
                target_page_id: targetId,
                link_type: linkType,
              }, { onConflict: "source_page_id,target_page_id" });
              linkedCount++;
            }
          }
        }
      } catch {
        // Cross-reference creation is best-effort, don't fail the whole operation
      }
    }

    // ── Auto-archive source resources from suggestions ──
    let archivedResources = 0;
    try {
      const now = new Date();
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const weekStart = monday.toISOString().split("T")[0];

      for (const idx of Array.from(selectedPages)) {
        const suggestion = result.wikiPageSuggestions[idx];
        // Save sourceResources as wiki_weekly_resources linked to the saved page
        const savedPage = newlyCreated.find(p => p.title === suggestion.title);
        const linkedPageId = savedPage?.id || null;

        if (suggestion.sourceResources && suggestion.sourceResources.length > 0) {
          for (const resourceTitle of suggestion.sourceResources) {
            // Skip if it looks like a bare description (not a URL)
            const isUrl = resourceTitle.startsWith("http") || resourceTitle.includes("://");
            await supabase.from("wiki_weekly_resources").upsert(
              {
                group_id: groupId,
                week_start: weekStart,
                shared_by: user.id,
                title: resourceTitle,
                url: isUrl ? resourceTitle : null,
                resource_type: isUrl ? "link" : "article",
                description: `'${suggestion.title}' 페이지의 출처 자료`,
                linked_wiki_page_id: linkedPageId,
                auto_summary: `${suggestion.keyInsight || ""}`.slice(0, 500),
              },
              { onConflict: "group_id,url,week_start", ignoreDuplicates: true }
            );
            archivedResources++;
          }
        }
      }
    } catch (err) {
      console.error("Source resource archiving error:", err);
    }

    setCreatedPages(newlyCreated);
    setApplyingIndex(null);
    setPhase("done");
    const parts = [`${created}개 탭 페이지가 생성/업데이트 되었습니다`];
    if (linkedCount > 0) parts.push(`${linkedCount}개 교차 참조`);
    if (archivedResources > 0) parts.push(`${archivedResources}개 자료 자동 보관`);
    if (failed > 0) parts.push(`${failed}개 실패`);
    toast.success(parts.join(" · "));

    // Notify UnifiedTabView to reload
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wiki-pages-updated", { detail: { groupId } }));
    }
  }

  function togglePage(idx: number) {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  return (
    <div className="bg-white border-[2px] border-nu-ink">
      {/* Header */}
      <div className="p-5 border-b-[2px] border-nu-ink/10">
        <h3 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
          <Brain size={18} className="text-nu-pink" />
          AI 지식 통합 엔진
        </h3>
        <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest mt-1">
          Incremental Knowledge Synthesis · Gemini 2.5 Flash
        </p>
      </div>

      {/* Idle State */}
      {phase === "idle" && (
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-20 h-20 shrink-0 bg-gradient-to-br from-nu-pink/10 to-purple-500/10 flex items-center justify-center border-[2px] border-nu-pink/20 relative">
              <Sparkles size={32} className="text-nu-pink" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-nu-ink flex items-center justify-center">
                <Zap size={10} className="text-white" />
              </div>
            </div>
            <div className="text-center sm:text-left flex-1">
              <p className="text-sm font-bold text-nu-ink mb-1.5">
                회의록 기반 탭 강화
              </p>
              <p className="text-xs text-nu-muted leading-relaxed mb-1">
                회의록과 토론 내용을 1차 자료로, 공유된 리소스를 보강 자료로 활용하여
                통합 탭을 점진적으로 강화합니다.
              </p>
              <p className="font-mono-nu text-[10px] text-nu-muted/60">
                회의 → 분석 → 기존 섹션 강화 · 증분 처리 · 토큰 절약
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex items-center justify-center gap-3">
            {isHost ? (
              <button
                onClick={runSynthesis}
                className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink text-white hover:bg-nu-pink transition-colors flex items-center gap-2 shadow-[3px_3px_0px_rgba(233,30,99,0.25)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
              >
                <Zap size={14} /> 지식 통합 시작
              </button>
            ) : (
              <div className="font-mono-nu text-[12px] text-nu-muted uppercase tracking-widest px-4 py-2.5 border border-nu-ink/10 bg-nu-cream/30">
                호스트만 실행 가능
              </div>
            )}
          </div>

          {/* Error detail display */}
          {errorDetail && (
            <div className="mt-4 mx-auto max-w-md bg-red-50 border border-red-200 p-3 text-left">
              <p className="font-mono-nu text-[11px] font-bold text-red-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                <AlertCircle size={10} /> 오류 상세
              </p>
              <p className="text-xs text-red-700 break-all">{errorDetail}</p>
            </div>
          )}

          {/* Synthesis History */}
          {history.length > 0 && (
            <div className="mt-6 border-t border-nu-ink/5 pt-4">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="font-mono-nu text-[11px] text-nu-muted hover:text-nu-ink flex items-center gap-1 mx-auto transition-colors"
              >
                <History size={11} /> 이전 통합 기록 ({history.length})
                {showHistory ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
              {showHistory && (
                <div className="mt-3 space-y-2">
                  {history.map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-3 bg-nu-paper/50 border border-nu-ink/[0.06] text-left">
                      <Clock size={12} className="text-nu-muted shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-nu-ink truncate">
                          {log.theme || "통합 완료"}
                        </p>
                        <div className="flex items-center gap-2 mt-1 font-mono-nu text-[10px] text-nu-muted flex-wrap">
                          <span>{new Date(log.createdAt).toLocaleDateString("ko", { month: "short", day: "numeric" })}</span>
                          <span>·</span>
                          <span>{log.inputSummary?.newResourceCount || 0} 리소스</span>
                          <span>·</span>
                          <span>{log.pagesCreated} 페이지 제안</span>
                          <span>·</span>
                          <span>{log.createdBy}</span>
                        </div>
                        {log.compactionNote && (
                          <p className="text-[12px] text-nu-muted/70 mt-1 line-clamp-1">{log.compactionNote}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Synthesizing */}
      {phase === "synthesizing" && (
        <div className="p-8">
          <div className="flex flex-col items-center">
            <div className="relative w-16 h-16 mb-5">
              <div className="absolute inset-0 border-[3px] border-nu-pink/20 rounded-full" />
              <div className="absolute inset-0 border-[3px] border-transparent border-t-nu-pink rounded-full animate-spin" />
              <Brain size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-nu-pink" />
            </div>
            <p className="text-sm font-bold text-nu-ink mb-2">AI가 지식을 통합하고 있습니다</p>
            <div className="flex items-center gap-4 font-mono-nu text-[11px] text-nu-muted">
              <span className="flex items-center gap-1"><FileText size={10} /> 자료 수집</span>
              <span>→</span>
              <span className="flex items-center gap-1"><Brain size={10} /> 분석 중</span>
              <span>→</span>
              <span className="flex items-center gap-1 text-nu-muted/40"><Sparkles size={10} /> 탭 생성</span>
            </div>
            <p className="font-mono-nu text-[10px] text-nu-muted/50 mt-3">최대 60초 소요될 수 있습니다</p>
          </div>
        </div>
      )}

      {/* Review Phase */}
      {phase === "reviewing" && result && (
        <div className="divide-y divide-nu-ink/5">
          {/* Theme & Summary */}
          <div className="p-5 bg-nu-cream/30">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-nu-pink" />
              <span className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-pink">
                이번 주 테마
              </span>
            </div>
            <p className="text-sm font-bold text-nu-ink">{result.weeklyTheme}</p>
            <p className="text-xs text-nu-graphite mt-2 leading-relaxed">{result.consolidatedSummary}</p>

            {/* Meta info */}
            {result._meta && (
              <div className="flex items-center gap-4 mt-3 font-mono-nu text-[10px] text-nu-muted">
                <span>리소스 {result._meta.newResourceCount}건</span>
                <span>미팅 {result._meta.newMeetingCount}건</span>
                <span>노트 {result._meta.newNoteCount}건</span>
                {result._meta.isIncremental && (
                  <span className="text-nu-blue">증분 처리</span>
                )}
              </div>
            )}
          </div>

          {/* Tab Completion Assessment */}
          {result.tabCompletionAssessment && (
            <div className="p-5 border-b border-nu-ink/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative w-14 h-14 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f0ede6" strokeWidth="2.5" />
                    <circle cx="18" cy="18" r="15.5" fill="none"
                      stroke={result.tabCompletionAssessment.overallCompleteness >= 70 ? "#16a34a" : result.tabCompletionAssessment.overallCompleteness >= 40 ? "#f59e0b" : "#e91e63"}
                      strokeWidth="2.5"
                      strokeDasharray={`${result.tabCompletionAssessment.overallCompleteness * 0.974} 100`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-head text-sm font-extrabold">{result.tabCompletionAssessment.overallCompleteness}%</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-ink">통합 문서 완성도</p>
                  <p className="text-xs text-nu-muted mt-0.5">
                    예상 완료까지 약 {result.tabCompletionAssessment.estimatedWeeksToComplete}주
                  </p>
                </div>
              </div>
              {/* Section completeness bars */}
              {result.tabCompletionAssessment.sectionStatuses?.length > 0 && (
                <div className="space-y-1.5">
                  {result.tabCompletionAssessment.sectionStatuses.map((sec, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-mono-nu text-[10px] text-nu-muted w-24 truncate shrink-0">{sec.sectionName}</span>
                      <div className="flex-1 h-1.5 bg-nu-cream overflow-hidden">
                        <div className="h-full bg-nu-pink transition-all" style={{ width: `${sec.completeness}%` }} />
                      </div>
                      <span className="font-mono-nu text-[10px] text-nu-muted w-8 text-right">{sec.completeness}%</span>
                    </div>
                  ))}
                </div>
              )}
              {result.tabCompletionAssessment.blockers?.length > 0 && (
                <div className="mt-3 bg-red-50 border border-red-200 p-2">
                  <p className="font-mono-nu text-[10px] text-red-600 font-bold uppercase tracking-widest mb-1">완성 차단 요소</p>
                  {result.tabCompletionAssessment.blockers.map((b, i) => (
                    <p key={i} className="text-[11px] text-red-700 flex items-start gap-1">
                      <AlertCircle size={10} className="shrink-0 mt-0.5" /> {b}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Growth Metrics */}
          {result.growthMetrics && (
            <div className="p-5 flex items-center gap-4 sm:gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Plus size={12} className="text-green-500" />
                <span className="font-mono-nu text-[12px]">
                  <span className="font-bold text-nu-ink">{result.growthMetrics.newConceptsIntroduced}</span>
                  <span className="text-nu-muted ml-1">새 개념</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp size={12} className="text-nu-blue" />
                <span className="font-mono-nu text-[12px]">
                  <span className="font-bold text-nu-ink">{result.growthMetrics.conceptsDeepened}</span>
                  <span className="text-nu-muted ml-1">심화</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <LinkIcon size={12} className="text-nu-pink" />
                <span className="font-mono-nu text-[12px]">
                  <span className="font-bold text-nu-ink">{result.growthMetrics.connectionsDiscovered}</span>
                  <span className="text-nu-muted ml-1">연결</span>
                </span>
              </div>
              {result.growthMetrics.evidenceStrength && (
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    result.growthMetrics.evidenceStrength === "strong" ? "bg-green-500" :
                    result.growthMetrics.evidenceStrength === "moderate" ? "bg-amber-500" : "bg-red-400"
                  }`} />
                  <span className="font-mono-nu text-[11px] text-nu-muted">
                    근거 강도: <span className="font-bold text-nu-ink">
                      {result.growthMetrics.evidenceStrength === "strong" ? "강함" :
                       result.growthMetrics.evidenceStrength === "moderate" ? "보통" : "약함"}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Wiki Page Suggestions */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
                <FileText size={13} /> 탭 페이지 제안 ({result.wikiPageSuggestions.length}건)
              </h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedPages(new Set(result.wikiPageSuggestions.map((_, i) => i)))}
                  className="font-mono-nu text-[11px] text-nu-blue hover:text-nu-pink transition-colors"
                >
                  전체 선택
                </button>
                <button
                  onClick={() => setSelectedPages(new Set())}
                  className="font-mono-nu text-[11px] text-nu-muted hover:text-nu-ink transition-colors"
                >
                  선택 해제
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {result.wikiPageSuggestions.map((page, idx) => (
                <div key={idx} className={`border transition-colors ${selectedPages.has(idx) ? "border-nu-blue/30 bg-nu-blue/[0.02]" : "border-nu-ink/[0.06]"}`}>
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer"
                    onClick={() => setExpandedPage(expandedPage === idx ? null : idx)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPages.has(idx)}
                      onChange={(e) => { e.stopPropagation(); togglePage(idx); }}
                      className="accent-nu-blue shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-nu-ink truncate">{page.title}</span>
                        <span className={`font-mono-nu text-[10px] font-bold uppercase px-1.5 py-0.5 ${
                          page.action === "create" ? "bg-green-50 text-green-600" : "bg-nu-amber/10 text-nu-amber"
                        }`}>
                          {page.action === "create" ? "NEW" : "UPDATE"}
                        </span>
                      </div>
                      <p className="text-xs text-nu-muted mt-0.5">{page.keyInsight}</p>
                    </div>
                    <span className="font-mono-nu text-[10px] text-nu-muted shrink-0">{page.topicName}</span>
                    {expandedPage === idx ? <ChevronUp size={14} className="text-nu-muted" /> : <ChevronDown size={14} className="text-nu-muted" />}
                  </div>

                  {expandedPage === idx && (
                    <div className="px-3 pb-3 border-t border-nu-ink/5">
                      <div className="bg-nu-paper p-4 mt-2 text-[13px] text-nu-graphite leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto prose prose-sm prose-headings:font-head prose-headings:text-nu-ink prose-headings:text-sm prose-headings:font-extrabold">
                        {page.content}
                      </div>

                      {/* Source Attribution */}
                      <div className="mt-3 bg-nu-cream/30 border border-nu-ink/5 p-3 space-y-2">
                        <p className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink">출처 및 근거</p>
                        {page.sourceMeetings && page.sourceMeetings.length > 0 && (
                          <div className="flex items-start gap-2">
                            <FileText size={11} className="text-nu-blue shrink-0 mt-0.5" />
                            <div>
                              <p className="font-mono-nu text-[10px] text-nu-blue font-bold uppercase">회의</p>
                              <p className="text-[12px] text-nu-graphite">{page.sourceMeetings.join(" · ")}</p>
                            </div>
                          </div>
                        )}
                        {page.sourceResources.length > 0 && (
                          <div className="flex items-start gap-2">
                            <BookOpen size={11} className="text-nu-amber shrink-0 mt-0.5" />
                            <div>
                              <p className="font-mono-nu text-[10px] text-nu-amber font-bold uppercase">참고 자료</p>
                              <p className="text-[12px] text-nu-graphite">{page.sourceResources.join(" · ")}</p>
                            </div>
                          </div>
                        )}
                        {(!page.sourceMeetings || page.sourceMeetings.length === 0) && page.sourceResources.length === 0 && (
                          <p className="text-[11px] text-nu-muted italic">명시된 출처 없음</p>
                        )}
                      </div>

                      {page.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {page.tags.map(tag => (
                            <span key={tag} className="font-mono-nu text-[10px] px-1.5 py-0.5 bg-nu-ink/5 text-nu-muted">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Cross References */}
          {result.crossReferences?.length > 0 && (
            <div className="p-5">
              <h4 className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2 mb-3">
                <LinkIcon size={13} /> 지식 연결 ({result.crossReferences.length}건)
              </h4>
              <div className="space-y-1">
                {result.crossReferences.map((ref, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-nu-muted">
                    <span className="font-medium text-nu-ink">{ref.fromPage}</span>
                    <ArrowRight size={10} />
                    <span className="font-medium text-nu-ink">{ref.toPage}</span>
                    <span className="font-mono-nu text-[10px] px-1 bg-nu-ink/5">{ref.linkType}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge Gaps */}
          {result.knowledgeGaps?.length > 0 && (
            <div className="p-5">
              <h4 className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2 mb-3">
                <AlertCircle size={13} className="text-nu-amber" /> 탐구 필요 영역
              </h4>
              <div className="space-y-2">
                {result.knowledgeGaps.map((gap, i) => {
                  const isRich = typeof gap === "object" && gap !== null;
                  const gapObj = isRich ? (gap as KnowledgeGap) : null;
                  return (
                    <div key={i} className="bg-amber-50/50 border border-amber-200/50 p-3">
                      <p className="text-sm font-bold text-nu-ink flex items-start gap-2">
                        <span className="font-mono-nu text-[11px] bg-amber-200 text-amber-800 px-1.5 py-0.5 font-bold shrink-0">{i + 1}</span>
                        {gapObj ? gapObj.topic : String(gap)}
                      </p>
                      {gapObj?.reason && (
                        <p className="text-[12px] text-nu-muted mt-1 ml-7">{gapObj.reason}</p>
                      )}
                      {gapObj?.suggestedAction && (
                        <p className="text-[12px] text-nu-blue mt-1 ml-7 flex items-center gap-1">
                          <Zap size={10} className="shrink-0" /> {gapObj.suggestedAction}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Next Week Suggestions */}
          {result.nextWeekSuggestions?.length > 0 && (
            <div className="p-5">
              <h4 className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2 mb-3">
                <TrendingUp size={13} className="text-green-500" /> 다음 주 학습 제안
              </h4>
              <ul className="space-y-1">
                {result.nextWeekSuggestions.map((s, i) => (
                  <li key={i} className="text-xs text-nu-graphite flex items-start gap-2">
                    <span className="font-mono-nu text-[11px] text-nu-pink font-bold">{String(i + 1).padStart(2, "0")}</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Apply Button */}
          <div className="p-5 bg-nu-cream/30 flex items-center justify-between">
            <p className="font-mono-nu text-[11px] text-nu-muted">
              {selectedPages.size}개 선택됨
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setPhase("idle"); setResult(null); }}
                className="px-4 py-2 text-xs text-nu-muted hover:text-nu-ink transition-colors"
              >
                취소
              </button>
              <button
                onClick={applySelectedPages}
                disabled={selectedPages.size === 0}
                className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <Save size={12} /> 탭에 적용 ({selectedPages.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Applying */}
      {phase === "applying" && (
        <div className="p-8 text-center">
          <Loader2 size={32} className="animate-spin text-nu-pink mx-auto mb-4" />
          <p className="text-sm font-bold text-nu-ink mb-1">탭 페이지를 생성하고 있습니다...</p>
          {applyingIndex !== null && result && (
            <p className="font-mono-nu text-[11px] text-nu-muted">
              {applyingIndex + 1} / {selectedPages.size}
            </p>
          )}
        </div>
      )}

      {/* Done */}
      {phase === "done" && result && (
        <div className="divide-y divide-nu-ink/5">
          {/* Success header */}
          <div className="p-6 text-center bg-green-50/30">
            <CheckCircle2 size={28} className="text-green-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-nu-ink mb-1">
              {createdPages.length > 0 ? `${createdPages.length}개 탭 페이지가 저장되었습니다` : result.wikiPageSuggestions.length > 0 ? "지식 통합 완료" : result.weeklyTheme}
            </p>
            {result.weeklyTheme && createdPages.length > 0 && (
              <p className="font-mono-nu text-[11px] text-nu-pink font-bold uppercase tracking-wider mt-1">{result.weeklyTheme}</p>
            )}
          </div>

          {/* Completion Assessment + Growth metrics */}
          {(result.tabCompletionAssessment || result.growthMetrics) && (createdPages.length > 0 || result.wikiPageSuggestions.length > 0) && (
            <div className="p-4">
              {/* Completion ring */}
              {result.tabCompletionAssessment && (
                <div className="flex items-center justify-center gap-6 mb-4">
                  <div className="relative w-16 h-16">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f0ede6" strokeWidth="2.5" />
                      <circle cx="18" cy="18" r="15.5" fill="none"
                        stroke={result.tabCompletionAssessment.overallCompleteness >= 70 ? "#16a34a" : result.tabCompletionAssessment.overallCompleteness >= 40 ? "#f59e0b" : "#e91e63"}
                        strokeWidth="2.5"
                        strokeDasharray={`${result.tabCompletionAssessment.overallCompleteness * 0.974} 100`}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-head text-base font-extrabold">{result.tabCompletionAssessment.overallCompleteness}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-ink">통합 문서 완성도</p>
                    <p className="text-xs text-nu-muted">예상 {result.tabCompletionAssessment.estimatedWeeksToComplete}주 후 완료</p>
                  </div>
                </div>
              )}
              {/* Growth metrics row */}
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="font-head text-lg font-extrabold text-green-600">{result.growthMetrics.newConceptsIntroduced}</p>
                  <p className="font-mono-nu text-[10px] text-nu-muted uppercase">새 개념</p>
                </div>
                <div className="text-center">
                  <p className="font-head text-lg font-extrabold text-nu-blue">{result.growthMetrics.conceptsDeepened}</p>
                  <p className="font-mono-nu text-[10px] text-nu-muted uppercase">심화</p>
                </div>
                <div className="text-center">
                  <p className="font-head text-lg font-extrabold text-nu-pink">{result.growthMetrics.connectionsDiscovered}</p>
                  <p className="font-mono-nu text-[10px] text-nu-muted uppercase">연결</p>
                </div>
              </div>
            </div>
          )}

          {/* Consolidated summary */}
          {result.consolidatedSummary && result.consolidatedSummary !== "마지막 통합 이후 새로 공유된 리소스나 회의가 없습니다." && (
            <div className="p-4">
              <p className="text-xs text-nu-graphite leading-relaxed">{result.consolidatedSummary}</p>
            </div>
          )}

          {/* Created pages list with links */}
          {createdPages.length > 0 && (
            <div className="p-4">
              <p className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-green-700 mb-3 flex items-center gap-1.5">
                <BookOpen size={11} /> 저장된 탭 페이지
              </p>
              <div className="space-y-1.5">
                {createdPages.map(page => (
                  <Link
                    key={page.id}
                    href={`/groups/${groupId}/wiki/pages/${page.id}`}
                    className="flex items-center gap-2 p-2.5 bg-white border border-green-100 hover:border-nu-blue/30 transition-colors no-underline group"
                  >
                    <span className={`font-mono-nu text-[9px] font-bold uppercase px-1.5 py-0.5 shrink-0 ${
                      page.action === "create" ? "bg-green-100 text-green-600" : "bg-nu-amber/10 text-nu-amber"
                    }`}>
                      {page.action === "create" ? "NEW" : "UPD"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-nu-ink group-hover:text-nu-blue transition-colors truncate block">
                        {page.title}
                      </span>
                      <span className="font-mono-nu text-[10px] text-nu-muted">{page.topicName}</span>
                    </div>
                    <ArrowRight size={12} className="text-nu-muted group-hover:text-nu-blue transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* No new data case */}
          {createdPages.length === 0 && result.wikiPageSuggestions.length === 0 && (
            <div className="p-5 text-center">
              <p className="text-xs text-nu-muted mb-1">
                마지막 통합 이후 새로 공유된 리소스나 회의가 없습니다
              </p>
              <p className="font-mono-nu text-[10px] text-nu-muted/60">
                자료실에 리소스를 추가하거나 미팅을 진행한 후 다시 실행하세요
              </p>
            </div>
          )}

          {/* Next week suggestions */}
          {result.nextWeekSuggestions?.length > 0 && (
            <div className="p-4">
              <p className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-ink mb-2 flex items-center gap-1.5">
                <TrendingUp size={11} className="text-green-500" /> 다음 주 학습 제안
              </p>
              <ul className="space-y-1">
                {result.nextWeekSuggestions.map((s, i) => (
                  <li key={i} className="text-[13px] text-nu-graphite flex items-start gap-2">
                    <span className="font-mono-nu text-[10px] text-nu-pink font-bold shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="p-4 flex items-center justify-center gap-3 bg-nu-cream/20">
            <button
              onClick={() => { setPhase("idle"); setResult(null); setCreatedPages([]); }}
              className="font-mono-nu text-[12px] text-nu-muted hover:text-nu-ink transition-colors flex items-center gap-1"
            >
              <RefreshCw size={11} /> 다시 실행
            </button>
            {createdPages.length > 0 && (
              <button
                onClick={() => window.location.reload()}
                className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-ink text-white hover:bg-nu-graphite transition-colors flex items-center gap-1.5"
              >
                <BookOpen size={11} /> 페이지 새로고침
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
