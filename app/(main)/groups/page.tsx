import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { GroupsList } from "@/components/groups/groups-list";

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: groups } = await supabase
    .from("groups")
    .select(
      "*, host:profiles!groups_host_id_fkey(id, nickname), group_members(count)"
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const formattedGroups = (groups || []).map((g: any) => ({
    ...g,
    member_count: g.group_members?.[0]?.count || 0,
    host_nickname: g.host?.nickname || "unknown",
  }));

  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink">
            소모임
          </h1>
          <p className="text-nu-gray text-sm mt-1">
            Scene을 만들어가는 크루들을 탐색하세요
          </p>
        </div>
        <Link
          href="/groups/create"
          className="font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-5 py-3 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-colors no-underline inline-flex items-center gap-2"
        >
          <Plus size={14} /> 소모임 만들기
        </Link>
      </div>

      <GroupsList groups={formattedGroups} userId={user?.id} />
    </div>
  );
}
