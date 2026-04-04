"use client";

import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";

export function AdminUserList({ users }: { users: Profile[] }) {
  const router = useRouter();

  async function toggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "member" : "admin";
    if (!confirm(`이 사용자의 역할을 ${newRole}로 변경하시겠습니까?`)) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`역할이 ${newRole}로 변경되었습니다`);
    router.refresh();
  }

  const catLabels: Record<string, string> = {
    space: "공간",
    culture: "문화",
    platform: "플랫폼",
    vibe: "바이브",
  };

  return (
    <div className="bg-nu-white border border-nu-ink/[0.08] overflow-x-auto">
      {/* Desktop table */}
      <table className="w-full hidden md:table" role="table">
        <thead>
          <tr className="border-b border-nu-ink/[0.08]">
            <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">이름</th>
            <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">닉네임</th>
            <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">이메일</th>
            <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">분야</th>
            <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">역할</th>
            <th className="text-left px-5 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted font-normal">관리</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-nu-ink/[0.04] last:border-0 text-sm">
              <td className="px-5 py-3 truncate max-w-[120px]">{u.name}</td>
              <td className="px-5 py-3 font-medium truncate max-w-[120px]">{u.nickname}</td>
              <td className="px-5 py-3 text-nu-muted truncate max-w-[180px]">{u.email}</td>
              <td className="px-5 py-3 text-nu-muted capitalize">{u.specialty ? catLabels[u.specialty] || u.specialty : "-"}</td>
              <td className="px-5 py-3">
                {u.role === "admin" ? (
                  <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-pink text-white px-2 py-0.5 inline-block">Admin</span>
                ) : (
                  <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">Member</span>
                )}
              </td>
              <td className="px-5 py-3">
                <button onClick={() => toggleRole(u.id, u.role)} className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:underline">변경</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-nu-ink/[0.06]">
        {users.map((u) => (
          <div key={u.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{u.nickname}</p>
                {u.role === "admin" && (
                  <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-nu-pink text-white px-1.5 py-0.5 shrink-0">Admin</span>
                )}
              </div>
              <p className="text-xs text-nu-muted truncate">{u.email}</p>
            </div>
            <button onClick={() => toggleRole(u.id, u.role)} className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:underline shrink-0">변경</button>
          </div>
        ))}
      </div>
    </div>
  );
}
