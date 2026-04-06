"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FileAttachment } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Search,
  FileText,
  Image,
  Film,
  File,
  Trash2,
  ExternalLink,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

function getFileIcon(fileType: string | null) {
  if (!fileType) return <File size={20} />;
  if (fileType.startsWith("image/")) return <Image size={20} className="text-nu-pink" />;
  if (fileType.startsWith("video/")) return <Film size={20} className="text-nu-blue" />;
  if (fileType.includes("pdf") || fileType.includes("document"))
    return <FileText size={20} className="text-nu-amber" />;
  return <File size={20} className="text-nu-graphite" />;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface MeetingResource {
  name: string;
  url: string;
  meetingTitle: string;
  agendaTopic: string;
}

export default function ResourcesPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [files, setFiles] = useState<(FileAttachment & { uploader?: { nickname: string | null } })[]>([]);
  const [meetingResources, setMeetingResources] = useState<MeetingResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Fetch file attachments for this group
    const { data: filesData } = await supabase
      .from("file_attachments")
      .select(
        "*, uploader:profiles!file_attachments_uploaded_by_fkey(nickname)"
      )
      .eq("target_type", "group")
      .eq("target_id", groupId)
      .order("created_at", { ascending: false });

    if (filesData) {
      setFiles(filesData as any);
    }

    // Fetch meeting agenda resources
    const { data: agendas } = await supabase
      .from("meeting_agendas")
      .select(
        "topic, resources, meeting:meetings!meeting_agendas_meeting_id_fkey(title, group_id)"
      )
      .not("resources", "eq", "[]");

    if (agendas) {
      const resources: MeetingResource[] = [];
      for (const agenda of agendas) {
        const meeting = agenda.meeting as any;
        if (meeting?.group_id !== groupId) continue;
        if (!agenda.resources || !Array.isArray(agenda.resources)) continue;
        for (const r of agenda.resources as { name: string; url: string }[]) {
          resources.push({
            name: r.name,
            url: r.url,
            meetingTitle: meeting.title,
            agendaTopic: agenda.topic,
          });
        }
      }
      setMeetingResources(resources);
    }

    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("로그인이 필요합니다");
      setUploading(false);
      return;
    }

    const filePath = `groups/${groupId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("파일 업로드에 실패했습니다");
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(filePath);

    const { error: insertError } = await supabase.from("file_attachments").insert({
      target_type: "group",
      target_id: groupId,
      uploaded_by: user.id,
      file_name: file.name,
      file_url: publicUrl,
      file_size: file.size,
      file_type: file.type,
    });

    if (insertError) {
      toast.error("파일 정보 저장에 실패했습니다");
    } else {
      toast.success("파일이 업로드되었습니다");
      await loadData();
    }
    setUploading(false);
    // Reset input
    e.target.value = "";
  }

  async function handleDelete(fileId: string, fileUrl: string) {
    const supabase = createClient();

    // Delete from storage
    const path = fileUrl.split("/media/")[1];
    if (path) {
      await supabase.storage.from("media").remove([path]);
    }

    // Delete record
    const { error } = await supabase
      .from("file_attachments")
      .delete()
      .eq("id", fileId);

    if (error) {
      toast.error("삭제에 실패했습니다");
    } else {
      toast.success("파일이 삭제되었습니다");
      await loadData();
    }
  }

  const filteredFiles = files.filter((f) =>
    f.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMeetingResources = meetingResources.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-nu-cream/50 w-48" />
          <div className="h-10 bg-nu-cream/50" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-nu-cream/50" />
            <div className="h-24 bg-nu-cream/50" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">
            자료실
          </h1>
          <p className="text-nu-gray text-sm mt-1">
            소모임 파일과 미팅 자료를 관리하세요
          </p>
        </div>
        <label className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-5 py-3 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors inline-flex items-center gap-2 cursor-pointer">
          <Upload size={14} />
          {uploading ? "업로드 중..." : "파일 업로드"}
          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted"
        />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="파일 이름으로 검색"
          className="pl-10 border-nu-ink/15 bg-transparent"
        />
      </div>

      {/* Uploaded files */}
      <section className="mb-10">
        <h2 className="font-head text-xl font-extrabold flex items-center gap-2 mb-4">
          <FileText size={18} className="text-nu-blue" /> 업로드된 파일 (
          {filteredFiles.length})
        </h2>
        {filteredFiles.length === 0 ? (
          <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
            <p className="text-nu-gray text-sm">
              {searchQuery ? "검색 결과가 없습니다" : "업로드된 파일이 없습니다"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="bg-nu-white border border-nu-ink/[0.08] p-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-nu-cream/50 flex items-center justify-center shrink-0">
                  {getFileIcon(file.file_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-nu-ink truncate block hover:text-nu-pink transition-colors no-underline"
                  >
                    {file.file_name}
                  </a>
                  <div className="flex items-center gap-3 mt-1">
                    {file.file_size && (
                      <span className="font-mono-nu text-[10px] text-nu-muted">
                        {formatFileSize(file.file_size)}
                      </span>
                    )}
                    <span className="font-mono-nu text-[10px] text-nu-muted">
                      {new Date(file.created_at).toLocaleDateString("ko")}
                    </span>
                    {(file as any).uploader?.nickname && (
                      <span className="font-mono-nu text-[10px] text-nu-muted">
                        {(file as any).uploader.nickname}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={file.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-nu-muted hover:text-nu-blue transition-colors"
                  >
                    <ExternalLink size={14} />
                  </a>
                  {file.uploaded_by === userId && (
                    <button
                      onClick={() => handleDelete(file.id, file.file_url)}
                      className="text-nu-muted hover:text-nu-red transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Meeting resources */}
      <section>
        <h2 className="font-head text-xl font-extrabold flex items-center gap-2 mb-4">
          <Link2 size={18} className="text-nu-pink" /> 미팅 자료 (
          {filteredMeetingResources.length})
        </h2>
        {filteredMeetingResources.length === 0 ? (
          <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
            <p className="text-nu-gray text-sm">
              {searchQuery
                ? "검색 결과가 없습니다"
                : "미팅 안건에 등록된 자료가 없습니다"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredMeetingResources.map((resource, i) => (
              <a
                key={i}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-nu-white border border-nu-ink/[0.08] p-4 flex items-center gap-4 no-underline hover:border-nu-pink/30 transition-colors"
              >
                <div className="w-10 h-10 bg-nu-pink/10 flex items-center justify-center shrink-0">
                  <ExternalLink size={18} className="text-nu-pink" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-nu-ink truncate">
                    {resource.name}
                  </p>
                  <p className="font-mono-nu text-[10px] text-nu-muted mt-0.5 truncate">
                    {resource.meetingTitle} &middot; {resource.agendaTopic}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
