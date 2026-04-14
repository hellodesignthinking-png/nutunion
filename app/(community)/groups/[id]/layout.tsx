import { createClient } from "@/lib/supabase/server";
import { GroupSubNav } from "@/components/groups/group-sub-nav";

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = await params;
  const supabase = await createClient();

  let groupName = "너트";
  let isHost = false;
  let isManager = false;

  try {
    // Parallelize auth + group query
    const [{ data: { user } }, { data: group }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("groups").select("name, host_id").eq("id", groupId).single(),
    ]);

    if (group) {
      groupName = group.name;
      if (user) {
        isHost = group.host_id === user.id;
        const { data: membership } = await supabase
          .from("group_members")
          .select("role")
          .eq("group_id", groupId)
          .eq("user_id", user.id)
          .maybeSingle();
        isManager = isHost || membership?.role === "moderator";
      }
    }
  } catch {
    // fallback to defaults
  }

  return (
    <>
      <GroupSubNav
        groupId={groupId}
        groupName={groupName}
        isHost={isHost}
        isManager={isManager}
      />
      {children}
    </>
  );
}
