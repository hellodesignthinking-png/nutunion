import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNavClient } from "./admin-nav-client";
import { AppSidebar, AppSidebarGutter } from "@/components/shared/app-sidebar";
import { AppBottomTabs } from "@/components/shared/app-bottom-tabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, nickname")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") redirect("/dashboard");

  const navItems = [
    { label: "대시보드", href: "/admin" },
    { label: "콘텐츠", href: "/admin/content" },
    { label: "미디어", href: "/admin/media" },
    { label: "회원", href: "/admin/users" },
    { label: "너트", href: "/admin/groups" },
    { label: "볼트", href: "/admin/projects" },
    { label: "의뢰", href: "/admin/proposals" },
  ];

  const adminName = profile?.nickname || user.email?.split("@")[0] || "Admin";

  return (
    <div className="min-h-screen bg-nu-paper flex flex-col">
      <AdminNavClient navItems={navItems} adminName={adminName} />
      <AppSidebar isStaff={true} isAdmin={true} />
      <AppSidebarGutter>
        <div className="flex-1 pt-[60px] pb-[64px] md:pb-0">{children}</div>
      </AppSidebarGutter>
      <AppBottomTabs />
    </div>
  );
}
