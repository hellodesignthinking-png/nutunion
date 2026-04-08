import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ProjectsGrid } from "@/components/projects/projects-grid";
import { Nav } from "@/components/shared/nav";
import { PageHero } from "@/components/shared/page-hero";
import { Footer } from "@/components/landing/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects — nutunion",
  description: "nutunion 커뮤니티 프로젝트를 탐색하고 참여하세요",
};

// 30초 ISR
export const revalidate = 30;

export default async function ProjectsPage() {
  const supabase = await createClient();

  // ── auth + profile + projects 전체 병렬 조회 ──────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  
  const [
    { data: projects },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("*, creator:profiles!projects_created_by_fkey(id, nickname, avatar_url), project_members(count)")
      .neq("status", "draft")
      .order("created_at", { ascending: false }),
    user ? 
      supabase
        .from("profiles")
        .select("role, can_create_crew, grade")
        .eq("id", user.id)
        .single() : 
      Promise.resolve({ data: null })
  ]);

  const canCreate = profile?.role === "admin" || !!profile?.can_create_crew ||
    ["vip", "gold"].includes(profile?.grade || "");

  const formatted = (projects || []).map((p: any) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    status: p.status,
    category: p.category,
    image_url: p.image_url,
    start_date: p.start_date,
    end_date: p.end_date,
    created_at: p.created_at,
    creator_nickname: p.creator?.nickname || "unknown",
    creator_avatar: p.creator?.avatar_url || null,
    member_count: p.project_members?.[0]?.count || 0,
    task_stats: p.task_stats || null,
  }));

  return (
    <div className="min-h-screen bg-nu-paper">
      <Nav />
      <PageHero 
        category="Collaborate"
        title="Projects"
        description="크루와 멤버들이 함께 실전 서비스를 만들어가는 프로젝트 Scene입니다. 관심 있는 프로젝트에 참여하여 실질적인 비즈니스 경험을 쌓아보세요."
        action={canCreate ? { label: "프로젝트 만들기", href: "/projects/create", icon: Plus } : undefined}
      />

      <div className="max-w-7xl mx-auto px-8 py-16">
        <ProjectsGrid projects={formatted} userId={user?.id} />
      </div>
      <Footer />
    </div>
  );
}
