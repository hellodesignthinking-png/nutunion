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
  keyInsight: string;
}

interface CrossReference {
  fromPage: string;
  toPage: string;
  linkType: string;
  reason: string;
}

interface SynthesisResult {
  weeklyTheme: string;
  consolidatedSummary: string;
  wikiPageSuggestions: WikiPageSuggestion[];
  crossReferences: CrossReference[];
  knowledgeGaps: string[];
  growthMetrics: {
    newConceptsIntroduced: number;
    conceptsDeepened: number;
    connectionsDiscovered: number;
  };
  nextWeekSuggestions: string[];
  compactionNote: string;
  _meta?: {
    newResourceCount: number;
    newMeetingCount: number;
    newNoteCount: number;
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
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps — reload history only on groupId change, not phase

  async function runSynthesis() {
    setPhase("synthesizing");
    setCreatedPages([]);
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
        const err = await res.json();
        throw new Error(err.error || "통합 실패");
      }
      const data: SynthesisResult = await res.json();
      setResult(data);

      if (data.wikiPageSuggestions?.length > 0) {
        setSelectedPages(new Set(data.wikiPageSuggestions.map((_, i) => i)));
        setPhase("reviewing");
      } else {
        setPhase("done");
      }
    } catch (e: any) {
      const msg = e.name === "AbortError" ? "요청 시간이 초과되었습니다. 다시 시도해주세요." : (e.message || "통합 실패");
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
            const { error: updateError } = await supabase.from("wiki_pages").update({
              content: existingPage.content + "\n\n---\n\n" + suggestion.content,
              version: existingPage.version + 1,
              last_updated_by: user.id,
            }).eq("id", existingPage.id);
            if (updateError) { failed++; continue; }
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

    setCreatedPages(newlyCreated);
    setApplyingIndex(null);
    setPhase("done");
    const parts = [`${created}개 탭 페이지가 생성/업데이트 되었습니다`];
    if (linkedCount > 0) parts.push(`${linkedCount}개 교차 참조가 연결되었습니다`);
    if (failed > 0) parts.push(`${failed}개 실패`);
    toast.success(parts.join(" · "));
  }

  function togglePage(idx: number) {
    setSelectedPages(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
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
        <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest mt-1">
          Incremental Knowledge Synthesis · Gemini 2.5 Flash
        </p>
      </div>

      {/* Idle State */}
      {phase === "idle" && (
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-nu-pink/5 flex items-center justify-center border-[2px] border-nu-pink/20">
            <Sparkles size={28} className="text-nu-pink" />
          </div>
          <p className="text-sm font-medium text-nu-ink mb-2">
            새로 공유된 리소스와 회의 내용을 분석하여 탭을 고도화합니다
          </p>
          <p className="text-xs text-nu-muted mb-6">
            이미 탭으로 정리된 자료는 다시 검토하지 않아 토큰을 절약합니다
          </p>
          {isHost ? (
            <button
              onClick={runSynthesis}
              className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink text-white hover:bg-nu-graphite transition-colors flex items-center gap-2 mx-auto"
            >
              <Zap size={14} /> 지식 통합 시작
            </button>
          ) : (
            <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">
              호스트만 지식 통합을 실행할 수 있습니다
            </p>
          )}

          {/* Synthesis History */}
          {history.length > 0 && (
            <div className="mt-6 border-t border-nu-ink/5 pt-4">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="font-mono-nu text-[9px] text-nu-muted hover:text-nu-ink flex items-center gap-1 mx-auto transition-colors"
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
                        <div className="flex items-center gap-2 mt-1 font-mono-nu text-[8px] text-nu-muted flex-wrap">
                          <span>{new Date(log.createdAt).toLocaleDateString("ko", { month: "short", day: "numeric" })}</span>
                          <span>·</span>
                          <span>{log.inputSummary?.newResourceCount || 0} 리소스</span>
                          <span>·</span>
                          <span>{log.pagesCreated} 페이지 제안</span>
                          <span>·</span>
                          <span>{log.createdBy}</span>
                        </div>
                        {log.compactionNote && (
                          <p className="text-[10px] text-nu-muted/70 mt-1 line-clamp-1">{log.compactionNote}</p>
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
        <div className="p-8 text-center">
          <Loader2 size={32} className="animate-spin text-nu-pink mx-auto mb-4" />
          <p className="text-sm font-bold text-nu-ink mb-1">AI가 새 자료를 분석하고 있습니다...</p>
          <p className="font-mono-nu text-[9px] text-nu-muted">마지막 통합 이후 새로운 리소스와 회의만 검토합니다</p>
        </div>
      )}

      {/* Review Phase */}
      {phase === "reviewing" && result && (
        <div className="divide-y divide-nu-ink/5">
          {/* Theme & Summary */}
          <div className="p-5 bg-nu-cream/30">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-nu-pink" />
              <span className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-pink">
                이번 주 테마
              </span>
            </div>
            <p className="text-sm font-bold text-nu-ink">{result.weeklyTheme}</p>
            <p className="text-xs text-nu-graphite mt-2 leading-relaxed">{result.consolidatedSummary}</p>

            {/* Meta info */}
            {result._meta && (
              <div className="flex items-center gap-4 mt-3 font-mono-nu text-[8px] text-nu-muted">
                <span>리소스 {result._meta.newResourceCount}건</span>
                <span>미팅 {result._meta.newMeetingCount}건</span>
                <span>노트 {result._meta.newNoteCount}건</span>
                {result._meta.isIncremental && (
                  <span className="text-nu-blue">증분 처리</span>
                )}
              </div>
            )}
          </div>

          {/* Growth Metrics */}
          {result.growthMetrics && (
            <div className="p-5 flex items-center gap-4 sm:gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Plus size={12} className="text-green-500" />
                <span className="font-mono-nu text-[10px]">
                  <span className="font-bold text-nu-ink">{result.growthMetrics.newConceptsIntroduced}</span>
                  <span className="text-nu-muted ml-1">새 개념</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp size={12} className="text-nu-blue" />
                <span className="font-mono-nu text-[10px]">
                  <span className="font-bold text-nu-ink">{result.growthMetrics.conceptsDeepened}</span>
                  <span className="text-nu-muted ml-1">심화</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <LinkIcon size={12} className="text-nu-pink" />
                <span className="font-mono-nu text-[10px]">
                  <span className="font-bold text-nu-ink">{result.growthMetrics.connectionsDiscovered}</span>
                  <span className="text-nu-muted ml-1">연결</span>
                </span>
              </div>
            </div>
          )}

          {/* Wiki Page Suggestions */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
                <FileText size={13} /> 탭 페이지 제안 ({result.wikiPageSuggestions.length}건)
              </h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedPages(new Set(result.wikiPageSuggestions.map((_, i) => i)))}
                  className="font-mono-nu text-[9px] text-nu-blue hover:text-nu-pink transition-colors"
                >
                  전체 선택
                </button>
                <button
                  onClick={() => setSelectedPages(new Set())}
                  className="font-mono-nu text-[9px] text-nu-muted hover:text-nu-ink transition-colors"
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
                        <span className={`font-mono-nu text-[8px] font-bold uppercase px-1.5 py-0.5 ${
                          page.action === "create" ? "bg-green-50 text-green-600" : "bg-nu-amber/10 text-nu-amber"
                        }`}>
                          {page.action === "create" ? "NEW" : "UPDATE"}
                        </span>
                      </div>
                      <p className="text-xs text-nu-muted mt-0.5">{page.keyInsight}</p>
                    </div>
                    <span className="font-mono-nu text-[8px] text-nu-muted shrink-0">{page.topicName}</span>
                    {expandedPage === idx ? <ChevronUp size={14} className="text-nu-muted" /> : <ChevronDown size={14} className="text-nu-muted" />}
                  </div>

                  {expandedPage === idx && (
                    <div className="px-3 pb-3 border-t border-nu-ink/5">
                      <div className="bg-nu-paper p-3 mt-2 text-xs text-nu-graphite leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto font-mono">
                        {page.content}
                      </div>
                      {page.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {page.tags.map(tag => (
                            <span key={tag} className="font-mono-nu text-[8px] px-1.5 py-0.5 bg-nu-ink/5 text-nu-muted">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {page.sourceResources.length > 0 && (
                        <p className="font-mono-nu text-[8px] text-nu-muted/60 mt-1">
                          참조: {page.sourceResources.join(", ")}
                        </p>
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
              <h4 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2 mb-3">
                <LinkIcon size={13} /> 지식 연결 ({result.crossReferences.length}건)
              </h4>
              <div className="space-y-1">
                {result.crossReferences.map((ref, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-nu-muted">
                    <span className="font-medium text-nu-ink">{ref.fromPage}</span>
                    <ArrowRight size={10} />
                    <span className="font-medium text-nu-ink">{ref.toPage}</span>
                    <span className="font-mono-nu text-[8px] px-1 bg-nu-ink/5">{ref.linkType}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge Gaps */}
          {result.knowledgeGaps?.length > 0 && (
            <div className="p-5">
              <h4 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2 mb-3">
                <AlertCircle size={13} className="text-nu-amber" /> 탐구 필요 영역
              </h4>
              <ul className="space-y-1">
                {result.knowledgeGaps.map((gap, i) => (
                  <li key={i} className="text-xs text-nu-muted flex items-start gap-2">
                    <span className="text-nu-amber shrink-0">?</span>
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Week Suggestions */}
          {result.nextWeekSuggestions?.length > 0 && (
            <div className="p-5">
              <h4 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2 mb-3">
                <TrendingUp size={13} className="text-green-500" /> 다음 주 학습 제안
              </h4>
              <ul className="space-y-1">
                {result.nextWeekSuggestions.map((s, i) => (
                  <li key={i} className="text-xs text-nu-graphite flex items-start gap-2">
                    <span className="font-mono-nu text-[9px] text-nu-pink font-bold">{String(i + 1).padStart(2, "0")}</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Apply Button */}
          <div className="p-5 bg-nu-cream/30 flex items-center justify-between">
            <p className="font-mono-nu text-[9px] text-nu-muted">
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
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
            <p className="font-mono-nu text-[9px] text-nu-muted">
              {applyingIndex + 1} / {selectedPages.size}
            </p>
          )}
        </div>
      )}

      {/* Done */}
      {phase === "done" && result && (
        <div className="p-6">
          <div className="text-center mb-4">
            <CheckCircle2 size={32} className="text-green-500 mx-auto mb-3" />
            <p className="text-sm font-bold text-nu-ink mb-1">
              {createdPages.length > 0 ? `${createdPages.length}개 탭 페이지가 저장되었습니다!` : result.wikiPageSuggestions.length > 0 ? "지식 통합 완료!" : result.weeklyTheme}
            </p>
            <p className="text-xs text-nu-muted">{result.compactionNote || result.consolidatedSummary}</p>
          </div>

          {/* Created pages list with links */}
          {createdPages.length > 0 && (
            <div className="bg-green-50/50 border border-green-200/50 p-4 mb-4">
              <p className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-green-700 mb-3 flex items-center gap-1.5">
                <BookOpen size={11} /> 저장된 탭 페이지
              </p>
              <div className="space-y-2">
                {createdPages.map(page => (
                  <Link
                    key={page.id}
                    href={`/groups/${groupId}/wiki/pages/${page.id}`}
                    className="flex items-center gap-2 p-2 bg-white border border-green-100 hover:border-nu-blue/30 transition-colors no-underline group"
                  >
                    <span className={`font-mono-nu text-[7px] font-bold uppercase px-1.5 py-0.5 shrink-0 ${
                      page.action === "create" ? "bg-green-100 text-green-600" : "bg-nu-amber/10 text-nu-amber"
                    }`}>
                      {page.action === "create" ? "NEW" : "UPD"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-nu-ink group-hover:text-nu-blue transition-colors truncate block">
                        {page.title}
                      </span>
                      <span className="font-mono-nu text-[8px] text-nu-muted">{page.topicName}</span>
                    </div>
                    <ArrowRight size={12} className="text-nu-muted group-hover:text-nu-blue transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
              <p className="font-mono-nu text-[8px] text-nu-muted mt-3">
                아래 &ldquo;주제별 탭&rdquo; 섹션에서도 확인할 수 있습니다
              </p>
            </div>
          )}

          {/* No new data case */}
          {createdPages.length === 0 && result.wikiPageSuggestions.length === 0 && (
            <div className="bg-nu-cream/50 border border-nu-ink/10 p-4 mb-4 text-center">
              <p className="text-xs text-nu-muted mb-2">
                마지막 통합 이후 새로 공유된 리소스나 회의가 없습니다.
              </p>
              <p className="font-mono-nu text-[9px] text-nu-muted/70">
                좌측 &ldquo;지식 수집&rdquo;에서 리소스를 추가하거나 미팅을 진행한 후 다시 실행하세요.
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => { setPhase("idle"); setResult(null); setCreatedPages([]); }}
              className="font-mono-nu text-[10px] text-nu-blue hover:text-nu-pink transition-colors flex items-center gap-1"
            >
              <RefreshCw size={11} /> 다시 실행
            </button>
            {createdPages.length > 0 && (
              <button
                onClick={() => window.location.reload()}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-ink text-white hover:bg-nu-graphite transition-colors flex items-center gap-1.5"
              >
                <BookOpen size={11} /> 탭 새로고침
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
