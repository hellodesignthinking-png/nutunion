"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  BookOpen, ChevronRight, Edit3, FileText, Brain,
  Calendar, Users, TrendingUp, Loader2, Clock,
  List, ChevronDown, ChevronUp, ExternalLink,
  Sparkles, ArrowRight, GitBranch, Hash,
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";

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
  meetingLinks: { meetingTitle: string; date: string }[];
  contributorCount: number;
  totalVersions: number;
}

interface MeetingLog {
  id: string;
  title: string;
  scheduledAt: string;
  summary: string | null;
  linkedSections: string[];
}

export function UnifiedTabView({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [meetings, setMeetings] = useState<MeetingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTOC, setShowTOC] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // 1. Fetch all topics (= sections) ordered by creation
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

      // 2. Fetch all pages for these topics
      const { data: pages } = await supabase
        .from("wiki_pages")
        .select("id, title, content, version, updated_at, topic_id, last_updated_by, author:profiles!wiki_pages_last_updated_by_fkey(nickname)")
        .in("topic_id", topicIds)
        .order("created_at");

      // 3. Fetch meeting links
      const pageIds = (pages || []).map(p => p.id);
      let meetingLinksData: any[] = [];
      if (pageIds.length > 0) {
        const { data: links } = await supabase
          .from("wiki_meeting_links")
          .select("page_id, meeting:meetings(id, title, scheduled_at)")
          .in("page_id", pageIds);
        meetingLinksData = links || [];
      }

      // 4. Fetch contribution counts per topic
      let contribData: any[] = [];
      if (pageIds.length > 0) {
        const { data: contribs } = await supabase
          .from("wiki_contributions")
          .select("page_id, user_id")
          .in("page_id", pageIds);
        contribData = contribs || [];
      }

      // 5. Fetch recent meetings for timeline
      const { data: recentMeetings } = await supabase
        .from("meetings")
        .select("id, title, scheduled_at, summary")
        .eq("group_id", groupId)
        .eq("status", "completed")
        .order("scheduled_at", { ascending: false })
        .limit(10);

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
            meetingTitle: l.meeting.title,
            date: l.meeting.scheduled_at,
          }));

        const topicContribs = contribData.filter(c => topicPageIds.includes(c.page_id));
        const uniqueContributors = new Set(topicContribs.map(c => c.user_id));
        const totalVersions = topicPages.reduce((sum, p) => sum + p.version, 0);

        return {
          topicId: topic.id,
          topicName: topic.name,
          description: topic.description,
          pages: topicPages,
          meetingLinks: topicMeetingLinks,
          contributorCount: uniqueContributors.size,
          totalVersions,
        };
      });

      // Build meetings timeline with linked sections
      const meetingLogs: MeetingLog[] = (recentMeetings || []).map(m => {
        const linkedPageIds = meetingLinksData
          .filter(l => l.meeting?.id === m.id)
          .map(l => l.page_id);
        const linkedTopicIds = (pages || [])
          .filter(p => linkedPageIds.includes(p.id))
          .map(p => p.topic_id);
        const linkedSections = topics
          .filter(t => linkedTopicIds.includes(t.id))
          .map(t => t.name);

        return {
          id: m.id,
          title: m.title,
          scheduledAt: m.scheduled_at,
          summary: m.summary,
          linkedSections,
        };
      });

      setSections(builtSections);
      setMeetings(meetingLogs);
      setLoading(false);
    }
    load();
  }, [groupId]);

  // Calculate overall progress
  const progress = useMemo(() => {
    if (sections.length === 0) return { completion: 0, totalWords: 0, totalSections: 0, activeSections: 0 };
    const totalWords = sections.reduce((sum, s) =>
      sum + s.pages.reduce((psum, p) => psum + p.content.length, 0), 0);
    const activeSections = sections.filter(s => s.pages.length > 0).length;
    const avgDepth = sections.length > 0
      ? sections.reduce((sum, s) => sum + Math.min(s.totalVersions / 3, 1), 0) / sections.length
      : 0;
    const completion = Math.round(
      (activeSections / Math.max(sections.length, 1)) * 60 + avgDepth * 40
    );
    return { completion: Math.min(completion, 100), totalWords, totalSections: sections.length, activeSections };
  }, [sections]);

  // Build backlink map for smart linking
  const backlinkMap = useMemo(() => {
    const map: { keyword: string; url: string; type: "section" | "page" }[] = [];
    sections.forEach(s => {
      // Don't link section names shorter than 3 chars (too generic)
      if (s.topicName.length >= 3) {
        map.push({ keyword: s.topicName, url: `#section-${s.topicId}`, type: "section" });
      }
      s.pages.forEach(p => {
        if (p.title.length >= 3) {
          map.push({ keyword: p.title, url: `/groups/${groupId}/wiki/pages/${p.id}`, type: "page" });
        }
      });
    });
    // Sort by keyword length descending so longer matches take priority
    return map.sort((a, b) => b.keyword.length - a.keyword.length);
  }, [sections, groupId]);

  // Apply smart backlinks to text
  const applyBacklinks = (html: string, currentPageId?: string): string => {
    let result = html;
    for (const link of backlinkMap) {
      // Skip self-references
      if (currentPageId && link.url.includes(currentPageId)) continue;
      // Only replace in text content (not inside tags or existing links)
      const escapedKeyword = link.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(?<![<\\/\\w])(?<!href=")${escapedKeyword}(?![\\w>])`, "g");
      // Only replace first occurrence to avoid cluttering
      let replaced = false;
      result = result.replace(regex, (match) => {
        if (replaced) return match;
        replaced = true;
        const color = link.type === "section" ? "text-nu-pink" : "text-nu-blue";
        return `<a href="${link.url}" class="${color} no-underline hover:underline font-medium" title="${link.type === "section" ? "섹션" : "페이지"}: ${link.keyword}">${match}</a>`;
      });
    }
    return result;
  };

  // Markdown to HTML with smart backlinks
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
    // Apply smart backlinks
    html = applyBacklinks(html, currentPageId);
    return html;
  };

  const scrollToSection = (topicId: string) => {
    sectionRefs.current[topicId]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(topicId);
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
          매주 회의와 자료가 쌓이면서 하나의 완성된 문서로 성장합니다.
        </p>
      </div>
    );
  }

  const lastUpdated = sections
    .flatMap(s => s.pages)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

  return (
    <div className="space-y-0">
      {/* ── Document Header ─────────────────────────── */}
      <div className="bg-white border-[2px] border-nu-ink">
        <div className="p-6 sm:p-8 border-b border-nu-ink/10">
          {/* Title block */}
          <div className="max-w-3xl mx-auto text-center">
            <p className="font-mono-nu text-[9px] text-nu-pink uppercase tracking-[0.3em] font-bold mb-3">
              {groupName} · Living Document
            </p>
            <h1 className="font-head text-2xl sm:text-3xl font-extrabold text-nu-ink leading-tight mb-4">
              통합 탭
            </h1>
            <p className="text-sm text-nu-muted leading-relaxed max-w-lg mx-auto">
              매주 회의와 토론을 통해 성장하는 공유 문서입니다.
              팀의 모든 지식이 하나의 완성된 자료로 축적됩니다.
            </p>
          </div>

          {/* Progress & Meta */}
          <div className="max-w-3xl mx-auto mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest">완성도</span>
              <span className="font-mono-nu text-[10px] font-bold text-nu-pink">{progress.completion}%</span>
            </div>
            <div className="w-full h-2.5 bg-nu-ink/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-nu-pink via-purple-500 to-nu-blue rounded-full transition-all duration-1000"
                style={{ width: `${progress.completion}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 font-mono-nu text-[8px] text-nu-muted">
              <span>{progress.activeSections}/{progress.totalSections} 섹션 작성됨</span>
              <span>{Math.round(progress.totalWords / 500)}분 분량</span>
              {lastUpdated && (
                <span>최종 수정: {new Date(lastUpdated.updatedAt).toLocaleDateString("ko", { month: "short", day: "numeric" })}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Table of Contents ────────────────────── */}
        <div className="border-b border-nu-ink/10">
          <button
            onClick={() => setShowTOC(!showTOC)}
            className="w-full px-6 sm:px-8 py-3 flex items-center justify-between hover:bg-nu-cream/30 transition-colors"
          >
            <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink flex items-center gap-2">
              <List size={13} /> 목차 ({sections.length}개 섹션)
            </span>
            {showTOC ? <ChevronUp size={14} className="text-nu-muted" /> : <ChevronDown size={14} className="text-nu-muted" />}
          </button>

          {showTOC && (
            <div className="px-6 sm:px-8 pb-4">
              <nav className="max-w-3xl mx-auto">
                <ol className="space-y-1">
                  {sections.map((section, i) => {
                    const hasContent = section.pages.length > 0;
                    return (
                      <li key={section.topicId}>
                        <button
                          onClick={() => scrollToSection(section.topicId)}
                          className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-sm transition-colors ${
                            activeSection === section.topicId
                              ? "bg-nu-pink/10 text-nu-pink"
                              : "hover:bg-nu-cream/50 text-nu-ink"
                          }`}
                        >
                          <span className="font-mono-nu text-[10px] text-nu-muted w-6 shrink-0">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className={`text-sm font-medium flex-1 ${!hasContent ? "text-nu-muted/50" : ""}`}>
                            {section.topicName}
                          </span>
                          {hasContent ? (
                            <span className="font-mono-nu text-[8px] text-nu-muted">
                              v{Math.max(...section.pages.map(p => p.version))} · {section.pages.length}p
                            </span>
                          ) : (
                            <span className="font-mono-nu text-[8px] text-nu-muted/40 italic">미작성</span>
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

        {/* ── Document Body ──────────────────────── */}
        <div className="px-6 sm:px-8 py-8 relative">
          {/* Floating TOC for large screens */}
          {sections.length > 1 && (
            <nav className="hidden xl:block absolute right-8 top-8 w-44 sticky-toc" style={{ position: "sticky", top: "6rem", alignSelf: "flex-start" }}>
              <div className="border-l-2 border-nu-ink/10 pl-3 space-y-1">
                <p className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest mb-2">목차</p>
                {sections.map((s, i) => (
                  <button
                    key={s.topicId}
                    onClick={() => scrollToSection(s.topicId)}
                    className={`block w-full text-left font-mono-nu text-[9px] py-0.5 transition-colors truncate ${
                      activeSection === s.topicId
                        ? "text-nu-pink font-bold"
                        : s.pages.length > 0
                        ? "text-nu-muted hover:text-nu-ink"
                        : "text-nu-muted/30"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}. {s.topicName}
                  </button>
                ))}
              </div>
            </nav>
          )}
          <div className="max-w-3xl mx-auto space-y-12">
            {sections.map((section, sectionIdx) => (
              <section
                key={section.topicId}
                ref={(el) => { sectionRefs.current[section.topicId] = el; }}
                className="scroll-mt-24"
              >
                {/* Section header */}
                <div className="flex items-start gap-4 mb-4 pb-3 border-b-[2px] border-nu-ink/10">
                  <span className="font-mono-nu text-[11px] text-nu-muted/40 mt-1 w-8 shrink-0 font-bold">
                    {String(sectionIdx + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <h2 className="font-head text-xl font-extrabold text-nu-ink">
                      {section.topicName}
                    </h2>
                    {section.description && (
                      <p className="text-xs text-nu-muted mt-1 leading-relaxed">{section.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 font-mono-nu text-[8px] text-nu-muted flex-wrap">
                      {section.pages.length > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText size={9} /> {section.pages.length} 페이지
                        </span>
                      )}
                      {section.contributorCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Users size={9} /> {section.contributorCount}명 기여
                        </span>
                      )}
                      {section.meetingLinks.length > 0 && (
                        <span className="flex items-center gap-1 text-nu-blue">
                          <Calendar size={9} /> {section.meetingLinks.length}회 회의 반영
                        </span>
                      )}
                      {section.pages.length > 0 && (
                        <Link
                          href={`/groups/${groupId}/wiki/topics/${section.topicId}`}
                          className="flex items-center gap-0.5 text-nu-pink no-underline hover:underline ml-auto"
                        >
                          편집 <Edit3 size={8} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section content */}
                {section.pages.length > 0 ? (
                  <div className="space-y-6 pl-12">
                    {section.pages.map((page, pageIdx) => (
                      <article key={page.id} className="relative">
                        {section.pages.length > 1 && (
                          <div className="flex items-center gap-2 mb-3">
                            <Hash size={11} className="text-nu-muted/30" />
                            <Link
                              href={`/groups/${groupId}/wiki/pages/${page.id}`}
                              className="font-head text-sm font-bold text-nu-ink no-underline hover:text-nu-pink transition-colors"
                            >
                              {page.title}
                            </Link>
                            <span className="font-mono-nu text-[7px] text-nu-muted/40">v{page.version}</span>
                          </div>
                        )}
                        <div
                          className="prose prose-sm max-w-none text-nu-graphite leading-relaxed text-[14px]"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(renderMarkdown(page.content, page.id)),
                          }}
                        />
                        {page.updatedBy && (
                          <p className="font-mono-nu text-[7px] text-nu-muted/40 mt-3 text-right">
                            — {page.updatedBy}, {new Date(page.updatedAt).toLocaleDateString("ko", { year: "numeric", month: "short", day: "numeric" })}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="pl-12 py-6 border border-dashed border-nu-ink/10 bg-nu-cream/20 text-center">
                    <p className="text-xs text-nu-muted mb-1">이 섹션은 아직 작성되지 않았습니다</p>
                    <p className="font-mono-nu text-[8px] text-nu-muted/50">
                      회의에서 이 주제를 논의하면 AI가 자동으로 내용을 채웁니다
                    </p>
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>

        {/* ── Meeting Contributions Timeline ──────── */}
        {meetings.length > 0 && (
          <div className="border-t-[2px] border-nu-ink/10 px-6 sm:px-8 py-6 bg-nu-cream/20">
            <div className="max-w-3xl mx-auto">
              <h3 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink mb-4 flex items-center gap-2">
                <Calendar size={13} className="text-nu-blue" /> 회의 기반 성장 기록
              </h3>
              <div className="space-y-0">
                {meetings.slice(0, 5).map((m, i) => (
                  <div key={m.id} className="flex gap-3">
                    <div className="flex flex-col items-center w-5 shrink-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${i === 0 ? "bg-nu-blue" : "bg-nu-ink/15"}`} />
                      {i < Math.min(meetings.length, 5) - 1 && <div className="w-px flex-1 bg-nu-ink/10" />}
                    </div>
                    <div className="flex-1 pb-4 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-nu-ink truncate">{m.title}</span>
                        <span className="font-mono-nu text-[8px] text-nu-muted">
                          {new Date(m.scheduledAt).toLocaleDateString("ko", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      {m.linkedSections.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <ArrowRight size={8} className="text-nu-muted/40" />
                          {m.linkedSections.map((s, si) => (
                            <span key={si} className="font-mono-nu text-[8px] px-1.5 py-0.5 bg-nu-blue/10 text-nu-blue">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {m.summary && (
                        <p className="text-[10px] text-nu-muted mt-1 line-clamp-1">{m.summary}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
