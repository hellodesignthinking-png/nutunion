import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ChatDockPanel } from "@/components/chat/chat-dock-panel-client";
import { ProjectTopNav } from "@/components/projects/project-top-nav";

/**
 * 볼트 공통 레이아웃 — 모든 하위 페이지(탭/회의록/벤처/자료실/설정 등)에서
 *  - 상단: 볼트 브레드크럼 + 서브탭 nav (홈에선 숨김)
 *  - 우측: 채팅 도크 패널 (멤버/호스트/admin 만)
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  let canSeeChat = false;
  let projectTitle: string | null = null;
  let isAdminOrLead = false;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [{ data: project }, userCtx] = await Promise.all([
      supabase.from("projects").select("title, created_by").eq("id", projectId).maybeSingle(),
      user
        ? Promise.all([
            supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
            supabase
              .from("project_members")
              .select("id, role")
              .eq("project_id", projectId)
              .eq("user_id", user.id)
              .maybeSingle(),
          ])
        : Promise.resolve([{ data: null }, { data: null }] as any),
    ]);
    projectTitle = (project as any)?.title || null;

    if (user && userCtx) {
      const [{ data: profile }, { data: membership }] = userCtx as any;
      const isAdmin = (profile as any)?.role === "admin";
      const isMember = !!membership;
      const isOwner = (project as any)?.created_by === user.id;
      const isLead = (membership as any)?.role === "lead";
      canSeeChat = isAdmin || isMember || isOwner;
      isAdminOrLead = isAdmin || isOwner || isLead;
    }
  } catch {
    /* fail open */
  }

  return (
    <>
      <Suspense fallback={
        <nav className="bg-white border-b-[3px] border-nu-ink/15 sticky top-[60px] z-[100] shadow-md">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
            <div className="h-[52px] flex items-center">
              <span className="font-head text-sm font-bold text-nu-ink truncate">{projectTitle || ""}</span>
            </div>
          </div>
        </nav>
      }>
        <ProjectTopNav projectId={projectId} projectTitle={projectTitle || ""} isAdmin={isAdminOrLead} />
      </Suspense>
      {children}
      {canSeeChat && <ChatDockPanel projectId={projectId} />}
    </>
  );
}
