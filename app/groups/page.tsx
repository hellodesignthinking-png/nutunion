import { createClient } from "@/lib/supabase/server";
import { Plus } from "lucide-react";
import { GroupsList } from "@/components/groups/groups-list";
import { PageHero } from "@/components/shared/page-hero";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/landing/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "소모임 — nutunion",
  description: "nutunion 소모임을 탐색하고 참여하세요",
};

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const supabase = await createClient();

  // auth + groups + user_memberships 조회 (병렬)
  const [{ data: { user } }, { data: groups }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("groups")
      .select("*, host:profiles!groups_host_id_fkey(id, nickname), group_members(count)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  const { data: userMemberships } = user 
    ? await supabase.from("group_members").select("group_id, status").eq("user_id", user.id)
    : { data: [] };

  // membership Map 생성
  const statusMap = new Map((userMemberships || []).map((m: any) => [m.group_id, m.status]));

  const formattedGroups = (groups || []).map((g: any) => ({
    ...g,
    member_count: g.group_members?.[0]?.count || 0,
    host_nickname: g.host?.nickname || "unknown",
    user_status: statusMap.get(g.id) || null,
  }));

  return (
    <>
      <PageHero 
        category="Collaborate"
        title="소모임 탐색"
        description="Scene을 만들어가는 크루들을 탐색하고 함께 성장하세요. 관심사나 프로젝트 성격에 맞는 팀을 찾아보세요."
        action={user ? { label: "소모임 만들기", href: "/groups/create", icon: Plus } : undefined}
      />

      <div className="max-w-7xl mx-auto px-8 py-16">
        <GroupsList groups={formattedGroups} userId={user?.id} />
      </div>
    </>
  );
}
