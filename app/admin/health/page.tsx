import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HealthClient } from "./health-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "System Health · nutunion" };

export default async function HealthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/admin/health");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "staff") {
    redirect("/");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-1">Admin · System Health</div>
        <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink">시스템 상태</h1>
        <p className="text-[12px] text-nu-graphite mt-1">DB 마이그레이션 적용 여부 확인 — 누락 시 아래 힌트대로 Supabase SQL Editor 에서 실행.</p>
      </div>

      <HealthClient />
    </div>
  );
}
