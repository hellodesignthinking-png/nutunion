"use client";

/**
 * TopicIntegrationHero — 통합탭의 메인 콘텐츠 (rewrite-flow 기반).
 *
 * 행동 변경:
 *   - AI가 자료를 누적하지 않고 topic.content 전체를 재작성한다.
 *   - 매 통합 시마다 wiki_topic_versions 에 스냅샷 → 히스토리/복원 가능.
 *
 * 구성:
 *   - Hero: 주제명 · v{N} · last_synthesized_at · 액션 (📜 히스토리 / 🔄 다시 통합)
 *   - Body: 현재 통합된 마크다운 렌더링
 *   - Resync flow: 자료 선택 → AI preview → 확인 → 커밋
 */

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  History, RefreshCw, Sparkles, Loader2, Clock, GitCommit,
  CheckCircle2, X, Plus, AlertCircle, FileText, Zap,
} from "lucide-react";
import { TopicHistoryDialog } from "@/components/wiki/topic-history-dialog";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface TopicResource {
  id: string;
  title: string;
  url: string;
  resource_type: string;
  auto_summary: string | null;
  created_at: string;
  contributor_nickname: string | null;
}

interface ExtractStat {
  id: string;
  title: string;
  type: string;
  method: string; // transcript | scrape | drive_export | pdf_parse | metadata | fallback
  word_count: number;
  truncated: boolean;
  fallback_reason?: string;
}

interface PreviewState {
  new_content: string;
  change_summary: string;
  previous_version: number;
  next_version: number;
  resource_ids: string[];
  extraction_stats?: ExtractStat[];
}

/** Predict per-resource extraction capability for UI chips before synthesis runs. */
function predictCapability(resource: TopicResource): "extractable" | "needs_google" | "metadata" {
  const t = (resource.resource_type || "").toLowerCase();
  const url = (resource.url || "").toLowerCase();
  if (t === "youtube" || url.includes("youtube.com") || url.includes("youtu.be")) return "extractable";
  if (t === "pdf" || url.endsWith(".pdf")) return "extractable";
  if (t === "docs" || t === "sheet" || t === "slide" || t === "drive" ||
      url.includes("docs.google.com") || url.includes("drive.google.com")) {
    return "needs_google"; // we don't know connection state client-side; show advisory chip
  }
  if (t === "article" || t === "link" || t === "notion" || t === "other") return "extractable";
  return "metadata";
}

const METHOD_LABEL: Record<string, string> = {
  transcript: "유튜브 자막",
  scrape: "본문 추출",
  drive_export: "구글 익스포트",
  pdf_parse: "PDF 추출",
  metadata: "메타데이터",
  fallback: "메타데이터(폴백)",
};

interface Props {
  topicId: string;
  topicName: string;
  topicDescription: string;
  initialContent: string | null;
  initialVersion: number;
  initialLastSynthesizedAt: string | null;
  isHost: boolean;
  candidateResources: TopicResource[]; // 통합에 쓸 수 있는 자료 후보
}

export function TopicIntegrationHero({
  topicId,
  topicName,
  topicDescription,
  initialContent,
  initialVersion,
  initialLastSynthesizedAt,
  isHost,
  candidateResources,
}: Props) {
  const router = useRouter();
  const [content, setContent] = useState<string>(initialContent || "");
  const [version, setVersion] = useState<number>(initialVersion || 0);
  const [lastSynthAt, setLastSynthAt] = useState<string | null>(initialLastSynthesizedAt);

  const [historyOpen, setHistoryOpen] = useState(false);

  // Resync UI state
  const [phase, setPhase] = useState<"idle" | "selecting" | "previewing" | "committing">("idle");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const startResync = useCallback(() => {
    if (candidateResources.length === 0) {
      // No new resources → 자료 없이 기존 콘텐츠 다듬기 모드
      setSelectedIds(new Set());
    } else {
      // 기본: 모든 후보 선택
      setSelectedIds(new Set(candidateResources.map(r => r.id)));
    }
    setPhase("selecting");
  }, [candidateResources]);

  function toggleResource(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function runPreview() {
    setPhase("previewing");
    try {
      const res = await fetch("/api/wiki/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_id: topicId,
          resource_ids: Array.from(selectedIds),
          preview: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "AI 통합 실패");
      }
      const data = await res.json();
      setPreview({
        new_content: data.new_content,
        change_summary: data.change_summary,
        previous_version: data.previous_version,
        next_version: data.next_version,
        resource_ids: Array.from(selectedIds),
        extraction_stats: Array.isArray(data.extraction_stats) ? data.extraction_stats : [],
      });
    } catch (e: unknown) {
      const __e = e as { message?: string };
      toast.error(__e.message || "AI 통합 실패");
      setPhase("selecting");
    }
  }

  async function commitPreview() {
    if (!preview) return;
    setPhase("committing");
    try {
      const res = await fetch("/api/wiki/synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_id: topicId,
          resource_ids: preview.resource_ids,
          preview: false,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "통합 저장 실패");
      }
      const data = await res.json();
      setContent(data.new_content);
      setVersion(data.current_version);
      setLastSynthAt(new Date().toISOString());
      setPreview(null);
      setPhase("idle");
      toast.success(`v${data.current_version} 으로 갱신되었습니다`);
      router.refresh();
    } catch (e: unknown) {
      const __e = e as { message?: string };
      toast.error(__e.message || "통합 저장 실패");
      setPhase("previewing");
    }
  }

  function cancelResync() {
    setPhase("idle");
    setPreview(null);
  }

  return (
    <div className="space-y-6">
      {/* ── Hero ────────────────────────────────────── */}
      <div className="bg-white border-[3px] border-nu-ink p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono-nu text-[10px] uppercase tracking-widest font-bold text-nu-pink">
                통합탭
              </span>
              {version > 0 && (
                <span className="font-mono-nu text-[11px] font-extrabold bg-nu-ink text-white px-2 py-0.5">
                  v{version}
                </span>
              )}
              {lastSynthAt && (
                <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-1">
                  <Clock size={9} />
                  {new Date(lastSynthAt).toLocaleString("ko", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <h2 className="font-head text-2xl font-extrabold text-nu-ink">{topicName}</h2>
            {topicDescription && (
              <p className="text-sm text-nu-muted mt-1">{topicDescription}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setHistoryOpen(true)}
              className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink/15 text-nu-ink hover:border-nu-pink hover:text-nu-pink transition-colors flex items-center gap-1.5 bg-white"
              title="버전 히스토리"
            >
              <History size={12} /> 히스토리 {version > 0 && `(${version})`}
            </button>
            {isHost && phase === "idle" && (
              <button
                onClick={startResync}
                className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors flex items-center gap-1.5 shadow-[2px_2px_0px_rgba(0,0,0,0.15)]"
              >
                <RefreshCw size={12} /> 다시 통합
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Resync flow ────────────────────────────── */}
      {phase === "selecting" && (
        <div className="bg-white border-[2px] border-nu-pink p-5 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-head text-base font-bold text-nu-ink flex items-center gap-2">
              <Sparkles size={16} className="text-nu-pink" /> 통합할 자료 선택
            </h3>
            <button onClick={cancelResync} className="text-nu-muted hover:text-nu-ink"><X size={16} /></button>
          </div>
          {candidateResources.length === 0 ? (
            <div className="bg-nu-cream/40 border border-nu-ink/10 p-3 text-xs text-nu-muted">
              <AlertCircle size={11} className="inline mr-1" />
              새로 추가된 자료가 없습니다. 자료 없이 기존 콘텐츠를 AI가 다시 다듬도록 진행할 수 있습니다.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono-nu text-[11px] text-nu-muted">{selectedIds.size} / {candidateResources.length} 선택됨</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedIds(new Set(candidateResources.map(r => r.id)))}
                    className="font-mono-nu text-[10px] text-nu-blue hover:text-nu-pink"
                  >전체</button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="font-mono-nu text-[10px] text-nu-muted hover:text-nu-ink"
                  >해제</button>
                </div>
              </div>
              <div className="max-h-[240px] overflow-y-auto space-y-1 border border-nu-ink/10">
                {candidateResources.map(r => {
                  const checked = selectedIds.has(r.id);
                  const cap = predictCapability(r);
                  const capChip = cap === "extractable"
                    ? { label: "콘텐츠 추출", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
                    : cap === "needs_google"
                    ? { label: "Google 연결 필요", cls: "bg-amber-50 text-amber-700 border-amber-200" }
                    : { label: "메타데이터만", cls: "bg-nu-ink/5 text-nu-muted border-nu-ink/10" };
                  return (
                    <label
                      key={r.id}
                      className={`flex items-start gap-2 p-2 cursor-pointer transition-colors ${checked ? "bg-nu-pink/5" : "hover:bg-nu-cream/40"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleResource(r.id)}
                        className="mt-0.5 accent-nu-pink"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-nu-ink truncate">{r.title}</p>
                        {r.auto_summary && (
                          <p className="text-[11px] text-nu-muted line-clamp-1">{r.auto_summary}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          <span className={`font-mono-nu text-[9px] uppercase tracking-widest border px-1.5 py-0.5 ${capChip.cls}`}>
                            {capChip.label}
                          </span>
                        </div>
                      </div>
                      <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-ink/5 text-nu-muted px-1.5 py-0.5 shrink-0">
                        {r.resource_type}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={cancelResync}
              className="font-mono-nu text-[12px] text-nu-muted hover:text-nu-ink px-3 py-2"
            >취소</button>
            <button
              onClick={runPreview}
              className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-ink text-white hover:bg-nu-graphite transition-colors flex items-center gap-1.5"
            >
              <Zap size={12} /> AI 미리보기
            </button>
          </div>
        </div>
      )}

      {phase === "previewing" && !preview && (
        <div className="bg-white border-[2px] border-nu-pink/40 p-8 text-center">
          <Loader2 size={28} className="animate-spin text-nu-pink mx-auto mb-3" />
          <p className="text-sm font-bold text-nu-ink">AI 가 통합하고 있습니다…</p>
          <p className="font-mono-nu text-[11px] text-nu-muted mt-1">기존 콘텐츠 + 선택한 자료 → 개선된 마크다운 생성 (최대 60초)</p>
        </div>
      )}

      {phase === "previewing" && preview && (
        <div className="bg-white border-[2px] border-nu-pink p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-head text-base font-bold text-nu-ink flex items-center gap-2">
              <Sparkles size={16} className="text-nu-pink" /> AI 변경 제안
              <span className="font-mono-nu text-[11px] bg-nu-ink text-white px-2 py-0.5">
                v{preview.previous_version} → v{preview.next_version}
              </span>
            </h3>
            <button onClick={cancelResync} className="text-nu-muted hover:text-nu-ink"><X size={16} /></button>
          </div>
          {/* Change summary */}
          <div className="bg-nu-pink/5 border border-nu-pink/30 p-3 mb-3">
            <p className="font-mono-nu text-[10px] uppercase tracking-widest font-bold text-nu-pink mb-1">변경 요약</p>
            <p className="text-sm text-nu-ink leading-relaxed whitespace-pre-wrap">{preview.change_summary}</p>
          </div>
          {/* Extraction stats — show what AI actually saw */}
          {preview.extraction_stats && preview.extraction_stats.length > 0 && (
            <div className="border border-nu-ink/10 p-3 mb-3 bg-white">
              <p className="font-mono-nu text-[10px] uppercase tracking-widest font-bold text-nu-muted mb-2">
                자료 추출 결과 ({preview.extraction_stats.length}개)
              </p>
              <ul className="space-y-1">
                {preview.extraction_stats.map(s => {
                  const isFallback = s.method === "fallback" || s.method === "metadata";
                  return (
                    <li key={s.id} className="flex items-center gap-2 text-[11px]">
                      <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${isFallback ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                        {METHOD_LABEL[s.method] || s.method}
                      </span>
                      <span className="text-nu-ink truncate flex-1" title={s.fallback_reason}>{s.title}</span>
                      <span className="font-mono-nu text-[9px] text-nu-muted shrink-0">
                        {s.word_count > 0 ? `${s.word_count.toLocaleString()}w` : "—"}
                        {s.truncated && " ⤵"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="font-mono-nu text-[9px] text-nu-muted mt-2">
                녹색 = 실제 콘텐츠 추출됨 · 황색 = 메타데이터로 폴백 (자막 없음 / 본문 추출 불가 / Google 미연결 등)
              </p>
            </div>
          )}
          {/* New content preview */}
          <div className="border border-nu-ink/10 max-h-[420px] overflow-y-auto p-4 bg-nu-paper/40">
            <p className="font-mono-nu text-[10px] uppercase tracking-widest font-bold text-nu-muted mb-2">새 콘텐츠 (저장 시 현재 콘텐츠를 대체합니다)</p>
            <div className="prose prose-sm max-w-none text-[13px] text-nu-graphite leading-relaxed prose-headings:font-head prose-headings:text-nu-ink prose-headings:font-extrabold">
              <ReactMarkdown>{preview.new_content}</ReactMarkdown>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 mt-4">
            <p className="font-mono-nu text-[11px] text-nu-muted">
              현재 콘텐츠는 v{preview.previous_version} 스냅샷으로 보존됩니다.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={cancelResync}
                className="font-mono-nu text-[12px] text-nu-muted hover:text-nu-ink px-3 py-2"
              >취소</button>
              <button
                onClick={commitPreview}
                className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 size={12} /> 적용 (v{preview.next_version})
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "committing" && (
        <div className="bg-white border-[2px] border-nu-pink/40 p-8 text-center">
          <Loader2 size={28} className="animate-spin text-nu-pink mx-auto mb-3" />
          <p className="text-sm font-bold text-nu-ink">새 버전을 저장하고 있습니다…</p>
        </div>
      )}

      {/* ── Main content (the integrated tab) ─────── */}
      <div className="bg-white border-[2px] border-nu-ink/10 p-6 min-h-[200px]">
        {content ? (
          <div className="prose prose-sm max-w-none text-[14px] text-nu-graphite leading-relaxed prose-headings:font-head prose-headings:text-nu-ink prose-headings:font-extrabold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-center py-10">
            <FileText size={36} className="mx-auto mb-3 text-nu-ink/15" />
            <p className="text-sm font-bold text-nu-ink mb-1">아직 통합된 콘텐츠가 없습니다</p>
            <p className="text-xs text-nu-muted mb-4">
              {candidateResources.length > 0
                ? `${candidateResources.length}개 자료가 통합 대기 중입니다.`
                : "자료를 추가한 뒤 ‘다시 통합’ 을 실행해주세요."}
            </p>
            {isHost && (
              <button
                onClick={startResync}
                className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors inline-flex items-center gap-1.5"
              >
                <Sparkles size={12} /> 첫 통합 시작
              </button>
            )}
          </div>
        )}
      </div>

      {/* History Dialog */}
      <TopicHistoryDialog
        topicId={topicId}
        isHost={isHost}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestored={() => router.refresh()}
      />
    </div>
  );
}
