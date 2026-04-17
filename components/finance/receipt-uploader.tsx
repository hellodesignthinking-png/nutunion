"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const MAX_FILE_SIZE = 750 * 1024; // 750KB raw
const ACCEPT = "image/*,application/pdf";

/**
 * 파일 → data URL 변환 + 이미지는 리사이즈해서 용량 줄임
 */
async function fileToDataUrl(file: File): Promise<string> {
  if (file.type.startsWith("image/")) {
    return await resizeImage(file, 1200, 0.82);
  }
  return await readAsDataUrl(file);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function resizeImage(file: File, maxSide: number, quality: number): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = () => res(null);
    img.onerror = rej;
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export function ReceiptUploader({
  transactionId,
  currentUrl,
}: {
  transactionId: string | number;
  currentUrl?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentUrl || null);
  const [showPreview, setShowPreview] = useState(false);

  const onFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE * 4) {
      toast.error("파일이 너무 큽니다. 3MB 이하로 업로드해주세요.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      if (dataUrl.length > 1_000_000) {
        toast.error("압축 후에도 용량이 큽니다. 더 작은 이미지를 사용하세요.");
        return;
      }
      const res = await fetch(`/api/finance/transactions/${transactionId}/receipt`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_url: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "업로드 실패");
      setPreview(dataUrl);
      toast.success("영수증이 첨부되었습니다");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm("첨부된 영수증을 삭제하시겠습니까?")) return;
    setUploading(true);
    try {
      const res = await fetch(`/api/finance/transactions/${transactionId}/receipt`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_url: null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "삭제 실패");
      setPreview(null);
      toast.success("영수증이 삭제되었습니다");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 items-center flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
          className="hidden"
        />
        {!preview ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="border-[2px] border-nu-ink bg-nu-paper text-nu-ink px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-wider hover:bg-nu-ink hover:text-nu-paper disabled:opacity-50"
          >
            {uploading ? "업로드 중..." : "📎 영수증 첨부"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="border-[2px] border-green-700 bg-green-50 text-green-700 px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-wider hover:bg-green-700 hover:text-white"
            >
              ✓ 영수증 보기
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="border-[2px] border-nu-ink bg-nu-paper text-nu-graphite px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-wider hover:bg-nu-ink hover:text-nu-paper disabled:opacity-50"
            >
              변경
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="border-[2px] border-red-500 bg-nu-paper text-red-600 px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-wider hover:bg-red-500 hover:text-white disabled:opacity-50"
            >
              삭제
            </button>
          </>
        )}
      </div>

      {showPreview && preview && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
        >
          <div className="max-w-3xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            {preview.startsWith("data:image/") || /\.(png|jpg|jpeg|webp|gif)$/i.test(preview) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="영수증" className="max-h-[90vh]" />
            ) : (
              <iframe src={preview} className="w-[80vw] h-[80vh] bg-white" title="영수증" />
            )}
            <button
              onClick={() => setShowPreview(false)}
              className="fixed top-4 right-4 bg-white text-nu-ink px-4 py-2 font-mono-nu text-[11px] uppercase tracking-wider"
            >
              ✕ 닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
