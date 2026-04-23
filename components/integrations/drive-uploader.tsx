"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Loader2, AlertTriangle, X, HardDrive, FolderOpen } from "lucide-react";
import { toast } from "sonner";

interface SharedFolder {
  id: string;
  url: string;
}

interface DriveUploaderProps {
  /** Called with file info after successful upload */
  onUploaded: (file: { name: string; url: string; mimeType: string }) => void;
  /** Optional: auto-register in DB (group or project) */
  targetType?: "group" | "project";
  targetId?: string;
  /** For project resources: stage */
  stage?: string;
  /** If provided, uploads go to this shared folder (no user Google connection needed) */
  sharedFolder?: SharedFolder | null;
}

export function DriveUploader({ onUploaded, targetType, targetId, stage, sharedFolder }: DriveUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [showReauthDialog, setShowReauthDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Only check user's Google connection when there's no shared folder
    if (!sharedFolder) {
      fetch("/api/google/status")
        .then((r) => r.json())
        .then((d) => setConnected(d.connected))
        .catch(() => setConnected(false));
    } else {
      setConnected(true); // shared folder uses host's token — user doesn't need their own
    }
  }, [sharedFolder]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // R2 업로드는 Google 연결 불필요 — 체크 생략

    setUploading(true);
    let successCount = 0;

    // [Drive migration Phase 3a/3b] 업로드 백엔드: Google Drive → Cloudflare R2 로 전환.
    // 기존에 /api/google/drive/upload 로 FormData 를 보내던 코드가 Vercel 4.5MB 바디 제한으로
    // 큰 파일에서 413 을 뱉었음. 이제는 클라에서 R2 에 직접 PUT (presigned URL) 후 DB 에 메타만 저장.
    const { uploadFile } = await import("@/lib/storage/upload-client");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`${i + 1}/${files.length}: ${file.name}`);

      // 200MB 까지 허용 (R2 presign 한도)
      if (file.size > 200 * 1024 * 1024) {
        toast.error(`"${file.name}" — 200MB 초과. 건너뜁니다.`);
        continue;
      }

      try {
        const up = await uploadFile(file, {
          prefix: "resources",
          scopeId: targetId || undefined,
        });

        // targetType/targetId 있으면 자동으로 DB 에 등록
        if (targetType && targetId) {
          try {
            const endpoint =
              targetType === "group"
                ? "/api/resources/group"
                : "/api/resources/project";
            await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                group_id: targetType === "group" ? targetId : undefined,
                project_id: targetType === "project" ? targetId : undefined,
                file_name: up.name,
                file_url: up.url,
                file_size: up.size,
                file_type: up.mime,
                storage_type: up.storage,
                storage_key: up.key,
                stage: stage || undefined,
              }),
            });
          } catch { /* DB 등록 실패해도 업로드 자체는 성공 — onUploaded 에서 caller 가 처리 */ }
        }

        onUploaded({
          name: up.name,
          url: up.url,
          mimeType: up.mime,
        });

        successCount++;
      } catch (err: unknown) {
        const __err = err as { message?: string; code?: number; name?: string };
        toast.error(`"${file.name}" 업로드 실패: ${__err.message}`);
      }
    }

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? `파일이 서버에 업로드되었습니다`
          : `${successCount}개 파일이 서버에 업로드되었습니다`
      );
    }

    setUploading(false);
    setUploadProgress("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleReauth() {
    setShowReauthDialog(false);
    window.location.href = "/api/auth/google?prompt=consent&returnTo=" + encodeURIComponent(window.location.pathname + window.location.search);
  }

  const hasSharedFolder = !!sharedFolder;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        multiple
      />
      <button
        onClick={() => {
          if (!hasSharedFolder && !connected) {
            window.location.href = "/api/auth/google?returnTo=" + encodeURIComponent(window.location.pathname + window.location.search);
            return;
          }
          fileInputRef.current?.click();
        }}
        disabled={uploading}
        className={`flex items-center gap-2 font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 border-[2px] transition-all disabled:opacity-50 cursor-pointer ${
          hasSharedFolder
            ? "bg-green-600/10 text-green-700 border-green-600/30 hover:bg-green-600/20"
            : "bg-green-600/10 text-green-700 border-green-600/20 hover:bg-green-600/20"
        }`}
        title={
          hasSharedFolder
            ? `공유 폴더에 업로드 — ${sharedFolder!.url}`
            : "파일을 선택하면 Google Drive에 업로드 후 자료실에 자동 등록됩니다"
        }
      >
        {uploading ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            <span className="max-w-[120px] truncate">{uploadProgress || "업로드 중..."}</span>
          </>
        ) : hasSharedFolder ? (
          <><FolderOpen size={13} /> 공유 폴더 업로드</>
        ) : connected === false ? (
          <><HardDrive size={13} /> Drive 연결</>
        ) : (
          <><Upload size={13} /> Drive 업로드</>
        )}
      </button>

      {/* Re-auth Dialog (only for non-shared-folder case) */}
      {showReauthDialog && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="bg-orange-50 border-b border-orange-200 px-5 py-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-500" />
              <h3 className="font-head text-sm font-bold text-orange-800">권한 업데이트 필요</h3>
              <button
                onClick={() => setShowReauthDialog(false)}
                className="ml-auto text-orange-400 hover:text-orange-600 cursor-pointer bg-transparent border-none"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-nu-graphite leading-relaxed">
                Google Drive에 파일을 업로드하려면 새로운 업로드 권한이 필요합니다.
                아래 버튼을 눌러 Google 계정을 다시 연결해주세요.
              </p>
              <p className="text-[13px] text-nu-muted">
                기존 연결된 드라이브 파일 보기 권한은 유지됩니다.
              </p>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setShowReauthDialog(false)}
                  className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 border border-nu-ink/10 text-nu-muted hover:bg-nu-ink/5 transition-all cursor-pointer"
                >
                  나중에
                </button>
                <button
                  onClick={handleReauth}
                  className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 bg-green-600 text-white border border-green-600 hover:bg-green-700 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <HardDrive size={12} /> Google 재연결
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
