import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ProjectsGrid } from "@/components/projects/projects-grid";
import { Nav } from "@/components/shared/nav";
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

  // ── auth + profile + projects 병렬 조회 ─────────────────────────
  const [
    { data: { user } },
    { data: projects },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("projects")
      .select("*, creator:profiles!projects_created_by_fkey(id, nickname, avatar_url), project_members(count)")
      .neq("status", "draft")
      .order("created_at", { ascending: false }),
  ]);

  // 관리자 여부는 프로젝트 목록 로딩 후 별도 확인
  let canCreate = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, can_create_crew, grade")
      .eq("id", user.id)
      .single();
    canCreate = profile?.role === "admin" || !!profile?.can_create_crew ||
      ["vip", "gold"].includes(profile?.grade || "");
  }

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
      {/* Hero */}
      <div className="relative bg-nu-ink overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-nu-blue/15 via-nu-ink to-nu-pink/10" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-nu-blue/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[200px] h-[200px] bg-nu-pink/8 rounded-full blur-[80px]" />
        <div className="relative max-w-7xl mx-auto px-8 pt-28 pb-16">
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-blue block mb-4">
            Collaboration
          </span>
          <h1 className="font-head text-[clamp(36px,5vw,56px)] font-extrabold text-nu-paper leading-tight">
            Projects
          </h1>
          <p className="text-nu-paper/40 mt-4 max-w-lg text-sm leading-relaxed">
            크루와 멤버들이 함께 만들어가는 프로젝트들입니다.
          </p>
          {canCreate && (
            <div className="mt-8">
              <Link
                href="/projects/create"
                className="font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-6 py-3 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-colors no-underline inline-flex items-center gap-2"
              >
                <Plus size={14} /> 프로젝트 만들기
              </Link>
            </div>
          )}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-8 py-16">
        <ProjectsGrid projects={formatted} userId={user?.id} />
      </div>
      <Footer />
    </div>
  );
}
