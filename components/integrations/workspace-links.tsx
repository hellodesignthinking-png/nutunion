"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ExternalLink, FolderOpen, MessageCircle, FileText, Save, Plus, Loader2, Link2, Calendar, Sheet, Eye } from "lucide-react";
import { ResourcePreviewModal } from "@/components/shared/resource-preview-modal";

interface WorkspaceLinksProps {
  workspaceType: "crew" | "project";
  workspaceId: string;
  canEdit: boolean;
  kakaoUrl?: string | null;
  driveUrl?: string | null;
}

const linkTypes = [
  { key: "google_drive", label: "Google Drive", icon: FolderOpen, color: "text-nu-blue", placeholder: "https://drive.google.com/drive/folders/..." },
  { key: "google_docs", label: "Google Docs", icon: FileText, color: "text-nu-blue", placeholder: "https://docs.google.com/document/..." },
  { key: "google_sheets", label: "Google Sheets", icon: Sheet, color: "text-[#0F9D58]", placeholder: "https://docs.google.com/spreadsheets/..." },
  { key: "google_calendar", label: "Google Calendar", icon: Calendar, color: "text-[#4285F4]", placeholder: "https://calendar.google.com/calendar/..." },
  { key: "notion", label: "Notion", icon: FileText, color: "text-nu-ink", placeholder: "https://www.notion.so/..." },
  { key: "slack", label: "Slack Channel", icon: MessageCircle, color: "text-[#4A154B]", placeholder: "https://your-workspace.slack.com/..." },
  { key: "figma", label: "Figma", icon: Link2, color: "text-[#F24E1E]", placeholder: "https://www.figma.com/..." },
  { key: "github", label: "GitHub", icon: Link2, color: "text-nu-ink", placeholder: "https://github.com/..." },
  { key: "miro", label: "Miro", icon: Link2, color: "text-[#FFD02F]", placeholder: "https://miro.com/app/..." },
  { key: "kakao", label: "카카오톡 오픈채팅", icon: MessageCircle, color: "text-[#FEE500]", placeholder: "https://open.kakao.com/o/..." },
];

interface LinkItem {
  id?: string;
  type: string;
  label: string;
  url: string;
}

export function WorkspaceLinks({ workspaceType, workspaceId, canEdit, kakaoUrl, driveUrl }: WorkspaceLinksProps) {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState("google_drive");
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    loadLinks();
  }, [workspaceId]);

  async function loadLinks() {
    const supabase = createClient();
    const { data } = await supabase
      .from("integrations")
      .select("id, type, name, config")
      .eq("workspace_type", workspaceType)
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .order("created_at");

    const items: LinkItem[] = (data || []).map((d: any) => ({
      id: d.id,
      type: d.type,
      label: d.name,
      url: d.config?.url || d.config?.webhook_url || "",
    }));

    // Add legacy kakao/drive links
    if (kakaoUrl) items.push({ type: "kakao", label: "카카오톡 오픈채팅", url: kakaoUrl });
    if (driveUrl) items.push({ type: "google_drive", label: "Google Drive", url: driveUrl });

    setLinks(items);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newUrl.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const typeInfo = linkTypes.find((t) => t.key === newType);
    const { error } = await supabase.from("integrations").insert({
      workspace_type: workspaceType,
      workspace_id: workspaceId,
      type: ["slack", "notion", "webhook", "discord"].includes(newType) ? newType : "webhook",
      name: newLabel.trim() || typeInfo?.label || newType,
      config: { url: newUrl.trim() },
      is_active: true,
      created_by: user?.id,
    });

    if (error) toast.error(error.message);
    else {
      toast.success("연동이 추가되었습니다");
      setNewUrl("");
      setNewLabel("");
      setShowAdd(false);
      loadLinks();
    }
    setSaving(false);
  }

  async function handleRemove(id: string) {
    const supabase = createClient();
    await supabase.from("integrations").delete().eq("id", id);
    setLinks(links.filter((l) => l.id !== id));
    toast.success("연동이 제거되었습니다");
  }

  function getIcon(type: string) {
    const info = linkTypes.find((t) => t.key === type);
    if (info) {
      const Icon = info.icon;
      return <Icon size={14} className={info.color} />;
    }
    return <Link2 size={14} className="text-nu-muted" />;
  }

  if (loading) return <div className="py-4"><Loader2 size={16} className="animate-spin text-nu-muted mx-auto" /></div>;

  return (
    <div className="bg-nu-white border border-nu-ink/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
          외부 도구 & 링크
        </span>
        {canEdit && (
          <button onClick={() => setShowAdd(!showAdd)} className="text-nu-pink hover:text-nu-pink/80 transition-colors">
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Existing links */}
      {links.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {links.map((link, i) => (
            <div key={link.id || i} className="flex items-center gap-2 group">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-nu-graphite no-underline hover:text-nu-pink transition-colors flex-1 min-w-0 py-1"
              >
                {getIcon(link.type)}
                <span className="truncate">{link.label}</span>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setPreviewData({ url: link.url, name: link.label })}
                    className="p-1 text-nu-muted hover:text-nu-pink transition-colors"
                    title="미리보기"
                  >
                    <Eye size={12} />
                  </button>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1 text-nu-muted hover:text-nu-ink transition-colors">
                    <ExternalLink size={10} />
                  </a>
                </div>
              {canEdit && link.id && (
                <button onClick={() => handleRemove(link.id!)} className="text-nu-muted hover:text-nu-red transition-colors opacity-0 group-hover:opacity-100 text-xs">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-nu-muted py-2">연동된 도구가 없습니다</p>
      )}

      {/* Add new link */}
      {showAdd && (
        <div className="mt-3 pt-3 border-t border-nu-ink/[0.06] space-y-2">
          <div className="grid grid-cols-4 gap-1">
            {linkTypes.map((t) => (
              <button
                key={t.key}
                onClick={() => setNewType(t.key)}
                className={`text-center py-1.5 text-[9px] font-mono-nu uppercase tracking-widest border transition-colors ${
                  newType === t.key ? "bg-nu-ink text-nu-paper border-nu-ink" : "border-nu-ink/10 text-nu-muted hover:border-nu-ink/30"
                }`}
              >
                {t.label.split(" ")[0]}
              </button>
            ))}
          </div>
          <Input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder={linkTypes.find((t) => t.key === newType)?.placeholder}
            className="text-xs border-nu-ink/15 bg-transparent"
          />
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="표시 이름 (선택)"
            className="text-xs border-nu-ink/15 bg-transparent"
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !newUrl.trim()} className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-40 flex items-center gap-1.5">
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} 추가
            </button>
            <button onClick={() => setShowAdd(false)} className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 text-nu-muted hover:text-nu-ink">취소</button>
          </div>
        </div>
      )}
      {/* Resource Preview Modal */}
      <ResourcePreviewModal 
        isOpen={!!previewData}
        onClose={() => setPreviewData(null)}
        url={previewData?.url || ""}
        name={previewData?.name || ""}
      />
    </div>
  );
}
