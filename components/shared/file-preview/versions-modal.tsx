"use client";

import { useEffect, useState } from "react";
import { X, History, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface FileVersion {
  id: string;
  backup_storage_key: string;
  bytes: number | null;
  content_type: string | null;
  created_by: string | null;
  created_at: string;
  label: string | null;
}

interface Props {
  open: boolean;
  fileId: string;
  targetTable: "file_attachments" | "project_resources";
  onClose: () => void;
  /** 복원 성공시 호출 — 부모는 iframe/이미지 캐시 버스트 + 부모 데이터 갱신 트리거 */
  onRestored?: () => void;
}

/**
 * 자료실 파일의 R2 백업본 목록 + 복원 모달.
 *
 * file-preview-panel 에서 추출. 모달이 열릴 때만 버전을 fetch — 항상 panel 마운트
 * 시점에 미리 가져오던 비효율 제거.
 */
export function VersionsModal({ open, fileId, targetTable, onClose, onRestored }: Props) {
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !fileId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(
          `/api/files/versions?table=${encodeURIComponent(targetTable)}&id=${encodeURIComponent(fileId)}`,
          { cache: "no-store" },
        );
        const json = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          if (json?.code === "MIGRATION_MISSING") {
            toast.error("버전 기능이 활성화되지 않았어요 (마이그레이션 132 필요)");
          } else {
            toast.error(json?.error || "버전 조회 실패");
          }
          setVersions([]);
          return;
        }
        setVersions(json.versions || []);
      } catch (e: unknown) {
        if (!cancelled) toast.error((e as Error).message || "버전 조회 실패");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, fileId, targetTable]);

  async function restore(versionId: string) {
    if (!confirm("이 백업본으로 되돌릴까요? 현재 콘텐츠는 새 백업으로 보관돼요.")) return;
    setRestoring(versionId);
    try {
      const r = await fetch("/api/files/versions/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: versionId }),
      });
      const json = await r.json();
      if (!r.ok) {
        toast.error(json?.error || "복원 실패");
        return;
      }
      toast.success("이전 버전으로 복원했어요");
      onRestored?.();
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error).message || "복원 실패");
    } finally {
      setRestoring(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center justify-between bg-nu-cream/30">
          <div className="flex items-center gap-2">
            <History size={14} className="text-nu-pink" />
            <span className="font-head text-[13px] font-black text-nu-ink">이전 버전</span>
          </div>
          <button onClick={onClose} className="p-1 text-nu-muted hover:text-nu-ink" aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-nu-muted" />
            </div>
          ) : versions.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-nu-muted">
              아직 백업된 버전이 없어요. Drive 동기화 시점에 자동으로 백업됩니다.
            </div>
          ) : (
            <ul className="divide-y divide-nu-ink/10">
              {versions.map((v) => (
                <li key={v.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-nu-ink truncate">{v.label || "백업"}</p>
                    <p className="font-mono-nu text-[10px] text-nu-muted">
                      {new Date(v.created_at).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <button
                    onClick={() => restore(v.id)}
                    disabled={restoring === v.id}
                    className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {restoring === v.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <RotateCcw size={11} />
                    )}
                    복원
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-4 py-2 border-t-[2px] border-nu-ink bg-nu-cream/20">
          <p className="text-[10px] text-nu-muted">
            자료당 최대 5개 보관 · Drive 동기화 직전·복원 직전 자동 백업
          </p>
        </div>
      </div>
    </div>
  );
}
