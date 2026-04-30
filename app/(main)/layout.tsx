import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthNav } from "@/components/shared/auth-nav";
import { AppSidebar, AppSidebarGutter } from "@/components/shared/app-sidebar";
import { AppBottomTabs } from "@/components/shared/app-bottom-tabs";
import { CommandPalette } from "@/components/shared/command-palette";
import { OnlineStatusBanner } from "@/components/shared/online-status-banner";
import { PushPromptBanner } from "@/components/shared/push-prompt-banner";
import { Footer } from "@/components/landing/footer";
import type { Profile } from "@/lib/types";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // 닉네임이 기본값(user_xxxxxx) 이거나 비어있으면 온보딩으로.
  // 소셜 로그인 및 handle_new_user 트리거 fallback 케이스 커버.
  const nick = (profile?.nickname || "").trim();
  const isDefaultNick = !nick || nick === "user" || /^user_[a-f0-9]{4,}$/i.test(nick);
  if (isDefaultNick) {
    redirect("/onboarding/nickname");
  }

  const userProfile: Profile = profile ?? {
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

  const isStaff = userProfile.role === "staff" || userProfile.role === "admin";
  const isAdmin = userProfile.role === "admin";

  return (
    <div className="min-h-screen bg-nu-paper flex flex-col">
      <OnlineStatusBanner />
      <AuthNav profile={userProfile} />
      <CommandPalette isAdmin={isAdmin} />
      <AppSidebar isStaff={isStaff} isAdmin={isAdmin} />
      <AppSidebarGutter>
        <div className="flex-1 pt-[60px] pb-[64px] md:pb-0">
          {children}
        </div>
      </AppSidebarGutter>
      <Footer />
      <AppBottomTabs />
      <PushPromptBanner />
    </div>
  );
}
