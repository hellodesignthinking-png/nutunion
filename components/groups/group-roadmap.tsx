"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Target, ChevronRight, CheckCircle2, Circle, Loader2,
  Plus, Save, X, Edit3, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface RoadmapPhase {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "active" | "done";
  order: number;
}

interface GroupRoadmapProps {
  groupId: string;
  groupTopic?: string;
  canEdit: boolean;
}

export function GroupRoadmap({ groupId, groupTopic: initialTopic, canEdit }: GroupRoadmapProps) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic || "");
  const [editingTopic, setEditingTopic] = useState(false);
  const [phases, setPhases] = useState<RoadmapPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTopic, setSavingTopic] = useState(false);
  const [addingPhase, setAddingPhase] = useState(false);
  const [newPhase, setNewPhase] = useState({ title: "", description: "" });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from("group_roadmap_phases")
          .select("*")
          .eq("group_id", groupId)
          .order("order");
        if (error) {
          console.warn("Roadmap feature not available:", error.message);
          // Gracefully degrade - feature not available in this version
        } else {
          setPhases(data || []);
        }
      } catch (err) {
        console.warn("Roadmap feature not available");
        // Gracefully degrade - feature not available in this version
      }
      setLoading(false);
    }
    load();
  }, [groupId]);

  async function saveTopic() {
    setSavingTopic(true);
    const supabase = createClient();
    try {
      await supabase.from("groups").update({ topic: topic.trim() }).eq("id", groupId);
      router.refresh();
      setEditingTopic(false);
      toast.success("주제가 저장되었습니다");
    } catch (err) {
      console.warn("Failed to save topic:", err);
      toast.error("주제 저장에 실패했습니다");
    }
    setSavingTopic(false);
  }

  async function addPhase() {
    if (!newPhase.title.trim()) return;
    const supabase = createClient();
    try {
      const maxOrder = phases.length > 0 ? Math.max(...phases.map(p => p.order)) + 1 : 0;
      const { data, error } = await supabase
        .from("group_roadmap_phases")
        .insert({ group_id: groupId, title: newPhase.title.trim(), description: newPhase.description || null, status: "pending", order: maxOrder })
        .select().single();
      if (error) {
        console.warn("Failed to add phase:", error);
        toast.error("단계 추가에 실패했습니다");
        return;
      }
      setPhases(prev => [...prev, data as RoadmapPhase]);
      setNewPhase({ title: "", description: "" });
      setAddingPhase(false);
      toast.success("단계가 추가되었습니다");
    } catch (err) {
      console.warn("Failed to add phase:", err);
      toast.error("단계 추가에 실패했습니다");
    }
  }

  async function updatePhaseStatus(id: string, status: RoadmapPhase["status"]) {
    if (!canEdit) return;
    const next: RoadmapPhase["status"] = status === "pending" ? "active" : status === "active" ? "done" : "pending";
    const supabase = createClient();
    try {
      await supabase.from("group_roadmap_phases").update({ status: next }).eq("id", id);
      setPhases(prev => prev.map(p => p.id === id ? { ...p, status: next } : p));
    } catch (err) {
      console.warn("Failed to update phase status:", err);
    }
  }

  async function deletePhase(id: string) {
    if (!confirm("이 단계를 삭제하시겠습니까?")) return;
    const supabase = createClient();
    try {
      await supabase.from("group_roadmap_phases").delete().eq("id", id);
      setPhases(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.warn("Failed to delete phase:", err);
      toast.error("단계 삭제에 실패했습니다");
    }
  }

  const doneCount   = phases.filter(p => p.status === "done").length;
  const progress    = phases.length > 0 ? Math.round((doneCount / phases.length) * 100) : 0;
  const activePhase = phases.find(p => p.status === "active");

  const statusIcon = (s: RoadmapPhase["status"]) => {
    if (s === "done")   return <CheckCircle2 size={16} className="text-green-500 shrink-0" />;
    if (s === "active") return <Circle size={16} className="text-nu-blue shrink-0 fill-nu-blue/20" />;
    return <Circle size={16} className="text-nu-muted/40 shrink-0" />;
  };

  const statusColor = (s: RoadmapPhase["status"]) => ({
    done:    "border-l-green-400 bg-green-50/50",
    active:  "border-l-nu-blue bg-nu-blue/5",
    pending: "border-l-transparent",
  }[s]);

  return (
    <div className="bg-nu-white border border-nu-ink/[0.08]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-nu-ink/[0.06]">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-nu-pink" />
          <h3 className="font-head text-base font-extrabold text-nu-ink">소모임 로드맵</h3>
          {phases.length > 0 && (
            <span className="font-mono-nu text-[10px] text-nu-muted">{doneCount}/{phases.length} 완료</span>
          )}
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="text-nu-muted hover:text-nu-ink">
          {collapsed ? <ChevronRight size={16} /> : <ChevronRight size={16} className="rotate-90" />}
        </button>
      </div>

      {!collapsed && (
        <div className="p-5">
          {/* Topic */}
          <div className="mb-5">
            <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1.5">주제 / 목표</p>
            {editingTopic ? (
              <div className="flex gap-2">
                <input value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="이 소모임의 핵심 주제나 목표를 입력하세요"
                  className="flex-1 px-3 py-2 border border-nu-ink/15 bg-transparent text-sm focus:outline-none focus:border-nu-pink"
                  autoFocus onKeyDown={e => { if (e.key === "Enter") saveTopic(); }}
                />
                <button onClick={saveTopic} disabled={savingTopic}
                  className="px-3 py-2 bg-nu-ink text-nu-paper text-xs hover:bg-nu-pink transition-colors">
                  {savingTopic ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                </button>
                <button onClick={() => setEditingTopic(false)} className="px-3 py-2 border border-nu-ink/15 text-xs hover:bg-nu-cream transition-colors">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <p className={`text-sm ${topic ? "text-nu-ink font-medium" : "text-nu-muted italic"}`}>
                  {topic || "주제가 설정되지 않았습니다"}
                </p>
                {canEdit && (
                  <button onClick={() => setEditingTopic(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-nu-muted hover:text-nu-pink">
                    <Edit3 size={12} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Progress bar */}
          {phases.length > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-[10px] font-mono-nu text-nu-muted mb-1.5">
                <span>진행률</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-nu-ink/10 rounded-full overflow-hidden">
                <div className="h-full bg-nu-pink rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
              {activePhase && (
                <p className="text-[10px] text-nu-blue mt-1.5 flex items-center gap-1">
                  <ArrowRight size={10} /> 현재: {activePhase.title}
                </p>
              )}
            </div>
          )}

          {/* Phases */}
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-nu-cream/50" />)}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {phases.map((phase, i) => (
                <div key={phase.id}
                  className={`border-l-[3px] px-3 py-2.5 flex items-start gap-2.5 group transition-all ${statusColor(phase.status)}`}>
                  <button onClick={() => updatePhaseStatus(phase.id, phase.status)}
                    className={`mt-0.5 shrink-0 ${canEdit ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}>
                    {statusIcon(phase.status)}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono-nu text-[9px] text-nu-muted">{String(i+1).padStart(2,"0")}.</span>
                      <p className={`text-sm font-medium ${phase.status === "done" ? "line-through text-nu-muted" : "text-nu-ink"}`}>
                        {phase.title}
                      </p>
                      {phase.status === "active" && (
                        <span className="font-mono-nu text-[8px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-blue/15 text-nu-blue">진행중</span>
                      )}
                    </div>
                    {phase.description && (
                      <p className="text-xs text-nu-muted mt-0.5">{phase.description}</p>
                    )}
                  </div>
                  {canEdit && (
                    <button onClick={() => deletePhase(phase.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-nu-muted hover:text-nu-red shrink-0 mt-0.5">
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add phase */}
          {canEdit && (
            <div className="mt-3">
              {addingPhase ? (
                <div className="border border-dashed border-nu-ink/20 p-3 flex flex-col gap-2">
                  <input value={newPhase.title} onChange={e => setNewPhase(p => ({ ...p, title: e.target.value }))}
                    placeholder="단계 제목" autoFocus
                    className="px-2 py-1.5 border border-nu-ink/15 bg-transparent text-sm focus:outline-none focus:border-nu-pink w-full"
                    onKeyDown={e => { if (e.key === "Enter") addPhase(); }}
                  />
                  <input value={newPhase.description} onChange={e => setNewPhase(p => ({ ...p, description: e.target.value }))}
                    placeholder="설명 (선택)"
                    className="px-2 py-1.5 border border-nu-ink/15 bg-transparent text-xs focus:outline-none focus:border-nu-pink w-full"
                  />
                  <div className="flex gap-2">
                    <button onClick={addPhase} className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors">추가</button>
                    <button onClick={() => setAddingPhase(false)} className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border border-nu-ink/15 hover:bg-nu-cream transition-colors">취소</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingPhase(true)}
                  className="w-full flex items-center gap-1.5 py-2 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-pink transition-colors">
                  <Plus size={12} /> 단계 추가
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
