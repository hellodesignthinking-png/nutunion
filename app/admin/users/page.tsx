import { createClient } from "@/lib/supabase/server";
import { AdminUserList } from "@/components/admin/user-list";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        회원 관리
      </h1>
      <p className="text-nu-gray text-sm mb-8">
        {users?.length || 0}명의 회원이 등록되어 있습니다
      </p>

      <AdminUserList users={users || []} />
    </div>
  );
}
