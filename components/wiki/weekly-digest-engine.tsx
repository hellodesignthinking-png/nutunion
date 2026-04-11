"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Brain, Sparkles, Loader2, CheckCircle2,
  ArrowRight, Save, BookOpen, ChevronDown, ChevronUp,
  Clock, FileText, Zap, RefreshCw, ListChecks,
  HelpCircle, TrendingUp,
} from "lucide-react";

interface WeeklyDigestResult {
  digest: string;
  carryOverItems: string[];
  resolvedItems: string[];
  keyDecisions: string[];
  openQuestions: string[];
  knowledgeGrowth: string[];
  nextMeetingContext: string;
  suggestedAgenda: string[];
  tokenSavings: string;
  periodStart: string;
  periodEnd: string;
  meetingCount: number;
  noteCount: number;
  resourceCount: number;
  wikiUpdateCount: number;
}

interface WeeklyDigestEngineProps {
  groupId: string;
  meetingId: string;
  /** Auto-trigger digest generation */
  autoTrigger?: boolean;
  /** Callback after digest is saved */
  onDigestSaved?: (digest: string) => void;
}

export function WeeklyDigestEngine({
  groupId,
  meetingId,
  autoTrigger = false,
  onDigestSaved,
}: WeeklyDigestEngineProps) {
  const [phase, setPhase] = useState<"idle" | "gathering" | "compressing" | "reviewing" | "saving" | "done">("idle");
  const [result, setResult] = useState<WeeklyDigestResult | null>(null);
  const [previousDigest, setPreviousDigest] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    digest: true, carryOver: true, decisions: false, wiki: false, agenda: true,
  });
  const [saving, setSaving] = useState(false);

  // Load previous digest on mount
  useEffect(() => {
    async function loadPreviousDigest() {
      const supabase = createClient();
      const { data } = await supabase
        .from("wiki_ai_analyses")
        .select("content, created_at")
        .eq("group_id", groupId)
        .eq("analysis_type", "weekly_digest")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.content) {
        try {
          const parsed = JSON.parse(data.content);
          setPreviousDigest(parsed.nextMeetingContext || parsed.digest || null);
        } catch {
          setPreviousDigest(null);
        }
      }
    }
    loadPreviousDigest();
  }, [groupId]);

  // Auto-trigger on mount if specified
  useEffect(() => {
    if (autoTrigger && phase === "idle") {
      handleGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTrigger]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  async function handleGenerate() {
    setPhase("gathering");

    try {
      // Phase 1: Gathering data (shown in UI)
      await new Promise(r => setTimeout(r, 500));
      setPhase("compressing");

      // Phase 2: AI compression
      const res = await fetch("/api/ai/weekly-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          previousDigest,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "다이제스트 생성 실패");
      }

      const data: WeeklyDigestResult = await res.json();
      setResult(data);
      setPhase("reviewing");
      toast.success("🧠 주간 다이제스트가 생성되었습니다!");
    } catch (err: any) {
      toast.error(err.message || "다이제스트 생성 중 오류가 발생했습니다");
      setPhase("idle");
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setPhase("saving");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인 필요");

      // 1. Save digest to wiki_ai_analyses
      await supabase.from("wiki_ai_analyses").insert({
        group_id: groupId,
        analysis_type: "weekly_digest",
        title: `주간 다이제스트 — ${new Date(result.periodStart).toLocaleDateString("ko")} ~ ${new Date(result.periodEnd).toLocaleDateString("ko")}`,
        content: JSON.stringify(result),
        metadata: {
          meetingId,
          meetingCount: result.meetingCount,
          noteCount: result.noteCount,
          resourceCount: result.resourceCount,
          wikiUpdateCount: result.wikiUpdateCount,
        },
        created_by: user.id,
      });

      // 2. Auto-create wiki page for this digest
      const { data: topics } = await supabase
        .from("wiki_topics")
        .select("id")
        .eq("group_id", groupId)
        .limit(1);

      let topicId: string | null = null;
      if (topics && topics.length > 0) {
        topicId = topics[0].id;
      } else {
        const { data: newTopic } = await supabase
          .from("wiki_topics")
          .insert({ group_id: groupId, name: "주간 다이제스트", description: "AI가 생성한 주간 지식 압축본" })
          .select("id")
          .single();
        topicId = newTopic?.id || null;
      }

      if (topicId) {
        const pageTitle = `📋 주간 다이제스트 (${new Date(result.periodStart).toLocaleDateString("ko")} ~ ${new Date(result.periodEnd).toLocaleDateString("ko")})`;
        
        const wikiContent = [
          `# ${pageTitle}`,
          "",
          `> ${result.digest}`,
          "",
          "## 📌 핵심 결정 사항",
          ...(result.keyDecisions.length > 0
            ? result.keyDecisions.map(d => `- ✅ ${d}`)
            : ["- 이번 주 결정 사항 없음"]),
          "",
          "## ⏳ 미완료 액션 아이템 (이월)",
          ...(result.carryOverItems.length > 0
            ? result.carryOverItems.map(i => `- ⬜ ${i}`)
            : ["- 이월 항목 없음"]),
          "",
          "## ✅ 완료된 사항",
          ...(result.resolvedItems.length > 0
            ? result.resolvedItems.map(i => `- ✔️ ${i}`)
            : ["- 이번 주 완료 사항 없음"]),
          "",
          "## ❓ 미결 질문",
          ...(result.openQuestions.length > 0
            ? result.openQuestions.map(q => `- ${q}`)
            : ["- 미결 질문 없음"]),
          "",
          "## 📚 지식 성장",
          ...(result.knowledgeGrowth.length > 0
            ? result.knowledgeGrowth.map(k => `- ${k}`)
            : ["- 위키 업데이트 없음"]),
          "",
          "---",
          "",
          `### 🤖 다음 회의 AI 컨텍스트`,
          `> ${result.nextMeetingContext}`,
          "",
          `### 📊 데이터 압축`,
          `${result.tokenSavings}`,
          "",
          `*이 문서는 ${new Date().toLocaleDateString("ko")} AI에 의해 자동 생성되었습니다.*`,
        ].join("\n");

        const { data: page } = await supabase
          .from("wiki_pages")
          .insert({
            topic_id: topicId,
            title: pageTitle,
            content: wikiContent,
            created_by: user.id,
            last_updated_by: user.id,
            version: 1,
          })
          .select("id")
          .single();

        if (page) {
          await supabase.from("wiki_contributions").insert({
            page_id: page.id,
            user_id: user.id,
            change_summary: "주간 다이제스트 자동 생성",
          });
          await supabase.from("wiki_page_versions").insert({
            page_id: page.id,
            version: 1,
            title: pageTitle,
            content: wikiContent,
            edited_by: user.id,
            change_summary: "AI 주간 다이제스트 자동 생성",
          });
        }
      }

      toast.success("다이제스트가 위키에 저장되었습니다!");
      onDigestSaved?.(result.nextMeetingContext);
      setPhase("done");
    } catch (err: any) {
      toast.error(err.message || "저장에 실패했습니다");
      setPhase("reviewing");
    } finally {
      setSaving(false);
    }
  }

  // ── Phase: Idle ──
  if (phase === "idle") {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-[2px] border-nu-ink p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, #9c27b0 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative z-10 text-center">
          <div className="relative inline-block mb-4">
            <Brain size={48} className="text-nu-ink/10" />
            <Zap size={20} className="text-purple-500 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <h3 className="font-head text-2xl font-extrabold text-nu-ink mb-2">
            주간 지식 다이제스트
          </h3>
          <p className="text-sm text-nu-muted max-w-md mx-auto mb-2 leading-relaxed">
            이번 주 회의, 노트, 자료, 위키 업데이트를 AI가 압축하여
            <strong className="text-purple-600"> 다음 회의의 시작 컨텍스트</strong>를 생성합니다.
          </p>
          <p className="text-[11px] text-nu-muted/60 mb-6">
            매 회의 시작 시 전체 데이터를 다시 읽는 대신, 압축본만 참조하여 AI 토큰과 시간을 절약합니다.
          </p>

          {/* Pipeline visualization */}
          <div className="flex items-center justify-center gap-1.5 mb-6 font-mono-nu text-[8px] text-nu-muted/60 uppercase tracking-widest flex-wrap">
            <span className="px-2 py-1 border border-purple-200 bg-purple-50">회의록</span>
            <ArrowRight size={10} />
            <span className="px-2 py-1 border border-purple-200 bg-purple-50">노트</span>
            <ArrowRight size={10} />
            <span className="px-2 py-1 border border-purple-200 bg-purple-50">자료</span>
            <ArrowRight size={10} />
            <span className="px-2 py-1 border border-purple-200 bg-purple-50">위키</span>
            <ArrowRight size={10} />
            <span className="px-2 py-1.5 border-2 border-purple-500 bg-purple-100 text-purple-700 font-bold">AI 압축</span>
            <ArrowRight size={10} />
            <span className="px-2 py-1 border border-green-300 bg-green-50 text-green-700">다음 회의</span>
          </div>

          {previousDigest && (
            <div className="bg-white/60 border border-purple-200 p-3 mb-6 text-left max-w-md mx-auto">
              <p className="font-mono-nu text-[8px] uppercase tracking-widest text-purple-500 mb-1">이전 다이제스트 컨텍스트</p>
              <p className="text-[11px] text-nu-ink/70 leading-relaxed">{previousDigest}</p>
            </div>
          )}

          <button
            onClick={handleGenerate}
            className="bg-nu-ink text-white px-8 py-3.5 font-mono-nu text-[11px] font-bold uppercase tracking-widest hover:bg-purple-700 transition-all shadow-[4px_4px_0px_rgba(156,39,176,0.3)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] flex items-center gap-3 mx-auto"
          >
            <Brain size={16} /> 주간 다이제스트 생성
          </button>
        </div>
      </div>
    );
  }

  // ── Phase: Gathering / Compressing ──
  if (phase === "gathering" || phase === "compressing") {
    return (
      <div className="bg-nu-ink text-white p-10 text-center border-[2px] border-nu-ink">
        <Loader2 size={40} className="mx-auto mb-6 animate-spin text-purple-400" />
        <h3 className="font-head text-xl font-extrabold mb-4">
          {phase === "gathering" ? "📊 한 주간의 데이터를 수집하고 있습니다..." : "🧠 AI가 지식을 압축하고 있습니다..."}
        </h3>
        <div className="space-y-2 max-w-xs mx-auto">
          {[
            { label: "회의록 수집", done: phase !== "gathering" },
            { label: "노트 & 결정사항 분석", done: phase === "compressing" },
            { label: "공유 자료 정리", done: phase === "compressing" },
            { label: "위키 업데이트 확인", done: phase === "compressing" },
            { label: "AI 압축 다이제스트 생성", done: false },
          ].map((step, i) => (
            <div key={i} className={`flex items-center gap-3 text-xs transition-all ${step.done ? "text-green-400" : "text-white/40 animate-pulse"}`}
              style={{ animationDelay: `${i * 300}ms` }}>
              {step.done
                ? <CheckCircle2 size={12} className="text-green-400" />
                : <div className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />}
              {step.label}
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
        <h3 className="font-head text-2xl font-extrabold text-green-700 mb-2">다이제스트 완료!</h3>
        <p className="text-sm text-green-600 mb-4">
          주간 다이제스트가 위키에 저장되었습니다.<br />
          다음 회의 시작 시 AI가 이 컨텍스트를 자동으로 참조합니다.
        </p>
        {result && (
          <div className="bg-white/60 border border-green-300 p-3 max-w-md mx-auto mb-6 text-left">
            <p className="font-mono-nu text-[8px] uppercase tracking-widest text-green-600 mb-1">다음 회의 AI 컨텍스트</p>
            <p className="text-[11px] text-nu-ink leading-relaxed">{result.nextMeetingContext}</p>
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <a href={`/groups/${groupId}/wiki`} className="px-5 py-2.5 bg-green-600 text-white font-mono-nu text-[10px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all no-underline flex items-center gap-2">
            <BookOpen size={13} /> 위키 보기
          </a>
          <button onClick={() => { setPhase("idle"); setResult(null); }}
            className="px-5 py-2.5 border-[2px] border-green-600 text-green-700 font-mono-nu text-[10px] font-bold uppercase tracking-widest hover:bg-green-100 transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>
    );
  }

  // ── Phase: Reviewing ──
  if (!result) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-nu-ink text-white p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-purple-300" />
          <span className="font-mono-nu text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">
            Weekly_Knowledge_Digest
          </span>
        </div>
        <p className="text-[11px] text-white/60">
          {new Date(result.periodStart).toLocaleDateString("ko")} ~ {new Date(result.periodEnd).toLocaleDateString("ko")}
          {" · "}{result.meetingCount}개 회의 · {result.noteCount}개 노트 · {result.resourceCount}개 자료 · {result.wikiUpdateCount}개 위키
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: <FileText size={14} />, value: result.meetingCount, label: "회의" },
          { icon: <ListChecks size={14} />, value: result.noteCount, label: "노트" },
          { icon: <BookOpen size={14} />, value: result.resourceCount, label: "자료" },
          { icon: <TrendingUp size={14} />, value: result.wikiUpdateCount, label: "위키" },
        ].map((stat, i) => (
          <div key={i} className="bg-nu-white border border-nu-ink/[0.08] p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-nu-muted mb-1">{stat.icon}</div>
            <p className="font-head text-lg font-black text-nu-ink">{stat.value}</p>
            <p className="font-mono-nu text-[7px] text-nu-muted uppercase">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Digest summary */}
      <SectionCard title="📋 주간 요약" icon={<Brain size={14} className="text-purple-500" />}
        expanded={expandedSections.digest} onToggle={() => toggleSection("digest")}>
        <p className="text-sm text-nu-ink leading-relaxed">{result.digest}</p>
      </SectionCard>

      {/* Carry over items */}
      {result.carryOverItems.length > 0 && (
        <SectionCard title={`⏳ 이월 항목 (${result.carryOverItems.length})`}
          icon={<Clock size={14} className="text-nu-amber" />}
          expanded={expandedSections.carryOver} onToggle={() => toggleSection("carryOver")}>
          <div className="flex flex-col gap-1.5">
            {result.carryOverItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-nu-amber/5 border border-nu-amber/10 text-sm text-nu-ink">
                <span className="text-nu-amber mt-0.5">⬜</span> {item}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Key decisions */}
      {result.keyDecisions.length > 0 && (
        <SectionCard title={`✅ 핵심 결정 (${result.keyDecisions.length})`}
          icon={<CheckCircle2 size={14} className="text-green-600" />}
          expanded={expandedSections.decisions} onToggle={() => toggleSection("decisions")}>
          <div className="flex flex-col gap-1">
            {result.keyDecisions.map((d, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-nu-ink">
                <CheckCircle2 size={13} className="text-green-500 mt-0.5 shrink-0" /> {d}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Open questions */}
      {result.openQuestions.length > 0 && (
        <SectionCard title={`❓ 미결 질문 (${result.openQuestions.length})`}
          icon={<HelpCircle size={14} className="text-nu-blue" />}
          expanded={expandedSections.questions ?? false} onToggle={() => toggleSection("questions")}>
          <div className="flex flex-col gap-1">
            {result.openQuestions.map((q, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-nu-ink">
                <HelpCircle size={13} className="text-nu-blue mt-0.5 shrink-0" /> {q}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Resolved items */}
      {result.resolvedItems.length > 0 && (
        <SectionCard title={`✔️ 완료된 사항 (${result.resolvedItems.length})`}
          icon={<CheckCircle2 size={14} className="text-green-500" />}
          expanded={expandedSections.resolved ?? false} onToggle={() => toggleSection("resolved")}>
          <div className="flex flex-col gap-1">
            {result.resolvedItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-nu-muted line-through">
                <CheckCircle2 size={13} className="text-green-400 mt-0.5 shrink-0" /> {item}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Knowledge growth */}
      {result.knowledgeGrowth.length > 0 && (
        <SectionCard title={`📚 지식 성장 (${result.knowledgeGrowth.length})`}
          icon={<TrendingUp size={14} className="text-purple-500" />}
          expanded={expandedSections.wiki ?? false} onToggle={() => toggleSection("wiki")}>
          <div className="flex flex-col gap-1">
            {result.knowledgeGrowth.map((k, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-nu-ink">
                <BookOpen size={13} className="text-purple-400 mt-0.5 shrink-0" /> {k}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Next meeting context (KEY OUTPUT) */}
      <div className="bg-purple-50 border-[2px] border-purple-400 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-purple-600" />
          <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-purple-700">다음 회의 AI 시작 컨텍스트</span>
        </div>
        <p className="text-sm text-purple-900 leading-relaxed bg-white/50 p-3 border border-purple-200">
          {result.nextMeetingContext}
        </p>
        <p className="font-mono-nu text-[8px] text-purple-400 mt-2 uppercase tracking-widest">
          {result.tokenSavings}
        </p>
      </div>

      {/* Suggested agenda */}
      {result.suggestedAgenda.length > 0 && (
        <SectionCard title={`📝 다음 회의 안건 제안 (${result.suggestedAgenda.length})`}
          icon={<ListChecks size={14} className="text-nu-pink" />}
          expanded={expandedSections.agenda} onToggle={() => toggleSection("agenda")}>
          <div className="flex flex-col gap-1.5">
            {result.suggestedAgenda.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-nu-ink p-2 bg-nu-pink/5 border border-nu-pink/10">
                <ArrowRight size={13} className="text-nu-pink mt-0.5 shrink-0" /> {a}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Save button */}
      <div className="p-4 bg-nu-ink text-nu-paper">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 font-mono-nu text-[11px] font-bold uppercase tracking-widest bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-40 transition-all shadow-lg"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          다이제스트 저장 + 위키 자동 등록
        </button>
        <p className="font-mono-nu text-[8px] text-nu-paper/40 uppercase tracking-widest text-center mt-2">
          다이제스트가 위키에 저장되면 다음 회의 AI가 자동으로 참조합니다
        </p>
      </div>
    </div>
  );
}

/* ─── Section Card ─── */
function SectionCard({ title, icon, expanded, onToggle, children }: {
  title: string; icon: React.ReactNode; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-nu-white border border-nu-ink/[0.08] overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-nu-cream/20 transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-ink">{title}</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-nu-muted" /> : <ChevronDown size={14} className="text-nu-muted" />}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
