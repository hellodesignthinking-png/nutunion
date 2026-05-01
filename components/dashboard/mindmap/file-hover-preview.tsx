"use client";

import { File as FileIcon, FileImage, FileText, FileVideo, FileAudio } from "lucide-react";
import type { MindMapData } from "@/lib/dashboard/mindmap-types";

type File = MindMapData["files"][number];

interface Props {
  file: File | null;
}

function pickIcon(mime?: string | null) {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime.includes("text") || mime.includes("pdf") || mime.includes("document")) return FileText;
  return FileIcon;
}

function fmtSize(b?: number | null): string {
  if (!b || b < 0) return "-";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * 파일 노드 hover 시 우상단에 뜨는 가벼운 프리뷰 카드.
 * - 이미지면 url 로 직접 썸네일 (R2 public 또는 Drive thumbnail)
 * - 그 외는 아이콘 + 메타
 * - 클릭하지 않으므로 pointer-events: none — 클릭은 노드 자체로
 */
export function FileHoverPreview({ file }: Props) {
  if (!file) return null;
  const Icon = pickIcon(file.fileType);
  const isImage = file.fileType?.startsWith("image/") && file.url;

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-30 max-w-[260px] bg-white border-[3px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] animate-in fade-in slide-in-from-right-2 duration-150">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.url!}
          alt={file.name}
          className="w-full max-h-40 object-contain bg-stone-100 border-b-[2px] border-nu-ink"
          loading="lazy"
        />
      ) : (
        <div className="flex items-center justify-center bg-stone-100 border-b-[2px] border-nu-ink py-6">
          <Icon size={36} className="text-stone-700" />
        </div>
      )}
      <div className="p-2.5 space-y-1.5">
        <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
          파일 미리보기
        </div>
        <div className="font-head text-[13px] font-extrabold text-nu-ink break-words leading-tight">
          {file.name}
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px] text-nu-muted">
          <div>
            <span className="font-mono-nu uppercase tracking-widest text-[8px]">종류</span>
            <div className="text-nu-ink truncate">{file.fileType || "-"}</div>
          </div>
          <div>
            <span className="font-mono-nu uppercase tracking-widest text-[8px]">크기</span>
            <div className="text-nu-ink">{fmtSize(file.sizeBytes)}</div>
          </div>
          <div className="col-span-2">
            <span className="font-mono-nu uppercase tracking-widest text-[8px]">저장소</span>
            <div className="text-nu-ink">{file.storageType || "supabase"}</div>
          </div>
        </div>
        <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted pt-1 border-t border-nu-ink/10">
          클릭 → 볼트로 이동
        </div>
      </div>
    </div>
  );
}
