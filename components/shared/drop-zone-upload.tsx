"use client";

/**
 * components/shared/drop-zone-upload — 드래그앤드롭 업로드 존 (브루탈리스트).
 *
 * - HTML5 drag/drop + click-to-select
 * - 큐에 담긴 각 파일별 진행률 바
 * - 업로드 성공 시 onUploaded(UploadResult) 호출
 * - uploadFile (lib/storage/upload-client) 사용 → R2 우선, Supabase fallback
 */

import { useCallback, useRef, useState } from "react";
import { uploadFile, type UploadResult } from "@/lib/storage/upload-client";

type Prefix = "resources" | "avatars" | "uploads";

interface QueueItem {
  id: string;
  file: File;
  progress: number; // 0-100
  status: "pending" | "uploading" | "done" | "failed";
  error?: string;
  result?: UploadResult;
}

export interface DropZoneUploadProps {
  prefix: Prefix;
  scopeId?: string;
  onUploaded: (file: UploadResult) => void | Promise<void>;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  className?: string;
  label?: string;
}

export function DropZoneUpload(props: DropZoneUploadProps) {
  const { prefix, scopeId, onUploaded, multiple = true, accept, maxFiles = 20, label } = props;

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startUpload = useCallback(async (files: File[]) => {
    const picked = files.slice(0, maxFiles);
    const items: QueueItem[] = picked.map((f, i) => ({
      id: `${Date.now()}_${i}_${f.name}`,
      file: f,
      progress: 0,
      status: "pending",
    }));
    setQueue((prev) => [...prev, ...items]);

    for (const item of items) {
      setQueue((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, status: "uploading" } : x)),
      );
      try {
        const result = await uploadFile(item.file, {
          prefix: prefix as any,
          scopeId,
          onProgress: (pct) => {
            setQueue((prev) =>
              prev.map((x) => (x.id === item.id ? { ...x, progress: pct } : x)),
            );
          },
        });
        setQueue((prev) =>
          prev.map((x) =>
            x.id === item.id ? { ...x, status: "done", progress: 100, result } : x,
          ),
        );
        try {
          await onUploaded(result);
        } catch (err) {
          console.warn("[drop-zone] onUploaded failed", err);
        }
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((x) =>
            x.id === item.id ? { ...x, status: "failed", error: err?.message || "실패" } : x,
          ),
        );
      }
    }
  }, [prefix, scopeId, maxFiles, onUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) startUpload(files);
  }, [startUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) startUpload(files);
    e.target.value = "";
  }, [startUpload]);

  return (
    <div className={props.className}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!dragOver) setDragOver(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          // only unset if leaving the zone itself (not children)
          if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={handleDrop}
        style={{
          border: dragOver ? "3px dashed var(--nu-pink, #ff3d6f)" : "3px dashed var(--nu-ink, #111)",
          background: dragOver ? "rgba(255,61,111,0.08)" : "var(--nu-cream, #fdf6e3)",
          textAlign: "center",
          cursor: "pointer",
          transition: "all 120ms",
          userSelect: "none",
        }}
        className="dropzone-brutalist px-6 py-5 md:py-8"
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--nu-ink, #111)" }}>
          {dragOver
            ? "📥 놓으면 업로드"
            : (label || "📎 파일을 이 영역에 드래그하거나 클릭해서 선택")}
        </div>
        {!dragOver && (
          <div style={{ fontSize: 12, marginTop: 6, color: "rgba(0,0,0,0.55)" }}>
            최대 {maxFiles}개 · R2 우선, Supabase 폴백
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleFileInput}
        style={{ display: "none" }}
      />

      {queue.length > 0 && (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {queue.map((item) => (
            <div
              key={item.id}
              style={{
                border: "2px solid var(--nu-ink, #111)",
                padding: "8px 12px",
                background: "#fff",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={item.file.name}
                >
                  {item.file.name}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    height: 6,
                    background: "#eee",
                    border: "1px solid var(--nu-ink, #111)",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${item.progress}%`,
                      background:
                        item.status === "failed"
                          ? "#ff3d3d"
                          : item.status === "done"
                            ? "#22c55e"
                            : "var(--nu-pink, #ff3d6f)",
                      transition: "width 200ms",
                    }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                {item.status === "pending" && "대기"}
                {item.status === "uploading" && `${item.progress}%`}
                {item.status === "done" && "✓ 완료"}
                {item.status === "failed" && `✗ ${item.error || "실패"}`}
              </div>
            </div>
          ))}
          {queue.some((q) => q.status === "done" || q.status === "failed") && (
            <button
              type="button"
              onClick={() => setQueue((prev) => prev.filter((x) => x.status === "uploading" || x.status === "pending"))}
              style={{
                alignSelf: "start",
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                border: "2px solid var(--nu-ink, #111)",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              완료된 항목 지우기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default DropZoneUpload;
