import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FinanceNav } from "@/components/finance/finance-nav";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/dashboard");
  }

  return (
    <div>
      <FinanceNav />
      {children}
    </div>
  );
}
