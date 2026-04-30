import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MigrateDataClient } from "./client";

export const dynamic = "force-dynamic";

export default async function MigrateDataAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (prof?.role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-nu-cream/20 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="font-head text-2xl font-extrabold text-nu-ink">📦 Legacy → Thread Data 이전</h1>
        <p className="text-sm font-mono text-nu-muted">
          기존 hardcoded UI 는 깨지지 않습니다. 데이터를 thread_data 에 <b>복제</b>하며, 원본 테이블은 유지됩니다.
        </p>
        <MigrateDataClient />
      </div>
    </div>
  );
}
