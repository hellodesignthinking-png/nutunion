import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { ThreadsAdminClient } from "./client";
import { registry } from "@/lib/threads/bootstrap";

export const dynamic = "force-dynamic";
export const metadata = { title: "Threads — Admin · nutunion" };

export default async function AdminThreadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  // Runtime registry definitions
  const runtimeDefs = registry.all().map((d) => ({
    slug: d.slug,
    name: d.name,
    description: d.description,
    icon: d.icon,
    category: d.category,
    scope: d.scope,
    isCore: !!d.isCore,
    version: d.version || "1.0.0",
  }));

  // DB-seeded threads + install counts
  let dbThreads: any[] = [];
  let migrationMissing = false;
  const { data, error } = await supabase
    .from("threads")
    .select("id, slug, name, icon, category, scope, install_count, is_core, version, is_public")
    .order("install_count", { ascending: false });
  if (error) {
    if (/relation .* does not exist/i.test(error.message) || (error as any).code === "42P01") {
      migrationMissing = true;
    }
  } else {
    dbThreads = data || [];
  }

  return (
    <div className="reader-shell min-h-screen">
      <div className="max-w-[960px] mx-auto px-4 md:px-6 py-8 space-y-6">
        <Link
          href="/admin/overview"
          className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-ink no-underline"
        >
          <ArrowLeft size={11} /> Admin
        </Link>

        <header>
          <p className="reader-meta">Admin · Module Lattice</p>
          <h1 className="reader-h1 mt-0.5">🧵 Threads — Registry</h1>
          <p className="reader-meta mt-1">
            런타임 레지스트리에 등록된 Thread 정의와 DB 에 싱크된 Thread 목록.
          </p>
        </header>

        {migrationMissing && (
          <section className="border-[3px] border-amber-500 bg-amber-50 p-4 text-[13px] text-amber-900 space-y-1">
            <p className="font-bold">⚠️ migration 115_thread_registry.sql 가 아직 적용되지 않았습니다.</p>
            <p>Supabase Dashboard 또는 CLI 로 마이그레이션을 실행하세요.</p>
          </section>
        )}

        <ThreadsAdminClient runtimeDefs={runtimeDefs} dbThreads={dbThreads} />
      </div>
    </div>
  );
}
