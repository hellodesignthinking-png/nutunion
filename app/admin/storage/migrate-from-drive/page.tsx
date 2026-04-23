import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MigrateFromDriveClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Drive → R2 이전 — Admin · nutunion" };

export default async function MigrateFromDrivePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/admin/storage/migrate-from-drive");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") redirect("/");

  return (
    <div className="max-w-[980px] mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <Link
        href="/admin/overview"
        className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-ink no-underline mb-4"
      >
        <ArrowLeft size={11} /> Admin
      </Link>

      <header className="mb-6">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-1">
          Admin · Storage · Migration
        </div>
        <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink">Drive → R2 일괄 이전</h1>
        <p className="text-[12px] text-nu-graphite mt-1 leading-relaxed">
          과거 Google Drive 에 저장돼 있던 파일을 Cloudflare R2 로 복사합니다. 원본 Drive 파일은 삭제하지 않으며,
          DB의 <code className="font-mono-nu bg-nu-cream px-1">file_url</code> / <code className="font-mono-nu bg-nu-cream px-1">storage_type</code> 을 갱신합니다.
          이미 <code className="font-mono-nu bg-nu-cream px-1">storage_type='r2'</code> 인 행은 자동으로 건너뜁니다.
        </p>
      </header>

      <MigrateFromDriveClient />
    </div>
  );
}
