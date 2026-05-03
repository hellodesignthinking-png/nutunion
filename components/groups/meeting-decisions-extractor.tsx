"use client";

import { useState } from "react";
import { Sparkles, Check, Loader2, ListChecks, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";

/**
 * MeetingDecisionsExtractor — 회의록 상세 페이지에 붙일 추출 다이얼로그.
 *
 *   회의의 summary + meeting_notes 를 AI 가 분석 → 결정 후보 N개.
 *   사용자가 체크해서 특정 프로젝트의 결정 로그로 일괄 등록.
 *
 *   meeting 은 group_id 기준이므로, projectId 는 사용자가 선택해야 함 (props 로 받음).
 */

interface Candidate {
  title: string;
  rationale: string;
  confidence: "high" | "medium" | "low";
}

interface Project { id: string; title: string }

interface Props {
  meetingId: string;
  /** 사용자가 멤버인 프로젝트 목록 — 결정을 어느 볼트에 등록할지 선택 */
  candidateProjects: Project[];
  open: boolean;
  onClose: () => void;
  onSaved?: (count: number) => void;
}

export function MeetingDecisionsExtractor({ meetingId, candidateProjects, open, onClose, onSaved }: Props) {
  const [extracting, setExtracting] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [projectId, setProjectId] = useState<string>(candidateProjects[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  async function extract() {
    setExtracting(true);
    setCandidates(null);
    try {
      const r = await fetch(`/api/meetings/${meetingId}/extract-decisions`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "추출 실패");
      setCandidates(j.candidates || []);
      setModelUsed(j.model_used || null);
      // 기본 — high/medium 자동 선택
      const auto = new Set<number>();
      (j.candidates as Candidate[] || []).forEach((c, i) => {
        if (c.confidence !== "low") auto.add(i);
      });
      setSelected(auto);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally { setExtracting(false); }
  }

  async function save() {
    if (!projectId || selected.size === 0 || !candidates) return;
    setSaving(true);
    try {
      let count = 0;
      for (const idx of selected) {
        const c = candidates[idx];
        const r = await fetch(`/api/projects/${projectId}/decisions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: c.title,
            rationale: c.rationale,
            source_kind: "meeting",
            source_id: meetingId,
          }),
        });
        if (r.ok) count++;
      }
      toast.success(`${count}건 결정 로그 등록`);
      onSaved?.(count);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally { setSaving(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b-[3px] border-nu-ink bg-white flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
            <Sparkles size={11} /> 회의록 → 결정 자동 추출
          </div>
          <button onClick={onClose} className="p-1 text-nu-muted hover:text-nu-ink"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-3">
          {!candidates && (
            <div className="text-center py-6">
              <ListChecks size={32} className="text-nu-muted/40 mx-auto mb-2" />
              <p className="text-[14px] text-nu-graphite mb-3">
                Genesis AI 가 회의 요약과 노트에서 "결정사항" 만 골라냅니다.
              </p>
              <button onClick={extract} disabled={extracting}
                className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 inline-flex items-center gap-1.5 disabled:opacity-50">
                {extracting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} 추출 시작
              </button>
            </div>
          )}

          {candidates && candidates.length === 0 && (
            <div className="text-[12px] text-nu-muted italic text-center py-4">
              추출된 결정 후보가 없습니다. 회의 summary 와 notes 를 채운 뒤 다시 시도해 주세요.
            </div>
          )}

          {candidates && candidates.length > 0 && (
            <>
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
                {candidates.length}개 후보 · {modelUsed}
              </div>
              <ul className="space-y-1.5 list-none p-0 m-0">
                {candidates.map((c, i) => {
                  const checked = selected.has(i);
                  return (
                    <li key={i}>
                      <label className={`flex items-start gap-2 bg-white border-2 ${checked ? "border-nu-pink" : "border-nu-ink/15"} px-3 py-2 cursor-pointer`}>
                        <input type="checkbox" checked={checked}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(i); else next.delete(i);
                            setSelected(next);
                          }}
                          className="mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold text-nu-ink">{c.title}</div>
                          {c.rationale && <div className="text-[11px] text-nu-graphite mt-0.5 leading-snug">{c.rationale}</div>}
                          <div className="font-mono-nu text-[9px] uppercase tracking-widest mt-1">
                            <span className={
                              c.confidence === "high" ? "text-emerald-700" :
                              c.confidence === "medium" ? "text-amber-700" :
                              "text-nu-muted"
                            }>
                              신뢰도 {c.confidence === "high" ? "높음" : c.confidence === "medium" ? "보통" : "낮음"}
                            </span>
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>

              {candidateProjects.length > 0 && (
                <div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">대상 볼트</div>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-2 py-1.5 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none">
                    {candidateProjects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              )}

              <button onClick={save} disabled={saving || selected.size === 0 || !projectId}
                className="w-full font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite disabled:opacity-40 inline-flex items-center justify-center gap-1.5">
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                {selected.size}건 결정 로그로 등록
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
