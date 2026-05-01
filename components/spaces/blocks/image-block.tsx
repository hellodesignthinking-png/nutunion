"use client";

import { useRef, useState } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SpaceBlock } from "../space-pages-types";

interface ImageData {
  url?: string;
  alt?: string;
  width?: number;
}

interface Props {
  block: SpaceBlock;
  onChange: (patch: Partial<SpaceBlock>) => void;
}

const MAX_BYTES = 3_000_000; // 3MB — base64 ~4MB
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/**
 * 이미지 블록 — 파일 업로드 / URL 붙여넣기 / 클립보드 paste 모두 지원.
 * 작은 이미지는 base64 inline (jsonb), 큰 이미지는 URL 만 저장 권장.
 */
export function ImageBlock({ block, onChange }: Props) {
  const data = (block.data as ImageData | undefined) ?? {};
  const [draftUrl, setDraftUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function loadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 가능");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`파일이 너무 커요 (${(file.size / 1024 / 1024).toFixed(1)}MB) — 3MB 이하`);
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange({ data: { ...(block.data || {}), url: dataUrl, alt: file.name } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "읽기 실패");
    } finally {
      setBusy(false);
    }
  }

  function applyUrl() {
    const u = draftUrl.trim();
    if (!u) return;
    onChange({ data: { ...(block.data || {}), url: u } });
    setDraftUrl("");
  }

  function clearImage() {
    if (!window.confirm("이미지를 제거할까요?")) return;
    onChange({ data: { ...(block.data || {}), url: undefined } });
  }

  if (!data.url) {
    return (
      <div
        className="my-1 border-[2px] border-dashed border-nu-ink/30 bg-nu-cream/20 px-3 py-3 space-y-2"
        onPaste={async (e) => {
          const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith("image/"));
          if (item) {
            e.preventDefault();
            const f = item.getAsFile();
            if (f) await loadFile(f);
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) await loadFile(f);
        }}
      >
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
          📷 이미지 — 파일 / URL / 붙여넣기 / 드래그
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-ink bg-nu-ink text-nu-paper disabled:opacity-30 flex items-center gap-1"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} 파일 선택
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await loadFile(f);
              e.target.value = "";
            }}
          />
          <span className="font-mono-nu text-[9px] text-nu-muted">또는</span>
          <input
            type="url"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyUrl(); } }}
            placeholder="https://image.url"
            className="flex-1 px-2 py-1 text-[12px] border-[2px] border-nu-ink/20 focus:border-nu-ink outline-none bg-white"
          />
          <button
            type="button"
            onClick={applyUrl}
            disabled={!draftUrl.trim()}
            className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-ink/40 hover:bg-nu-cream disabled:opacity-30"
          >
            URL
          </button>
        </div>
      </div>
    );
  }

  return (
    <figure className="my-1 group relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.url}
        alt={data.alt || ""}
        className="max-w-full border-[2px] border-nu-ink"
        style={data.width ? { width: data.width } : undefined}
      />
      {data.alt && (
        <figcaption className="text-[11px] text-nu-muted mt-1 italic">{data.alt}</figcaption>
      )}
      <button
        type="button"
        onClick={clearImage}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-white border-[2px] border-nu-ink p-1 hover:bg-red-50 hover:text-red-600"
        title="이미지 제거"
      >
        <Trash2 size={11} />
      </button>
    </figure>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}
