import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FinanceNav } from "@/components/finance/finance-nav";

export const metadata: Metadata = {
  title: { default: "재무 | nutunion", template: "%s | 재무 · nutunion" },
  description: "nutunion 재무 관리 — 볼트별 예산, 법인 거래, 직원/근태, AI 마케팅",
};

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
      <FinanceNav role={profile.role} />
      {children}
    </div>
  );
}
