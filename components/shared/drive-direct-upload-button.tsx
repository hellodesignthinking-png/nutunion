"use client";

/**
 * DriveDirectUploadButton — 로컬 파일을 사용자 Google Drive 에 직접 업로드.
 *
 * 사용 시점: 자료실 신규 업로드 시, 편집 가능한 Office 문서를 R2(view-only) 대신
 * Drive 에 두고 싶을 때. 업로드 완료 후 webViewLink 가 자료실 행으로 등록되어
 * 클릭하면 바로 Drive 편집 UI 가 열린다.
 *
 * 제약: Vercel route formData 4.5MB body limit — 큰 파일은 알림.
 *
 * Props:
 *  - targetType: "group" | "project"
 *  - targetId: string
 *  - onUploaded: 등록 후 호출 (목록 갱신용)
 */

import { useRef, useState } from "react";
import { Loader2, Edit3 } from "lucide-react";
import { toast } from "sonner";

interface DriveDirectUploadButtonProps {
  targetType: "group" | "project";
  targetId: string;
  onUploaded: () => void;
  className?: string;
  label?: string;
  stage?: string;
}

const SOFT_LIMIT_BYTES = 4 * 1024 * 1024; // Vercel body limit 안전선

export function DriveDirectUploadButton({
  targetType,
  targetId,
  onUploaded,
  className = "",
  label = "📝 Drive 에 편집용으로 업로드",
  stage,
}: DriveDirectUploadButtonProps) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > SOFT_LIMIT_BYTES) {
      toast.error(
        `Drive 직접 업로드는 4MB 까지만 지원합니다. 더 큰 파일은 R2 업로드 후 [Drive 에서 편집] 으로 사본을 만드세요.`,
      );
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("fileName", file.name);
      fd.append("mimeType", file.type || "application/octet-stream");
      fd.append("targetType", targetType);
      fd.append("targetId", targetId);
      if (stage) fd.append("stage", stage);

      const r = await fetch("/api/google/drive/upload", { method: "POST", body: fd });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (json?.code === "GOOGLE_NOT_CONNECTED" || /연결되지 않/.test(json?.error || "")) {
          toast.error("Google 계정을 먼저 연결해주세요 (설정 → 연동)");
        } else {
          toast.error(json?.error || "Drive 업로드 실패");
        }
        return;
      }
      toast.success("Drive 에 업로드되었어요. 자료실에서 클릭하면 편집창이 열립니다.");
      onUploaded();
    } catch (err: unknown) {
      toast.error((err as Error).message || "업로드 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label
      className={
        className ||
        `flex items-center justify-center gap-2 font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2.5 border-[2px] border-nu-ink/20 hover:border-nu-ink text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-all cursor-pointer ${busy ? "opacity-60 pointer-events-none" : ""}`
      }
      title="로컬 파일을 내 Google Drive 에 업로드 — 그 자리에서 편집 가능"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Edit3 size={13} />}
      {busy ? "업로드 중..." : label}
      <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
    </label>
  );
}
