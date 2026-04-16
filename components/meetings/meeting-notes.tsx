"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MeetingNote, NoteType, Profile } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  StickyNote,
  ListTodo,
  Gavel,
  Plus,
  CheckCircle2,
  Circle,
  User,
  CalendarDays,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface MeetingNotesProps {
  meetingId: string;
  members: Profile[];
  userId: string | null;
}

export function MeetingNotes({ meetingId, members, userId }: MeetingNotesProps) {
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("meeting_notes")
      .select(
        "*, owner:profiles!meeting_notes_owner_id_fkey(id, nickname), creator:profiles!meeting_notes_created_by_fkey(id, nickname)"
      )
      .eq("meeting_id", meetingId)
      .order("created_at");

    if (data) {
      setNotes(data as MeetingNote[]);
    }
    setLoading(false);
  }, [meetingId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const noteItems = notes.filter((n) => n.type === "note");
  const actionItems = notes.filter((n) => n.type === "action_item");
  const decisions = notes.filter((n) => n.type === "decision");

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-10 bg-nu-cream/50 w-64" />
        <div className="h-32 bg-nu-cream/50" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="notes">
      <TabsList variant="line" className="mb-4">
        <TabsTrigger value="notes" className="font-mono-nu text-[13px] uppercase tracking-widest">
          <StickyNote size={14} className="mr-1" /> 노트 ({noteItems.length})
        </TabsTrigger>
        <TabsTrigger value="actions" className="font-mono-nu text-[13px] uppercase tracking-widest">
          <ListTodo size={14} className="mr-1" /> 액션 아이템 ({actionItems.length})
        </TabsTrigger>
        <TabsTrigger value="decisions" className="font-mono-nu text-[13px] uppercase tracking-widest">
          <Gavel size={14} className="mr-1" /> 결정 사항 ({decisions.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="notes">
        <NoteSection
          type="note"
          items={noteItems}
          meetingId={meetingId}
          members={members}
          userId={userId}
          onRefresh={loadNotes}
        />
      </TabsContent>

      <TabsContent value="actions">
        <ActionItemSection
          items={actionItems}
          meetingId={meetingId}
          members={members}
          userId={userId}
          onRefresh={loadNotes}
        />
      </TabsContent>

      <TabsContent value="decisions">
        <NoteSection
          type="decision"
          items={decisions}
          meetingId={meetingId}
          members={members}
          userId={userId}
          onRefresh={loadNotes}
        />
      </TabsContent>
    </Tabs>
  );
}

/* ------------------------------------------------------------------ */
/*  Notes / Decisions section                                          */
/* ------------------------------------------------------------------ */

function NoteSection({
  type,
  items,
  meetingId,
  members,
  userId,
  onRefresh,
}: {
  type: "note" | "decision";
  items: MeetingNote[];
  meetingId: string;
  members: Profile[];
  userId: string | null;
  onRefresh: () => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const label = type === "note" ? "노트" : "결정 사항";

  async function handleAdd() {
    if (!content.trim()) {
      toast.error("내용을 입력해주세요");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("meeting_notes").insert({
      meeting_id: meetingId,
      type,
      content: content.trim(),
      created_by: userId,
    });

    if (error) {
      toast.error("추가에 실패했습니다");
    } else {
      setContent("");
      await onRefresh();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("meeting_notes")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("삭제에 실패했습니다");
    } else {
      await onRefresh();
    }
  }

  return (
    <div>
      {/* List */}
      {items.length === 0 ? (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6 text-center mb-4">
          <p className="text-nu-gray text-sm">{label}이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-nu-white border border-nu-ink/[0.08] p-4 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-nu-ink leading-relaxed">
                  {item.content}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {item.creator && (
                    <span className="font-mono-nu text-[12px] text-nu-muted flex items-center gap-1">
                      <User size={10} /> {item.creator.nickname}
                    </span>
                  )}
                  <span className="font-mono-nu text-[12px] text-nu-muted">
                    {new Date(item.created_at).toLocaleDateString("ko")}
                  </span>
                </div>
              </div>
              {item.created_by === userId && (
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-nu-muted hover:text-nu-red transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="bg-nu-cream/20 border border-dashed border-nu-ink/10 p-4 flex flex-col gap-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            type === "note"
              ? "노트를 작성하세요..."
              : "결정 사항을 기록하세요..."
          }
          rows={2}
          className="border-nu-ink/15 bg-transparent resize-none"
        />
        <Button
          onClick={handleAdd}
          disabled={saving}
          className="self-start bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[12px] uppercase tracking-widest"
        >
          <Plus size={12} /> {saving ? "추가 중..." : `${label} 추가`}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Action Items section                                               */
/* ------------------------------------------------------------------ */

function ActionItemSection({
  items,
  meetingId,
  members,
  userId,
  onRefresh,
}: {
  items: MeetingNote[];
  meetingId: string;
  members: Profile[];
  userId: string | null;
  onRefresh: () => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!content.trim()) {
      toast.error("내용을 입력해주세요");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("meeting_notes").insert({
      meeting_id: meetingId,
      type: "action_item" as NoteType,
      content: content.trim(),
      owner_id: ownerId || null,
      due_date: dueDate || null,
      status: "pending",
      created_by: userId,
    });

    if (error) {
      toast.error("추가에 실패했습니다");
    } else {
      setContent("");
      setOwnerId("");
      setDueDate("");
      await onRefresh();
    }
    setSaving(false);
  }

  async function toggleStatus(item: MeetingNote) {
    const newStatus = item.status === "done" ? "pending" : "done";
    const supabase = createClient();
    const { error } = await supabase
      .from("meeting_notes")
      .update({ status: newStatus })
      .eq("id", item.id);

    if (error) {
      toast.error("상태 변경에 실패했습니다");
    } else {
      await onRefresh();
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("meeting_notes")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("삭제에 실패했습니다");
    } else {
      await onRefresh();
    }
  }

  return (
    <div>
      {/* List */}
      {items.length === 0 ? (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6 text-center mb-4">
          <p className="text-nu-gray text-sm">액션 아이템이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-nu-white border border-nu-ink/[0.08] p-4 flex items-start gap-3"
            >
              <button
                onClick={() => toggleStatus(item)}
                className="shrink-0 mt-0.5"
              >
                {item.status === "done" ? (
                  <CheckCircle2 size={18} className="text-nu-pink" />
                ) : (
                  <Circle size={18} className="text-nu-muted" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm leading-relaxed ${
                    item.status === "done"
                      ? "line-through text-nu-muted"
                      : "text-nu-ink"
                  }`}
                >
                  {item.content}
                </p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {item.owner && (
                    <span className="font-mono-nu text-[12px] text-nu-muted flex items-center gap-1">
                      <User size={10} /> {item.owner.nickname}
                    </span>
                  )}
                  {item.due_date && (
                    <span className="font-mono-nu text-[12px] text-nu-muted flex items-center gap-1">
                      <CalendarDays size={10} />{" "}
                      {new Date(item.due_date).toLocaleDateString("ko")}
                    </span>
                  )}
                  {item.creator && (
                    <span className="font-mono-nu text-[12px] text-nu-muted">
                      작성: {item.creator.nickname}
                    </span>
                  )}
                </div>
              </div>
              {item.created_by === userId && (
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-nu-muted hover:text-nu-red transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <div className="bg-nu-cream/20 border border-dashed border-nu-ink/10 p-4 flex flex-col gap-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="액션 아이템 내용"
          rows={2}
          className="border-nu-ink/15 bg-transparent resize-none"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <span className="font-mono-nu text-[12px] text-nu-muted block mb-1">
              담당자
            </span>
            <Select value={ownerId} onValueChange={(v) => v && setOwnerId(v)}>
              <SelectTrigger className="border-nu-ink/15 bg-transparent">
                <SelectValue placeholder="담당자 선택" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nickname || m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="font-mono-nu text-[12px] text-nu-muted block mb-1">
              마감일
            </span>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="border-nu-ink/15 bg-transparent"
            />
          </div>
        </div>
        <Button
          onClick={handleAdd}
          disabled={saving}
          className="self-start bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[12px] uppercase tracking-widest"
        >
          <Plus size={12} /> {saving ? "추가 중..." : "액션 아이템 추가"}
        </Button>
      </div>
    </div>
  );
}
