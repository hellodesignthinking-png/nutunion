import { createClient } from "@/lib/supabase/server";
import { AdminUserList } from "@/components/admin/user-list";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("*, grade, can_create_project")
    .order("created_at", { ascending: false });

  // Fetch crew memberships for all users
  const { data: memberships } = await supabase
    .from("group_members")
    .select("user_id, group_id, role, group:groups!group_members_group_id_fkey(name)")
    .eq("status", "active");

  // Build a map of user_id -> crews
  const crewMap: Record<string, { group_id: string; group_name: string; role: string }[]> = {};
  (memberships || []).forEach((m: any) => {
    if (!crewMap[m.user_id]) crewMap[m.user_id] = [];
    crewMap[m.user_id].push({
      group_id: m.group_id,
      group_name: m.group?.name || "unknown",
      role: m.role,
    });
  });

  const usersWithCrews = (users || []).map((u: any) => ({
    ...u,
    crews: crewMap[u.id] || [],
  }));

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        회원 관리
      </h1>
      <p className="text-nu-gray text-sm mb-8">
        {users?.length || 0}명의 회원이 등록되어 있습니다
      </p>

      <AdminUserList users={usersWithCrews} />
    </div>
  );
}
