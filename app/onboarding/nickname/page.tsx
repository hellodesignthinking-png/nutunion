import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NicknameOnboardingForm } from "./form";

export const dynamic = "force-dynamic";

/**
 * /onboarding/nickname
 *
 * 회원가입 직후 또는 소셜 로그인으로 들어온 사용자가 닉네임을 설정하는 페이지.
 * 이미 설정한 사용자는 /dashboard 로 자동 리다이렉트.
 *
 * (main) 레이아웃은 닉네임이 기본값(`user_xxxx`) 인 사용자를 여기로 보낸다.
 */
export default async function OnboardingNicknamePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, name")
    .eq("id", user.id)
    .maybeSingle();

  // 이미 닉네임 설정됨 → 대시보드로
  const nickname = profile?.nickname || "";
  const isDefault = /^user_[a-f0-9]{4,}$/i.test(nickname) || nickname === "" || nickname === "user";
  if (!isDefault) {
    redirect("/dashboard");
  }

  return (
    <NicknameOnboardingForm
      initialName={profile?.name || user.user_metadata?.name || ""}
      email={user.email || ""}
      provider={user.app_metadata?.provider || "email"}
    />
  );
}
