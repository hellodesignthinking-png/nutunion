"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Loader2, CheckCircle2, AlertTriangle, X, HardDrive } from "lucide-react";
import { toast } from "sonner";

interface DriveUploaderProps {
  /** Called with file info after successful upload */
  onUploaded: (file: { name: string; url: string; mimeType: string }) => void;
  /** Optional: auto-register in DB (group or project) */
  targetType?: "group" | "project";
  targetId?: string;
  /** For project resources: stage */
  stage?: string;
}

export function DriveUploader({ onUploaded, targetType, targetId, stage }: DriveUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const [showReauthDialog, setShowReauthDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/google/status")
      .then((r) => r.json())
      .then((d) => setConnected(d.connected))
      .catch(() => setConnected(false));
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!connected) {
      toast.error("Google 계정을 먼저 연결해주세요");
      window.location.href = "/api/auth/google";
      return;
    }

    setUploading(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`${i + 1}/${files.length}: ${file.name}`);

      // 50MB limit per file
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`"${file.name}" — 50MB 초과. 건너뜁니다.`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);
        if (targetType && targetId) {
          formData.append("targetType", targetType);
          formData.append("targetId", targetId);
          if (stage) formData.append("stage", stage);
        }

        const res = await fetch("/api/google/drive/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          // Handle scope / auth errors
          if (
            data.code === "SCOPE_INSUFFICIENT" ||
            data.code === "NOT_CONNECTED" ||
            data.code === "TOKEN_EXPIRED"
          ) {
            setConnected(false);
            setShowReauthDialog(true);
            break; // Stop uploading remaining files
          }
          throw new Error(data.error || "업로드 실패");
        }

        onUploaded({
          name: data.file.name,
          url: data.file.webViewLink,
          mimeType: data.file.mimeType,
        });

        successCount++;
      } catch (err: any) {
        toast.error(`"${file.name}" 업로드 실패: ${err.message}`);
      }
    }

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? "Google Drive에 파일이 업로드되었습니다"
          : `${successCount}개 파일이 Google Drive에 업로드되었습니다`
      );
    }

    setUploading(false);
    setUploadProgress("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleReauth() {
    setShowReauthDialog(false);
    // Force re-authentication with updated scopes
    window.location.href = "/api/auth/google?prompt=consent";
  }

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
          if (!connected) {
            window.location.href = "/api/auth/google";
            return;
          }
          fileInputRef.current?.click();
        }}
        disabled={uploading}
        className="flex items-center gap-2 font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 bg-green-600/10 text-green-700 border-[2px] border-green-600/20 hover:bg-green-600/20 transition-all disabled:opacity-50 cursor-pointer"
        title="파일을 선택하면 Google Drive에 업로드 후 자료실에 자동 등록됩니다"
      >
        {uploading ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            <span className="max-w-[120px] truncate">{uploadProgress || "업로드 중..."}</span>
          </>
        ) : connected === false ? (
          <><HardDrive size={13} /> Drive 연결</>
        ) : (
          <><Upload size={13} /> Drive 업로드</>
        )}
      </button>

      {/* Re-auth Dialog */}
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
              <p className="text-[11px] text-nu-muted">
                기존 연결된 드라이브 파일 보기 권한은 유지됩니다.
              </p>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setShowReauthDialog(false)}
                  className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 border border-nu-ink/10 text-nu-muted hover:bg-nu-ink/5 transition-all cursor-pointer"
                >
                  나중에
                </button>
                <button
                  onClick={handleReauth}
                  className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2 bg-green-600 text-white border border-green-600 hover:bg-green-700 transition-all cursor-pointer flex items-center gap-1.5"
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
