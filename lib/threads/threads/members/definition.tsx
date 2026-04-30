"use client";
import { useEffect, useState } from "react";
import { registry, type ThreadProps } from "@/lib/threads/registry";
import { createClient } from "@/lib/supabase/client";

interface MemberRow {
  user_id: string;
  role: string;
  status: string;
  profile?: { id: string; nickname?: string | null; avatar_url?: string | null; bio?: string | null } | null;
}

function MembersComponent({ installation, canEdit }: ThreadProps) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        if (installation.target_type !== "nut") {
          setMembers([]);
          setError("members thread는 너트(group) 전용입니다");
          return;
        }
        const { data, error: e } = await supabase
          .from("group_members")
          .select(`user_id, role, status, profile:profiles ( id, nickname, avatar_url, bio )`)
          .eq("group_id", installation.target_id)
          .eq("status", "active");
        if (e) throw e;
        setMembers((data as any) || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [installation.target_id, installation.target_type]);

  const filtered = members.filter((m) => {
    if (roleFilter !== "all" && m.role !== roleFilter) return false;
    if (search && !(m.profile?.nickname || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="border-[3px] border-nu-ink p-4 bg-white shadow-[4px_4px_0_0_#0D0F14] space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-head text-lg font-extrabold text-nu-ink">👥 멤버</h3>
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{filtered.length}명</span>
      </div>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="닉네임 검색"
          className="flex-1 border-[2px] border-nu-ink/30 px-2 py-1 text-sm font-mono"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border-[2px] border-nu-ink/30 px-2 py-1 text-sm font-mono"
        >
          <option value="all">전체</option>
          <option value="host">호스트</option>
          <option value="moderator">모더레이터</option>
          <option value="member">멤버</option>
        </select>
      </div>

      {error && <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-[11px] font-mono">{error}</div>}

      {loading ? (
        <div className="text-[11px] font-mono text-nu-muted">로딩...</div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 border-[2px] border-nu-ink/20 p-2">
              <div className="w-9 h-9 border-[2px] border-nu-ink overflow-hidden bg-nu-cream flex items-center justify-center font-bold">
                {m.profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{(m.profile?.nickname || "?").charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-nu-ink truncate">{m.profile?.nickname || "(이름 없음)"}</div>
                {m.profile?.bio && (
                  <div className="text-[11px] text-nu-muted font-mono truncate">{m.profile.bio}</div>
                )}
              </div>
              <span className={`font-mono-nu text-[10px] uppercase tracking-widest border-[1.5px] px-1.5 py-0.5 ${
                m.role === "host" ? "border-nu-pink text-nu-pink" :
                m.role === "moderator" ? "border-amber-500 text-amber-700" :
                "border-nu-ink/30 text-nu-muted"
              }`}>
                {m.role}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <button className="border-[2px] border-nu-ink bg-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#0D0F14] transition">
          + 초대 (추후)
        </button>
      )}
    </div>
  );
}

registry.register({
  slug: "members",
  name: "👥 멤버",
  description: "너트 멤버 디렉토리. 검색/필터/초대.",
  icon: "👥",
  category: "communication",
  scope: ["nut"],
  schema: { type: "object", properties: {} },
  Component: MembersComponent,
  isCore: true,
  version: "1.0.0",
});
