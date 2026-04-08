"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Upload,
  FileEdit,
  FileClock,
  FileCheck,
  FileBadge,
  FileText,
  Sheet,
  BookOpen,
  Link,
  Search,
  Plus,
  X,
  ExternalLink,
  Grid3x3,
  List,
  Loader2,
} from "lucide-react";

type ResourceStage = "planning" | "interim" | "evidence" | "final";
type ResourceType = "file" | "google_doc" | "google_sheet" | "notion" | "link";

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
  planning: {
    icon: FileEdit,
    label: "기획안",
    color: "nu-blue",
    badge: "bg-nu-blue/10 text-nu-blue border-nu-blue/20",
  },
  interim: {
    icon: FileClock,
    label: "중간 결과물",
    color: "nu-amber",
    badge: "bg-nu-amber/10 text-nu-amber border-nu-amber/20",
  },
  evidence: {
    icon: FileCheck,
    label: "증빙 자료",
    color: "nu-pink",
    badge: "bg-nu-pink/10 text-nu-pink border-nu-pink/20",
  },
  final: {
    icon: FileBadge,
    label: "최종 결과물",
    color: "green-600",
    badge: "bg-green-50 text-green-600 border-green-200",
  },
};

const typeConfig: Record<
  ResourceType,
  { icon: typeof Upload; label: string; color: string }
> = {
  file: {
    icon: Upload,
    label: "파일",
    color: "text-nu-gray",
  },
  google_doc: {
    icon: FileText,
    label: "Google Docs",
    color: "text-blue-600",
  },
  google_sheet: {
    icon: Sheet,
    label: "Google Sheets",
    color: "text-green-600",
  },
  notion: {
    icon: BookOpen,
    label: "Notion",
    color: "text-nu-ink",
  },
  link: {
    icon: Link,
    label: "링크",
    color: "text-nu-blue",
  },
};

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
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ProjectResource | null>(
    null
  );
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    type: "link" as ResourceType,
    stage: "planning" as ResourceStage,
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = isLead || isMember;

  // Load resources
  useEffect(() => {
    loadResources();
  }, [projectId]);

  async function loadResources() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_resources")
        .select("*, uploader:profiles!uploaded_by(nickname)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setResources(data as ProjectResource[]);
    } catch (err: any) {
      toast.error(err.message || "자료를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }

  // Filter resources
  const filteredResources = resources.filter((resource) => {
    const matchesStage =
      activeStage === "all" || resource.stage === activeStage;
    const matchesSearch =
      resource.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStage && matchesSearch;
  });

  // Group by stage for display
  const resourcesByStage = {
    planning: filteredResources.filter((r) => r.stage === "planning"),
    interim: filteredResources.filter((r) => r.stage === "interim"),
    evidence: filteredResources.filter((r) => r.stage === "evidence"),
    final: filteredResources.filter((r) => r.stage === "final"),
  };

  // Handle file upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("로그인이 필요합니다");

      // Upload file to storage
      const filePath = `projects/${projectId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("media")
        .getPublicUrl(filePath);

      // Create resource record
      const { error: insertError } = await supabase
        .from("project_resources")
        .insert({
          project_id: projectId,
          name: formData.name || file.name,
          url: publicUrlData.publicUrl,
          type: "file",
          stage: formData.stage,
          description: formData.description,
          uploaded_by: userData.user.id,
        });

      if (insertError) throw insertError;

      toast.success("파일이 업로드되었습니다");
      resetForm();
      await loadResources();
    } catch (err: any) {
      toast.error(err.message || "파일 업로드에 실패했습니다");
    } finally {
      setSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error("이름과 URL을 입력해주세요");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("로그인이 필요합니다");

      const { error } = await supabase.from("project_resources").insert({
        project_id: projectId,
        name: formData.name.trim(),
        url: formData.url.trim(),
        type: formData.type,
        stage: formData.stage,
        description: formData.description.trim() || null,
        uploaded_by: userData.user.id,
      });

      if (error) throw error;

      toast.success("자료가 추가되었습니다");
      resetForm();
      await loadResources();
    } catch (err: any) {
      toast.error(err.message || "자료 추가에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      url: "",
      type: "link",
      stage: "planning",
      description: "",
    });
    setShowUploadForm(false);
  }

  // Get embed URL for preview
  function getEmbedUrl(resource: ProjectResource): string | null {
    if (resource.type === "google_doc" || resource.type === "google_sheet") {
      return `${resource.url}?embedded=true`;
    }
    if (resource.type === "notion") {
      return `${resource.url}?embedded=true`;
    }
    return null;
  }

  // Resource item component
  function ResourceCard({
    resource,
    variant = "default",
  }: {
    resource: ProjectResource;
    variant?: "default" | "compact";
  }) {
    const stageCfg = stageConfig[resource.stage];
    const typeCfg = typeConfig[resource.type];
    const TypeIcon = typeCfg.icon;
    const StageIcon = stageCfg.icon;

    return (
      <div
        className={`bg-nu-white border border-nu-ink/[0.08] overflow-hidden hover:border-nu-ink/[0.16] transition-colors ${variant === "compact" ? "p-3" : "p-4"}`}
      >
        <div
          className={`flex items-start gap-${variant === "compact" ? "2" : "3"} mb-${variant === "compact" ? "2" : "3"}`}
        >
          <TypeIcon
            size={variant === "compact" ? 16 : 20}
            className={`shrink-0 mt-1 ${typeCfg.color}`}
          />
          <div className="flex-1 min-w-0">
            <button
              onClick={() => {
                setSelectedResource(resource);
                setShowPreview(true);
              }}
              className="text-left hover:text-nu-pink transition-colors"
            >
              <h3
                className={`font-head font-bold text-nu-ink truncate ${
                  variant === "compact" ? "text-sm" : "text-base"
                }`}
              >
                {resource.name}
              </h3>
            </button>
            {resource.description && variant !== "compact" && (
              <p className="text-xs text-nu-muted mt-1 line-clamp-2">
                {resource.description}
              </p>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span
              className={`font-mono-nu text-[8px] font-bold uppercase tracking-widest px-2 py-1 border ${stageCfg.badge}`}
            >
              {stageCfg.label}
            </span>
            {resource.type !== "file" && (
              <button
                onClick={() => window.open(resource.url, "_blank")}
                className="text-nu-muted hover:text-nu-ink transition-colors p-1"
                title="외부 링크 열기"
              >
                <ExternalLink size={14} />
              </button>
            )}
          </div>
        </div>

        {variant === "default" && (
          <div className="flex items-center justify-between pt-3 border-t border-nu-ink/[0.06] text-xs text-nu-muted">
            <div className="flex items-center gap-2">
              <StageIcon size={12} />
              <span>{stageCfg.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {resource.uploader?.nickname && (
                <span>{resource.uploader.nickname}</span>
              )}
              <span>
                {new Date(resource.created_at).toLocaleDateString("ko", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header with search and controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-nu-muted"
          />
          <input
            type="text"
            placeholder="자료 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-nu-paper border border-nu-ink/[0.12] rounded p-1">
            <button
              onClick={() => setIsGridView(true)}
              className={`p-2 transition-colors ${
                isGridView
                  ? "bg-nu-white text-nu-ink"
                  : "text-nu-muted hover:text-nu-ink"
              }`}
              title="그리드 보기"
            >
              <Grid3x3 size={16} />
            </button>
            <button
              onClick={() => setIsGridView(false)}
              className={`p-2 transition-colors ${
                !isGridView
                  ? "bg-nu-white text-nu-ink"
                  : "text-nu-muted hover:text-nu-ink"
              }`}
              title="리스트 보기"
            >
              <List size={16} />
            </button>
          </div>

          {/* Upload button */}
          {canUpload && (
            <button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors flex items-center gap-2"
            >
              <Plus size={14} /> 추가
            </button>
          )}
        </div>
      </div>

      {/* Upload form */}
      {showUploadForm && canUpload && (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-head text-base font-bold text-nu-ink">
              새 자료 추가
            </h3>
            <button
              onClick={() => resetForm()}
              className="text-nu-muted hover:text-nu-ink"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name input */}
            <div>
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2 block">
                이름
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="자료 이름"
                className="w-full px-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
              />
            </div>

            {/* URL input */}
            <div>
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2 block">
                URL
              </label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) =>
                  setFormData({ ...formData, url: e.target.value })
                }
                placeholder="https://example.com"
                className="w-full px-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
              />
            </div>

            {/* Type dropdown */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2 block">
                  타입
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as ResourceType,
                    })
                  }
                  className="w-full px-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
                >
                  <option value="link">링크</option>
                  <option value="google_doc">Google Docs</option>
                  <option value="google_sheet">Google Sheets</option>
                  <option value="notion">Notion</option>
                  <option value="file">파일</option>
                </select>
              </div>

              {/* Stage dropdown */}
              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2 block">
                  단계
                </label>
                <select
                  value={formData.stage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stage: e.target.value as ResourceStage,
                    })
                  }
                  className="w-full px-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink"
                >
                  <option value="planning">기획안</option>
                  <option value="interim">중간 결과물</option>
                  <option value="evidence">증빙 자료</option>
                  <option value="final">최종 결과물</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2 block">
                설명 (선택)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="자료에 대한 설명을 입력해주세요"
                className="w-full px-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink resize-none"
                rows={3}
              />
            </div>

            {/* File upload for file type */}
            {formData.type === "file" && (
              <div>
                <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2 block">
                  파일
                </label>
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={submitting}
                  />
                  <div className="px-4 py-2.5 bg-nu-paper border border-dashed border-nu-ink/[0.12] text-center text-sm text-nu-muted hover:border-nu-ink/[0.24] transition-colors cursor-pointer">
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        업로드 중...
                      </span>
                    ) : (
                      "파일을 선택하세요"
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Submit buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    추가 중...
                  </>
                ) : (
                  "자료 추가"
                )}
              </button>
              <button
                type="button"
                onClick={() => resetForm()}
                className="font-mono-nu text-[10px] uppercase tracking-widest px-5 py-2.5 text-nu-muted hover:text-nu-ink transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stage filter tabs */}
      <div className="bg-gradient-to-r from-nu-ink to-nu-graphite rounded-lg p-5 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {/* All tab */}
          <button
            onClick={() => setActiveStage("all")}
            className={`px-4 py-2.5 rounded-lg transition-all text-center ${
              activeStage === "all"
                ? "bg-nu-white text-nu-ink font-bold"
                : "bg-nu-ink/20 text-nu-white hover:bg-nu-ink/30"
            }`}
          >
            <div className="font-head text-sm font-bold">전체</div>
            <div className="font-mono-nu text-[10px] opacity-70 mt-0.5">
              {resources.length}
            </div>
          </button>

          {/* Stage tabs */}
          {(Object.keys(stageConfig) as ResourceStage[]).map((stage) => {
            const cfg = stageConfig[stage];
            const count = resourcesByStage[stage].length;
            const StageIcon = cfg.icon;

            return (
              <button
                key={stage}
                onClick={() => setActiveStage(stage)}
                className={`px-4 py-2.5 rounded-lg transition-all text-center ${
                  activeStage === stage
                    ? "bg-nu-white text-nu-ink font-bold"
                    : "bg-nu-ink/20 text-nu-white hover:bg-nu-ink/30"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <StageIcon size={16} />
                  <div>
                    <div className="font-head text-sm font-bold">
                      {cfg.label}
                    </div>
                    <div className="font-mono-nu text-[10px] opacity-70">
                      {count}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resources display */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-nu-gray" />
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="text-center py-16 bg-nu-white border border-nu-ink/[0.08]">
          <FileText size={40} className="text-nu-gray/30 mx-auto mb-3" />
          <p className="text-nu-gray text-sm mb-2">아직 자료가 없습니다</p>
          {canUpload && (
            <button
              onClick={() => setShowUploadForm(true)}
              className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink hover:text-nu-pink/80 transition-colors"
            >
              첫 자료 추가하기
            </button>
          )}
        </div>
      ) : isGridView ? (
        // Grid view
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map((resource) => (
            <div key={resource.id}>
              <ResourceCard resource={resource} variant="default" />
            </div>
          ))}
        </div>
      ) : (
        // List view
        <div className="space-y-2">
          {filteredResources.map((resource) => (
            <div key={resource.id}>
              <ResourceCard resource={resource} variant="compact" />
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {showPreview && selectedResource && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-nu-white rounded-lg overflow-hidden max-w-4xl w-full max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-nu-ink/[0.08]">
              <h2 className="font-head text-lg font-bold text-nu-ink truncate">
                {selectedResource.name}
              </h2>
              <button
                onClick={() => setShowPreview(false)}
                className="text-nu-muted hover:text-nu-ink transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto bg-nu-paper p-5">
              {getEmbedUrl(selectedResource) ? (
                <iframe
                  src={getEmbedUrl(selectedResource)!}
                  className="w-full h-full border-0 rounded"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12">
                  <FileText size={48} className="text-nu-gray/30 mb-4" />
                  <p className="text-nu-gray text-sm mb-6">
                    미리보기를 지원하지 않습니다
                  </p>
                  <a
                    href={selectedResource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2.5 bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors flex items-center gap-2"
                  >
                    <ExternalLink size={12} /> 외부 링크에서 열기
                  </a>
                </div>
              )}
            </div>

            {/* Footer with metadata */}
            <div className="border-t border-nu-ink/[0.08] p-5 bg-nu-white space-y-3">
              {selectedResource.description && (
                <div>
                  <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">
                    설명
                  </p>
                  <p className="text-sm text-nu-ink">
                    {selectedResource.description}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-nu-muted">
                <div className="flex items-center gap-4">
                  {selectedResource.uploader?.nickname && (
                    <span>업로드: {selectedResource.uploader.nickname}</span>
                  )}
                  <span>
                    {new Date(selectedResource.created_at).toLocaleDateString(
                      "ko",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </span>
                </div>
                <a
                  href={selectedResource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-nu-pink hover:text-nu-pink/80 transition-colors"
                >
                  원본 링크 →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
