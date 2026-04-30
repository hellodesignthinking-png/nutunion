"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Edit3, CheckCircle2, X, Flag, ExternalLink,
  RotateCcw, Loader2, ChevronDown, Lock,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface WikiTabGoalEditorProps {
  groupId: string;
  tabGoal: string | null;
  tabDescription: string | null;
  groupName: string;
  isHost: boolean;
  tabStatus: "building" | "ready" | "published";
  tabPublishedSlug: string | null;
  readinessPct?: number;
  isReadyToPublish?: boolean;
}

/**
 * Shows the final tab goal title with:
 * - Inline editing (host only)
 * - Publish whole wiki as one tab (host only)
 * - Unpublish / re-open flow
 */
export function WikiTabGoalEditor({
  groupId,
  tabGoal,
  tabDescription,
  groupName,
  isHost,
  tabStatus,
  tabPublishedSlug,
  readinessPct = 100,
  isReadyToPublish = true,
}: WikiTabGoalEditorProps) {
  const router = useRouter();

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(tabGoal || "");
  const [descInput, setDescInput] = useState(tabDescription || "");
  const [savingGoal, setSavingGoal] = useState(false);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishTitle, setPublishTitle] = useState(tabGoal || groupName + " 탭");
  const [publishDesc, setPublishDesc] = useState(tabDescription || "");
  const [publishing, setPublishing] = useState(false);

  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

  // ── Save goal ──────────────────────────────────────────────────────
  async function saveGoal() {
    setSavingGoal(true);
    try {
      const res = await fetch("/api/wiki/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, tabGoal: goalInput.trim(), tabDescription: descInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "저장 실패"); return; }
      toast.success("탭 목표가 저장되었습니다");
      setEditingGoal(false);
      router.refresh();
    } finally {
      setSavingGoal(false);
    }
  }

  // ── Publish ────────────────────────────────────────────────────────
  async function publishTab() {
    setPublishing(true);
    try {
      const res = await fetch("/api/wiki/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, tabTitle: publishTitle.trim(), tabDescription: publishDesc.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "발행 실패"); return; }
      toast.success("너트 탭이 발행되었습니다! 🎉");
      setShowPublishModal(false);
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  // ── Unpublish ──────────────────────────────────────────────────────
  async function unpublishTab() {
    setUnpublishing(true);
    try {
      const res = await fetch("/api/wiki/publish", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "비공개 처리 실패"); return; }
      toast.success("탭이 비공개로 전환되었습니다");
      setShowUnpublishConfirm(false);
      router.refresh();
    } finally {
      setUnpublishing(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Tab goal title */}
      {editingGoal ? (
        <div className="space-y-3">
          <div>
            <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-1">탭 제목 (최종 발행될 이름)</label>
            <input
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              placeholder={`예: ${groupName} 완전 정복 가이드`}
              className="w-full border-[3px] border-nu-ink px-4 py-2.5 font-head text-lg font-extrabold focus:outline-none focus:border-nu-pink"
              autoFocus
            />
          </div>
          <div>
            <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-1">한 줄 소개 (선택)</label>
            <input
              value={descInput}
              onChange={e => setDescInput(e.target.value)}
              placeholder="이 탭이 독자에게 주는 가치를 한 줄로..."
              className="w-full border-[2px] border-nu-ink/20 px-3 py-2 text-sm focus:outline-none focus:border-nu-pink"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveGoal}
              disabled={savingGoal}
              className="flex items-center gap-2 px-4 py-2 bg-nu-ink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold hover:bg-nu-pink transition-colors disabled:opacity-40"
            >
              {savingGoal ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              저장
            </button>
            <button
              onClick={() => { setEditingGoal(false); setGoalInput(tabGoal || ""); setDescInput(tabDescription || ""); }}
              className="flex items-center gap-2 px-4 py-2 border-[2px] border-nu-ink/20 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors"
            >
              <X size={12} /> 취소
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {tabGoal ? (
                <>
                  <h1 className="font-head text-2xl sm:text-3xl font-extrabold text-nu-ink leading-tight">
                    {tabGoal}
                  </h1>
                  {tabDescription && (
                    <p className="text-sm text-nu-muted mt-1 leading-relaxed">{tabDescription}</p>
                  )}
                </>
              ) : (
                <div>
                  <h1 className="font-head text-2xl sm:text-3xl font-extrabold text-nu-ink/30 leading-tight italic">
                    탭 제목 미정
                  </h1>
                  <p className="text-sm text-nu-muted mt-1">
                    {isHost
                      ? "이 팀이 만들 최종 탭의 제목을 설정해주세요"
                      : "팀장이 탭 제목을 설정하면 표시됩니다"
                    }
                  </p>
                </div>
              )}
            </div>
            {isHost && !editingGoal && tabStatus !== "published" && (
              <button
                onClick={() => setEditingGoal(true)}
                className="shrink-0 p-2 border-[2px] border-nu-ink/10 text-nu-muted hover:text-nu-ink hover:border-nu-ink/30 transition-colors"
                title="탭 제목 편집"
              >
                <Edit3 size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Publish / Unpublish actions — host only */}
      {isHost && !editingGoal && (
        <div className="flex items-center gap-2 flex-wrap pt-2">
          {tabStatus !== "published" ? (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => {
                  if (!isReadyToPublish) {
                    if (!confirm(`아직 발행 준비가 충분하지 않아요 (완성도 ${readinessPct}%, 권장 70% 이상).\n\n그래도 발행하시겠어요?`)) return;
                  }
                  setPublishTitle(tabGoal || groupName + " 탭");
                  setPublishDesc(tabDescription || "");
                  setShowPublishModal(true);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest font-bold border-[3px] border-nu-ink shadow-[3px_3px_0px_0px_rgba(13,13,13,0.2)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(13,13,13,0.2)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all ${
                  isReadyToPublish ? "bg-nu-ink text-white" : "bg-nu-amber/30 text-nu-ink"
                }`}
              >
                <Flag size={12} /> {isReadyToPublish ? "최종 탭 발행" : `발행 (완성도 ${readinessPct}%)`}
              </button>
              {!isReadyToPublish && (
                <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">
                  ※ 권장 완성도 70% 이상 — 부족하면 발행 후에도 보완 권장
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowUnpublishConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 border-[2px] border-nu-ink/15 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-red-500 hover:border-red-200 transition-colors"
            >
              <RotateCcw size={11} /> 비공개로 전환
            </button>
          )}
        </div>
      )}

      {/* ── Publish Modal ── */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nu-ink/40 backdrop-blur-sm">
          <div className="bg-white border-[3px] border-nu-ink w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(13,13,13,1)]">
            {/* Modal header */}
            <div className="px-6 py-4 border-b-[2px] border-nu-ink flex items-center justify-between bg-nu-cream/30">
              <div className="flex items-center gap-2">
                <Flag size={18} className="text-nu-pink" />
                <h3 className="font-head text-base font-extrabold text-nu-ink">너트 탭 발행</h3>
              </div>
              <button onClick={() => setShowPublishModal(false)} className="text-nu-muted hover:text-nu-ink"><X size={16} /></button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-nu-cream/40 border border-nu-ink/10 p-4 font-mono-nu text-[12px] text-nu-muted leading-relaxed">
                발행하면 모든 섹션의 내용이 하나의 <strong className="text-nu-ink">공개 탭</strong>으로 통합됩니다.
                커뮤니티 위키 아카이브에 등록되며 누구나 읽을 수 있습니다.
              </div>

              <div>
                <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-2">발행 제목</label>
                <input
                  value={publishTitle}
                  onChange={e => setPublishTitle(e.target.value)}
                  className="w-full border-[3px] border-nu-ink px-4 py-3 font-head text-base font-extrabold focus:outline-none focus:border-nu-pink"
                />
              </div>

              <div>
                <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-2">독자를 위한 한 줄 소개</label>
                <textarea
                  value={publishDesc}
                  onChange={e => setPublishDesc(e.target.value)}
                  rows={2}
                  placeholder="이 탭에서 독자가 얻을 수 있는 것을 한두 줄로 요약해주세요"
                  className="w-full border-[2px] border-nu-ink/20 px-3 py-2 text-sm focus:outline-none focus:border-nu-pink resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={publishTab}
                  disabled={publishing || !publishTitle.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-nu-ink text-white font-mono-nu text-[12px] uppercase tracking-widest font-bold hover:bg-nu-pink transition-colors disabled:opacity-40"
                >
                  {publishing ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
                  {publishing ? "발행 중..." : "발행하기"}
                </button>
                <button
                  onClick={() => setShowPublishModal(false)}
                  className="px-5 py-3 border-[2px] border-nu-ink/15 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Unpublish confirm ── */}
      {showUnpublishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nu-ink/40 backdrop-blur-sm">
          <div className="bg-white border-[3px] border-nu-ink w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(13,13,13,1)]">
            <div className="px-6 py-4 border-b-[2px] border-nu-ink bg-red-50">
              <h3 className="font-head text-base font-extrabold text-nu-ink flex items-center gap-2">
                <RotateCcw size={16} /> 탭 비공개 전환
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-nu-graphite leading-relaxed">
                발행된 탭이 비공개로 전환됩니다. 공개 URL은 더 이상 접근할 수 없게 되며, 내부에서는 계속 편집할 수 있습니다.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={unpublishTab}
                  disabled={unpublishing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold hover:bg-red-600 transition-colors disabled:opacity-40"
                >
                  {unpublishing ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                  비공개로 전환
                </button>
                <button
                  onClick={() => setShowUnpublishConfirm(false)}
                  className="px-4 py-2.5 border-[2px] border-nu-ink/15 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-ink"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
