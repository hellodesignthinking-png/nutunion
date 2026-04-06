"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface AgendaItem {
  topic: string;
  description: string;
  duration_min: number;
}

export default function CreateMeetingPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState("60");
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [newAgenda, setNewAgenda] = useState<AgendaItem>({
    topic: "",
    description: "",
    duration_min: 10,
  });

  function addAgenda() {
    if (!newAgenda.topic.trim()) {
      toast.error("안건 주제를 입력해주세요");
      return;
    }
    setAgendas((prev) => [...prev, { ...newAgenda }]);
    setNewAgenda({ topic: "", description: "", duration_min: 10 });
  }

  function removeAgenda(index: number) {
    setAgendas((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const title = fd.get("title") as string;
    const description = fd.get("description") as string;
    const date = fd.get("date") as string;
    const time = fd.get("time") as string;
    const location = fd.get("location") as string;

    if (!date || !time) {
      toast.error("날짜와 시간을 입력해주세요");
      setLoading(false);
      return;
    }

    const scheduledAt = new Date(`${date}T${time}`).toISOString();

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("로그인이 필요합니다");
      setLoading(false);
      return;
    }

    // Create meeting
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .insert({
        group_id: groupId,
        title,
        description: description || null,
        scheduled_at: scheduledAt,
        duration_min: parseInt(duration),
        location: location || null,
        status: "upcoming",
        organizer_id: user.id,
      })
      .select("id")
      .single();

    if (meetingError || !meeting) {
      toast.error(meetingError?.message || "미팅 생성에 실패했습니다");
      setLoading(false);
      return;
    }

    // Create agendas
    if (agendas.length > 0) {
      const agendaRows = agendas.map((a, i) => ({
        meeting_id: meeting.id,
        topic: a.topic,
        description: a.description || null,
        duration_min: a.duration_min,
        sort_order: i,
        resources: [],
      }));

      const { error: agendaError } = await supabase
        .from("meeting_agendas")
        .insert(agendaRows);

      if (agendaError) {
        toast.error("안건 생성 중 오류가 발생했습니다");
      }
    }

    toast.success("미팅이 생성되었습니다!");
    router.push(`/groups/${groupId}/meetings/${meeting.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        새 미팅 만들기
      </h1>
      <p className="text-nu-gray text-sm mb-8">미팅 일정과 안건을 설정하세요</p>

      <div className="bg-nu-white border border-nu-ink/[0.08] p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              제목
            </Label>
            <Input
              name="title"
              required
              placeholder="정기 미팅"
              className="mt-1.5 border-nu-ink/15 bg-transparent"
            />
          </div>

          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              설명
            </Label>
            <Textarea
              name="description"
              rows={3}
              placeholder="미팅에 대한 설명"
              className="mt-1.5 border-nu-ink/15 bg-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
                날짜
              </Label>
              <Input
                name="date"
                type="date"
                required
                className="mt-1.5 border-nu-ink/15 bg-transparent"
              />
            </div>
            <div>
              <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
                시간
              </Label>
              <Input
                name="time"
                type="time"
                required
                className="mt-1.5 border-nu-ink/15 bg-transparent"
              />
            </div>
            <div>
              <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
                소요 시간
              </Label>
              <Select value={duration} onValueChange={(v) => v && setDuration(v)}>
                <SelectTrigger className="mt-1.5 border-nu-ink/15 bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30분</SelectItem>
                  <SelectItem value="60">60분</SelectItem>
                  <SelectItem value="90">90분</SelectItem>
                  <SelectItem value="120">120분</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              장소
            </Label>
            <Input
              name="location"
              placeholder="서울 강남구 역삼동 / 온라인"
              className="mt-1.5 border-nu-ink/15 bg-transparent"
            />
          </div>

          {/* Agendas section */}
          <div className="border-t border-nu-ink/[0.08] pt-5 mt-2">
            <h2 className="font-head text-lg font-extrabold text-nu-ink mb-4">
              안건 추가
            </h2>

            {/* Existing agendas */}
            {agendas.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                {agendas.map((agenda, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-nu-cream/30 border border-nu-ink/[0.06] p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-nu-ink truncate">
                        {agenda.topic}
                      </p>
                      {agenda.description && (
                        <p className="text-xs text-nu-muted truncate mt-0.5">
                          {agenda.description}
                        </p>
                      )}
                    </div>
                    <span className="font-mono-nu text-[10px] text-nu-muted shrink-0">
                      {agenda.duration_min}분
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAgenda(i)}
                      className="text-nu-red hover:text-nu-red/80 shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add agenda form */}
            <div className="flex flex-col gap-3 bg-nu-cream/20 border border-dashed border-nu-ink/10 p-4">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_80px] gap-3">
                <Input
                  value={newAgenda.topic}
                  onChange={(e) =>
                    setNewAgenda((prev) => ({ ...prev, topic: e.target.value }))
                  }
                  placeholder="안건 주제"
                  className="border-nu-ink/15 bg-transparent"
                />
                <Input
                  type="number"
                  min={1}
                  value={newAgenda.duration_min}
                  onChange={(e) =>
                    setNewAgenda((prev) => ({
                      ...prev,
                      duration_min: parseInt(e.target.value) || 10,
                    }))
                  }
                  placeholder="분"
                  className="border-nu-ink/15 bg-transparent"
                />
              </div>
              <Textarea
                value={newAgenda.description}
                onChange={(e) =>
                  setNewAgenda((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="안건 설명 (선택)"
                rows={2}
                className="border-nu-ink/15 bg-transparent resize-none"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addAgenda}
                className="self-start font-mono-nu text-[10px] uppercase tracking-widest"
              >
                <Plus size={14} /> 안건 추가
              </Button>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              type="submit"
              disabled={loading}
              className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest px-8"
            >
              {loading ? "생성 중..." : "미팅 만들기"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="font-mono-nu text-[11px] uppercase tracking-widest"
            >
              취소
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
