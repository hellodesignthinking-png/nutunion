import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/shared/nav";
import { AuthNav } from "@/components/shared/auth-nav";
import { Footer } from "@/components/landing/footer";
import type { Profile } from "@/lib/types";

export default async function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // (community) 는 비로그인 열람도 허용. 로그인 상태에 따라 렌더되는 컴포넌트는
  // 다르지만 메뉴 항목은 lib/nav-links.ts 에서 공유되어 (main) 과 완전 일치.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    profile = (data as Profile | null) ?? {
      id: user.id,
      name: user.user_metadata?.name || "",
      nickname: user.user_metadata?.nickname || "user",
      email: user.email || "",
      specialty: null,
      avatar_url: null,
      role: "member" as const,
      can_create_crew: false,
      bio: null,
      created_at: new Date().toISOString(),
    };
  }

  return (
    <div className="min-h-screen bg-nu-paper flex flex-col">
      {profile ? <AuthNav profile={profile} /> : <Nav />}
      {/* Nav 높이 60px 고정 — (main) 과 동일한 pt-[60px] 유지 */}
      <div className="flex-1 pt-[60px]">
        {children}
      </div>
      <Footer />
    </div>
  );
}
