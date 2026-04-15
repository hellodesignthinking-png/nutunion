import { createClient } from "@/lib/supabase/server";
import { Star } from "lucide-react";
import { GroupsList } from "@/components/groups/groups-list";
import { TemplateCard } from "@/components/groups/template-card";
import { PageHero } from "@/components/shared/page-hero";
import { AICommandBar } from "@/app/staff/ai-command-bar";
import { Suspense } from "react";
import { GroupSkeleton } from "@/components/shared/skeletons";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "너트 (Nut) — nutunion",
  description: "nutunion 너트를 탐색하고 참여하세요",
};

export const revalidate = 60;

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="bg-nu-paper min-h-screen">
      <PageHero
        category="Collaborate"
        title="너트 (Nut) 탐색"
        description="변화를 만드는 최소 단위, 너트로 모여보세요. 관심사나 과제에 맞는 너트를 찾아 단단하게 결합하세요."
        action={user ? { label: "너트 만들기", href: "/groups/create" } : undefined}
      />

      {/* ── AI Command Bar ──────────────────────────────────────────── */}
      {user && (
        <div className="max-w-7xl mx-auto px-8 pt-8">
          <AICommandBar />
        </div>
      )}

      {/* ── Featured Templates Section ─────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-8 py-10">
        {/* Section Header — dark premium banner */}
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
              <p className="font-mono-nu text-[10px] text-white/40 uppercase tracking-[0.2em]">검증된 구조로 커뮤니티를 스케일하세요</p>
            </div>
          </div>
        </div>

        {/* Mobile-only compact template pills */}
        <div className="md:hidden mb-6">
          <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mb-3">인기 템플릿</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            <Link href="/templates/sprint" className="shrink-0 px-4 py-2.5 bg-nu-blue/5 border border-nu-blue/20 text-nu-blue font-mono-nu text-[10px] uppercase tracking-widest no-underline hover:bg-nu-blue/10 transition-colors">
              🚀 Sprint
            </Link>
            <Link href="/templates/paper-review" className="shrink-0 px-4 py-2.5 bg-nu-pink/5 border border-nu-pink/20 text-nu-pink font-mono-nu text-[10px] uppercase tracking-widest no-underline hover:bg-nu-pink/10 transition-colors">
              📖 Paper Review
            </Link>
            <Link href="/templates/venture" className="shrink-0 px-4 py-2.5 bg-nu-amber/5 border border-nu-amber/20 text-nu-amber font-mono-nu text-[10px] uppercase tracking-widest no-underline hover:bg-nu-amber/10 transition-colors">
              ⚡ Venture
            </Link>
          </div>
        </div>

        <div className="hidden md:grid md:grid-cols-3 gap-6 mb-16">
           <TemplateCard
              title="Project Sprint - Standard"
              description="6주 단위의 고밀도 실행 스프린트에 최적화된 자료 구조와 미팅 아카이브 템플릿입니다."
              iconName="rocket"
              color="bg-nu-blue/5 border-nu-blue/20 text-nu-blue"
              colorKey="blue"
              tag="MOST POPULAR"
              templateId="sprint"
              details={{
                longDescription: "Project Sprint - Standard는 6주 단위의 고밀도 실행을 위해 설계된 템플릿입니다. 목표 설정, 주간 체크인, 미팅 아카이브, 결과 리뷰 등 전체 스프린트 사이클을 관리할 수 있는 구조를 제공합니다.",
                features: [
                  "주간 체크인 및 진행상황 추적",
                  "미팅 노트 아카이브 시스템",
                  "결과 리뷰 및 피드백",
                  "스프린트 평가 템플릿",
                  "자동화된 주간 리포트"
                ],
                groupSize: "4-12명",
                duration: "6주 사이클"
              }}
           />
           <TemplateCard
              title="Weekly Paper Review"
              description="매주 1편의 논문이나 보고서를 깊게 읽고 인사이트를 나누는 지식 기반 너트 전용입니다."
              iconName="book-open"
              color="bg-nu-pink/5 border-nu-pink/20 text-nu-pink"
              colorKey="pink"
              tag="KNOWLEDGE BASE"
              templateId="paper-review"
              details={{
                longDescription: "Weekly Paper Review는 지식 공유와 깊이 있는 토론을 위해 설계된 템플릿입니다. 매주 선정된 논문이나 보고서를 함께 읽고, 핵심 내용을 정리하고, 인사이트를 나누는 정기적인 모임을 운영할 수 있습니다.",
                features: [
                  "주간 논문 선정 및 공지",
                  "읽기 진행도 추적",
                  "토론 노트 및 요약",
                  "인사이트 공유 게시판",
                  "논문 아카이브 라이브러리"
                ],
                groupSize: "5-15명",
                duration: "지속적 운영"
              }}
           />
           <TemplateCard
              title="Venture Building 101"
              description="아이디어 검증부터 MVP 제작, 정산까지 비즈니스 빌딩의 전 과정을 관리하는 통합 템플릿입니다."
              iconName="zap"
              color="bg-nu-amber/5 border-nu-amber/20 text-nu-amber"
              colorKey="amber"
              tag="PRO WORKFLOW"
              templateId="venture"
              details={{
                longDescription: "Venture Building 101은 초기 스타트업이나 사이드 프로젝트를 함께 검증하고 개발하는 팀을 위한 템플릿입니다. 아이디어 검증, 고객 인터뷰, MVP 개발, 테스트, 정산까지 전체 빌딩 사이클을 체계적으로 관리합니다.",
                features: [
                  "아이디어 검증 프레임워크",
                  "고객 인터뷰 관리",
                  "MVP 개발 로드맵",
                  "테스트 및 피드백 수집",
                  "재정 관리 및 정산 도구"
                ],
                groupSize: "2-8명",
                duration: "12주 사이클"
              }}
           />
        </div>

        {/* Existing Groups List */}
        <div className="flex items-center gap-3 mb-8">
           <div className="w-1.5 h-6 bg-nu-pink" />
           <h2 className="font-head text-2xl font-black text-nu-ink uppercase tracking-tight">Active Communities</h2>
        </div>

        <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mb-6">
          활발하게 운영 중인 너트를 탐색하세요
        </p>

        <Suspense fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <GroupSkeleton key={i} />)}
          </div>
        }>
          <GroupsListWrapper userId={user?.id} />
        </Suspense>
      </div>
    </div>
  );
}


async function GroupsListWrapper({ userId }: { userId?: string }) {
  try {
    const supabase = await createClient();

    const [
      { data: groups },
      { data: userMemberships }
    ] = await Promise.all([
      supabase
        .from("groups")
        .select("id, name, category, description, max_members, host_id, image_url, created_at, host:profiles!groups_host_id_fkey(nickname, avatar_url), group_members(count)")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      userId 
        ? supabase.from("group_members").select("group_id, status").eq("user_id", userId)
        : Promise.resolve({ data: [] }),
    ]);

    const statusMap = new Map((userMemberships || []).map((m: any) => [m.group_id, m.status]));

    const formattedGroups = (groups || []).map((g: any) => {
      const hostData = Array.isArray(g.host) ? g.host[0] : g.host;
      return {
        id: g.id,
        name: g.name,
        category: g.category,
        description: g.description,
        max_members: g.max_members,
        host_id: g.host_id,
        image_url: g.image_url,
        created_at: g.created_at,
        member_count: g.group_members?.[0]?.count || 0,
        host_nickname: hostData?.nickname || "unknown",
        host_avatar_url: hostData?.avatar_url || null,
        user_status: statusMap.get(g.id) || null,
      };
    });

    return <GroupsList groups={formattedGroups} userId={userId} />;
  } catch (err) {
    console.error("GroupsListWrapper error:", err);
    return <div className="p-8 text-center text-nu-muted">너트 목록을 불러오는 중 오류가 발생했습니다.</div>;
  }
}
