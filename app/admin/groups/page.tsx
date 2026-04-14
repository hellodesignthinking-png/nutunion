import { createClient } from "@/lib/supabase/server";
import { AdminGroupList } from "@/components/admin/group-list";
import { Layers } from "lucide-react";

export default async function AdminGroupsPage() {
  const supabase = await createClient();

  // Get groups and separately count members and events
  const { data: groups } = await supabase
    .from("groups")
    .select("*, host:profiles!groups_host_id_fkey(nickname, email)")
    .order("created_at", { ascending: false });

  // Bulk-fetch member and event counts in 2 queries instead of N*2
  const groupIds = (groups || []).map((g: any) => g.id);
  const [memberCountsRes, eventCountsRes] = groupIds.length
    ? await Promise.all([
        supabase.from("group_members").select("group_id", { count: "exact" }).in("group_id", groupIds),
        supabase.from("events").select("group_id", { count: "exact" }).in("group_id", groupIds),
      ])
    : [{ data: [] }, { data: [] }];

  // Build count maps in JS
  const memberCountMap: Record<string, number> = {};
  (memberCountsRes.data || []).forEach((row: any) => {
    memberCountMap[row.group_id] = (memberCountMap[row.group_id] || 0) + 1;
  });
  const eventCountMap: Record<string, number> = {};
  (eventCountsRes.data || []).forEach((row: any) => {
    eventCountMap[row.group_id] = (eventCountMap[row.group_id] || 0) + 1;
  });

  const formatted = (groups || []).map((g: any) => ({
    ...g,
    member_count: memberCountMap[g.id] || 0,
    event_count: eventCountMap[g.id] || 0,
    host_nickname: g.host?.nickname || "unknown",
    host_email: g.host?.email || "",
  }));

  // Category breakdown
  const catLabels: Record<string, string> = {
    space: "공간",
    culture: "문화",
    platform: "플랫폼",
    vibe: "바이브",
  };
  const catColors: Record<string, string> = {
    space: "bg-nu-blue/10 text-nu-blue",
    culture: "bg-nu-amber/10 text-nu-amber",
    platform: "bg-nu-ink/5 text-nu-ink",
    vibe: "bg-nu-pink/10 text-nu-pink",
  };

  const categoryBreakdown: Record<string, number> = {};
  let activeCount = 0;
  formatted.forEach((g: any) => {
    categoryBreakdown[g.category] = (categoryBreakdown[g.category] || 0) + 1;
    if (g.is_active) activeCount++;
  });

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        너트 관리
      </h1>
      <p className="text-nu-gray text-sm mb-6">
        {formatted.length}개의 너트가 등록되어 있습니다
      </p>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-4">
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">전체</p>
          <p className="font-head text-2xl font-extrabold">{formatted.length}</p>
        </div>
        <div className="bg-nu-white border border-nu-ink/[0.08] p-4">
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-green-600 mb-1">활성</p>
          <p className="font-head text-2xl font-extrabold text-green-600">{activeCount}</p>
        </div>
        {Object.entries(categoryBreakdown).map(([cat, count]) => (
          <div key={cat} className="bg-nu-white border border-nu-ink/[0.08] p-4">
            <p className={`font-mono-nu text-[10px] uppercase tracking-widest mb-1 ${catColors[cat]?.split(" ")[1] || "text-nu-muted"}`}>
              {catLabels[cat] || cat}
            </p>
            <p className="font-head text-2xl font-extrabold">{count}</p>
          </div>
        ))}
      </div>

      <AdminGroupList groups={formatted} />
    </div>
  );
}
