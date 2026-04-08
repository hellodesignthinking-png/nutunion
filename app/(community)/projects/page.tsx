import { createClient } from "@/lib/supabase/server";
import { ProjectsGrid } from "@/components/projects/projects-grid";
import { PageHero } from "@/components/shared/page-hero";
import { Suspense } from "react";
import { ProjectSkeleton } from "@/components/shared/skeletons";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects — nutunion",
  description: "nutunion 커뮤니티 프로젝트를 탐색하고 참여하세요",
};

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <PageHero 
        category="Collaborate"
        title="Projects"
        description="크루와 멤버들이 함께 실전 서비스를 만들어가는 프로젝트 Scene입니다. 관심 있는 프로젝트에 참여하여 실질적인 비즈니스 경험을 쌓아보세요."
        action={{ label: "프로젝트 만들기", href: "/projects/create" }}
      />

      <div className="max-w-7xl mx-auto px-8 py-16">
        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <ProjectSkeleton key={i} />)}
          </div>
        }>
          <ProjectsListWrapper userId={user?.id} />
        </Suspense>
      </div>
    </>
  );
}

async function ProjectsListWrapper({ userId }: { userId?: string }) {
  try {
  const supabase = await createClient();

  const [
    { data: projects },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, description, status, category, image_url, start_date, end_date, created_at, creator:profiles!projects_created_by_fkey(nickname, avatar_url), project_members(count)")
      .neq("status", "draft")
      .order("created_at", { ascending: false }),
    userId ? 
      supabase
        .from("profiles")
        .select("role, can_create_crew, grade")
        .eq("id", userId)
        .single() : 
      Promise.resolve({ data: null })
  ]);

  const formatted = (projects || []).map((p: any) => {
    const creatorData = Array.isArray(p.creator) ? p.creator[0] : p.creator;
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      status: p.status,
      category: p.category,
      image_url: p.image_url,
      start_date: p.start_date,
      end_date: p.end_date,
      creator_nickname: creatorData?.nickname || "unknown",
      creator_avatar: creatorData?.avatar_url || null,
      member_count: p.project_members?.[0]?.count || 0,
      created_at: p.created_at,
    };
  });

  return <ProjectsGrid projects={formatted} userId={userId} />;
  } catch (err) {
    console.error("ProjectsListWrapper error:", err);
    return <div className="p-8 text-center text-nu-muted">프로젝트 목록을 불러오는 중 오류가 발생했습니다.</div>;
  }
}
