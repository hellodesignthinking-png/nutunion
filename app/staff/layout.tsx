import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StaffNavClient } from "./staff-nav-client";
import { ChatPanel } from "./chat-panel";
import { CommandPalette } from "./command-palette";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, nickname")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    redirect("/dashboard");
  }

  const navItems = [
    { label: "대시보드", href: "/staff" },
    { label: "프로젝트", href: "/staff/workspace" },
    { label: "할일", href: "/staff/tasks" },
    { label: "재무", href: "/finance" },
    { label: "파일", href: "/staff/files" },
    { label: "캘린더", href: "/staff/calendar" },
  ];

  const staffName = profile.nickname || user.email?.split("@")[0] || "Staff";

  return (
    <div className="min-h-screen bg-nu-paper">
      <StaffNavClient navItems={navItems} staffName={staffName} />
      <div className="pt-[60px]">{children}</div>
      {/* Global floating components */}
      <ChatPanel />
      <CommandPalette />
    </div>
  );
}
