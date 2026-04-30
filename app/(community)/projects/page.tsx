import { createClient } from "@/lib/supabase/server";
import { ProjectsGrid } from "@/components/projects/projects-grid";
import { TemplateCard } from "@/components/groups/template-card";
import { PageHero } from "@/components/shared/page-hero";
import { Suspense } from "react";
import { ProjectSkeleton } from "@/components/shared/skeletons";
import { Star } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects — nutunion",
  description: "nutunion 볼트를 탐색하고 참여하세요",
};

export const revalidate = 60;

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <PageHero
        compact
        category="Collaborate"
        title="볼트 (Bolt)"
        description="너트들이 합쳐져 해결하는 과제, 볼트. 관심 있는 볼트에 참여해 비즈니스 경험을 쌓아보세요."
        action={{ label: "볼트 만들기", href: "/projects/create" }}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-8 pt-6">
        {user && (
          <div className="flex items-center justify-end mb-4">
            <Link
              href="/projects/create"
              className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite hover:text-nu-pink no-underline inline-flex items-center gap-1"
            >
              <Star size={11} /> 템플릿으로 시작하기 →
            </Link>
          </div>
        )}

        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
    { data: userMemberships },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, description, status, category, image_url, start_date, end_date, created_at, venture_mode, venture_stage, recruiting, needed_roles, dev_plan, creator:profiles!projects_created_by_fkey(nickname, avatar_url), project_members(count), project_milestones(id, status)")
      .neq("status", "draft")
      .order("created_at", { ascending: false }),
    userId ?
      supabase
        .from("profiles")
        .select("role, can_create_crew, grade")
        .eq("id", userId)
        .maybeSingle() :
      Promise.resolve({ data: null }),
    userId
      ? supabase.from("project_members").select("project_id, role").eq("user_id", userId)
      : Promise.resolve({ data: [] }),
  ]);

  const memberMap = new Map((userMemberships || []).map((m: any) => [m.project_id, m.role]));

  const formatted = (projects || []).map((p: any) => {
    const creatorData = Array.isArray(p.creator) ? p.creator[0] || null : p.creator;
    const milestones = p.project_milestones || [];
    const milestoneTotal = milestones.length;
    const milestoneCompleted = milestones.filter((m: any) => m.status === "completed").length;
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
      milestone_total: milestoneTotal,
      milestone_completed: milestoneCompleted,
      user_role: memberMap.get(p.id) || null,
      venture_mode: p.venture_mode ?? false,
      venture_stage: p.venture_stage ?? null,
      recruiting: p.recruiting ?? false,
      has_dev_plan: !!p.dev_plan,
    };
  });

  return <ProjectsGrid projects={formatted} userId={userId} />;
  } catch (err) {
    console.error("ProjectsListWrapper error:", err);
    return <div className="p-8 text-center text-nu-muted">볼트 목록을 불러오는 중 오류가 발생했습니다.</div>;
  }
}
