"use client";

import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface GroupItem {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  member_count: number;
  max_members: number;
  host_nickname: string;
  created_at: string;
}

const catColors: Record<string, string> = {
  space: "bg-nu-blue",
  culture: "bg-nu-amber",
  platform: "bg-nu-ink",
  vibe: "bg-nu-pink",
};

export function AdminGroupList({ groups }: { groups: GroupItem[] }) {
  const router = useRouter();

  async function toggleActive(groupId: string, currentState: boolean) {
    const supabase = createClient();
    const { error } = await supabase
      .from("groups")
      .update({ is_active: !currentState })
      .eq("id", groupId);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(currentState ? "소모임이 비활성화되었습니다" : "소모임이 활성화되었습니다");
    router.refresh();
  }

  return (
    <div className="bg-nu-white border border-nu-ink/[0.08] overflow-x-auto">
      {/* Desktop table */}
      <table className="w-full hidden md:table" role="table">
        <thead>
          <tr className="border-b border-nu-ink/[0.08]">
            <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">소모임</th>
            <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">카테고리</th>
            <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">호스트</th>
            <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">멤버</th>
            <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">상태</th>
            <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">관리</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id} className={`border-b border-nu-ink/[0.04] last:border-0 text-sm ${!g.is_active ? "opacity-50" : ""}`}>
              <td className="px-5 py-3 font-medium truncate max-w-[200px]">{g.name}</td>
              <td className="px-5 py-3">
                <span className={`inline-block font-mono-nu text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 text-white ${catColors[g.category] || "bg-nu-gray"}`}>
                  {g.category}
                </span>
              </td>
              <td className="px-5 py-3 text-nu-muted truncate max-w-[120px]">{g.host_nickname}</td>
              <td className="px-5 py-3 font-mono-nu text-[11px]">{g.member_count}/{g.max_members}</td>
              <td className="px-5 py-3">
                {g.is_active ? (
                  <span className="font-mono-nu text-[9px] uppercase tracking-widest text-green-600">활성</span>
                ) : (
                  <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-red">비활성</span>
                )}
              </td>
              <td className="px-5 py-3">
                <button onClick={() => toggleActive(g.id, g.is_active)} className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:underline">
                  {g.is_active ? "비활성화" : "활성화"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-nu-ink/[0.06]">
        {groups.map((g) => (
          <div key={g.id} className={`p-4 ${!g.is_active ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`font-mono-nu text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 text-white ${catColors[g.category] || "bg-nu-gray"}`}>
                  {g.category}
                </span>
                <span className="font-medium text-sm truncate">{g.name}</span>
              </div>
              {g.is_active ? (
                <span className="font-mono-nu text-[9px] text-green-600 shrink-0">활성</span>
              ) : (
                <span className="font-mono-nu text-[9px] text-nu-red shrink-0">비활성</span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-nu-muted">
              <span>호스트: {g.host_nickname} · {g.member_count}/{g.max_members}명</span>
              <button onClick={() => toggleActive(g.id, g.is_active)} className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:underline">
                {g.is_active ? "비활성화" : "활성화"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
