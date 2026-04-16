"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function EventActions({
  eventId,
  userId,
  myStatus,
  maxAttendees,
  registeredCount,
}: {
  eventId: string;
  userId: string;
  myStatus: string | null;
  maxAttendees: number | null;
  registeredCount: number;
}) {
  const router = useRouter();

  async function handleRegister() {
    const supabase = createClient();
    const isFull = maxAttendees && registeredCount >= maxAttendees;
    const status = isFull ? "waitlist" : "registered";

    const { error } = await supabase.from("event_attendees").insert({
      event_id: eventId,
      user_id: userId,
      status,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      status === "waitlist"
        ? "대기자로 등록되었습니다"
        : "참석 등록 완료!"
    );
    router.refresh();
  }

  async function handleCancel() {
    const supabase = createClient();

    const { error } = await supabase
      .from("event_attendees")
      .update({ status: "cancelled" })
      .eq("event_id", eventId)
      .eq("user_id", userId);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Promote first waitlisted user
    if (maxAttendees) {
      const { data: waitlisted } = await supabase
        .from("event_attendees")
        .select("user_id")
        .eq("event_id", eventId)
        .eq("status", "waitlist")
        .order("registered_at")
        .limit(1);

      if (waitlisted && waitlisted.length > 0) {
        await supabase
          .from("event_attendees")
          .update({ status: "registered" })
          .eq("event_id", eventId)
          .eq("user_id", waitlisted[0].user_id);

        // Create notification for promoted user
        await supabase.from("notifications").insert({
          user_id: waitlisted[0].user_id,
          type: "waitlist_promoted",
          title: "참석 확정!",
          body: "대기 중이던 일정에 자리가 생겨 참석이 확정되었습니다.",
          metadata: { event_id: eventId },
        });
      }
    }

    toast.success("참석이 취소되었습니다");
    router.refresh();
  }

  if (myStatus === "registered") {
    return (
      <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
        <p className="font-mono-nu text-[13px] uppercase tracking-widest text-green-600 mb-3">
          참석 확정
        </p>
        <button
          onClick={handleCancel}
          className="font-mono-nu text-[13px] uppercase tracking-widest px-6 py-3 border border-nu-red/30 text-nu-red hover:bg-nu-red hover:text-white transition-colors"
        >
          참석 취소
        </button>
      </div>
    );
  }

  if (myStatus === "waitlist") {
    return (
      <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
        <p className="font-mono-nu text-[13px] uppercase tracking-widest text-nu-amber mb-3">
          대기 중
        </p>
        <p className="text-sm text-nu-gray mb-3">
          자리가 생기면 자동으로 참석이 확정됩니다.
        </p>
        <button
          onClick={handleCancel}
          className="font-mono-nu text-[13px] uppercase tracking-widest px-6 py-3 border border-nu-ink/20 text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-colors"
        >
          대기 취소
        </button>
      </div>
    );
  }

  if (myStatus === "cancelled") {
    return (
      <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
        <button
          onClick={handleRegister}
          className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors"
        >
          다시 참석하기
        </button>
      </div>
    );
  }

  return (
    <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
      <button
        onClick={handleRegister}
        className="font-mono-nu text-[13px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors"
      >
        {maxAttendees && registeredCount >= maxAttendees
          ? "대기자 등록"
          : "참석 등록"}
      </button>
    </div>
  );
}
