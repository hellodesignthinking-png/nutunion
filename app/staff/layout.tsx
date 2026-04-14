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
    { label: "\uB300\uC2DC\uBCF4\uB4DC", href: "/staff" },
    { label: "\uD504\uB85C\uC81D\uD2B8", href: "/staff/workspace" },
    { label: "\uD560\uC77C", href: "/staff/tasks" },
    { label: "\uD30C\uC77C", href: "/staff/files" },
    { label: "\uCE98\uB9B0\uB354", href: "/staff/calendar" },
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
