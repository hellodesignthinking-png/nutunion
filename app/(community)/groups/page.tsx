import { createClient } from "@/lib/supabase/server";
import { Zap, BookOpen, Rocket, Star, ArrowRight } from "lucide-react";
import { GroupsList } from "@/components/groups/groups-list";
import { PageHero } from "@/components/shared/page-hero";
import { Suspense } from "react";
import { GroupSkeleton } from "@/components/shared/skeletons";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "소모임 — nutunion",
  description: "nutunion 소모임을 탐색하고 참여하세요",
};

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="bg-nu-paper min-h-screen">
      <PageHero 
        category="Collaborate"
        title="소모임 탐색"
        description="Scene을 만들어가는 크루들을 탐색하고 함께 성장하세요. 관심사나 프로젝트 성격에 맞는 팀을 찾아보세요."
        action={user ? { label: "소모임 만들기", href: "/groups/create" } : undefined}
      />

      {/* Featured Templates Section */}
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-nu-ink text-nu-paper flex items-center justify-center rotate-3 border-2 border-nu-ink shadow-[4px_4px_0px_0px_#FF2E97]">
                 <Star size={24} className="fill-nu-paper" />
              </div>
              <div>
                <h2 className="font-head text-2xl font-black text-nu-ink uppercase tracking-tight">Success Templates</h2>
                <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-[0.2em] mt-0.5">Scale your community with proven structures</p>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
           <TemplateCard 
              title="Project Sprint - Standard"
              description="6주 단위의 고밀도 실행 스프린트에 최적화된 자료 구조와 미팅 아카이브 템플릿입니다."
              icon={<Rocket size={24} />}
              color="bg-nu-blue/5 border-nu-blue/20 text-nu-blue"
              tag="MOST POPULAR"
           />
           <TemplateCard 
              title="Weekly Paper Review"
              description="매주 1편의 논문이나 보고서를 깊게 읽고 인사이트를 나누는 지식 기반 소모임 전용입니다."
              icon={<BookOpen size={24} />}
              color="bg-nu-pink/5 border-nu-pink/20 text-nu-pink"
              tag="KNOWLEDGE BASE"
           />
           <TemplateCard 
              title="Venture Building 101"
              description="아이디어 검증부터 MVP 제작, 정산까지 비즈니스 빌딩의 전 과정을 관리하는 통합 템플릿입니다."
              icon={<Zap size={24} />}
              color="bg-nu-amber/5 border-nu-amber/20 text-nu-amber"
              tag="PRO WORKFLOW"
           />
        </div>

        {/* Existing Groups List */}
        <div className="flex items-center gap-3 mb-8">
           <div className="w-1.5 h-6 bg-nu-pink" />
           <h2 className="font-head text-2xl font-black text-nu-ink uppercase tracking-tight">Active Communities</h2>
        </div>
        
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

function TemplateCard({ title, description, icon, color, tag }: { title: string; description: string; icon: any; color: string; tag: string }) {
  return (
    <div className={`group relative p-6 border-2 transition-all hover:-translate-y-1 cursor-pointer overflow-hidden ${color} border-current`}>
       <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 rotate-12 transition-transform group-hover:rotate-45">
          {icon}
       </div>
       <div className="relative z-10">
          <span className="font-mono-nu text-[9px] font-black tracking-widest px-2 py-1 bg-white border border-nu-ink/10 mb-4 inline-block">
             {tag}
          </span>
          <h3 className="font-head text-xl font-bold mb-2 group-hover:text-nu-ink">{title}</h3>
          <p className="text-[11px] leading-relaxed opacity-70 mb-6">{description}</p>
          <div className="flex items-center gap-2 font-mono-nu text-[10px] font-black uppercase tracking-widest">
             Apply This Template <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
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
        .select("id, name, category, description, max_members, host_id, image_url, topic, host:profiles!groups_host_id_fkey(nickname), group_members(count)")
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
        topic: g.topic,
        member_count: g.group_members?.[0]?.count || 0,
        host_nickname: hostData?.nickname || "unknown",
        user_status: statusMap.get(g.id) || null,
      };
    });

    return <GroupsList groups={formattedGroups} userId={userId} />;
  } catch (err) {
    console.error("GroupsListWrapper error:", err);
    return <div className="p-8 text-center text-nu-muted">소모임 목록을 불러오는 중 오류가 발생했습니다.</div>;
  }
}
