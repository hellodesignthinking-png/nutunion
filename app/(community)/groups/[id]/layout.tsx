import { createClient } from "@/lib/supabase/server";
import { GroupSubNav } from "@/components/groups/group-sub-nav";
import { ChatDockPanel } from "@/components/chat/chat-dock-panel-client";

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

  let isMember = false;

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
        isMember = isHost || !!membership;
        isManager = isHost || membership?.role === "moderator";
      }
    }
  } catch {
    // fallback to defaults
  }

  if (!isMember) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="w-16 h-16 bg-nu-ink/[0.03] rounded-full flex items-center justify-center mb-6">
          <span className="text-3xl opacity-20">🔒</span>
        </div>
        <h2 className="font-head text-2xl font-extrabold text-nu-ink mb-2 uppercase tracking-widest">Access Restricted</h2>
        <p className="text-nu-muted text-sm mb-6 max-w-sm leading-relaxed">
          이 너트는 가입된 멤버들만 내부 내용을 확인하고 참여할 수 있는 프라이빗 공간입니다. 그룹리더나 초대 링크를 통해 가입 후 이용해주세요.
        </p>
        <a href="/groups" className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-6 py-2.5 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors">
          목록으로 돌아가기
        </a>
      </div>
    );
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
      {/* 너트 모든 하위 페이지 공통 — 우측 채팅 도킹 패널 */}
      <ChatDockPanel groupId={groupId} />
    </>
  );
}
