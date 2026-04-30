"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  X, Loader2, History, RotateCcw, Eye, EyeOff, Clock,
  GitCommit, AlertCircle, ChevronDown, ChevronUp,
} from "lucide-react";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface TopicVersion {
  id: string;
  version_number: number;
  content_snapshot: string;
  synthesis_input: { resource_titles?: string[]; restored_from_version?: number } | null;
  synthesis_summary: string | null;
  created_at: string;
  created_by_nickname: string;
}

export function TopicHistoryDialog({
  topicId,
  isHost,
  open,
  onClose,
  onRestored,
}: {
  topicId: string;
  isHost: boolean;
  open: boolean;
  onClose: () => void;
  onRestored?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<TopicVersion[]>([]);
  const [migrationPending, setMigrationPending] = useState(false);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setMigrationPending(false);
    fetch(`/api/wiki/topics/${topicId}/versions`)
      .then(r => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.migration_pending) setMigrationPending(true);
        setVersions(Array.isArray(data.versions) ? data.versions : []);
      })
      .catch(() => {
        if (!cancelled) toast.error("히스토리를 불러올 수 없습니다");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, topicId]);

  async function handleRestore(versionNumber: number) {
    setRestoringVersion(versionNumber);
    try {
      const res = await fetch(`/api/wiki/topics/${topicId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_number: versionNumber }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "복원 실패");
      }
      const data = await res.json();
      toast.success(`v${versionNumber} 으로 복원되었습니다 (현재 v${data.current_version})`);
      setRestoreConfirm(null);
      onRestored?.();
      onClose();
    } catch (e: unknown) {
      const __e = e as { message?: string };
      toast.error(__e.message || "복원 실패");
    } finally {
      setRestoringVersion(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white border-[3px] border-nu-ink w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b-[2px] border-nu-ink/10 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
              <History size={18} className="text-nu-pink" />
              통합탭 히스토리
            </h3>
            <p className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest mt-1">
              {versions.length} versions · 최신 → 과거 순
            </p>
          </div>
          <button onClick={onClose} className="text-nu-muted hover:text-nu-ink transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-nu-muted">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs">불러오는 중...</span>
            </div>
          ) : migrationPending ? (
            <div className="p-8 text-center">
              <AlertCircle size={28} className="mx-auto mb-3 text-amber-500" />
              <p className="text-sm font-bold text-nu-ink mb-1">마이그레이션이 적용되지 않았습니다</p>
              <p className="text-xs text-nu-muted">
                <code className="font-mono-nu bg-nu-cream px-1.5 py-0.5">supabase/migrations/128_wiki_topic_versions.sql</code>
                {" "}을 실행한 뒤 다시 시도해주세요.
              </p>
            </div>
          ) : versions.length === 0 ? (
            <div className="p-12 text-center">
              <GitCommit size={28} className="mx-auto mb-3 text-nu-ink/15" />
              <p className="text-sm text-nu-muted">아직 통합 이력이 없습니다</p>
              <p className="text-xs text-nu-muted/60 mt-1">자료를 추가하고 "다시 통합"을 실행하면 v1이 생성됩니다.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {versions.map((v, idx) => {
                const isLatest = idx === 0;
                const isExpanded = expandedVersionId === v.id;
                const isRestoring = restoringVersion === v.version_number;
                const showConfirm = restoreConfirm === v.version_number;
                const usedTitles = v.synthesis_input?.resource_titles || [];
                return (
                  <div
                    key={v.id}
                    className={`border-[2px] transition-colors ${
                      isLatest ? "border-nu-pink bg-nu-pink/[0.03]" : "border-nu-ink/10 bg-white"
                    }`}
                  >
                    <div className="p-3 flex items-start gap-3">
                      <div className="flex flex-col items-center gap-1 shrink-0 w-12">
                        <div className={`font-head text-base font-extrabold px-2 py-0.5 ${
                          isLatest ? "bg-nu-pink text-white" : "bg-nu-ink/5 text-nu-ink"
                        }`}>
                          v{v.version_number}
                        </div>
                        {isLatest && (
                          <span className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-pink font-bold">
                            현재
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-nu-ink font-medium leading-relaxed">
                          {v.synthesis_summary || "(요약 없음)"}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 font-mono-nu text-[10px] text-nu-muted">
                          <Clock size={9} />
                          <span>{new Date(v.created_at).toLocaleString("ko", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          <span>·</span>
                          <span>{v.created_by_nickname}</span>
                          {v.synthesis_input?.restored_from_version && (
                            <>
                              <span>·</span>
                              <span className="text-nu-blue">v{v.synthesis_input.restored_from_version} 복원</span>
                            </>
                          )}
                        </div>
                        {usedTitles.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {usedTitles.slice(0, 5).map((t, i) => (
                              <span key={i} className="font-mono-nu text-[10px] bg-nu-cream text-nu-graphite px-1.5 py-0.5 truncate max-w-[180px]">
                                {t}
                              </span>
                            ))}
                            {usedTitles.length > 5 && (
                              <span className="font-mono-nu text-[10px] text-nu-muted">+{usedTitles.length - 5}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => setExpandedVersionId(isExpanded ? null : v.id)}
                          className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2 py-1 border border-nu-ink/15 text-nu-ink hover:border-nu-blue hover:text-nu-blue transition-colors flex items-center gap-1"
                        >
                          {isExpanded ? <EyeOff size={9} /> : <Eye size={9} />}
                          {isExpanded ? "접기" : "보기"}
                        </button>
                        {isHost && !isLatest && (
                          showConfirm ? (
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => handleRestore(v.version_number)}
                                disabled={isRestoring}
                                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-nu-pink text-white hover:bg-nu-pink/90 disabled:opacity-50 flex items-center gap-1"
                              >
                                {isRestoring ? <Loader2 size={9} className="animate-spin" /> : <RotateCcw size={9} />}
                                확정
                              </button>
                              <button
                                onClick={() => setRestoreConfirm(null)}
                                className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 text-nu-muted hover:text-nu-ink"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRestoreConfirm(v.version_number)}
                              className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2 py-1 border border-nu-pink/40 text-nu-pink hover:bg-nu-pink hover:text-white transition-colors flex items-center gap-1"
                            >
                              <RotateCcw size={9} /> 복원
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-nu-ink/10 p-4 bg-nu-paper/40 max-h-[300px] overflow-y-auto">
                        <div className="prose prose-sm max-w-none text-[13px] text-nu-graphite leading-relaxed prose-headings:font-head prose-headings:text-nu-ink prose-headings:font-extrabold">
                          <ReactMarkdown>{v.content_snapshot || "(빈 콘텐츠)"}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
