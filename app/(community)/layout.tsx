import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/shared/nav";
import { AuthNav } from "@/components/shared/auth-nav";
import { AppSidebar, AppSidebarGutter } from "@/components/shared/app-sidebar";
import { AppBottomTabs } from "@/components/shared/app-bottom-tabs";
import { CommandPalette } from "@/components/shared/command-palette";
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

    // 로그인 사용자가 기본 닉네임(user_xxxx) 이면 온보딩으로.
    const nick = ((data as any)?.nickname || "").trim();
    const isDefaultNick = !nick || nick === "user" || /^user_[a-f0-9]{4,}$/i.test(nick);
    if (isDefaultNick) {
      redirect("/onboarding/nickname");
    }

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

  const isStaff = profile?.role === "staff" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-nu-paper flex flex-col">
      {profile ? <AuthNav profile={profile} /> : <Nav />}
      {profile && <CommandPalette isAdmin={isAdmin} />}
      {profile && <AppSidebar isStaff={isStaff} isAdmin={isAdmin} />}
      {profile ? (
        <AppSidebarGutter>
          <div className="flex-1 pt-[60px] pb-[64px] md:pb-0">
            {children}
          </div>
        </AppSidebarGutter>
      ) : (
        <div className="flex-1 pt-[60px]">
          {children}
        </div>
      )}
      <Footer />
      {profile && <AppBottomTabs />}
    </div>
  );
}
