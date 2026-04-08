import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { GroupsList } from "@/components/groups/groups-list";
import { PageHero } from "@/components/shared/page-hero";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "소모임 — nutunion",
  description: "nutunion 소모임을 탐색하고 참여하세요",
};

// 30초 ISR 캐싱 (목록 페이지)
export const revalidate = 30;

export default async function GroupsPage() {
  const supabase = await createClient();

  // auth + groups 병렬 조회
  const [
    { data: { user } },
    { data: groups },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("groups")
      .select("*, host:profiles!groups_host_id_fkey(id, nickname), group_members(count)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  const formattedGroups = (groups || []).map((g: any) => ({
    ...g,
    member_count: g.group_members?.[0]?.count || 0,
    host_nickname: g.host?.nickname || "unknown",
  }));

  return (
    <div className="bg-nu-paper min-h-screen pb-20">
      <PageHero 
        category="Collaborate"
        title="Groups"
        description="Scene을 만들어가는 크루들을 탐색하고 함께 성장하세요. 관심사나 프로젝트 성격에 맞는 팀을 찾아보세요."
        action={user ? { label: "소모임 만들기", href: "/groups/create", icon: Plus } : undefined}
      />

      <div className="max-w-7xl mx-auto px-8 py-16">
        <GroupsList groups={formattedGroups} userId={user?.id} />
      </div>
    </div>
  );
}
