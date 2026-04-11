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
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: group } = await supabase
        .from("groups")
        .select("name, host_id")
        .eq("id", groupId)
        .single();

      if (!group) return;

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
    }
    load();
  }, [groupId]);

  return (
    <>
      {groupInfo && (
        <GroupSubNav
          groupId={groupId}
          groupName={groupInfo.name}
          isHost={groupInfo.isHost}
          isManager={groupInfo.isManager}
        />
      )}
      {children}
    </>
  );
}
