import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthNav } from "@/components/shared/auth-nav";
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

  return (
    <div className="min-h-screen bg-nu-paper flex flex-col">
      <AuthNav profile={userProfile} />
      <div className="flex-1 pt-[60px]">{children}</div>
      <Footer />
    </div>
  );
}
