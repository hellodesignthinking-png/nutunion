import { createClient } from "@/lib/supabase/server";
import { Plus, Loader2 } from "lucide-react";
import { GroupsList } from "@/components/groups/groups-list";
import { PageHero } from "@/components/shared/page-hero";
import { Suspense } from "react";
import { GroupSkeleton } from "@/components/shared/skeletons";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "소모임 — nutunion",
  description: "nutunion 소모임을 탐색하고 참여하세요",
};

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="bg-nu-paper min-h-screen">
      <PageHero 
        category="Collaborate"
        title="소모임 탐색"
        description="Scene을 만들어가는 크루들을 탐색하고 함께 성장하세요. 관심사나 프로젝트 성격에 맞는 팀을 찾아보세요."
        action={user ? { label: "소모임 만들기", href: "/groups/create", icon: Plus } : undefined}
      />

      <div className="max-w-7xl mx-auto px-8 py-16">
        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <GroupSkeleton key={i} />)}
          </div>
        }>
          <GroupsListWrapper userId={user?.id} />
        </Suspense>
      </div>
    </div>
  );
}

async function GroupsListWrapper({ userId }: { userId?: string }) {
  const supabase = await createClient();

  // 최적화된 컬럼만 조회
  const [
    { data: groups },
    { data: userMemberships }
  ] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, category, description, max_members, host_id, image_url, topic, host:profiles!groups_host_id_fkey(nickname), group_members(count)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    userId 
      ? supabase.from("group_members").select("group_id, status").eq("user_id", userId)
      : Promise.resolve({ data: [] }),
  ]);

  const statusMap = new Map((userMemberships || []).map((m: any) => [m.group_id, m.status]));

  const formattedGroups = (groups || []).map((g: any) => ({
    ...g,
    member_count: g.group_members?.[0]?.count || 0,
    host_nickname: g.host?.nickname || "unknown",
    user_status: statusMap.get(g.id) || null,
  }));

  return <GroupsList groups={formattedGroups} userId={userId} />;
}
