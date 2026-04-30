import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StorageHealthClient } from "./client";
import { StorageUsageClient } from "./usage-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Storage (R2) 진단 · nutunion" };

export default async function StorageAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/admin/storage");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "staff") {
    redirect("/");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-1">Admin · Storage</div>
        <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink">Cloudflare R2 진단</h1>
        <p className="text-[12px] text-nu-graphite mt-1">
          R2 환경변수 · 버킷 접근성 · presign 발급 가능 여부를 확인합니다.
          설정되지 않은 경우 Supabase Storage 로 자동 fallback 되므로 업로드 자체는 동작하지만
          Vercel 4.5MB 제한을 우회하려면 R2 를 활성화하세요.
        </p>
      </div>

      <StorageHealthClient />
      <StorageUsageClient />
    </div>
  );
}
