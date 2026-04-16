"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MeetingAgenda, Profile } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Plus, Trash2, Clock, User, ExternalLink, Paperclip,
  HardDrive, Upload, FileText, Link2, X, FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { DrivePicker } from "@/components/integrations/drive-picker";
import { DriveUploader } from "@/components/integrations/drive-uploader";

interface AgendaResource {
  name: string;
  url: string;
}

interface AgendaListProps {
  meetingId: string;
  groupId?: string;
  projectId?: string;
  canEdit: boolean;
  members: Profile[];
}

export function AgendaList({ meetingId, groupId, projectId, canEdit, members }: AgendaListProps) {
  const contextType = groupId ? "group" : "project";
  const contextId = groupId || projectId || "";
  const [agendas, setAgendas] = useState<MeetingAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [durationMin, setDurationMin] = useState(10);
  const [saving, setSaving] = useState(false);

  // Resources for new agenda
  const [newResources, setNewResources] = useState<AgendaResource[]>([]);
  const [showResourcePanel, setShowResourcePanel] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  // Resources for editing existing agenda
  const [editingAgendaId, setEditingAgendaId] = useState<string | null>(null);
  const [editResources, setEditResources] = useState<AgendaResource[]>([]);

  // Existing resources from resource library
  const [libraryFiles, setLibraryFiles] = useState<{ file_name: string; file_url: string }[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<"new" | "edit">("new");

  const loadAgendas = useCallback(async () => {
    const supabase = createClient();
    try {
      const { data } = await supabase
        .from("meeting_agendas")
        .select(
          "*, presenter:profiles!meeting_agendas_presenter_id_fkey(id, nickname, avatar_url)"
        )
        .eq("meeting_id", meetingId)
        .order("sort_order");
      if (data) setAgendas(data as MeetingAgenda[]);
    } catch {
      // FK join may fail — try basic query
      const { data } = await supabase
        .from("meeting_agendas")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("sort_order");
      if (data) setAgendas(data as MeetingAgenda[]);
    }
    setLoading(false);
  }, [meetingId]);

  // Load existing resources from library (groups: file_attachments, projects: project_resources)
  const loadLibraryFiles = useCallback(async () => {
    const supabase = createClient();
    if (contextType === "group") {
      const { data } = await supabase
        .from("file_attachments")
        .select("file_name, file_url")
        .eq("target_type", "group")
        .eq("target_id", contextId)
        .order("created_at", { ascending: false });
      if (data) setLibraryFiles(data);
    } else {
      const { data } = await supabase
        .from("project_resources")
        .select("name, url")
        .eq("project_id", contextId)
        .order("created_at", { ascending: false });
      if (data) setLibraryFiles(data.map((r) => ({ file_name: r.name, file_url: r.url })));
    }
  }, [contextType, contextId]);

  useEffect(() => {
    loadAgendas();
  }, [loadAgendas]);

  /* ── Add new agenda ── */
  async function handleAdd() {
    if (!topic.trim()) {
      toast.error("안건 주제를 입력해주세요");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("meeting_agendas").insert({
      meeting_id: meetingId,
      topic: topic.trim(),
      description: description.trim() || null,
      duration_min: durationMin,
      sort_order: agendas.length,
      resources: newResources,
    });

    if (error) {
      toast.error("안건 추가에 실패했습니다");
    } else {
      toast.success("안건이 추가되었습니다");
      setTopic("");
      setDescription("");
      setDurationMin(10);
      setNewResources([]);
      setShowForm(false);
      setShowResourcePanel(false);
      await loadAgendas();
    }
    setSaving(false);
  }

  /* ── Delete agenda ── */
  async function handleDelete(agendaId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("meeting_agendas")
      .delete()
      .eq("id", agendaId);

    if (error) {
      toast.error("삭제에 실패했습니다");
    } else {
      toast.success("안건이 삭제되었습니다");
      await loadAgendas();
    }
  }

  /* ── Update agenda resources ── */
  async function handleSaveResources(agendaId: string, resources: AgendaResource[]) {
    const supabase = createClient();
    const { error } = await supabase
      .from("meeting_agendas")
      .update({ resources })
      .eq("id", agendaId);

    if (error) {
      toast.error("자료 저장에 실패했습니다");
    } else {
      toast.success("자료가 저장되었습니다");
      setEditingAgendaId(null);
      setEditResources([]);
      await loadAgendas();
    }
  }

  /* ── Add link helper ── */
  function addLink(target: "new" | "edit") {
    if (!linkName.trim() || !linkUrl.trim()) {
      toast.error("자료 이름과 URL을 입력해주세요");
      return;
    }
    const resource: AgendaResource = { name: linkName.trim(), url: linkUrl.trim() };
    if (target === "new") {
      setNewResources((prev) => [...prev, resource]);
    } else {
      setEditResources((prev) => [...prev, resource]);
    }
    setLinkName("");
    setLinkUrl("");
  }

  /* ── Remove resource ── */
  function removeResource(target: "new" | "edit", index: number) {
    if (target === "new") {
      setNewResources((prev) => prev.filter((_, i) => i !== index));
    } else {
      setEditResources((prev) => prev.filter((_, i) => i !== index));
    }
  }

  /* ── Resource panel (shared between new & edit) ── */
  function ResourceAttachPanel({
    target,
    resources,
  }: {
    target: "new" | "edit";
    resources: AgendaResource[];
  }) {
    return (
      <div className="border border-nu-ink/[0.06] bg-nu-cream/10 p-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Paperclip size={12} className="text-nu-pink" />
          <span className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-ink">
            사전 자료 첨부
          </span>
        </div>

        {/* Existing attached resources */}
        {resources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {resources.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[13px] bg-nu-blue/10 text-nu-blue px-2 py-1"
              >
                <FileText size={10} />
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="hover:underline max-w-[140px] truncate">
                  {r.name}
                </a>
                {canEdit && (
                  <button
                    onClick={() => removeResource(target, i)}
                    className="ml-0.5 text-nu-muted hover:text-nu-red"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Attach options */}
        <div className="flex flex-wrap gap-2">
          {/* Drive Picker - 기존 Drive 파일 선택 */}
          <DrivePicker
            onFilePicked={(file) => {
              const resource: AgendaResource = { name: file.name, url: file.url };
              if (target === "new") {
                setNewResources((prev) => [...prev, resource]);
              } else {
                setEditResources((prev) => [...prev, resource]);
              }
            }}
          />

          {/* Resource library - 자료실에서 선택 */}
          <button
            onClick={() => {
              setLibraryTarget(target);
              setShowLibrary(true);
              loadLibraryFiles();
            }}
            className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-3 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors inline-flex items-center gap-1.5"
          >
            <FolderOpen size={12} /> 자료실
          </button>

          {/* Drive Upload - 새 파일 업로드 */}
          <DriveUploader
            targetType={contextType as "group" | "project"}
            targetId={contextId}
            onUploaded={(file) => {
              const resource: AgendaResource = { name: file.name, url: file.url };
              if (target === "new") {
                setNewResources((prev) => [...prev, resource]);
              } else {
                setEditResources((prev) => [...prev, resource]);
              }
            }}
          />
        </div>

        {/* Manual link input */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 flex gap-2">
            <input
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="자료명"
              className="flex-1 px-2.5 py-1.5 text-xs border border-nu-ink/10 bg-nu-white focus:outline-none focus:border-nu-pink"
            />
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="URL (https://...)"
              className="flex-[2] px-2.5 py-1.5 text-xs border border-nu-ink/10 bg-nu-white focus:outline-none focus:border-nu-pink"
            />
          </div>
          <button
            onClick={() => addLink(target)}
            className="px-3 py-1.5 text-xs font-mono-nu uppercase tracking-widest bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors"
          >
            <Link2 size={11} />
          </button>
        </div>
      </div>
    );
  }

  /* ── Library files picker modal ── */
  function LibraryModal() {
    if (!showLibrary) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-nu-paper w-full max-w-lg max-h-[70vh] flex flex-col border-2 border-nu-ink shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-nu-ink/10">
            <div className="flex items-center gap-2">
              <FolderOpen size={18} className="text-nu-pink" />
              <h3 className="font-head text-base font-extrabold text-nu-ink">
                {contextType === "group" ? "너트" : "볼트"} 자료실
              </h3>
            </div>
            <button onClick={() => setShowLibrary(false)} className="text-nu-muted hover:text-nu-ink">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {libraryFiles.length === 0 ? (
              <p className="text-center py-10 text-nu-gray text-sm">자료실에 파일이 없습니다</p>
            ) : (
              <div className="space-y-1">
                {libraryFiles.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const resource: AgendaResource = { name: f.file_name, url: f.file_url };
                      if (libraryTarget === "new") {
                        setNewResources((prev) => [...prev, resource]);
                      } else {
                        setEditResources((prev) => [...prev, resource]);
                      }
                      setShowLibrary(false);
                      toast.success(`"${f.file_name}" 추가됨`);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-nu-cream/50 transition-colors text-left"
                  >
                    <FileText size={16} className="text-nu-blue shrink-0" />
                    <span className="text-sm text-nu-ink truncate">{f.file_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-nu-ink/10">
            <button
              onClick={() => setShowLibrary(false)}
              className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-1.5 border border-nu-ink/15 hover:bg-nu-cream transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-20 bg-nu-cream/50" />
        <div className="h-20 bg-nu-cream/50" />
      </div>
    );
  }

  return (
    <div>
      <LibraryModal />

      {agendas.length === 0 && !showForm ? (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
          <p className="text-nu-gray text-sm mb-3">등록된 안건이 없습니다</p>
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => setShowForm(true)}
              className="font-mono-nu text-[12px] uppercase tracking-widest"
            >
              <Plus size={14} /> 안건 추가
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {agendas.map((agenda, index) => (
            <div
              key={agenda.id}
              className="bg-nu-white border border-nu-ink/[0.08] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono-nu text-[12px] text-nu-muted">
                      #{index + 1}
                    </span>
                    <h4 className="font-head text-sm font-bold text-nu-ink">
                      {agenda.topic}
                    </h4>
                  </div>
                  {agenda.description && (
                    <p className="text-sm text-nu-gray mt-1 leading-relaxed">
                      {agenda.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                    {agenda.duration_min && (
                      <span className="flex items-center gap-1 font-mono-nu text-[12px] text-nu-muted">
                        <Clock size={12} /> {agenda.duration_min}분
                      </span>
                    )}
                    {agenda.presenter && (
                      <span className="flex items-center gap-1 font-mono-nu text-[12px] text-nu-muted">
                        <User size={12} /> {(agenda.presenter as any).nickname}
                      </span>
                    )}
                  </div>

                  {/* Resources display */}
                  {agenda.resources && agenda.resources.length > 0 && (
                    <div className="mt-3">
                      <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-1.5">
                        사전 자료
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {agenda.resources.map((resource, ri) => (
                          <a
                            key={ri}
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[13px] text-nu-blue hover:text-nu-pink transition-colors bg-nu-blue/5 px-2.5 py-1 no-underline"
                          >
                            <ExternalLink size={10} />
                            {resource.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Edit resources for existing agenda */}
                  {editingAgendaId === agenda.id && (
                    <div className="mt-3">
                      <ResourceAttachPanel target="edit" resources={editResources} />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleSaveResources(agenda.id, editResources)}
                          className="px-3 py-1.5 text-[12px] font-mono-nu uppercase tracking-widest bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors"
                        >
                          자료 저장
                        </button>
                        <button
                          onClick={() => { setEditingAgendaId(null); setEditResources([]); }}
                          className="px-3 py-1.5 text-[12px] font-mono-nu uppercase tracking-widest border border-nu-ink/15 hover:bg-nu-cream transition-colors"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                {canEdit && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {editingAgendaId !== agenda.id && (
                      <button
                        onClick={() => {
                          setEditingAgendaId(agenda.id);
                          setEditResources(agenda.resources || []);
                        }}
                        title="자료 첨부"
                        className="text-nu-muted hover:text-nu-blue transition-colors p-1"
                      >
                        <Paperclip size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(agenda.id)}
                      className="text-nu-muted hover:text-nu-red transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add agenda form */}
      {canEdit && (
        <div className="mt-4">
          {!showForm && agendas.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowForm(true)}
              className="font-mono-nu text-[12px] uppercase tracking-widest"
            >
              <Plus size={14} /> 안건 추가
            </Button>
          )}
          {showForm && (
            <div className="bg-nu-cream/20 border border-dashed border-nu-ink/10 p-4 flex flex-col gap-3">
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="안건 주제"
                className="border-nu-ink/15 bg-transparent"
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="안건 설명 (선택)"
                rows={2}
                className="border-nu-ink/15 bg-transparent resize-none"
              />
              <div className="flex items-center gap-2">
                <span className="font-mono-nu text-[12px] text-nu-muted">
                  소요 시간:
                </span>
                <Input
                  type="number"
                  min={1}
                  value={durationMin}
                  onChange={(e) => setDurationMin(parseInt(e.target.value) || 10)}
                  className="w-20 border-nu-ink/15 bg-transparent"
                />
                <span className="font-mono-nu text-[12px] text-nu-muted">분</span>
              </div>

              {/* Resource attachment toggle */}
              <button
                onClick={() => setShowResourcePanel(!showResourcePanel)}
                className="self-start flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-pink transition-colors"
              >
                <Paperclip size={12} />
                사전 자료 첨부 ({newResources.length}개)
              </button>

              {showResourcePanel && (
                <ResourceAttachPanel target="new" resources={newResources} />
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleAdd}
                  disabled={saving}
                  className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[12px] uppercase tracking-widest"
                >
                  {saving ? "추가 중..." : "추가"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setNewResources([]);
                    setShowResourcePanel(false);
                  }}
                  className="font-mono-nu text-[12px] uppercase tracking-widest"
                >
                  취소
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
