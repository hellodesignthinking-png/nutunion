import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { BuilderClient } from "@/components/threads/builder/builder-client";

export const dynamic = "force-dynamic";

export default async function EditThreadPage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { slug } = await params;
  const { data: thread, error } = await supabase
    .from("threads")
    .select("id, slug, name, description, icon, category, scope, builder_state, builder_mode, created_by, is_draft")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !thread) notFound();
  if (thread.created_by !== user.id) redirect("/threads");

  const initial = {
    name: thread.name,
    description: thread.description || "",
    icon: thread.icon || "📋",
    scope: thread.scope || ["bolt"],
    category: thread.category || "custom",
    fields: thread.builder_state?.fields || [],
    views: thread.builder_state?.views || [{ kind: "list" }],
    actions: thread.builder_state?.actions || [{ kind: "add", label: "추가" }],
  };

  return <BuilderClient userId={user.id} initial={initial} threadId={thread.id} />;
}
