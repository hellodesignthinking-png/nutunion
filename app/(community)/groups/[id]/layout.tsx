"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GroupSubNav } from "@/components/groups/group-sub-nav";

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const groupId = params?.id as string;
  const [groupInfo, setGroupInfo] = useState<{
    name: string;
    isHost: boolean;
    isManager: boolean;
  } | null>(null);

  useEffect(() => {
    if (!groupId) return;
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const { data: group } = await supabase
          .from("groups")
          .select("name, host_id")
          .eq("id", groupId)
          .single();

        if (!group) {
          // Even if group not found, show nav with fallback name
          setGroupInfo({ name: "소모임", isHost: false, isManager: false });
          return;
        }

        if (!user) {
          // Not logged in - still show nav with group name
          setGroupInfo({ name: group.name, isHost: false, isManager: false });
          return;
        }

        const { data: membership } = await supabase
          .from("group_members")
          .select("role")
          .eq("group_id", groupId)
          .eq("user_id", user.id)
          .maybeSingle();

        setGroupInfo({
          name: group.name,
          isHost: group.host_id === user.id,
          isManager: group.host_id === user.id || membership?.role === "manager",
        });
      } catch {
        // On error, show nav with fallback
        setGroupInfo({ name: "소모임", isHost: false, isManager: false });
      }
    }
    load();
  }, [groupId]);

  return (
    <>
      {/* Always show nav — loading state uses fallback name */}
      <GroupSubNav
        groupId={groupId}
        groupName={groupInfo?.name || "로딩 중..."}
        isHost={groupInfo?.isHost || false}
        isManager={groupInfo?.isManager || false}
      />
      {children}
    </>
  );
}
