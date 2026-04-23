import { createClient } from "@/lib/supabase/server";
import { Star } from "lucide-react";
import { GroupsList } from "@/components/groups/groups-list";
import { TemplateCard } from "@/components/groups/template-card";
import { PageHero } from "@/components/shared/page-hero";
import { Suspense } from "react";
import { GroupSkeleton } from "@/components/shared/skeletons";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "너트 (Nut) — nutunion",
  description: "nutunion 너트를 탐색하고 참여하세요",
};

export const revalidate = 60;

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="bg-nu-paper min-h-screen">
      <PageHero
        compact
        category="Collaborate"
        title="너트 (Nut) 탐색"
        description="변화를 만드는 최소 단위, 너트로 모여보세요. 관심사/과제에 맞는 너트를 찾아 결합하세요."
        action={user ? { label: "너트 만들기", href: "/groups/create" } : undefined}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-8 pt-6">
        {/* 템플릿 — 신규 생성 진입 버튼만 (목록은 /groups/create 에서) */}
        {user && (
          <div className="flex items-center justify-end mb-4">
            <Link
              href="/groups/create"
              className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite hover:text-nu-pink no-underline inline-flex items-center gap-1"
            >
              <Star size={11} /> 템플릿으로 시작하기 →
            </Link>
          </div>
        )}

        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
  try {
    const supabase = await createClient();

    const [
      { data: groups },
      { data: userMemberships }
    ] = await Promise.all([
      supabase
        .from("groups")
        .select("id, name, category, description, max_members, host_id, image_url, created_at, host:profiles!groups_host_id_fkey(nickname, avatar_url), group_members(count)")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      userId 
        ? supabase.from("group_members").select("group_id, status").eq("user_id", userId)
        : Promise.resolve({ data: [] }),
    ]);

    const statusMap = new Map((userMemberships || []).map((m: any) => [m.group_id, m.status]));

    const formattedGroups = (groups || []).map((g: any) => {
      const hostData = Array.isArray(g.host) ? g.host[0] : g.host;
      return {
        id: g.id,
        name: g.name,
        category: g.category,
        description: g.description,
        max_members: g.max_members,
        host_id: g.host_id,
        image_url: g.image_url,
        created_at: g.created_at,
        member_count: g.group_members?.[0]?.count || 0,
        host_nickname: hostData?.nickname || "unknown",
        host_avatar_url: hostData?.avatar_url || null,
        user_status: statusMap.get(g.id) || null,
      };
    });

    // GroupsList 내부에서 이미 membership 우선 정렬 — 여기서는 count 만 전달
    const joinedCount = formattedGroups.filter((g) => g.user_status === "active" || g.host_id === userId).length;
    return <GroupsList groups={formattedGroups} userId={userId} joinedCount={joinedCount} />;
  } catch (err) {
    console.error("GroupsListWrapper error:", err);
    return <div className="p-8 text-center text-nu-muted">너트 목록을 불러오는 중 오류가 발생했습니다.</div>;
  }
}
