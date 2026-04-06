"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

interface EventRsvpButtonProps {
  eventId: string;
  userId: string;
  maxAttendees?: number | null;
}

type RsvpStatus = "attending" | "maybe" | "declined" | null;

export function EventRsvpButton({ eventId, userId, maxAttendees }: EventRsvpButtonProps) {
  const [status, setStatus] = useState<RsvpStatus>(null);
  const [attendingCount, setAttendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Get user's RSVP
      const { data: myRsvp } = await supabase
        .from("event_attendances")
        .select("status")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .maybeSingle();

      setStatus((myRsvp?.status as RsvpStatus) || null);

      // Get attending count
      const { count } = await supabase
        .from("event_attendances")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "attending");

      setAttendingCount(count || 0);
      setInitialized(true);
    }
    load();
  }, [eventId, userId]);

  async function handleRsvp(newStatus: RsvpStatus) {
    if (loading) return;
    setLoading(true);
    const supabase = createClient();

    if (status === newStatus) {
      // Toggle off
      const { error } = await supabase
        .from("event_attendances")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", userId);

      if (!error) {
        setStatus(null);
        if (newStatus === "attending") setAttendingCount((c) => Math.max(0, c - 1));
        toast.success("참여 취소되었습니다");
      }
    } else {
      const { error } = await supabase
        .from("event_attendances")
        .upsert({ event_id: eventId, user_id: userId, status: newStatus }, { onConflict: "event_id,user_id" });

      if (!error) {
        if (status === "attending") setAttendingCount((c) => Math.max(0, c - 1));
        if (newStatus === "attending") setAttendingCount((c) => c + 1);
        setStatus(newStatus);
        toast.success(newStatus === "attending" ? "참여하겠습니다! ✓" : newStatus === "maybe" ? "미정으로 표시했습니다" : "불참으로 표시했습니다");
      } else {
        toast.error("오류가 발생했습니다");
      }
    }
    setLoading(false);
  }

  if (!initialized) return null;

  const isAttending = status === "attending";
  const isFull = maxAttendees !== null && maxAttendees !== undefined && attendingCount >= maxAttendees && !isAttending;

  return (
    <div className="flex items-center justify-between gap-4 w-full">
      {/* Attendee count */}
      <div className="flex items-center gap-1.5 font-mono-nu text-[11px] text-nu-muted">
        <Users size={12} />
        <span>{attendingCount}{maxAttendees ? `/${maxAttendees}` : ""}명 참여</span>
      </div>

      {/* RSVP Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleRsvp("attending")}
          disabled={loading || (isFull && !isAttending)}
          className={`inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 transition-all border ${
            isAttending
              ? "bg-green-500 border-green-500 text-white"
              : "border-nu-ink/15 text-nu-graphite hover:border-green-400 hover:text-green-600"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          aria-label="참여"
        >
          <Check size={11} />
          {status === "attending" ? "참여중" : isFull ? "마감" : "참여"}
        </button>
        <button
          onClick={() => handleRsvp("maybe")}
          disabled={loading}
          className={`inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 transition-all border ${
            status === "maybe"
              ? "bg-nu-amber/80 border-nu-amber text-white"
              : "border-nu-ink/15 text-nu-graphite hover:border-nu-amber hover:text-nu-amber"
          }`}
          aria-label="미정"
        >
          <Clock size={11} />
          미정
        </button>
        <button
          onClick={() => handleRsvp("declined")}
          disabled={loading}
          className={`inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 transition-all border ${
            status === "declined"
              ? "bg-nu-red/70 border-nu-red/70 text-white"
              : "border-nu-ink/15 text-nu-graphite hover:border-red-400 hover:text-red-500"
          }`}
          aria-label="불참"
        >
          <X size={11} />
          불참
        </button>
      </div>
    </div>
  );
}
