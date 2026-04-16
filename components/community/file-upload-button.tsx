"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Paperclip, Loader2, FileText, X } from "lucide-react";

interface FileUploadButtonProps {
  targetType: "project_update" | "crew_post" | "project_task" | "project" | "group";
  targetId: string;
  userId: string;
  onUploaded?: (file: { name: string; url: string }) => void;
}

export function FileUploadButton({ targetType, targetId, userId, onUploaded }: FileUploadButtonProps) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const fileName = `${targetType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("media").upload(fileName, file, { cacheControl: "3600" });
    if (uploadErr) {
      toast.error("파일 업로드 실패");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);

    const { error } = await supabase.from("file_attachments").insert({
      target_type: targetType,
      target_id: targetId,
      uploaded_by: userId,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
      file_type: file.type,
    });

    if (error) { toast.error("파일 저장 실패"); }
    else {
      toast.success(`${file.name} 첨부됨`);
      onUploaded?.({ name: file.name, url: urlData.publicUrl });
    }
    setUploading(false);
    e.target.value = "";
  }

  return (
    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-nu-muted hover:text-nu-pink hover:bg-nu-pink/5 transition-colors cursor-pointer font-mono-nu text-[12px]">
      {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
      {uploading ? "업로드중..." : "파일첨부"}
      <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
    </label>
  );
}

// Display attached files
interface AttachedFilesProps {
  targetType: string;
  targetId: string;
}

export function AttachedFiles({ targetType, targetId }: AttachedFilesProps) {
  const [files, setFiles] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("file_attachments")
        .select("id, file_name, file_url, file_size, file_type")
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .order("created_at");
      setFiles(data || []);
    })();
  }, [targetType, targetId]);

  if (files.length === 0) return null;

  function formatSize(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((f) => (
        <a
          key={f.id}
          href={f.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-nu-cream/50 border border-nu-ink/[0.06] text-xs text-nu-graphite no-underline hover:border-nu-blue/30 transition-colors"
        >
          <FileText size={11} className="text-nu-blue shrink-0" />
          <span className="truncate max-w-[120px]">{f.file_name}</span>
          {f.file_size && <span className="text-nu-muted text-[11px]">{formatSize(f.file_size)}</span>}
        </a>
      ))}
    </div>
  );
}
