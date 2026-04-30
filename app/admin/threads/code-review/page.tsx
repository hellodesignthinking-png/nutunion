import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CodeReviewClient } from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Code Threads — Admin · nutunion" };

export default async function AdminCodeReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data: rows } = await supabase
    .from("threads")
    .select("id, slug, name, icon, description, builder_mode, is_public, is_draft, created_by, created_at, generated_component_source")
    .eq("builder_mode", "code")
    .order("created_at", { ascending: false });

  const threads = (rows || []).map((r: any) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    icon: r.icon,
    description: r.description,
    is_public: r.is_public,
    is_draft: r.is_draft,
    created_by: r.created_by,
    created_at: r.created_at,
    source_preview: typeof r.generated_component_source === "string"
      ? r.generated_component_source.slice(0, 8000)
      : "",
    source_length: typeof r.generated_component_source === "string"
      ? r.generated_component_source.length
      : 0,
  }));

  return (
    <div className="min-h-screen bg-nu-cream/20 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="font-head text-2xl font-extrabold">💻 코드 Thread 검토</h1>
          <Link href="/admin/threads" className="text-[11px] font-mono-nu underline">
            ← Threads 관리
          </Link>
        </div>
        <p className="text-sm text-nu-muted">
          코드 모드(Level 3)로 생성된 Thread 목록입니다. 검토 후 공개 / 비공개를 결정하세요.
        </p>
        <CodeReviewClient threads={threads} />
      </div>
    </div>
  );
}
