"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Upload, Trash2, Copy, Image as ImageIcon, Video, Link2, Loader2 } from "lucide-react";

interface MediaFile {
  name: string;
  url: string;
  type: string;
  size: number;
  created_at: string;
}

export default function AdminMediaPage() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    const supabase = createClient();
    const { data, error } = await supabase.storage.from("media").list("", {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) {
      // Storage bucket might not exist yet
      if (error.message.includes("not found")) {
        toast.error("미디어 스토리지 버킷이 없습니다. Supabase에서 'media' 버킷을 생성해주세요.");
      }
      setLoading(false);
      return;
    }

    const mediaFiles: MediaFile[] = (data || [])
      .filter((f) => f.name !== ".emptyFolderPlaceholder")
      .map((f) => {
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(f.name);
        const isVideo = /\.(mp4|webm|mov|avi)$/i.test(f.name);
        return {
          name: f.name,
          url: urlData.publicUrl,
          type: isVideo ? "video" : "image",
          size: f.metadata?.size || 0,
          created_at: f.created_at || "",
        };
      });

    setFiles(mediaFiles);
    setLoading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    const supabase = createClient();

    for (const file of Array.from(selectedFiles)) {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage.from("media").upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) {
        toast.error(`${file.name} 업로드 실패: ${error.message}`);
      } else {
        toast.success(`${file.name} 업로드 완료`);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadFiles();
  }

  async function handleDelete(fileName: string) {
    if (!confirm(`"${fileName}"을 삭제하시겠습니까?`)) return;
    const supabase = createClient();
    const { error } = await supabase.storage.from("media").remove([fileName]);
    if (error) {
      toast.error("삭제 실패: " + error.message);
      return;
    }
    toast.success("삭제되었습니다");
    setFiles(files.filter((f) => f.name !== fileName));
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("URL이 복사되었습니다");
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">
            미디어 관리
          </h1>
          <p className="text-nu-gray text-sm mt-1">
            이미지와 영상을 업로드하고 관리합니다. 업로드한 파일의 URL을 콘텐츠 편집에서 사용할 수 있습니다.
          </p>
        </div>
      </div>

      {/* Upload area */}
      <div className="bg-nu-white border-2 border-dashed border-nu-ink/15 p-10 text-center mb-8 hover:border-nu-pink/40 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleUpload}
          className="hidden"
          id="media-upload"
        />
        <label htmlFor="media-upload" className="cursor-pointer flex flex-col items-center gap-3">
          {uploading ? (
            <Loader2 size={32} className="text-nu-pink animate-spin" />
          ) : (
            <Upload size={32} className="text-nu-muted" />
          )}
          <div>
            <p className="font-head text-sm font-bold text-nu-ink">
              {uploading ? "업로드 중..." : "클릭하여 파일 선택"}
            </p>
            <p className="font-mono-nu text-[10px] text-nu-muted mt-1">
              JPG, PNG, GIF, SVG, MP4, WEBM (최대 50MB)
            </p>
          </div>
        </label>
      </div>

      {/* Files grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-nu-muted" size={24} />
        </div>
      ) : files.length === 0 ? (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-12 text-center">
          <ImageIcon size={32} className="mx-auto text-nu-muted mb-3" />
          <p className="text-nu-gray text-sm">업로드된 미디어가 없습니다</p>
          <p className="font-mono-nu text-[10px] text-nu-muted mt-2">
            이미지나 영상을 업로드해주세요
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((f) => (
            <div key={f.name} className="bg-nu-white border border-nu-ink/[0.06] overflow-hidden group">
              {/* Preview */}
              <div className="relative aspect-square bg-nu-cream overflow-hidden">
                {f.type === "video" ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-nu-ink">
                    <Video size={32} className="text-nu-paper/30" />
                    <video src={f.url} className="absolute inset-0 w-full h-full object-cover opacity-60" muted preload="metadata" />
                  </div>
                ) : (
                  <img src={f.url} alt={f.name} className="w-full h-full object-cover" loading="lazy" />
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-nu-ink/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button onClick={() => copyUrl(f.url)} className="p-2 bg-nu-paper/20 hover:bg-nu-paper/30 transition-colors rounded" title="URL 복사">
                    <Copy size={16} className="text-nu-paper" />
                  </button>
                  <button onClick={() => handleDelete(f.name)} className="p-2 bg-nu-red/30 hover:bg-nu-red/50 transition-colors rounded" title="삭제">
                    <Trash2 size={16} className="text-nu-paper" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-[11px] text-nu-graphite truncate font-medium">{f.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono-nu text-[9px] text-nu-muted uppercase">{f.type}</span>
                  <span className="font-mono-nu text-[9px] text-nu-muted">{formatSize(f.size)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      <div className="mt-10 bg-nu-cream/50 border border-nu-ink/[0.06] p-6">
        <h3 className="font-head text-sm font-bold text-nu-ink mb-2">사용 방법</h3>
        <ol className="text-xs text-nu-gray leading-relaxed space-y-1.5 list-decimal list-inside">
          <li>이미지나 영상을 업로드합니다</li>
          <li>파일에 마우스를 올리고 <Copy size={10} className="inline" /> 버튼으로 URL을 복사합니다</li>
          <li><strong>콘텐츠 관리</strong> 페이지에서 해당 URL을 이미지/영상 필드에 붙여넣습니다</li>
          <li>너트 이미지에도 URL을 사용할 수 있습니다</li>
        </ol>
      </div>
    </div>
  );
}
