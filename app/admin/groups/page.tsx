import { createClient } from "@/lib/supabase/server";
import { AdminGroupList } from "@/components/admin/group-list";

export default async function AdminGroupsPage() {
  const supabase = await createClient();

  const { data: groups } = await supabase
    .from("groups")
    .select("*, host:profiles!groups_host_id_fkey(nickname), group_members(count)")
    .order("created_at", { ascending: false });

  const formatted = (groups || []).map((g: any) => ({
    ...g,
    member_count: g.group_members?.[0]?.count || 0,
    host_nickname: g.host?.nickname || "unknown",
  }));

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        소모임 관리
      </h1>
      <p className="text-nu-gray text-sm mb-8">
        {formatted.length}개의 소모임이 등록되어 있습니다
      </p>

      <AdminGroupList groups={formatted} />
    </div>
  );
}
