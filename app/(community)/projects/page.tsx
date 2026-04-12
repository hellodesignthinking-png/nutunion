import { createClient } from "@/lib/supabase/server";
import { ProjectsGrid } from "@/components/projects/projects-grid";
import { TemplateCard } from "@/components/groups/template-card";
import { PageHero } from "@/components/shared/page-hero";
import { Suspense } from "react";
import { ProjectSkeleton } from "@/components/shared/skeletons";
import { Star } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects — nutunion",
  description: "nutunion 커뮤니티 프로젝트를 탐색하고 참여하세요",
};

export const revalidate = 60;

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

      <div className="max-w-7xl mx-auto px-8 py-10">
        {/* ── Featured Templates Section ─────────────────────────────── */}
        <div className="relative overflow-hidden bg-nu-ink p-8 mb-8 border-2 border-nu-ink">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#FF2E97]/10 to-transparent" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 bg-white/5 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Star size={26} className="text-[#FF2E97]" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="font-head text-2xl font-black text-white uppercase tracking-tight">Success Templates</h2>
                <span className="font-mono-nu text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 bg-[#FF2E97]/15 text-[#FF2E97] border border-[#FF2E97]/20">PRO</span>
              </div>
              <p className="font-mono-nu text-[10px] text-white/40 uppercase tracking-[0.2em]">검증된 구조로 프로젝트를 체계적으로 관리하세요</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <TemplateCard
            title="Local Branding"
            description="시장조사부터 런칭까지 로컬 브랜딩 프로젝트의 전 과정을 관리하는 템플릿입니다."
            iconName="rocket"
            color="bg-nu-blue/5 border-nu-blue/20 text-nu-blue"
            colorKey="blue"
            tag="MOST POPULAR"
            templateId="local-branding"
            basePath="/projects/create"
            details={{
              longDescription: "Local Branding은 로컬 비즈니스의 브랜드 아이덴티티 개발을 위해 설계된 템플릿입니다. 시장조사, 로고 & 아이덴티티 디자인, 공간 연출 및 제작, 런칭 및 홍보까지 전체 브랜딩 프로세스를 체계적으로 관리합니다.",
              features: [
                "시장조사 및 컨셉 기획",
                "로고 & 아이덴티티 설계",
                "공간 연출 및 제작 관리",
                "런칭 및 홍보 일정",
                "브랜드 가이드라인 템플릿"
              ],
              groupSize: "3-6명",
              duration: "3-4개월"
            }}
          />
          <TemplateCard
            title="Platform MVP"
            description="요구사항 정의부터 QA까지 플랫폼 개발의 전 과정을 관리하는 통합 템플릿입니다."
            iconName="zap"
            color="bg-nu-pink/5 border-nu-pink/20 text-nu-pink"
            colorKey="pink"
            tag="TECHNICAL"
            templateId="platform-mvp"
            basePath="/projects/create"
            details={{
              longDescription: "Platform MVP는 기술 팀이 플랫폼을 개발할 때 필요한 모든 단계를 포함한 템플릿입니다. 요구사항 정의, DB 설계, API 개발, 프론트엔드 개발부터 QA와 런칭까지 전체 개발 사이클을 관리합니다.",
              features: [
                "요구사항 정의 및 기획",
                "데이터베이스 설계",
                "API 개발 로드맵",
                "프론트엔드 개발 추적",
                "QA 및 테스트 관리"
              ],
              groupSize: "4-10명",
              duration: "2-3개월"
            }}
          />
          <TemplateCard
            title="Pop-up Store"
            description="공간 섭외부터 정산까지 팝업스토어 프로젝트의 전 과정을 관리하는 템플릿입니다."
            iconName="book-open"
            color="bg-nu-amber/5 border-nu-amber/20 text-nu-amber"
            colorKey="amber"
            tag="OPERATIONS"
            templateId="popup-store"
            basePath="/projects/create"
            details={{
              longDescription: "Pop-up Store는 임시 공간 기반 비즈니스를 운영할 때 필요한 모든 요소를 포함한 템플릿입니다. 공간 섭외, 비주얼 가이드 제작, 스태프 교육부터 운영 및 정산까지 팝업스토어 운영의 전체 프로세스를 관리합니다.",
              features: [
                "공간 섭외 및 기획",
                "비주얼 가이드 제작",
                "스태프 교육 및 준비",
                "운영 일정 관리",
                "비용 정산 시트"
              ],
              groupSize: "2-5명",
              duration: "1-2개월"
            }}
          />
        </div>

        {/* Existing Projects List */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1.5 h-6 bg-nu-pink" />
          <h2 className="font-head text-2xl font-black text-nu-ink uppercase tracking-tight">Active Projects</h2>
        </div>

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
