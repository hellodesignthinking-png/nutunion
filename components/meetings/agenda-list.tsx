"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MeetingAgenda, Profile } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Clock, User, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface AgendaListProps {
  meetingId: string;
  canEdit: boolean;
  members: Profile[];
}

export function AgendaList({ meetingId, canEdit, members }: AgendaListProps) {
  const [agendas, setAgendas] = useState<MeetingAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [durationMin, setDurationMin] = useState(10);
  const [saving, setSaving] = useState(false);

  const loadAgendas = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("meeting_agendas")
      .select(
        "*, presenter:profiles!meeting_agendas_presenter_id_fkey(id, nickname, avatar_url)"
      )
      .eq("meeting_id", meetingId)
      .order("sort_order");

    if (data) {
      setAgendas(data as MeetingAgenda[]);
    }
    setLoading(false);
  }, [meetingId]);

  useEffect(() => {
    loadAgendas();
  }, [loadAgendas]);

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
      resources: [],
    });

    if (error) {
      toast.error("안건 추가에 실패했습니다");
    } else {
      toast.success("안건이 추가되었습니다");
      setTopic("");
      setDescription("");
      setDurationMin(10);
      setShowForm(false);
      await loadAgendas();
    }
    setSaving(false);
  }

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
      {agendas.length === 0 && !showForm ? (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-8 text-center">
          <p className="text-nu-gray text-sm mb-3">등록된 안건이 없습니다</p>
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => setShowForm(true)}
              className="font-mono-nu text-[10px] uppercase tracking-widest"
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
                    <span className="font-mono-nu text-[10px] text-nu-muted">
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
                      <span className="flex items-center gap-1 font-mono-nu text-[10px] text-nu-muted">
                        <Clock size={12} /> {agenda.duration_min}분
                      </span>
                    )}
                    {agenda.presenter && (
                      <span className="flex items-center gap-1 font-mono-nu text-[10px] text-nu-muted">
                        <User size={12} /> {agenda.presenter.nickname}
                      </span>
                    )}
                  </div>
                  {/* Resources */}
                  {agenda.resources && agenda.resources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {agenda.resources.map((resource, ri) => (
                        <a
                          key={ri}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-nu-blue hover:text-nu-pink transition-colors bg-nu-blue/5 px-2.5 py-1 no-underline"
                        >
                          <ExternalLink size={11} />
                          {resource.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleDelete(agenda.id)}
                    className="text-nu-muted hover:text-nu-red transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
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
              className="font-mono-nu text-[10px] uppercase tracking-widest"
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
                <span className="font-mono-nu text-[10px] text-nu-muted">
                  소요 시간:
                </span>
                <Input
                  type="number"
                  min={1}
                  value={durationMin}
                  onChange={(e) => setDurationMin(parseInt(e.target.value) || 10)}
                  className="w-20 border-nu-ink/15 bg-transparent"
                />
                <span className="font-mono-nu text-[10px] text-nu-muted">분</span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAdd}
                  disabled={saving}
                  className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[10px] uppercase tracking-widest"
                >
                  {saving ? "추가 중..." : "추가"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="font-mono-nu text-[10px] uppercase tracking-widest"
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
