"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  BookOpen, ChevronRight, Edit3, FileText, Brain,
  Calendar, Users, Loader2, Clock, List,
  ChevronDown, ChevronUp, ExternalLink, Sparkles,
  ArrowRight, Hash, AlertCircle, Lightbulb,
  MessageSquare, Plus, Quote, Link2, TrendingUp,
  Search, CheckCircle2, XCircle, Microscope,
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────
interface Section {
  topicId: string;
  topicName: string;
  description: string | null;
  pages: {
    id: string;
    title: string;
    content: string;
    version: number;
    updatedAt: string;
    updatedBy: string | null;
  }[];
  meetingLinks: { meetingId: string; meetingTitle: string; date: string }[];
  contributorCount: number;
  totalVersions: number;
  resources: Resource[];
}

interface Resource {
  id: string;
  title: string;
  url: string;
  type: string;
  summary: string | null;
  contributor: string | null;
  createdAt: string;
}

interface Gap {
  sectionName: string;
  topicId: string | null;
  type: "missing" | "thin" | "unlinked" | "suggested";
  description: string;
  suggestedAction: "meeting" | "discussion" | "research";
  urgency: "high" | "medium" | "low";
}

// ── Word count util ────────────────────────────────────────────
function wordCount(text: string): number {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

// ── Plain text extractor ───────────────────────────────────────
function toPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

// ── First N meaningful chars (sentence-aware) ──────────────────
function extractExcerpt(content: string, maxChars = 200): string {
  const plain = toPlainText(content);
  if (plain.length <= maxChars) return plain;
  // Try to cut at a sentence boundary
  const cutoff = plain.slice(0, maxChars);
  const lastPeriod = Math.max(cutoff.lastIndexOf("다."), cutoff.lastIndexOf("요."), cutoff.lastIndexOf("."));
  if (lastPeriod > maxChars * 0.6) return cutoff.slice(0, lastPeriod + 2) + "…";
  return cutoff.trimEnd() + "…";
}

// ── Extract key bullet points from markdown content ─────────────
function extractBulletPoints(content: string, maxItems = 3): string[] {
  const plain = toPlainText(content);
  // Match lines that look like list items (starting with - , ·, •, *, 숫자.)
  const lines = plain.split(/(?<=[.!?다요])\s+|[\n\r]+/);
  const bullets: string[] = [];
  for (const line of lines) {
    const trimmed = line.replace(/^[-·•*\d]+[.)]\s*/, "").trim();
    if (trimmed.length > 15 && trimmed.length < 120 && !bullets.includes(trimmed)) {
      bullets.push(trimmed);
    }
    if (bullets.length >= maxItems) break;
  }
  return bullets;
}

// ── Gap analyzer ───────────────────────────────────────────────
function analyzeGaps(sections: Section[]): Gap[] {
  const gaps: Gap[] = [];

  sections.forEach(s => {
    const totalWords = s.pages.reduce((sum, p) => sum + wordCount(p.content), 0);

    if (s.pages.length === 0) {
      gaps.push({
        sectionName: s.topicName,
        topicId: s.topicId,
        type: "missing",
        description: `'${s.topicName}' 섹션이 아직 시작되지 않았습니다. 회의나 토론을 통해 내용을 채워보세요.`,
        suggestedAction: "meeting",
        urgency: "high",
      });
    } else if (totalWords < 150) {
      gaps.push({
        sectionName: s.topicName,
        topicId: s.topicId,
        type: "thin",
        description: `'${s.topicName}' 섹션이 ${totalWords}단어로 너무 얕습니다. 더 심층적인 논의가 필요합니다.`,
        suggestedAction: s.meetingLinks.length === 0 ? "meeting" : "research",
        urgency: "medium",
      });
    } else if (s.resources.length === 0 && totalWords > 0) {
      gaps.push({
        sectionName: s.topicName,
        topicId: s.topicId,
        type: "unlinked",
        description: `'${s.topicName}' 섹션에 인용 자료(논문·레퍼런스)가 없습니다. 자료를 찾아 공유해보세요.`,
        suggestedAction: "research",
        urgency: "low",
      });
    }
  });

  return gaps;
}

// ── Reference formatter (APA-style) ───────────────────────────
function formatReference(r: Resource, idx: number): string {
  const year = new Date(r.createdAt).getFullYear();
  const author = r.contributor || "너트유니온";
  return `[${idx + 1}] ${author} (${year}). ${r.title}.`;
}

export function UnifiedTabView({
  groupId,
  groupName,
  isHost = false,
}: {
  groupId: string;
  groupName: string;
  isHost?: boolean;
  groupId2?: string;
}) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTOC, setShowTOC] = useState(true);
  const [showRefs, setShowRefs] = useState(true);
  const [showGaps, setShowGaps] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [aiGapLoading, setAiGapLoading] = useState(false);
  const [aiGapSuggestions, setAiGapSuggestions] = useState<string[]>([]);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // 1. Topics
      const { data: topics } = await supabase
        .from("wiki_topics")
        .select("id, name, description, created_at")
        .eq("group_id", groupId)
        .order("created_at");

      if (!topics || topics.length === 0) {
        setLoading(false);
        return;
      }

      const topicIds = topics.map(t => t.id);

      // 2. Pages
      const { data: pages } = await supabase
        .from("wiki_pages")
        .select("id, title, content, version, updated_at, topic_id, last_updated_by, author:profiles!wiki_pages_last_updated_by_fkey(nickname)")
        .in("topic_id", topicIds)
        .order("created_at");

      const pageIds = (pages || []).map(p => p.id);

      // 3. Meeting links
      let meetingLinksData: any[] = [];
      if (pageIds.length > 0) {
        const { data: links } = await supabase
          .from("wiki_meeting_links")
          .select("page_id, meeting:meetings(id, title, scheduled_at)")
          .in("page_id", pageIds);
        meetingLinksData = links || [];
      }

      // 4. Contributions
      let contribData: any[] = [];
      if (pageIds.length > 0) {
        const { data: contribs } = await supabase
          .from("wiki_contributions")
          .select("page_id, user_id")
          .in("page_id", pageIds);
        contribData = contribs || [];
      }

      // 5. Shared resources (wiki_weekly_resources) — curated only (논문·자료)
      const { data: resources } = await supabase
        .from("wiki_weekly_resources")
        .select("id, title, url, type, summary, contributor:profiles!wiki_weekly_resources_added_by_fkey(nickname), created_at, topic_id")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      const resourceList: Resource[] = (resources || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        type: r.type || "link",
        summary: r.summary || null,
        contributor: r.contributor?.nickname || null,
        createdAt: r.created_at,
      }));

      setAllResources(resourceList);

      // Build sections
      const builtSections: Section[] = topics.map(topic => {
        const topicPages = (pages || [])
          .filter(p => p.topic_id === topic.id)
          .map(p => ({
            id: p.id,
            title: p.title,
            content: p.content,
            version: p.version,
            updatedAt: p.updated_at,
            updatedBy: (p as any).author?.nickname || null,
          }));

        const topicPageIds = topicPages.map(p => p.id);
        const topicMeetingLinks = meetingLinksData
          .filter(l => topicPageIds.includes(l.page_id) && l.meeting)
          .map(l => ({
            meetingId: l.meeting.id,
            meetingTitle: l.meeting.title,
            date: l.meeting.scheduled_at,
          }));

        const topicContribs = contribData.filter(c => topicPageIds.includes(c.page_id));
        const uniqueContributors = new Set(topicContribs.map(c => c.user_id));
        const totalVersions = topicPages.reduce((sum, p) => sum + p.version, 0);

        // Resources tagged to this topic
        const topicResources = resourceList.filter((r: any) =>
          (resources || []).find((raw: any) => raw.id === r.id && raw.topic_id === topic.id)
        );

        return {
          topicId: topic.id,
          topicName: topic.name,
          description: topic.description,
          pages: topicPages,
          meetingLinks: topicMeetingLinks,
          contributorCount: uniqueContributors.size,
          totalVersions,
          resources: topicResources,
        };
      });

      setSections(builtSections);
      setLoading(false);
    }
    load();
  }, [groupId]);

  // Compute gaps
  const gaps = useMemo(() => analyzeGaps(sections), [sections]);

  // Progress
  const progress = useMemo(() => {
    if (sections.length === 0) return { completion: 0, totalWords: 0, totalSections: 0, activeSections: 0 };
    const totalWords = sections.reduce((sum, s) =>
      sum + s.pages.reduce((psum, p) => psum + wordCount(p.content), 0), 0);
    const activeSections = sections.filter(s => s.pages.length > 0).length;
    const completion = Math.round((activeSections / Math.max(sections.length, 1)) * 70 +
      Math.min(totalWords / 500, 30));
    return { completion: Math.min(completion, 100), totalWords, totalSections: sections.length, activeSections };
  }, [sections]);

  // Backlink map
  const backlinkMap = useMemo(() => {
    const map: { keyword: string; url: string; type: "section" | "page" }[] = [];
    sections.forEach(s => {
      if (s.topicName.length >= 3)
        map.push({ keyword: s.topicName, url: `#section-${s.topicId}`, type: "section" });
      s.pages.forEach(p => {
        if (p.title.length >= 3)
          map.push({ keyword: p.title, url: `/groups/${groupId}/wiki/pages/${p.id}`, type: "page" });
      });
    });
    return map.sort((a, b) => b.keyword.length - a.keyword.length);
  }, [sections, groupId]);

  const applyBacklinks = (html: string, currentPageId?: string): string => {
    let result = html;
    for (const link of backlinkMap) {
      if (currentPageId && link.url.includes(currentPageId)) continue;
      const escapedKeyword = link.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(?<![<\\/\\w])(?<!href=")${escapedKeyword}(?![\\w>])`, "g");
      let replaced = false;
      result = result.replace(regex, (match) => {
        if (replaced) return match;
        replaced = true;
        const color = link.type === "section" ? "text-nu-pink" : "text-nu-blue";
        return `<a href="${link.url}" class="${color} no-underline hover:underline font-medium">${match}</a>`;
      });
    }
    return result;
  };

  const renderMarkdown = (md: string, currentPageId?: string) => {
    const escaped = md
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let html = escaped
      .replace(/### (.+)/g, '<h4 class="font-head text-sm font-bold mt-5 mb-2 text-nu-ink">$1</h4>')
      .replace(/## (.+)/g, '<h3 class="font-head text-base font-extrabold mt-6 mb-3 text-nu-ink">$1</h3>')
      .replace(/# (.+)/g, '<h2 class="font-head text-lg font-extrabold mt-8 mb-4 text-nu-ink">$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-nu-cream/50 px-1 py-0.5 text-nu-pink font-mono-nu text-xs border border-nu-ink/10">$1</code>')
      .replace(/^- (.+)/gm, '<li class="ml-4 list-disc text-sm leading-relaxed">$1</li>')
      .replace(/^\d+\. (.+)/gm, '<li class="ml-4 list-decimal text-sm leading-relaxed">$1</li>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-nu-blue hover:text-nu-pink underline" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
    html = applyBacklinks(html, currentPageId);
    return html;
  };

  const scrollToSection = (topicId: string) => {
    sectionRefs.current[topicId]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(topicId);
  };

  // AI gap analysis call
  async function requestAiGapAnalysis() {
    setAiGapLoading(true);
    try {
      const summary = sections.map(s => ({
        section: s.topicName,
        pages: s.pages.length,
        words: s.pages.reduce((sum, p) => sum + wordCount(p.content), 0),
        meetings: s.meetingLinks.length,
        resources: s.resources.length,
      }));
      const res = await fetch("/api/ai/wiki-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `아래는 너트유니온 그룹 "${groupName}"의 위키 섹션 현황입니다. 부족하거나 더 연구해야 할 주제 5가지를 한 문장씩 제안해주세요. 각 제안은 "- "로 시작하세요.\n\n${JSON.stringify(summary, null, 2)}`,
          groupId,
        }),
      });
      const data = await res.json();
      const text: string = data.result || data.content || "";
      const lines = text.split("\n").filter((l: string) => l.trim().startsWith("-")).map((l: string) => l.replace(/^-\s*/, "").trim());
      setAiGapSuggestions(lines.slice(0, 5));
    } catch {
      setAiGapSuggestions(["AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요."]);
    } finally {
      setAiGapLoading(false);
    }
  }

  const URGENCY_COLOR = {
    high: "border-l-[4px] border-red-400 bg-red-50",
    medium: "border-l-[4px] border-nu-amber bg-nu-amber/5",
    low: "border-l-[4px] border-nu-blue/50 bg-nu-blue/5",
  };

  const ACTION_ICON = {
    meeting: Calendar,
    discussion: MessageSquare,
    research: Microscope,
  };

  const ACTION_LABEL = {
    meeting: "회의 만들기",
    discussion: "토론 게시",
    research: "자료 조사",
  };

  if (loading) {
    return (
      <div className="bg-white border-[2px] border-nu-ink p-12 text-center">
        <Loader2 size={24} className="animate-spin text-nu-pink mx-auto mb-3" />
        <p className="text-sm text-nu-muted">통합 탭을 불러오고 있습니다...</p>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="bg-white border-[2px] border-nu-ink p-12 text-center">
        <BookOpen size={36} className="mx-auto mb-4 text-nu-ink/10" />
        <p className="text-sm font-bold text-nu-ink mb-2">아직 탭이 시작되지 않았습니다</p>
        <p className="text-xs text-nu-muted mb-4 max-w-md mx-auto leading-relaxed">
          주제(섹션)를 생성한 후 회의를 진행하면, AI가 회의록을 기반으로 탭을 작성합니다.
        </p>
      </div>
    );
  }

  const lastUpdated = sections
    .flatMap(s => s.pages)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

  const allContributors = [...new Set(
    sections.flatMap(s => s.pages.map(p => p.updatedBy)).filter(Boolean)
  )];

  const paperResources = allResources.filter(r => r.type === "paper" || r.type === "article" || r.url);

  return (
    <div className="space-y-0">

      {/* ══════════════════════════════════════════
          ACADEMIC PAPER HEADER
          ══════════════════════════════════════════ */}
      <div className="bg-white border-[2px] border-nu-ink">
        <div className="p-6 sm:p-10 border-b border-nu-ink/10 max-w-3xl mx-auto w-full">

          {/* Journal / Group label */}
          <div className="text-center mb-6">
            <p className="font-mono-nu text-[11px] text-nu-pink uppercase tracking-[0.4em] font-bold mb-1">
              {groupName} · Working Paper
            </p>
            <div className="h-px bg-nu-ink/10 w-24 mx-auto" />
          </div>

          {/* Paper Title */}
          <h1 className="font-head text-2xl sm:text-3xl font-extrabold text-nu-ink text-center leading-tight mb-4">
            통합 탭
          </h1>

          {/* Authors */}
          {allContributors.length > 0 && (
            <p className="text-center text-sm text-nu-muted mb-4">
              {allContributors.slice(0, 5).join(", ")}
              {allContributors.length > 5 && ` 외 ${allContributors.length - 5}명`}
            </p>
          )}

          {/* Date & Version */}
          <div className="flex items-center justify-center gap-4 font-mono-nu text-[11px] text-nu-muted mb-6">
            {lastUpdated && (
              <span>최종 수정: {new Date(lastUpdated.updatedAt).toLocaleDateString("ko", { year: "numeric", month: "long", day: "numeric" })}</span>
            )}
            <span>·</span>
            <span>{sections.filter(s => s.pages.length > 0).length}/{sections.length} 섹션</span>
            <span>·</span>
            <span>{Math.round(progress.totalWords / 500)}분 분량</span>
          </div>

          {/* Abstract — curated summary from top completed sections */}
          <div className="bg-nu-cream/40 border border-nu-ink/10 p-5">
            <p className="font-mono-nu text-[11px] text-nu-ink font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
              <Quote size={12} className="text-nu-pink" /> 요약 (Abstract)
            </p>
            {(() => {
              const filled = sections.filter(s => s.pages.length > 0 && wordCount(s.pages.map(p => p.content).join(" ")) >= 50);
              if (filled.length === 0) {
                return (
                  <p className="text-sm text-nu-muted italic">섹션 내용을 채우면 자동으로 요약이 생성됩니다.</p>
                );
              }
              return (
                <div className="space-y-2">
                  {filled.slice(0, 4).map(s => {
                    const combined = s.pages.map(p => p.content).join(" ");
                    const excerpt = extractExcerpt(combined, 120);
                    return (
                      <p key={s.topicId} className="text-sm text-nu-graphite leading-relaxed">
                        <span className="font-bold text-nu-ink">{s.topicName}:</span>{" "}
                        {excerpt}
                      </p>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">문서 완성도</span>
              <span className="font-mono-nu text-[12px] font-bold text-nu-pink">{progress.completion}%</span>
            </div>
            <div className="w-full h-2 bg-nu-ink/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-nu-pink via-purple-500 to-nu-blue rounded-full transition-all duration-1000"
                style={{ width: `${progress.completion}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Table of Contents ── */}
        <div className="border-b border-nu-ink/10">
          <button
            onClick={() => setShowTOC(!showTOC)}
            className="w-full px-6 sm:px-10 py-3 flex items-center justify-between hover:bg-nu-cream/30 transition-colors"
          >
            <span className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
              <List size={13} /> 목차 ({sections.length}개 섹션)
            </span>
            {showTOC ? <ChevronUp size={14} className="text-nu-muted" /> : <ChevronDown size={14} className="text-nu-muted" />}
          </button>

          {showTOC && (
            <div className="px-6 sm:px-10 pb-4">
              <nav className="max-w-3xl mx-auto">
                <ol className="space-y-0.5">
                  {sections.map((section, i) => {
                    const hasContent = section.pages.length > 0;
                    const wc = section.pages.reduce((sum, p) => sum + wordCount(p.content), 0);
                    return (
                      <li key={section.topicId}>
                        <button
                          onClick={() => scrollToSection(section.topicId)}
                          className={`w-full text-left flex items-center gap-3 px-3 py-2 transition-colors ${
                            activeSection === section.topicId
                              ? "bg-nu-pink/10 text-nu-pink"
                              : "hover:bg-nu-cream/50 text-nu-ink"
                          }`}
                        >
                          <span className="font-mono-nu text-[12px] text-nu-muted w-6 shrink-0 font-bold">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className={`text-sm font-medium flex-1 ${!hasContent ? "text-nu-muted/50" : ""}`}>
                            {section.topicName}
                          </span>
                          {hasContent ? (
                            <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-1.5">
                              {wc > 200 ? (
                                <CheckCircle2 size={10} className="text-green-500" />
                              ) : (
                                <AlertCircle size={10} className="text-nu-amber" />
                              )}
                              {wc}자
                            </span>
                          ) : (
                            <span className="font-mono-nu text-[10px] text-red-400 flex items-center gap-1">
                              <XCircle size={10} /> 미작성
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </div>
          )}
        </div>

        {/* ── Document Body (Paper format) ── */}
        <div className="px-6 sm:px-10 py-10">
          <div className="max-w-7xl mx-auto flex gap-0">

            {/* Main content */}
            <div className="flex-1 min-w-0 max-w-3xl mx-auto space-y-16">
              {sections.map((section, sectionIdx) => {
                const wc = section.pages.reduce((sum, p) => sum + wordCount(p.content), 0);
                const isWeak = section.pages.length > 0 && wc < 150;
                const isEmpty = section.pages.length === 0;

                return (
                  <section
                    key={section.topicId}
                    id={`section-${section.topicId}`}
                    ref={(el) => { sectionRefs.current[section.topicId] = el; }}
                    className="scroll-mt-24"
                  >
                    {/* Section header — academic style */}
                    <div className="flex items-start gap-4 mb-5 pb-4 border-b-[2px] border-nu-ink/10">
                      <span className="font-mono-nu text-[14px] text-nu-muted/40 mt-0.5 w-8 shrink-0 font-bold">
                        {String(sectionIdx + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <h2 className="font-head text-xl font-extrabold text-nu-ink">
                            {section.topicName}
                          </h2>
                          <div className="flex items-center gap-2 shrink-0">
                            {isEmpty && (
                              <span className="font-mono-nu text-[10px] px-2 py-0.5 bg-red-50 text-red-500 border border-red-200">
                                미작성
                              </span>
                            )}
                            {isWeak && !isEmpty && (
                              <span className="font-mono-nu text-[10px] px-2 py-0.5 bg-nu-amber/10 text-nu-amber border border-nu-amber/30">
                                내용 부족
                              </span>
                            )}
                            {!isEmpty && !isWeak && (
                              <span className="font-mono-nu text-[10px] px-2 py-0.5 bg-green-50 text-green-600 border border-green-200">
                                ✓ 충분
                              </span>
                            )}
                            {section.pages.length > 0 && (
                              <Link
                                href={`/groups/${groupId}/wiki/topics/${section.topicId}`}
                                className="flex items-center gap-1 font-mono-nu text-[10px] text-nu-pink no-underline hover:underline"
                              >
                                <Edit3 size={9} /> 편집
                              </Link>
                            )}
                          </div>
                        </div>
                        {section.description && (
                          <p className="text-xs text-nu-muted mt-1 leading-relaxed">{section.description}</p>
                        )}
                        {/* Section meta */}
                        <div className="flex items-center gap-3 mt-2 font-mono-nu text-[10px] text-nu-muted flex-wrap">
                          {section.pages.length > 0 && (
                            <span className="flex items-center gap-1">
                              <FileText size={9} /> {section.pages.length}p
                            </span>
                          )}
                          {section.contributorCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Users size={9} /> {section.contributorCount}명 기여
                            </span>
                          )}
                          {section.meetingLinks.length > 0 && (
                            <span className="flex items-center gap-1 text-nu-blue">
                              <Calendar size={9} /> {section.meetingLinks.length}회 회의
                            </span>
                          )}
                          {section.resources.length > 0 && (
                            <span className="flex items-center gap-1 text-green-600">
                              <Link2 size={9} /> 참고 {section.resources.length}건
                            </span>
                          )}
                          {wc > 0 && (
                            <span className="text-nu-muted/50">{wc}자</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Content — curated summary view, NOT raw dump */}
                    {section.pages.length > 0 ? (
                      <div className="space-y-5 pl-12">
                        {(() => {
                          // Merge all pages into one body for excerpt + bullet points
                          const combinedHtml = section.pages.map(p => p.content).join("\n\n");
                          const excerpt = extractExcerpt(combinedHtml, 300);
                          const bullets = extractBulletPoints(combinedHtml, 3);
                          const lastPage = section.pages[section.pages.length - 1];
                          return (
                            <article className="relative">
                              {/* Excerpt */}
                              <p className="text-[14px] text-nu-graphite leading-relaxed">{excerpt}</p>

                              {/* Key points (bullet list from content) */}
                              {bullets.length > 0 && (
                                <ul className="mt-3 space-y-1.5 border-l-[3px] border-nu-pink/20 pl-4">
                                  {bullets.map((b, bi) => (
                                    <li key={bi} className="text-[13px] text-nu-graphite flex items-start gap-2">
                                      <span className="text-nu-pink mt-0.5 shrink-0">▸</span>
                                      <span>{b}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}

                              {/* Page list (if multiple pages) */}
                              {section.pages.length > 1 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {section.pages.map(p => (
                                    <Link
                                      key={p.id}
                                      href={`/groups/${groupId}/wiki/pages/${p.id}`}
                                      className="inline-flex items-center gap-1 font-mono-nu text-[10px] text-nu-blue border border-nu-blue/20 px-2 py-1 no-underline hover:bg-nu-blue/10 transition-colors"
                                    >
                                      <FileText size={9} /> {p.title}
                                    </Link>
                                  ))}
                                </div>
                              )}

                              {/* Read more + author */}
                              <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                                {lastPage.updatedBy && (
                                  <span className="font-mono-nu text-[10px] text-nu-muted/50">
                                    최근 수정: {lastPage.updatedBy} · {new Date(lastPage.updatedAt).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                                  </span>
                                )}
                                <Link
                                  href={`/groups/${groupId}/wiki/topics/${section.topicId}`}
                                  className="inline-flex items-center gap-1.5 font-mono-nu text-[11px] font-bold text-nu-pink no-underline hover:underline"
                                >
                                  전체 내용 읽기 <ArrowRight size={10} />
                                </Link>
                              </div>
                            </article>
                          );
                        })()}

                        {/* Section references */}
                        {section.resources.length > 0 && (
                          <div className="pl-0 pt-4 border-t border-nu-ink/[0.06]">
                            <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mb-2 flex items-center gap-1">
                              <Link2 size={9} /> 이 섹션 참고자료
                            </p>
                            <ul className="space-y-1">
                              {section.resources.map((r, ri) => (
                                <li key={r.id} className="flex items-start gap-2 text-[12px] text-nu-muted">
                                  <span className="font-mono-nu text-[10px] text-nu-muted/40 shrink-0 mt-0.5">[{ri + 1}]</span>
                                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                                    className="text-nu-blue hover:underline no-underline line-clamp-1 flex-1">
                                    {r.title}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Gap CTA inside section if weak */}
                        {isWeak && (
                          <div className="pl-0 py-3 px-4 bg-nu-amber/5 border border-nu-amber/20 flex items-start gap-3">
                            <AlertCircle size={14} className="text-nu-amber shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] text-nu-graphite font-medium mb-2">
                                이 섹션은 내용이 부족합니다 ({wc}자 / 150자 이상 권장)
                              </p>
                              <div className="flex gap-2 flex-wrap">
                                <Link
                                  href={`/groups/${groupId}/meetings/create?title=${encodeURIComponent(`${section.topicName} 심층 논의`)}&topic=${encodeURIComponent(section.topicName)}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nu-ink text-white font-mono-nu text-[10px] uppercase tracking-widest font-bold hover:bg-nu-pink transition-colors no-underline"
                                >
                                  <Calendar size={10} /> 회의 만들기
                                </Link>
                                <Link
                                  href={`/groups/${groupId}/wiki/topics/${section.topicId}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border-[2px] border-nu-ink/15 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink hover:border-nu-ink transition-colors no-underline"
                                >
                                  <Edit3 size={10} /> 직접 작성
                                </Link>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Empty section — strong CTA */
                      <div className="pl-12">
                        <div className="py-8 px-6 border-[2px] border-dashed border-red-200 bg-red-50/30 text-center">
                          <XCircle size={24} className="mx-auto mb-3 text-red-300" />
                          <p className="text-sm font-bold text-nu-ink mb-1">이 섹션이 아직 시작되지 않았습니다</p>
                          <p className="text-xs text-nu-muted mb-4 max-w-xs mx-auto">
                            회의를 통해 논의하거나 직접 작성을 시작하면 통합 탭이 완성에 가까워집니다
                          </p>
                          <div className="flex gap-2 justify-center flex-wrap">
                            <Link
                              href={`/groups/${groupId}/meetings/create?title=${encodeURIComponent(`${section.topicName} 회의`)}&topic=${encodeURIComponent(section.topicName)}`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold hover:bg-nu-ink transition-colors no-underline"
                            >
                              <Calendar size={12} /> 회의 만들기
                            </Link>
                            <Link
                              href={`/groups/${groupId}/wiki/topics/${section.topicId}`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 border-[2px] border-nu-ink font-mono-nu text-[11px] uppercase tracking-widest font-bold hover:bg-nu-cream transition-colors no-underline text-nu-ink"
                            >
                              <Edit3 size={12} /> 직접 작성
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Meeting links for this section */}
                    {section.meetingLinks.length > 0 && (
                      <div className="pl-12 mt-4">
                        <div className="flex flex-wrap gap-2">
                          {section.meetingLinks.slice(0, 3).map(m => (
                            <Link
                              key={m.meetingId}
                              href={`/groups/${groupId}/meetings/${m.meetingId}`}
                              className="inline-flex items-center gap-1.5 font-mono-nu text-[10px] px-2 py-1 bg-nu-blue/10 text-nu-blue border border-nu-blue/20 no-underline hover:bg-nu-blue/20 transition-colors"
                            >
                              <Calendar size={9} />
                              {m.meetingTitle.length > 20 ? m.meetingTitle.slice(0, 20) + "…" : m.meetingTitle}
                              <span className="text-nu-blue/50">
                                {new Date(m.date).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>

            {/* Floating TOC */}
            {sections.length > 1 && (
              <aside className="hidden xl:block sticky top-24 self-start w-52 shrink-0 ml-8">
                <div className="border-[3px] border-nu-ink bg-white shadow-[6px_6px_0px_0px_rgba(13,13,13,1)]">
                  <div className="px-4 py-3 border-b-[2px] border-nu-ink bg-nu-cream/30">
                    <span className="font-head text-xs font-extrabold uppercase tracking-widest text-nu-ink flex items-center gap-2">
                      <List size={13} /> 목차
                    </span>
                  </div>
                  <nav className="px-3 py-3 space-y-0.5 max-h-[55vh] overflow-y-auto scrollbar-hide">
                    {sections.map((s, i) => {
                      const isActive = activeSection === s.topicId;
                      const hasContent = s.pages.length > 0;
                      const wc = s.pages.reduce((sum, p) => sum + wordCount(p.content), 0);
                      return (
                        <button
                          key={s.topicId}
                          onClick={() => scrollToSection(s.topicId)}
                          className={`w-full text-left block transition-all duration-150 px-2 py-1.5 rounded-sm ${
                            isActive
                              ? "bg-nu-pink/10 text-nu-pink font-bold border-l-[3px] border-nu-pink -ml-[1px]"
                              : hasContent
                              ? "text-nu-graphite hover:text-nu-ink hover:bg-nu-cream/40"
                              : "text-nu-muted/40 hover:text-nu-muted/60"
                          }`}
                        >
                          <span className="font-head text-[11px] leading-snug block truncate">
                            <span className="font-mono-nu text-[10px] text-nu-muted/50 mr-1.5">{String(i + 1).padStart(2, "0")}</span>
                            {s.topicName}
                          </span>
                          <span className={`font-mono-nu text-[9px] block mt-0.5 pl-5 flex items-center gap-1 ${
                            !hasContent ? "text-red-400" : wc < 150 ? "text-nu-amber" : "text-green-600"
                          }`}>
                            {!hasContent ? "미작성" : wc < 150 ? `${wc}자 (부족)` : `${wc}자`}
                          </span>
                        </button>
                      );
                    })}
                  </nav>
                  <div className="px-4 py-2 border-t border-nu-ink/10 bg-nu-cream/20">
                    <p className="font-mono-nu text-[10px] text-nu-muted">
                      {sections.filter(s => s.pages.length > 0).length}/{sections.length} 작성됨
                    </p>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            REFERENCES (Bibliography)
            논문 형식 참고문헌 목록
            ══════════════════════════════════════════ */}
        {paperResources.length > 0 && (
          <div className="border-t-[2px] border-nu-ink/10">
            <button
              onClick={() => setShowRefs(!showRefs)}
              className="w-full px-6 sm:px-10 py-4 flex items-center justify-between hover:bg-nu-cream/20 transition-colors"
            >
              <h3 className="font-head text-base font-extrabold text-nu-ink flex items-center gap-2">
                <BookOpen size={16} className="text-nu-blue" />
                참고문헌 (References)
                <span className="font-mono-nu text-[11px] text-nu-muted font-normal">({paperResources.length}건)</span>
              </h3>
              {showRefs ? <ChevronUp size={14} className="text-nu-muted" /> : <ChevronDown size={14} className="text-nu-muted" />}
            </button>

            {showRefs && (
              <div className="px-6 sm:px-10 pb-8 max-w-3xl mx-auto">
                <ol className="space-y-3">
                  {paperResources.map((r, idx) => (
                    <li key={r.id} className="flex gap-3 text-sm">
                      <span className="font-mono-nu text-[11px] text-nu-muted shrink-0 mt-0.5 w-7">[{idx + 1}]</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-nu-blue hover:underline no-underline font-medium flex-1"
                          >
                            {r.title}
                          </a>
                          <span className={`font-mono-nu text-[10px] px-1.5 py-0.5 shrink-0 ${
                            r.type === "paper"
                              ? "bg-purple-50 text-purple-600 border border-purple-200"
                              : r.type === "article"
                              ? "bg-nu-blue/10 text-nu-blue border border-nu-blue/20"
                              : "bg-nu-cream text-nu-muted border border-nu-ink/10"
                          }`}>
                            {r.type}
                          </span>
                        </div>
                        <p className="font-mono-nu text-[10px] text-nu-muted mt-0.5">
                          {r.contributor && `${r.contributor} 공유 · `}
                          {new Date(r.createdAt).getFullYear()}
                        </p>
                        {r.summary && (
                          <p className="text-[12px] text-nu-muted mt-1 leading-relaxed line-clamp-2">{r.summary}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          GAP ANALYSIS PANEL
          부족하거나 더 알아봐야 하는 것 제안
          ══════════════════════════════════════════ */}
      <div className="bg-nu-ink text-white border-[2px] border-nu-ink mt-6 overflow-hidden">
        <button
          onClick={() => setShowGaps(!showGaps)}
          className="w-full px-6 sm:px-8 py-5 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-nu-pink flex items-center justify-center shrink-0">
              <Microscope size={16} className="text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-head text-base font-extrabold text-white">
                연구 공백 분석 (Gap Analysis)
              </h3>
              <p className="font-mono-nu text-[11px] text-white/40 mt-0.5">
                부족하거나 더 다뤄야 할 내용 · 회의/토론으로 해결하세요
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {gaps.length > 0 && (
              <span className="font-mono-nu text-[11px] px-2 py-0.5 bg-nu-pink text-white font-bold">
                {gaps.length}건
              </span>
            )}
            {showGaps ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
          </div>
        </button>

        {showGaps && (
          <div className="px-6 sm:px-8 pb-8">
            {/* Auto-detected gaps */}
            {gaps.length > 0 ? (
              <div className="space-y-3 mb-6">
                {gaps.map((gap, i) => {
                  const ActionIcon = ACTION_ICON[gap.suggestedAction];
                  return (
                    <div key={i} className={`bg-white/5 p-4 border-l-[4px] ${
                      gap.urgency === "high" ? "border-red-400" :
                      gap.urgency === "medium" ? "border-nu-amber" : "border-nu-blue"
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 mt-0.5 px-2 py-0.5 font-mono-nu text-[10px] font-bold ${
                          gap.urgency === "high" ? "bg-red-400/20 text-red-300" :
                          gap.urgency === "medium" ? "bg-nu-amber/20 text-nu-amber" : "bg-nu-blue/20 text-nu-blue"
                        }`}>
                          {gap.urgency === "high" ? "긴급" : gap.urgency === "medium" ? "보완 필요" : "권장"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/80 leading-relaxed mb-3">{gap.description}</p>
                          <div className="flex gap-2 flex-wrap">
                            {gap.suggestedAction === "meeting" && gap.topicId && (
                              <Link
                                href={`/groups/${groupId}/meetings/create?title=${encodeURIComponent(`${gap.sectionName} 심층 논의`)}&topic=${encodeURIComponent(gap.sectionName)}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest font-bold no-underline hover:bg-white hover:text-nu-ink transition-colors"
                              >
                                <Calendar size={10} /> 회의 만들기
                              </Link>
                            )}
                            {gap.suggestedAction === "research" && (
                              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nu-blue/20 text-nu-blue border border-nu-blue/30 font-mono-nu text-[10px] uppercase tracking-widest font-bold hover:bg-nu-blue hover:text-white transition-colors">
                                <Search size={10} /> 자료 조사 시작
                              </button>
                            )}
                            {gap.topicId && (
                              <Link
                                href={`/groups/${groupId}/wiki/topics/${gap.topicId}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/15 text-white/50 font-mono-nu text-[10px] uppercase tracking-widest hover:text-white hover:border-white/40 transition-colors no-underline"
                              >
                                <Edit3 size={10} /> 직접 작성
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 mb-6">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-green-400" />
                <p className="text-sm text-white/50">모든 섹션이 충분한 내용을 갖추고 있습니다</p>
              </div>
            )}

            {/* AI-powered gap suggestions */}
            <div className="border-t border-white/10 pt-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h4 className="font-head text-sm font-extrabold text-white flex items-center gap-2">
                    <Brain size={15} className="text-nu-pink" /> AI 심층 갭 분석
                  </h4>
                  <p className="font-mono-nu text-[11px] text-white/30 mt-0.5">
                    현재 내용을 분석해 추가로 다뤄야 할 주제를 제안합니다
                  </p>
                </div>
                <button
                  onClick={requestAiGapAnalysis}
                  disabled={aiGapLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold hover:bg-white hover:text-nu-ink transition-colors disabled:opacity-50 shrink-0"
                >
                  {aiGapLoading ? (
                    <><Loader2 size={12} className="animate-spin" /> 분석 중...</>
                  ) : (
                    <><Sparkles size={12} /> AI 분석 실행</>
                  )}
                </button>
              </div>

              {aiGapSuggestions.length > 0 && (
                <div className="space-y-3">
                  {aiGapSuggestions.map((suggestion, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 bg-nu-pink/10 border border-nu-pink/20">
                      <Lightbulb size={14} className="text-nu-pink shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 leading-relaxed mb-2">{suggestion}</p>
                        <div className="flex gap-2 flex-wrap">
                          <Link
                            href={`/groups/${groupId}/meetings/create?title=${encodeURIComponent(suggestion.slice(0, 40))}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest font-bold no-underline hover:bg-white hover:text-nu-ink transition-colors"
                          >
                            <Calendar size={10} /> 회의 만들기
                          </Link>
                          <Link
                            href={`/groups/${groupId}/meetings/create?title=${encodeURIComponent(`토론: ${suggestion.slice(0, 30)}`)}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/20 text-white/60 font-mono-nu text-[10px] uppercase tracking-widest hover:text-white hover:border-white/40 transition-colors no-underline"
                          >
                            <MessageSquare size={10} /> 토론 열기
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
