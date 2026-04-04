"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const filters = [
  { key: "all", label: "전체" },
  { key: "space", label: "Space" },
  { key: "culture", label: "Culture" },
  { key: "platform", label: "Platform" },
  { key: "vibe", label: "Vibe" },
];

const catColors: Record<string, { bg: string; text: string; bar: string }> = {
  space: { bg: "bg-nu-blue", text: "text-white", bar: "bg-nu-blue" },
  culture: { bg: "bg-nu-amber", text: "text-white", bar: "bg-nu-amber" },
  platform: { bg: "bg-nu-ink", text: "text-nu-paper", bar: "bg-nu-ink" },
  vibe: { bg: "bg-nu-pink", text: "text-white", bar: "bg-nu-pink" },
};

interface GroupItem {
  id: string;
  name: string;
  category: string;
  description: string;
  max_members: number;
  member_count: number;
  host_nickname: string;
  host_id: string;
}

export function GroupsList({
  groups,
  userId,
}: {
  groups: GroupItem[];
  userId?: string;
}) {
  const [filter, setFilter] = useState("all");
  const router = useRouter();

  const filtered =
    filter === "all" ? groups : groups.filter((g) => g.category === filter);

  async function handleJoin(groupId: string, maxMembers: number, currentCount: number) {
    if (!userId) {
      router.push("/login");
      return;
    }

    const supabase = createClient();
    const status = currentCount >= maxMembers ? "waitlist" : "active";

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

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-8">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 border-[1.5px] transition-colors ${
              filter === f.key
                ? "bg-nu-ink border-nu-ink text-nu-paper"
                : "bg-transparent border-nu-ink/20 text-nu-graphite hover:border-nu-ink/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((g) => {
          const color = catColors[g.category] || catColors.platform;
          const pct = g.max_members
            ? Math.min(Math.round((g.member_count / g.max_members) * 100), 100)
            : 0;
          const isFull = g.member_count >= g.max_members;

          return (
            <div
              key={g.id}
              className="group-card bg-nu-white border border-nu-ink/[0.08] p-5 flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  className={`inline-block font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 ${color.bg} ${color.text}`}
                >
                  {g.category}
                </span>
                <span className="font-mono-nu text-[10px] text-nu-muted">
                  by {g.host_nickname}
                </span>
              </div>

              <Link
                href={`/groups/${g.id}`}
                className="no-underline block flex-1"
              >
                <h3 className="font-head text-lg font-extrabold text-nu-ink leading-tight mb-2">
                  {g.name}
                </h3>
                <p className="font-body text-xs text-nu-gray leading-relaxed mb-4">
                  {g.description}
                </p>
              </Link>

              <div className="mb-3">
                <div className="progress-bar">
                  <div
                    className={`progress-bar-fill ${color.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono-nu text-[10px] text-nu-muted mt-1.5 block">
                  {g.member_count}/{g.max_members} 멤버
                  {isFull && " (정원 초과)"}
                </span>
              </div>

              {g.host_id === userId ? (
                <Link
                  href={`/groups/${g.id}/settings`}
                  className="font-mono-nu text-[10px] font-bold uppercase tracking-[0.1em] text-center py-2.5 border border-nu-pink/30 text-nu-pink no-underline block hover:bg-nu-pink hover:text-white transition-colors"
                >
                  관리하기
                </Link>
              ) : (
                <button
                  onClick={() => handleJoin(g.id, g.max_members, g.member_count)}
                  className="font-mono-nu text-[10px] font-bold uppercase tracking-[0.1em] text-center py-2.5 border border-nu-ink/20 text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-colors w-full"
                >
                  {isFull ? "대기자 등록" : "참여하기"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-nu-gray">해당 카테고리에 소모임이 없습니다</p>
        </div>
      )}
    </>
  );
}
