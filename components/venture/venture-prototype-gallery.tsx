"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { sanitizeExtension, sanitizePathSegment } from "@/lib/ai/sanitize";

interface Task {
  id: string;
  project_id: string;
  title: string;
  status: "todo" | "doing" | "done";
  image_urls?: string[] | null;
  result_note?: string | null;
  completed_at?: string | null;
  created_at: string;
  assignee_id: string | null;
}

interface Feedback {
  id: string;
  project_id: string;
  tester_name: string | null;
  score: number | null;
  note: string;
  image_urls?: string[] | null;
  created_at: string;
}

interface Props {
  projectId: string;
  canEdit: boolean;
  currentStage: string | null;
}

/**
 * Prototype 결과물 갤러리 + 단계 되돌리기.
 * - 완료된 task 들의 이미지와 결과 노트를 그리드로 표시
 * - 유저 피드백 (점수 + 사진 + 노트)
 * - 호스트는 이전 단계(Discover/Define/Develop) 로 되돌리기 가능
 */
export function VenturePrototypeGallery({ projectId, canEdit, currentStage }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [revertOpen, setRevertOpen] = useState(false);
  const revertRef = useRef<HTMLDivElement | null>(null);

  // 결과 노트 입력 다이얼로그 상태
  const [doneDialog, setDoneDialog] = useState<{ taskId: string; note: string } | null>(null);
  // 단계 되돌리기 이유 입력 다이얼로그 상태
  const [revertDialog, setRevertDialog] = useState<{ stage: "empathize" | "define" | "ideate"; reason: string } | null>(null);

  // Revert 드롭다운 — ESC + 외부 클릭 닫기
  useEffect(() => {
    if (!revertOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRevertOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (revertRef.current && !revertRef.current.contains(e.target as Node)) {
        setRevertOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    // capture: 다른 핸들러보다 먼저 실행 — 하지만 드롭다운 자체 클릭은 ref contains 로 걸러짐
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [revertOpen]);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const [tasksRes, fbRes] = await Promise.all([
        supabase.from("venture_prototype_tasks").select("*").eq("project_id", projectId).order("sort_order").order("created_at"),
        supabase.from("venture_feedback").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      ]);
      setTasks((tasksRes.data as Task[] | null) ?? []);
      setFeedback((fbRes.data as Feedback[] | null) ?? []);
    } catch (err) {
      console.warn("[prototype-gallery]", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const uploadImage = async (taskId: string, file: File, target: "task" | "feedback", feedbackId?: string) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("이미지는 5MB 이하로 업로드해주세요");
      return;
    }
    // MIME + 확장자 2중 검증
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드 가능합니다");
      return;
    }
    const ext = sanitizeExtension(file.name, "image");
    if (ext === "bin") {
      toast.error("지원하지 않는 파일 형식 (jpg/png/gif/webp/heic 만 가능)");
      return;
    }
    setUploadingId(taskId);
    try {
      const supabase = createClient();
      // 경로 세그먼트 sanitize (경로 인젝션 방지)
      const safeProject = sanitizePathSegment(projectId);
      const safeId = sanitizePathSegment(taskId);
      const path = `${safeProject}/${target}/${safeId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("project-files").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("project-files").getPublicUrl(path);

      if (target === "task") {
        const cur = tasks.find((t) => t.id === taskId);
        const urls = [...(cur?.image_urls ?? []), pub.publicUrl];
        const { error } = await supabase.from("venture_prototype_tasks").update({ image_urls: urls }).eq("id", taskId);
        if (error) throw error;
      } else if (feedbackId) {
        const cur = feedback.find((f) => f.id === feedbackId);
        const urls = [...(cur?.image_urls ?? []), pub.publicUrl];
        const { error } = await supabase.from("venture_feedback").update({ image_urls: urls }).eq("id", feedbackId);
        if (error) throw error;
      }
      toast.success("이미지 업로드 완료");
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "업로드 실패";
      toast.error(msg);
    } finally {
      setUploadingId(null);
    }
  };

  const markDone = (taskId: string) => {
    // 다이얼로그 열기 (실제 저장은 confirmMarkDone 에서)
    setDoneDialog({ taskId, note: "" });
  };

  const confirmMarkDone = async () => {
    if (!doneDialog) return;
    const { taskId, note } = doneDialog;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("venture_prototype_tasks").update({
        status: "done",
        completed_at: new Date().toISOString(),
        result_note: note.trim() || null,
      }).eq("id", taskId);
      if (error) throw error;
      toast.success("완료 처리됨");
      setDoneDialog(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "업데이트 실패");
    }
  };

  const revertTo = (stage: "empathize" | "define" | "ideate") => {
    setRevertOpen(false);
    setRevertDialog({ stage, reason: "" });
  };

  const confirmRevert = async () => {
    if (!revertDialog) return;
    const { stage, reason } = revertDialog;
    try {
      const res = await fetch(`/api/venture/${projectId}/revert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_stage: stage, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "되돌리기 실패");
      toast.success(`${stage} 단계로 되돌렸습니다`);
      setRevertDialog(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "되돌리기 실패");
    }
  };

  if (loading) {
    return <div className="p-6 text-center font-mono-nu text-[11px] text-nu-graphite">불러오는 중...</div>;
  }

  const doneTasks = tasks.filter((t) => t.status === "done");
  const hasAnyImage = tasks.some((t) => (t.image_urls?.length ?? 0) > 0) || feedback.some((f) => (f.image_urls?.length ?? 0) > 0);

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper">
      <div className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-blue">
            🛠 Prototype Gallery
          </div>
          <div className="font-bold text-[14px] text-nu-ink mt-0.5">
            프로토타입 결과물 · 테스트 기록
          </div>
        </div>
        {canEdit && (currentStage === "prototype" || currentStage === "plan") && (
          <div className="relative" ref={revertRef}>
            <button
              type="button"
              onClick={() => setRevertOpen((v) => !v)}
              aria-expanded={revertOpen}
              aria-haspopup="menu"
              className="h-9 px-3 border-[2px] border-nu-ink/40 bg-nu-paper text-nu-ink font-mono-nu text-[10px] uppercase tracking-widest hover:border-orange-500 hover:text-orange-500"
              title="이전 단계로 흐름 되돌리기"
            >
              🔄 이전 단계로 되돌리기
            </button>
            {revertOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1 w-56 border-[2px] border-nu-ink bg-nu-paper shadow-[4px_4px_0_0_rgba(13,13,13,0.4)] z-10">
                <button type="button" onClick={() => revertTo("empathize")} className="block w-full text-left px-3 py-2 border-b-[1px] border-nu-ink/10 hover:bg-nu-pink/5 font-mono-nu text-[11px]">
                  ① Empathize 로
                  <span className="block text-[10px] text-nu-graphite">더 많은 인사이트 수집이 필요해</span>
                </button>
                <button type="button" onClick={() => revertTo("define")} className="block w-full text-left px-3 py-2 border-b-[1px] border-nu-ink/10 hover:bg-nu-pink/5 font-mono-nu text-[11px]">
                  ② Define 로
                  <span className="block text-[10px] text-nu-graphite">HMW 를 재정의해야 해</span>
                </button>
                <button type="button" onClick={() => revertTo("ideate")} className="block w-full text-left px-3 py-2 hover:bg-nu-pink/5 font-mono-nu text-[11px]">
                  ③ Ideate 로
                  <span className="block text-[10px] text-nu-graphite">다른 아이디어를 시도</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {tasks.length === 0 && feedback.length === 0 ? (
        <div className="p-6 text-center">
          <div className="text-[32px] mb-2">🛠</div>
          <p className="text-[12px] text-nu-graphite">
            프로토타입 태스크 및 유저 피드백이 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <>
          {/* 완료된 태스크 그리드 */}
          {doneTasks.length > 0 && (
            <div className="p-4 border-b-[2px] border-nu-ink/10">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">
                ✅ 완료된 태스크 ({doneTasks.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {doneTasks.map((t) => (
                  <div key={t.id} className="border-[2px] border-nu-ink bg-nu-paper overflow-hidden">
                    {(t.image_urls?.length ?? 0) > 0 && (
                      <div className="grid grid-cols-2 gap-0.5 bg-nu-ink/10 aspect-video">
                        {(t.image_urls ?? []).slice(0, 4).map((url, i) => (
                          <Image key={i} src={url} alt="" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" unoptimized />
                        ))}
                      </div>
                    )}
                    <div className="p-3">
                      <div className="font-bold text-[13px] text-nu-ink">{t.title}</div>
                      {t.result_note && (
                        <p className="text-[12px] text-nu-graphite mt-1 leading-relaxed">{t.result_note}</p>
                      )}
                      {t.completed_at && (
                        <div className="font-mono-nu text-[9px] text-nu-graphite mt-1">
                          완료: {new Date(t.completed_at).toLocaleDateString("ko-KR")}
                        </div>
                      )}
                      {canEdit && (
                        <label className="mt-2 inline-block cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadImage(t.id, f, "task");
                              e.target.value = "";
                            }}
                          />
                          <span className={`font-mono-nu text-[9px] uppercase tracking-widest border-[1.5px] border-nu-ink px-2 py-1 ${uploadingId === t.id ? "opacity-50" : "hover:bg-nu-ink hover:text-nu-paper"}`}>
                            {uploadingId === t.id ? "업로드 중..." : "📸 사진 추가"}
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 진행 중 태스크 — 사진 업로드 포함 */}
          {canEdit && tasks.some((t) => t.status !== "done") && (
            <div className="p-4 border-b-[2px] border-nu-ink/10">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">
                ⏳ 진행 중 / 대기
              </div>
              <ul className="space-y-2 list-none m-0 p-0">
                {tasks.filter((t) => t.status !== "done").map((t) => (
                  <li key={t.id} className="border-[1.5px] border-nu-ink/40 bg-nu-paper p-2 flex items-center gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[12px] text-nu-ink truncate">{t.title}</div>
                      <div className="font-mono-nu text-[9px] text-nu-graphite uppercase">
                        {t.status === "doing" ? "진행 중" : "대기"}
                      </div>
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadImage(t.id, f, "task");
                          e.target.value = "";
                        }}
                      />
                      <span className="font-mono-nu text-[9px] uppercase tracking-widest border-[1px] border-nu-ink/40 px-2 py-1 hover:border-nu-ink">
                        📸
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => markDone(t.id)}
                      className="h-7 px-2 border-[1.5px] border-green-600 bg-green-50 text-green-700 font-mono-nu text-[9px] uppercase tracking-widest hover:bg-green-600 hover:text-nu-paper"
                    >
                      ✓ 완료
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 유저 피드백 갤러리 */}
          {feedback.length > 0 && (
            <div className="p-4">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">
                💬 유저 피드백 ({feedback.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {feedback.map((f) => (
                  <div key={f.id} className="border-[1.5px] border-nu-ink/40 bg-nu-paper overflow-hidden">
                    {(f.image_urls?.length ?? 0) > 0 && (
                      <div className="relative w-full aspect-video">
                        <Image src={f.image_urls![0]} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" unoptimized />
                      </div>
                    )}
                    <div className="p-2">
                      <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                        {f.tester_name && (
                          <span className="font-mono-nu text-[10px] font-bold text-nu-ink">{f.tester_name}</span>
                        )}
                        {f.score !== null && (
                          <span className="font-mono-nu text-[10px] text-nu-pink">⭐ {f.score}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-nu-graphite leading-relaxed line-clamp-3">{f.note}</p>
                      {canEdit && (f.image_urls?.length ?? 0) === 0 && (
                        <label className="mt-1 inline-block cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadImage(f.id, file, "feedback", f.id);
                              e.target.value = "";
                            }}
                          />
                          <span className="font-mono-nu text-[8px] uppercase tracking-widest border-[1px] border-nu-ink/30 px-1.5 py-0.5 hover:border-nu-ink">
                            📸 사진
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasAnyImage && (tasks.length > 0 || feedback.length > 0) && (
            <div className="px-4 py-2 bg-nu-cream/20 border-t-[1px] border-nu-ink/10 font-mono-nu text-[10px] text-nu-graphite text-center">
              💡 태스크나 피드백에 사진을 추가하면 여기에 갤러리로 표시됩니다
            </div>
          )}
        </>
      )}
      {/* 결과 노트 다이얼로그 */}
      {doneDialog && (
        <div className="fixed inset-0 z-50 bg-nu-ink/60 flex items-center justify-center p-4" onClick={() => setDoneDialog(null)} role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="결과 노트 입력"
            className="max-w-md w-full bg-nu-paper border-[2.5px] border-nu-ink p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-pink mb-2">
              ✓ 태스크 완료
            </div>
            <h3 className="font-bold text-[14px] text-nu-ink mb-1">결과 노트 (선택)</h3>
            <p className="text-[11px] text-nu-graphite mb-2">이 태스크의 결과나 배운 점을 간단히 적어주세요. 비워도 됩니다.</p>
            <textarea
              value={doneDialog.note}
              onChange={(e) => setDoneDialog({ ...doneDialog, note: e.target.value })}
              rows={4}
              autoFocus
              maxLength={500}
              className="w-full px-3 py-2 border-[2px] border-nu-ink bg-nu-paper text-[12px] resize-y"
              placeholder="예: 유저 10명 중 8명이 기능 발견했음. 상단 CTA 가시성 개선 필요"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setDoneDialog(null)}
                className="h-9 px-3 border-[2px] border-nu-ink/30 bg-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:border-nu-ink"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmMarkDone}
                className="h-9 px-3 border-[2px] border-green-600 bg-green-600 text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-green-700"
              >
                ✓ 완료 처리
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 단계 되돌리기 이유 다이얼로그 */}
      {revertDialog && (
        <div className="fixed inset-0 z-50 bg-nu-ink/60 flex items-center justify-center p-4" onClick={() => setRevertDialog(null)} role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="단계 되돌리기"
            className="max-w-md w-full bg-nu-paper border-[2.5px] border-orange-500 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-orange-600 mb-2">
              🔄 단계 되돌리기
            </div>
            <h3 className="font-bold text-[14px] text-nu-ink mb-1">
              {revertDialog.stage === "empathize" ? "① Empathize" : revertDialog.stage === "define" ? "② Define" : "③ Ideate"} 단계로 이동
            </h3>
            <p className="text-[11px] text-nu-graphite mb-2">
              되돌리는 이유는 archive 에 기록되어 팀이 맥락을 이해할 수 있습니다.
            </p>
            <textarea
              value={revertDialog.reason}
              onChange={(e) => setRevertDialog({ ...revertDialog, reason: e.target.value })}
              rows={3}
              autoFocus
              maxLength={300}
              className="w-full px-3 py-2 border-[2px] border-nu-ink bg-nu-paper text-[12px] resize-y"
              placeholder="예: 유저 피드백에서 핵심 pain point 가 달라 HMW 재정의 필요"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setRevertDialog(null)}
                className="h-9 px-3 border-[2px] border-nu-ink/30 bg-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:border-nu-ink"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmRevert}
                className="h-9 px-3 border-[2px] border-orange-500 bg-orange-500 text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-orange-600"
              >
                🔄 되돌리기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
