"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FileAttachment } from "@/lib/types";
import { Input } from "@/components/ui/input";
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
  FolderOpen,
  HardDrive,
  Plus,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { DrivePicker } from "@/components/integrations/drive-picker";

function getFileIcon(fileType: string | null) {
  if (!fileType) return <File size={20} />;
  if (fileType.startsWith("image/")) return <Image size={20} className="text-nu-pink" />;
  if (fileType.startsWith("video/")) return <Film size={20} className="text-nu-blue" />;
  if (fileType.includes("pdf") || fileType.includes("document")) return <FileText size={20} className="text-nu-amber" />;
  if (fileType === "drive-link") return <HardDrive size={20} className="text-green-600" />;
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
  const [isManager, setIsManager] = useState(false);
  const [activeTab, setActiveTab] = useState<"files" | "drive" | "meetings">("files");
  const [groupName, setGroupName] = useState("");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // 매니저/호스트 여부 확인
    const [{ data: grp }, { data: membership }] = await Promise.all([
      supabase.from("groups").select("name, host_id").eq("id", groupId).single(),
      supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", user.id).maybeSingle(),
    ]);
    if (grp) {
      setGroupName(grp.name || "소모임");
      setIsManager(grp.host_id === user.id || membership?.role === "manager" || membership?.role === "host");
    }

    const { data: filesData } = await supabase
      .from("file_attachments")
      .select("*, uploader:profiles!file_attachments_uploaded_by_fkey(nickname)")
      .eq("target_type", "group")
      .eq("target_id", groupId)
      .order("created_at", { ascending: false });

    if (filesData) setFiles(filesData as any);

    const { data: agendas } = await supabase
      .from("meeting_agendas")
      .select("topic, resources, meeting:meetings!meeting_agendas_meeting_id_fkey(title, group_id)")
      .not("resources", "eq", "[]");

    if (agendas) {
      const resources: MeetingResource[] = [];
      for (const agenda of agendas) {
        const meeting = agenda.meeting as any;
        if (meeting?.group_id !== groupId) continue;
        if (!agenda.resources || !Array.isArray(agenda.resources)) continue;
        for (const r of agenda.resources as { name: string; url: string }[]) {
          resources.push({ name: r.name, url: r.url, meetingTitle: meeting.title, agendaTopic: agenda.topic });
        }
      }
      setMeetingResources(resources);
    }

    setLoading(false);
  }, [groupId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("로그인이 필요합니다"); setUploading(false); return; }

    const filePath = `groups/${groupId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("media").upload(filePath, file);
    if (uploadError) { toast.error("파일 업로드에 실패했습니다"); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(filePath);

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
    e.target.value = "";
  }

  // Called when user picks a file from Google Drive
  async function handleDriveFilePicked(driveFile: { name: string; url: string; mimeType: string }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("로그인이 필요합니다"); return; }

    const { error } = await supabase.from("file_attachments").insert({
      target_type: "group",
      target_id: groupId,
      uploaded_by: user.id,
      file_name: driveFile.name,
      file_url: driveFile.url,
      file_size: null,
      file_type: "drive-link",
    });

    if (error) {
      toast.error("드라이브 파일 등록에 실패했습니다");
    } else {
      toast.success(`"${driveFile.name}" 을(를) 자료실에 추가했습니다`);
      await loadData();
    }
  }

  async function handleDelete(fileId: string, fileUrl: string, fileType: string | null) {
    const supabase = createClient();

    // Only delete from Supabase storage if it's NOT a drive link
    if (fileType !== "drive-link") {
      const path = fileUrl.split("/media/")[1];
      if (path) await supabase.storage.from("media").remove([path]);
    }

    const { error } = await supabase.from("file_attachments").delete().eq("id", fileId);
    if (error) {
      toast.error("삭제에 실패했습니다");
    } else {
      toast.success("파일이 삭제되었습니다");
      await loadData();
    }
  }

  const uploadedFiles = files.filter((f) => f.file_type !== "drive-link");
  const driveFiles = files.filter((f) => f.file_type === "drive-link");

  const filteredUploadedFiles = uploadedFiles.filter((f) => f.file_name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredDriveFiles = driveFiles.filter((f) => f.file_name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredMeetingResources = meetingResources.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
    <div className="max-w-5xl mx-auto px-8 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 mb-6 font-mono-nu text-[11px] uppercase tracking-widest">
        <Link href={`/groups/${groupId}`}
          className="text-nu-muted hover:text-nu-ink no-underline flex items-center gap-1 transition-colors">
          <ArrowLeft size={12} /> {groupName || "소모임"}
        </Link>
        <ChevronRight size={12} className="text-nu-muted/40" />
        <span className="text-nu-ink">자료실</span>
      </nav>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">자료실</h1>
          <p className="text-nu-gray text-sm mt-1">소모임 파일, 드라이브, 미팅 자료를 한곳에서 관리하세요</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Google Drive Picker */}
          <DrivePicker onFilePicked={handleDriveFilePicked} />

          {/* Direct file upload */}
          <label className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2.5 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors inline-flex items-center gap-2 cursor-pointer">
            <Upload size={13} />
            {uploading ? "업로드 중..." : "파일 업로드"}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="파일 이름으로 검색"
          className="pl-10 border-nu-ink/15 bg-transparent"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b-[2px] border-nu-ink/[0.08] mb-6">
        {([
          { key: "files", label: "업로드 파일", icon: <Upload size={13} />, count: filteredUploadedFiles.length },
          { key: "drive", label: "Google Drive", icon: <HardDrive size={13} />, count: filteredDriveFiles.length },
          { key: "meetings", label: "미팅 자료", icon: <Link2 size={13} />, count: filteredMeetingResources.length },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 font-mono-nu text-[11px] uppercase tracking-widest px-5 py-3 border-b-[3px] transition-all ${
              activeTab === tab.key
                ? "border-nu-pink text-nu-ink font-bold"
                : "border-transparent text-nu-muted hover:text-nu-graphite"
            }`}
          >
            {tab.icon} {tab.label}
            <span className={`px-1.5 py-0.5 text-[9px] rounded ${activeTab === tab.key ? "bg-nu-pink/10 text-nu-pink" : "bg-nu-ink/5 text-nu-muted"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab: Uploaded Files */}
      {activeTab === "files" && (
        <section>
          {filteredUploadedFiles.length === 0 ? (
            <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-12 text-center">
              <Upload size={32} className="text-nu-muted mx-auto mb-3" />
              <p className="text-nu-gray text-sm mb-2">{searchQuery ? "검색 결과가 없습니다" : "업로드된 파일이 없습니다"}</p>
              <p className="font-mono-nu text-[10px] text-nu-muted">위의 '파일 업로드' 버튼을 눌러 파일을 추가하세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredUploadedFiles.map((file) => (
                <FileCard key={file.id} file={file} userId={userId} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab: Google Drive Links */}
      {activeTab === "drive" && (
        <section>
          {filteredDriveFiles.length === 0 ? (
            <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-12 text-center">
              <HardDrive size={32} className="text-green-400 mx-auto mb-3" />
              <p className="text-nu-gray text-sm mb-2">{searchQuery ? "검색 결과가 없습니다" : "구글 드라이브 파일이 없습니다"}</p>
              <p className="font-mono-nu text-[10px] text-nu-muted">상단의 'Drive 연결' 버튼으로 드라이브 파일을 추가하세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredDriveFiles.map((file) => (
                <FileCard key={file.id} file={file} userId={userId} onDelete={handleDelete} isDrive />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab: Meeting Materials */}
      {activeTab === "meetings" && (
        <section>
          {filteredMeetingResources.length === 0 ? (
            <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-12 text-center">
              <Link2 size={32} className="text-nu-pink mx-auto mb-3" />
              <p className="text-nu-gray text-sm">{searchQuery ? "검색 결과가 없습니다" : "미팅 안건에 등록된 자료가 없습니다"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMeetingResources.map((resource, i) => (
                <a
                  key={i}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-4 flex items-center gap-4 no-underline hover:border-nu-pink/40 transition-colors"
                >
                  <div className="w-10 h-10 bg-nu-pink/10 flex items-center justify-center shrink-0">
                    <ExternalLink size={18} className="text-nu-pink" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-nu-ink truncate">{resource.name}</p>
                    <p className="font-mono-nu text-[10px] text-nu-muted mt-0.5 truncate">
                      {resource.meetingTitle} · {resource.agendaTopic}
                    </p>
                  </div>
                  <ExternalLink size={13} className="text-nu-muted shrink-0" />
                </a>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function FileCard({
  file, userId, onDelete, isDrive,
}: {
  file: FileAttachment & { uploader?: { nickname: string | null } };
  userId: string | null;
  onDelete: (id: string, url: string, type: string | null) => void;
  isDrive?: boolean;
}) {
  return (
    <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-4 flex items-center gap-4 hover:border-nu-blue/30 transition-colors group">
      <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${isDrive ? "bg-green-50" : "bg-nu-cream/50"}`}>
        {isDrive ? <HardDrive size={18} className="text-green-600" /> : getFileIcon(file.file_type)}
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
        <div className="flex items-center gap-2 mt-0.5">
          {isDrive && <span className="font-mono-nu text-[9px] text-green-600 bg-green-50 px-1.5 py-0.5">Drive</span>}
          {file.file_size && <span className="font-mono-nu text-[10px] text-nu-muted">{formatFileSize(file.file_size)}</span>}
          <span className="font-mono-nu text-[10px] text-nu-muted">{new Date(file.created_at).toLocaleDateString("ko")}</span>
          {(file as any).uploader?.nickname && (
            <span className="font-mono-nu text-[10px] text-nu-muted">{(file as any).uploader.nickname}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-nu-muted hover:text-nu-blue transition-colors">
          <ExternalLink size={14} />
        </a>
        {file.uploaded_by === userId && (
          <button onClick={() => onDelete(file.id, file.file_url, file.file_type)} className="p-1.5 text-nu-muted hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
