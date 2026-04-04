"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function GroupActions({
  groupId,
  userId,
  maxMembers,
  memberCount,
}: {
  groupId: string;
  userId: string;
  maxMembers: number;
  memberCount: number;
}) {
  const router = useRouter();

  async function handleJoin() {
    const supabase = createClient();
    const status = memberCount >= maxMembers ? "waitlist" : "active";

    const { error } = await supabase.from("group_members").insert({
      group_id: groupId,
      user_id: userId,
      role: "member",
      status,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("이미 가입한 소모임입니다");
      } else {
        toast.error(error.message);
      }
      return;
    }

    toast.success(
      status === "waitlist"
        ? "대기자 명단에 등록되었습니다"
        : "소모임에 참여했습니다!"
    );
    router.refresh();
  }

  const isFull = memberCount >= maxMembers;

  return (
    <button
      onClick={handleJoin}
      className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors"
    >
      {isFull ? "대기자 등록" : "참여하기"}
    </button>
  );
}
