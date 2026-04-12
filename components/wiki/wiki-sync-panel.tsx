"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles, Brain, CheckCircle2, HelpCircle,
  RefreshCw, Plus, Save, Loader2,
  GitBranch, ArrowRight, Zap, Tag, BookOpen
} from "lucide-react";
import { toast } from "sonner";

interface WikiSyncPanelProps {
  meetingId: string;
  groupId: string;
  meetingContent: string;
}

interface ExtractedData {
  entities: { name: string; isNew: boolean }[];
  decisions: string[];
  openQuestions: string[];
  wikiUpdates: { pageTitle: string; suggestion: string; action: "create" | "update" }[];
  suggestedTags: string[];
}

export function WikiSyncPanel({ meetingId, groupId, meetingContent }: WikiSyncPanelProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<"idle" | "extracting" | "reviewing" | "syncing" | "done">("idle");
  const [extractionSource, setExtractionSource] = useState<"ai" | "heuristic" | null>(null);

  const handleExtract = async () => {
    setPhase("extracting");
    setLoading(true);
    try {
      const supabase = createClient();

      // Get existing topics and pages to cross-reference
      const { data: topics } = await supabase
        .from("wiki_topics")
        .select("id, name")
        .eq("group_id", groupId);

      const topicIds = (topics || []).map(t => t.id);
      let existingPages: { id: string; title: string }[] = [];
      if (topicIds.length > 0) {
        const { data: pagesData } = await supabase
          .from("wiki_pages")
          .select("id, title")
          .in("topic_id", topicIds);
        existingPages = pagesData || [];
      }

      // ── Try Gemini AI extraction first ──
      let data: ExtractedData | null = null;
      try {
        const res = await fetch("/api/ai/wiki-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetingContent: meetingContent || "",
            existingTopics: (topics || []).map(t => t.name),
            existingPages: existingPages.map(p => p.title),
          }),
        });

        if (res.ok) {
          const aiResult = await res.json();
          data = {
            entities: aiResult.entities || [],
            decisions: aiResult.decisions || [],
            openQuestions: aiResult.openQuestions || [],
            wikiUpdates: aiResult.wikiUpdates || [],
            suggestedTags: aiResult.suggestedTags || [],
          };
          setExtractionSource("ai");
          toast.success("🤖 Gemini AI가 지식을 추출했습니다!");
        }
      } catch (aiErr) {
        console.warn("AI extraction failed, falling back to heuristic:", aiErr);
      }

      // ── Fallback: Heuristic NLP extraction ──
      if (!data || (data.entities.length === 0 && data.wikiUpdates.length === 0)) {
        const existingNames = new Set([
          ...(topics || []).map(t => t.name.toLowerCase()),
          ...existingPages.map(p => p.title.toLowerCase()),
        ]);

        const content = meetingContent || "";
        const lines = content.split("\n").filter(l => l.trim());

        // Pull out sentences that look like decisions
        const decisionKeywords = ["결정", "합의", "하기로", "의결", "진행하기로", "도입", "시작"];
        const decisions = lines
          .filter(l => decisionKeywords.some(k => l.includes(k)))
          .slice(0, 5);
        if (decisions.length === 0 && lines.length > 0) {
          decisions.push(lines[0]);
        }

        // Pull out questions
        const questionKeywords = ["?", "어떻게", "할 것인가", "필요한가", "가능한가", "해야", "고민"];
        const openQuestions = lines
          .filter(l => questionKeywords.some(k => l.includes(k)))
          .slice(0, 5);

        // Extract entity names
        const wordFreq: Record<string, number> = {};
        const words = content.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*|"[^"]+"|'[^']+'/g) || [];
        words.forEach(w => {
          const clean = w.replace(/["']/g, "").trim();
          if (clean.length > 2) wordFreq[clean] = (wordFreq[clean] || 0) + 1;
        });
        const koreanWords = content.match(/[가-힣]{3,}/g) || [];
        koreanWords.forEach(w => {
          if (w.length >= 3) wordFreq[w] = (wordFreq[w] || 0) + 1;
        });

        const entities = Object.entries(wordFreq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name]) => ({
            name,
            isNew: !existingNames.has(name.toLowerCase()),
          }));

        // Generate wiki update suggestions
        const wikiUpdates: ExtractedData["wikiUpdates"] = [];
        entities.filter(e => e.isNew).forEach(e => {
          wikiUpdates.push({
            pageTitle: e.name,
            suggestion: `미팅에서 등장한 새로운 개념 "${e.name}"에 대한 위키 문서를 생성합니다.`,
            action: "create",
          });
        });
        existingPages.forEach(p => {
          if (content.toLowerCase().includes(p.title.toLowerCase())) {
            wikiUpdates.push({
              pageTitle: p.title,
              suggestion: `이번 미팅에서 "${p.title}"와 관련된 논의가 있었습니다. 새로운 내용을 반영해주세요.`,
              action: "update",
            });
          }
        });

        // Extract tags
        const tagKeywords = content.match(/#[가-힣A-Za-z]+/g) || [];
        const suggestedTags = [...new Set(tagKeywords.map(t => t.slice(1)))].slice(0, 6);
        if (suggestedTags.length === 0 && topics) {
          topics.slice(0, 3).forEach(t => suggestedTags.push(t.name));
        }

        data = {
          entities: entities.length > 0 ? entities : [{ name: "미팅 내용", isNew: false }],
          decisions: decisions.length > 0 ? decisions : ["미팅 내용에서 명시적 결정 사항을 추출하지 못했습니다."],
          openQuestions: openQuestions.length > 0 ? openQuestions : ["미팅 내용에서 미결 질문을 추출하지 못했습니다."],
          wikiUpdates: wikiUpdates.length > 0 ? wikiUpdates : [{ pageTitle: "미팅 요약", suggestion: "이번 미팅의 핵심 내용을 위키에 기록합니다.", action: "create" }],
          suggestedTags: suggestedTags.length > 0 ? suggestedTags : ["미팅"],
        };

        setExtractionSource("heuristic");
        toast.info("⚙️ 휴리스틱 모드로 지식을 추출했습니다. (AI API 미연결)");
      }

      setExtractedData(data);
      setSelectedUpdates(new Set(data.wikiUpdates.map((_, i) => i)));
      setPhase("reviewing");
      toast.success(`${data.entities.length}개 개념, ${data.wikiUpdates.length}개 위키 업데이트를 추출했습니다.`);
    } catch (err) {
      toast.error("AI 분석 중 오류가 발생했습니다.");
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  };

  const handleApplySync = async () => {
    setPhase("syncing");
    setSyncing(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인 필요");

      // Find or get default topic for this group
      const { data: existingTopics } = await supabase
        .from("wiki_topics")
        .select("id, name")
        .eq("group_id", groupId)
        .limit(1);

      let defaultTopicId: string | null = null;
      if (existingTopics && existingTopics.length > 0) {
        defaultTopicId = existingTopics[0].id;
      } else {
        // Create a default "미팅 노트" topic
        const { data: newTopic } = await supabase
          .from("wiki_topics")
          .insert({ group_id: groupId, name: "미팅 노트", description: "미팅에서 추출된 지식과 결정 사항" })
          .select("id")
          .single();
        defaultTopicId = newTopic?.id || null;
      }

      // Record the AI analysis log
      await supabase.from("wiki_ai_analyses").insert({
        group_id: groupId,
        analysis_type: "weekly_digest",
        title: `미팅 동기화 — ${new Date().toLocaleDateString("ko")}`,
        content: JSON.stringify(extractedData),
        metadata: { meetingId, selectedUpdates: Array.from(selectedUpdates) },
        created_by: user.id,
      });

      // Process selected updates
      const createdPageIds: string[] = [];
      if (extractedData && defaultTopicId) {
        for (const idx of selectedUpdates) {
          const update = extractedData.wikiUpdates[idx];
          if (update.action === "create") {
            // Build page content from extracted data
            const content = [
              `# ${update.pageTitle}`,
              "",
              update.suggestion,
              "",
              extractedData.decisions.length > 0 ? `## 주요 결정 사항\n${extractedData.decisions.map(d => `- ${d}`).join("\n")}` : "",
              extractedData.openQuestions.length > 0 ? `## 미결 질문\n${extractedData.openQuestions.map(q => `- ${q}`).join("\n")}` : "",
              "",
              `---`,
              `*이 문서는 ${new Date().toLocaleDateString("ko")} 미팅에서 AI가 자동 생성했습니다.*`,
            ].filter(Boolean).join("\n");

            // Create the page
            const { data: newPage, error: pageError } = await supabase
              .from("wiki_pages")
              .insert({
                topic_id: defaultTopicId,
                title: update.pageTitle,
                content,
                created_by: user.id,
                last_updated_by: user.id,
                version: 1,
              })
              .select("id")
              .single();

            if (!pageError && newPage) {
              createdPageIds.push(newPage.id);

              // Record contribution, version, meeting link, and auto-apply tags in parallel
              const tagInserts: Promise<any>[] = [];
              if (extractedData?.suggestedTags && extractedData.suggestedTags.length > 0) {
                tagInserts.push(
                  (async () => {
                    for (const tagName of extractedData.suggestedTags) {
                      // Ensure tag exists
                      const { data: existing } = await supabase
                        .from("wiki_tags")
                        .select("id")
                        .eq("group_id", groupId)
                        .eq("name", tagName)
                        .limit(1);
                      let tagId = existing?.[0]?.id;
                      if (!tagId) {
                        const { data: created } = await supabase
                          .from("wiki_tags")
                          .insert({ group_id: groupId, name: tagName })
                          .select("id")
                          .single();
                        tagId = created?.id;
                      }
                      if (tagId) {
                        await supabase.from("wiki_page_tags").insert({ page_id: newPage.id, tag_id: tagId });
                      }
                    }
                  })()
                );
              }

              await Promise.all([
                supabase.from("wiki_contributions").insert({
                  page_id: newPage.id,
                  user_id: user.id,
                  change_summary: "미팅 AI 동기화로 페이지 생성",
                  source_type: "meeting_sync",
                  source_id: meetingId,
                }),
                supabase.from("wiki_page_versions").insert({
                  page_id: newPage.id,
                  version: 1,
                  title: update.pageTitle,
                  content,
                  edited_by: user.id,
                  change_summary: "AI 자동 생성 초기 버전",
                }),
                supabase.from("wiki_meeting_links").insert({
                  page_id: newPage.id,
                  meeting_id: meetingId,
                  description: `AI 추출: ${update.suggestion.slice(0, 100)}`,
                }),
                ...tagInserts,
              ]);

              toast.success(`"${update.pageTitle}" 페이지가 생성되었습니다!`);
            }
          } else if (update.action === "update") {
            toast.info(`"${update.pageTitle}" 업데이트 제안이 기록되었습니다.`);
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      setSynced(true);
      setPhase("done");
      toast.success(`위키에 성공적으로 반영되었습니다! (${createdPageIds.length}개 페이지 생성)`);
    } catch (err: any) {
      toast.error(err.message || "반영 중 오류가 발생했습니다.");
      setPhase("reviewing");
    } finally {
      setSyncing(false);
    }
  };

  const toggleUpdate = (idx: number) => {
    const next = new Set(selectedUpdates);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedUpdates(next);
  };

  // ── Phase: Idle ──
  if (phase === "idle") {
    return (
      <div className="bg-gradient-to-br from-nu-cream/50 to-white border-[2px] border-nu-ink p-10 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #e91e63 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        <div className="relative z-10">
          <div className="relative inline-block mb-6">
            <Brain size={48} className="text-nu-ink/10" />
            <Sparkles size={20} className="text-nu-pink absolute -top-1 -right-1 animate-pulse" />
          </div>
          <h3 className="font-head text-2xl font-extrabold text-nu-ink mb-3">살아있는 지식 저장소 동기화</h3>
          <p className="text-sm text-nu-muted max-w-md mx-auto mb-4 leading-relaxed">
            오늘의 미팅 기록을 AI가 분석하여 위키에 등록할 핵심 개념, 확정 사항, 그리고 업데이트 제안을 추출합니다.
          </p>

          {/* Pipeline visualization */}
          <div className="flex items-center justify-center gap-2 mb-8 font-mono-nu text-[9px] text-nu-muted/60 uppercase tracking-widest">
            <span className="px-2 py-1 border border-nu-ink/10">기록</span>
            <ArrowRight size={12} />
            <span className="px-2 py-1 border border-nu-ink/10">분석</span>
            <ArrowRight size={12} />
            <span className="px-2 py-1 border border-nu-ink/10">구조화</span>
            <ArrowRight size={12} />
            <span className="px-2 py-1 border border-nu-ink/10">연결</span>
          </div>

          <button
            onClick={handleExtract}
            className="bg-nu-ink text-white px-10 py-4 font-mono-nu text-xs font-bold uppercase tracking-widest hover:bg-nu-pink transition-all shadow-[4px_4px_0px_rgba(233,30,99,0.3)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] flex items-center gap-3 mx-auto"
          >
            <Brain size={16} /> AI 위키 추출 시작
          </button>
        </div>
      </div>
    );
  }

  // ── Phase: Extracting ──
  if (phase === "extracting") {
    return (
      <div className="bg-nu-ink text-white p-10 text-center border-[2px] border-nu-ink">
        <Loader2 size={40} className="mx-auto mb-6 animate-spin text-nu-pink" />
        <h3 className="font-head text-xl font-extrabold mb-3">AI가 미팅 콘텐츠를 분석 중...</h3>
        <div className="space-y-2 max-w-xs mx-auto">
          {["핵심 개념 추출 중...", "확정 사항 식별 중...", "위키 업데이트 제안 생성 중..."].map((step, i) => (
            <div key={i} className="flex items-center gap-3 text-xs text-white/50 animate-pulse" style={{ animationDelay: `${i * 500}ms` }}>
              <div className="w-1.5 h-1.5 rounded-full bg-nu-pink animate-ping" />
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Phase: Done ──
  if (phase === "done") {
    return (
      <div className="bg-green-50 border-[2px] border-green-400 p-10 text-center">
        <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
        <h3 className="font-head text-2xl font-extrabold text-green-700 mb-3">동기화 완료!</h3>
        <p className="text-sm text-green-600 mb-6">
          {selectedUpdates.size}개의 위키 업데이트가 반영되었습니다.
        </p>
        <div className="flex gap-3 justify-center">
          <a
            href={`/groups/${groupId}/wiki`}
            className="px-6 py-3 bg-green-600 text-white font-mono-nu text-[11px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all no-underline flex items-center gap-2"
          >
            <BookOpen size={14} /> 위키 보기
          </a>
          <button
            onClick={() => { setPhase("idle"); setExtractedData(null); setSynced(false); }}
            className="px-6 py-3 border-[2px] border-green-600 text-green-700 font-mono-nu text-[11px] font-bold uppercase tracking-widest hover:bg-green-100 transition-colors"
          >
            다시 분석
          </button>
        </div>
      </div>
    );
  }

  // ── Phase: Reviewing / Syncing ──
  if (!extractedData) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      {/* Extraction Source Badge */}
      {extractionSource && (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-mono-nu text-[9px] font-bold uppercase tracking-widest ${
          extractionSource === "ai"
            ? "bg-nu-pink/10 text-nu-pink border border-nu-pink/20"
            : "bg-nu-amber/10 text-nu-amber border border-nu-amber/20"
        }`}>
          {extractionSource === "ai" ? <Sparkles size={10} /> : <GitBranch size={10} />}
          {extractionSource === "ai" ? "Gemini AI 추출" : "휴리스틱 추출 (추정)"}
        </div>
      )}

      {/* Entities & Tags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border-[2px] border-nu-ink p-6">
          <h4 className="font-mono-nu text-[10px] font-bold text-nu-ink uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <GitBranch size={14} className="text-nu-pink" /> Key Entities & Concepts
          </h4>
          <div className="flex flex-wrap gap-2">
            {extractedData.entities.map((e, i) => (
              <span key={i} className={`px-3 py-1.5 border font-head text-xs transition-all ${
                e.isNew
                  ? "bg-nu-pink/10 border-nu-pink text-nu-pink animate-pulse"
                  : "bg-nu-ink/5 border-nu-ink text-nu-ink"
              }`}>
                {e.name}
                {e.isNew && <span className="ml-1.5 font-mono-nu text-[7px] uppercase">NEW</span>}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white border-[2px] border-nu-ink p-6">
          <h4 className="font-mono-nu text-[10px] font-bold text-nu-ink uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <Tag size={14} className="text-nu-amber" /> Suggested Tags
          </h4>
          <div className="flex flex-wrap gap-2">
            {extractedData.suggestedTags.map((tag, i) => (
              <span key={i} className="px-2 py-1 bg-nu-amber/10 border border-nu-amber/30 text-nu-amber font-mono-nu text-[9px] font-bold uppercase tracking-widest">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Decisions */}
      <div className="bg-white border-[2px] border-nu-ink p-6">
        <h4 className="font-mono-nu text-[10px] font-bold text-nu-blue uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <CheckCircle2 size={14} /> Confirmed Decisions ({extractedData.decisions.length})
        </h4>
        <div className="space-y-2">
          {extractedData.decisions.map((d, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-nu-blue/5 border border-nu-blue/10">
              <CheckCircle2 size={14} className="text-nu-blue shrink-0 mt-0.5" />
              <span className="text-sm text-nu-graphite">{d}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Open Questions */}
      <div className="bg-white border-[2px] border-nu-ink p-6">
        <h4 className="font-mono-nu text-[10px] font-bold text-nu-amber uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <HelpCircle size={14} /> Open Questions ({extractedData.openQuestions.length})
        </h4>
        <div className="space-y-2">
          {extractedData.openQuestions.map((q, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-nu-amber/5 border border-nu-amber/10">
              <HelpCircle size={14} className="text-nu-amber shrink-0 mt-0.5" />
              <span className="text-sm text-nu-graphite italic">{q}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Wiki Updates (selectable) */}
      <div className="bg-nu-pink text-white p-6 border-[2px] border-nu-ink">
        <h4 className="font-mono-nu text-[10px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <RefreshCw size={14} /> Wiki Updates — 반영할 항목 선택 ({selectedUpdates.size}/{extractedData.wikiUpdates.length})
        </h4>
        <div className="space-y-3">
          {extractedData.wikiUpdates.map((u, i) => (
            <button
              key={i}
              onClick={() => toggleUpdate(i)}
              className={`w-full text-left p-4 border transition-all ${
                selectedUpdates.has(i)
                  ? "bg-white/20 border-white/40"
                  : "bg-white/5 border-white/10 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-4 h-4 border-2 rounded-sm flex items-center justify-center transition-colors ${
                  selectedUpdates.has(i) ? "bg-white border-white" : "border-white/40"
                }`}>
                  {selectedUpdates.has(i) && <CheckCircle2 size={10} className="text-nu-pink" />}
                </div>
                <span className="font-head text-sm font-bold">{u.pageTitle}</span>
                <span className={`font-mono-nu text-[8px] px-1.5 py-0.5 uppercase tracking-widest ${
                  u.action === "create" ? "bg-green-400/20 text-green-200" : "bg-yellow-400/20 text-yellow-200"
                }`}>
                  {u.action === "create" ? "New Page" : "Update"}
                </span>
              </div>
              <p className="text-[11px] text-white/70 ml-7">{u.suggestion}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => { setPhase("idle"); setExtractedData(null); }}
          className="px-6 py-3 border-[2px] border-nu-ink font-mono-nu text-[11px] font-bold uppercase tracking-widest hover:bg-nu-cream transition-all"
        >
          다시 추출
        </button>
        <button
          onClick={handleApplySync}
          disabled={syncing || selectedUpdates.size === 0}
          className="px-8 py-3 bg-nu-pink text-white font-mono-nu text-[11px] font-bold uppercase tracking-widest shadow-[4px_4px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {selectedUpdates.size}개 항목 위키에 반영
        </button>
      </div>
    </div>
  );
}
