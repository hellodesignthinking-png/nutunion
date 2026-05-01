import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNavClient } from "./admin-nav-client";

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
    { label: "Overview", href: "/admin/overview" },
    { label: "Metrics", href: "/admin/metrics" },
    { label: "Analytics", href: "/admin/analytics" },
    { label: "Integrations", href: "/admin/integrations" },
    { label: "Drive 백필", href: "/admin/drive-backfill" },
    { label: "회원", href: "/admin/users" },
    { label: "너트", href: "/admin/groups" },
    { label: "볼트", href: "/admin/projects" },
    { label: "Threads", href: "/admin/threads" },
    { label: "콘텐츠", href: "/admin/content" },
    { label: "의뢰", href: "/admin/proposals" },
  ];

  const adminName = profile?.nickname || user.email?.split("@")[0] || "Admin";

  return (
    <div className="min-h-screen bg-nu-paper flex flex-col">
      {/* Admin 전용 탑 네비 — Overview / Analytics / Integrations / 회원 / 너트 / 볼트 등 */}
      <AdminNavClient navItems={navItems} adminName={adminName} />
      <div className="flex-1 pt-[60px]">{children}</div>
    </div>
  );
}
