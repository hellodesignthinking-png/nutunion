"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  FileEdit,
  FileClock,
  FileCheck,
  FileBadge,
  FileText,
  Sheet,
  BookOpen,
  Link,
  Link2,
  Search,
  Plus,
  X,
  ExternalLink,
  Grid3x3,
  List,
  Loader2,
  HardDrive,
  Image,
  Film,
  Presentation,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { DrivePicker } from "@/components/integrations/drive-picker";

type ResourceStage = "planning" | "interim" | "evidence" | "final";
type ResourceType = "google_doc" | "google_sheet" | "google_slide" | "drive" | "notion" | "link";

interface ProjectResource {
  id: string;
  project_id: string;
  name: string;
  url: string;
  type: ResourceType;
  stage: ResourceStage;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploader?: { nickname: string | null };
}

const stageConfig: Record<
  ResourceStage,
  { icon: typeof FileEdit; label: string; color: string; badge: string }
> = {
  planning: { icon: FileEdit, label: "기획안", color: "nu-blue", badge: "bg-nu-blue/10 text-nu-blue border-nu-blue/20" },
  interim: { icon: FileClock, label: "중간 결과물", color: "nu-amber", badge: "bg-nu-amber/10 text-nu-amber border-nu-amber/20" },
  evidence: { icon: FileCheck, label: "증빙 자료", color: "nu-pink", badge: "bg-nu-pink/10 text-nu-pink border-nu-pink/20" },
  final: { icon: FileBadge, label: "최종 결과물", color: "green-600", badge: "bg-green-50 text-green-600 border-green-200" },
};

const typeConfig: Record<ResourceType, { icon: typeof FileText; label: string; color: string }> = {
  google_doc: { icon: FileText, label: "Google Docs", color: "text-blue-600" },
  google_sheet: { icon: Sheet, label: "Google Sheets", color: "text-green-600" },
  google_slide: { icon: Presentation, label: "Google Slides", color: "text-amber-600" },
  drive: { icon: HardDrive, label: "Google Drive", color: "text-green-600" },
  notion: { icon: BookOpen, label: "Notion", color: "text-nu-ink" },
  link: { icon: Link, label: "링크", color: "text-nu-blue" },
};

function detectType(url: string): ResourceType {
  if (url.includes("docs.google.com/document")) return "google_doc";
  if (url.includes("docs.google.com/spreadsheets")) return "google_sheet";
  if (url.includes("docs.google.com/presentation")) return "google_slide";
  if (url.includes("drive.google.com")) return "drive";
  if (url.includes("notion.so") || url.includes("notion.site")) return "notion";
  return "link";
}

export function ProjectResourceHub({
  projectId,
  isLead,
  isMember,
}: {
  projectId: string;
  isLead: boolean;
  isMember: boolean;
}) {
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStage, setActiveStage] = useState<ResourceStage | "all">("all");
  const [isGridView, setIsGridView] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ProjectResource | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    type: "link" as ResourceType,
    stage: "planning" as ResourceStage,
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const canEdit = isLead || isMember;

  useEffect(() => { loadResources(); }, [projectId]);

  async function loadResources() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_resources")
        .select("*, uploader:profiles!uploaded_by(nickname)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("project_resources not available:", error.message);
        setResources([]);
      } else {
        setResources(data as ProjectResource[]);
      }
    } catch {
      setResources([]);
    } finally {
      setLoading(false);
    }
  }

  // Filter
  const filtered = resources.filter((r) => {
    const stageOk = activeStage === "all" || r.stage === activeStage;
    const searchOk = r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return stageOk && searchOk;
  });

  const byStage = {
    planning: filtered.filter((r) => r.stage === "planning"),
    interim: filtered.filter((r) => r.stage === "interim"),
    evidence: filtered.filter((r) => r.stage === "evidence"),
    final: filtered.filter((r) => r.stage === "final"),
  };

  // Drive picker callback
  async function handleDriveFile(driveFile: { name: string; url: string; mimeType: string }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("로그인이 필요합니다"); return; }

    const type = detectType(driveFile.url);
    const { error } = await supabase.from("project_resources").insert({
      project_id: projectId,
      name: driveFile.name,
      url: driveFile.url,
      type,
      stage: "planning",
      description: null,
      uploaded_by: user.id,
    });

    if (error) {
      toast.error("자료 등록에 실패했습니다");
    } else {
      toast.success(`"${driveFile.name}" 추가됨`);
      await loadResources();
    }
  }

  // Link form submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error("이름과 URL을 입력해주세요");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다");

      const autoType = detectType(formData.url);
      const { error } = await supabase.from("project_resources").insert({
        project_id: projectId,
        name: formData.name.trim(),
        url: formData.url.trim(),
        type: autoType,
        stage: formData.stage,
        description: formData.description.trim() || null,
        uploaded_by: user.id,
      });

      if (error) throw error;
      toast.success("자료가 추가되었습니다");
      setFormData({ name: "", url: "", type: "link", stage: "planning", description: "" });
      setShowAddForm(false);
      await loadResources();
    } catch (err: any) {
      toast.error(err.message || "자료 추가에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  // Delete
  async function handleDelete(id: string) {
    if (!confirm("이 자료를 삭제하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("project_resources").delete().eq("id", id);
    if (error) { toast.error("삭제에 실패했습니다"); return; }
    toast.success("삭제되었습니다");
    setResources((prev) => prev.filter((r) => r.id !== id));
    if (selectedResource?.id === id) setSelectedResource(null);
  }

  // Embed URL
  function getEmbedUrl(r: ProjectResource): string | null {
    if (r.type === "google_doc") return r.url.replace("/edit", "/preview");
    if (r.type === "google_sheet") return r.url.replace("/edit", "/preview");
    if (r.type === "google_slide") return r.url.replace("/edit", "/embed");
    return null;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 relative w-full sm:w-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <input
            type="text"
            placeholder="자료 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-nu-paper border border-nu-ink/[0.12] p-1">
            <button onClick={() => setIsGridView(true)}
              className={`p-2 transition-colors ${isGridView ? "bg-nu-white text-nu-ink" : "text-nu-muted hover:text-nu-ink"}`}>
              <Grid3x3 size={16} />
            </button>
            <button onClick={() => setIsGridView(false)}
              className={`p-2 transition-colors ${!isGridView ? "bg-nu-white text-nu-ink" : "text-nu-muted hover:text-nu-ink"}`}>
              <List size={16} />
            </button>
          </div>

          {canEdit && (
            <>
              <DrivePicker onFilePicked={handleDriveFile} />
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2.5 bg-nu-ink text-white hover:bg-nu-pink transition-colors flex items-center gap-2"
              >
                <Link2 size={13} /> 링크 추가
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cost info banner */}
      <div className="bg-green-50 border border-green-200 px-4 py-3 flex items-start gap-3">
        <HardDrive size={16} className="text-green-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs text-green-800 font-medium">파일은 Google Drive에 보관, nutunion에는 링크만 저장됩니다</p>
          <p className="text-[10px] text-green-600 mt-0.5">호스팅 비용 없이 무제한 자료 관리 가능 · Drive, Docs, Sheets, Slides, Notion 링크 지원</p>
        </div>
      </div>

      {/* Link add form */}
      {showAddForm && canEdit && (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-head text-base font-bold text-nu-ink">링크로 자료 추가</h3>
            <button onClick={() => setShowAddForm(false)} className="text-nu-muted hover:text-nu-ink"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2 block">이름</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="자료 이름" className="w-full px-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink" />
              </div>
              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2 block">단계</label>
                <select value={formData.stage} onChange={(e) => setFormData({ ...formData, stage: e.target.value as ResourceStage })}
                  className="w-full px-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink">
                  <option value="planning">기획안</option>
                  <option value="interim">중간 결과물</option>
                  <option value="evidence">증빙 자료</option>
                  <option value="final">최종 결과물</option>
                </select>
              </div>
            </div>
            <div>
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2 block">URL</label>
              <input type="url" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://docs.google.com/... 또는 https://notion.so/..." className="w-full px-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink" />
              <p className="text-[10px] text-nu-muted mt-1">Google Docs/Sheets/Slides/Drive, Notion, 일반 링크 자동 인식</p>
            </div>
            <div>
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2 block">설명 (선택)</label>
              <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="간단한 설명" className="w-full px-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-ink text-white hover:bg-nu-pink transition-colors disabled:opacity-50 flex items-center gap-2">
                {submitting ? <><Loader2 size={12} className="animate-spin" /> 추가 중...</> : "자료 추가"}
              </button>
              <button type="button" onClick={() => setShowAddForm(false)}
                className="font-mono-nu text-[10px] uppercase tracking-widest px-5 py-2.5 text-nu-muted hover:text-nu-ink transition-colors">취소</button>
            </div>
          </form>
        </div>
      )}

      {/* Stage filter */}
      <div className="bg-gradient-to-r from-nu-ink to-nu-graphite p-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <button onClick={() => setActiveStage("all")}
            className={`px-4 py-2.5 transition-all text-center ${activeStage === "all" ? "bg-nu-white text-nu-ink font-bold" : "bg-nu-ink/20 text-nu-white hover:bg-nu-ink/30"}`}>
            <div className="font-head text-sm font-bold">전체</div>
            <div className="font-mono-nu text-[10px] opacity-70 mt-0.5">{resources.length}</div>
          </button>
          {(Object.keys(stageConfig) as ResourceStage[]).map((stage) => {
            const cfg = stageConfig[stage];
            const StageIcon = cfg.icon;
            return (
              <button key={stage} onClick={() => setActiveStage(stage)}
                className={`px-4 py-2.5 transition-all text-center ${activeStage === stage ? "bg-nu-white text-nu-ink font-bold" : "bg-nu-ink/20 text-nu-white hover:bg-nu-ink/30"}`}>
                <div className="flex items-center justify-center gap-1.5">
                  <StageIcon size={14} />
                  <span className="font-head text-sm font-bold">{cfg.label}</span>
                </div>
                <div className="font-mono-nu text-[10px] opacity-70">{byStage[stage].length}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resources */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-nu-gray" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-nu-white border border-nu-ink/[0.08]">
          <FileText size={40} className="text-nu-gray/30 mx-auto mb-3" />
          <p className="text-nu-gray text-sm mb-2">
            {searchQuery ? "검색 결과가 없습니다" : "아직 자료가 없습니다"}
          </p>
          {canEdit && !searchQuery && (
            <p className="text-[10px] text-nu-muted">Drive 연결 버튼 또는 링크 추가로 자료를 등록해보세요</p>
          )}
        </div>
      ) : isGridView ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <ResourceCard key={r.id} resource={r} canEdit={canEdit}
              onPreview={() => setSelectedResource(r)} onDelete={() => handleDelete(r.id)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <ResourceCard key={r.id} resource={r} canEdit={canEdit} compact
              onPreview={() => setSelectedResource(r)} onDelete={() => handleDelete(r.id)} />
          ))}
        </div>
      )}

      {/* Preview modal */}
      {selectedResource && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedResource(null)}>
          <div className="bg-nu-white max-w-4xl w-full max-h-[85vh] flex flex-col border-2 border-nu-ink shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-nu-ink/10">
              <div className="flex items-center gap-2 min-w-0">
                {(() => { const T = typeConfig[selectedResource.type]?.icon || FileText; return <T size={18} className={typeConfig[selectedResource.type]?.color} />; })()}
                <h2 className="font-head text-lg font-bold text-nu-ink truncate">{selectedResource.name}</h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={selectedResource.url} target="_blank" rel="noopener noreferrer"
                  className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 bg-nu-ink text-white hover:bg-nu-pink transition-colors flex items-center gap-1">
                  <ExternalLink size={10} /> 원본 열기
                </a>
                <button onClick={() => setSelectedResource(null)} className="text-nu-muted hover:text-nu-ink"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-nu-paper">
              {getEmbedUrl(selectedResource) ? (
                <iframe src={getEmbedUrl(selectedResource)!} className="w-full h-[65vh] border-0" />
              ) : (
                <div className="flex flex-col items-center justify-center py-20">
                  <ExternalLink size={48} className="text-nu-gray/20 mb-4" />
                  <p className="text-nu-gray text-sm mb-4">이 자료는 임베드 미리보기를 지원하지 않습니다</p>
                  <a href={selectedResource.url} target="_blank" rel="noopener noreferrer"
                    className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors flex items-center gap-2">
                    <ExternalLink size={12} /> 외부에서 열기
                  </a>
                </div>
              )}
            </div>
            {selectedResource.description && (
              <div className="px-5 py-3 border-t border-nu-ink/10 text-xs text-nu-muted">{selectedResource.description}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Resource card component
function ResourceCard({ resource, canEdit, compact, onPreview, onDelete }: {
  resource: ProjectResource;
  canEdit: boolean;
  compact?: boolean;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const stageCfg = stageConfig[resource.stage];
  const typeCfg = typeConfig[resource.type] || typeConfig.link;
  const TypeIcon = typeCfg.icon;

  return (
    <div className={`bg-nu-white border border-nu-ink/[0.08] overflow-hidden hover:border-nu-pink/30 transition-all group ${compact ? "p-3" : "p-4"}`}>
      <div className={`flex items-start gap-${compact ? "2" : "3"}`}>
        <div className={`${compact ? "w-8 h-8" : "w-10 h-10"} flex items-center justify-center bg-nu-cream/50 border border-nu-ink/5 shrink-0`}>
          <TypeIcon size={compact ? 14 : 18} className={typeCfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <button onClick={onPreview} className="text-left hover:text-nu-pink transition-colors w-full">
            <h3 className={`font-head font-bold text-nu-ink truncate ${compact ? "text-sm" : "text-base"}`}>{resource.name}</h3>
          </button>
          {resource.description && !compact && (
            <p className="text-xs text-nu-muted mt-1 line-clamp-2">{resource.description}</p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className={`font-mono-nu text-[8px] font-bold uppercase tracking-widest px-2 py-1 border ${stageCfg.badge}`}>{stageCfg.label}</span>
          <a href={resource.url} target="_blank" rel="noopener noreferrer"
            className="text-nu-muted hover:text-nu-ink transition-colors p-1" title="외부 링크 열기">
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {!compact && (
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-nu-ink/[0.06] text-xs text-nu-muted">
          <div className="flex items-center gap-2">
            <span className={`font-mono-nu text-[9px] uppercase tracking-widest ${typeCfg.color}`}>{typeCfg.label}</span>
            {resource.uploader?.nickname && <span>· {resource.uploader.nickname}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span>{new Date(resource.created_at).toLocaleDateString("ko", { month: "short", day: "numeric" })}</span>
            {canEdit && (
              <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-nu-muted hover:text-red-500 transition-all" title="삭제">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
