import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CrewsGrid } from "@/components/crews/crews-grid";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/landing/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "크루 — nutunion",
  description: "Scene을 만드는 크루들을 탐색하고 참여하세요",
};

export default async function CrewsPage() {
  const supabase = await createClient();

  // ── 데이터 조회를 병렬로 실행하여 성능 최적화 ─────────────────────────
  const [
    { data: groups },
    { data: { user } },
  ] = await Promise.all([
    supabase
      .from("groups")
      .select("*, host:profiles!groups_host_id_fkey(id, nickname, avatar_url), group_members(count)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  const formatted = (groups || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    category: g.category,
    description: g.description,
    max_members: g.max_members,
    image_url: g.image_url,
    host_id: g.host_id,
    host_nickname: g.host?.nickname || "unknown",
    host_avatar: g.host?.avatar_url || null,
    member_count: g.group_members?.[0]?.count || 0,
    created_at: g.created_at,
  }));

  // 유저 정보에 기반한 추가 조회
  let memberships: any[] = [];
  let canCreateCrew = false;

  if (user) {
    const [
      { data: m },
      { data: profile },
    ] = await Promise.all([
      supabase
        .from("group_members")
        .select("group_id, status, role, rejection_reason")
        .eq("user_id", user.id),
      supabase
        .from("profiles")
        .select("can_create_crew, role")
        .eq("id", user.id)
        .single(),
    ]);

    memberships = m || [];
    canCreateCrew = profile?.can_create_crew === true || profile?.role === "admin";
  }

  return (
    <div className="min-h-screen bg-nu-paper">
      <Nav />
      {/* Hero banner */}
      <div className="relative bg-nu-ink overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-nu-pink/15 via-nu-ink to-nu-blue/10" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-nu-pink/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[200px] h-[200px] bg-nu-blue/8 rounded-full blur-[80px]" />

        <div className="relative max-w-7xl mx-auto px-8 pt-28 pb-16">
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink block mb-4">
            Community
          </span>
          <h1 className="font-head text-[clamp(36px,5vw,56px)] font-extrabold text-nu-paper leading-tight">
            Scene을 만드는<br />크루들
          </h1>
          <p className="text-nu-paper/40 mt-4 max-w-lg text-sm leading-relaxed">
            각자의 전문 분야에서 새로운 Scene을 만들어가는 소모임들입니다.
            관심 있는 크루에 참여하거나 직접 만들어보세요.
          </p>
          {canCreateCrew && (
            <div className="mt-8 flex gap-3">
              <Link
                href={user ? "/groups/create" : "/signup"}
                className="font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-6 py-3 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-colors no-underline inline-flex items-center gap-2"
              >
                <Plus size={14} /> 크루 만들기
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Crews grid */}
      <div className="max-w-7xl mx-auto px-8 py-16">
        {formatted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            {/* Illustration-like SVG */}
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-8 opacity-60">
              <rect x="10" y="30" width="40" height="60" rx="4" stroke="#FF48B0" strokeWidth="2" fill="none" />
              <rect x="70" y="20" width="40" height="70" rx="4" stroke="#0055FF" strokeWidth="2" fill="none" />
              <rect x="35" y="45" width="50" height="50" rx="4" stroke="#FFD200" strokeWidth="2" fill="none" />
              <circle cx="30" cy="50" r="6" fill="#FF48B0" opacity="0.2" />
              <circle cx="90" cy="40" r="6" fill="#0055FF" opacity="0.2" />
              <circle cx="60" cy="65" r="6" fill="#FFD200" opacity="0.2" />
              <line x1="36" y1="56" x2="64" y2="56" stroke="#9E9B96" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="50" y1="75" x2="70" y2="45" stroke="#9E9B96" strokeWidth="1" strokeDasharray="3 3" />
            </svg>

            <h2 className="font-head text-2xl font-extrabold text-nu-ink mb-3">
              아직 크루가 없습니다
            </h2>
            <p className="text-nu-gray text-sm max-w-md leading-relaxed mb-2">
              크루는 같은 관심사를 가진 사람들이 모여 새로운 Scene을 만들어가는 소모임입니다.
              음악, 디자인, 개발, 문화 기획 등 다양한 분야의 크루에 참여하거나 직접 만들 수 있습니다.
            </p>
            <p className="text-nu-muted text-sm mb-8">
              가입하고 첫 크루를 만들어보세요
            </p>
            <Link
              href={user ? "/groups/create" : "/signup"}
              className="font-mono-nu text-[11px] font-bold tracking-[0.1em] uppercase px-7 py-4 bg-nu-ink text-nu-paper border-[1.5px] border-nu-ink hover:bg-nu-pink hover:border-nu-pink transition-all no-underline inline-flex items-center gap-2"
            >
              {user ? "크루 만들기" : "가입하고 시작하기"} <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        ) : (
          <CrewsGrid groups={formatted} userId={user?.id} memberships={memberships} />
        )}
      </div>

      <Footer />
    </div>
  );
}
