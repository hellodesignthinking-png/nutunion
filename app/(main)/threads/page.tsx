import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StoreClient } from "@/components/threads/store-client";

export const dynamic = "force-dynamic";

export default async function ThreadStorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Threads
  const { data: threads, error } = await supabase
    .from("threads")
    .select("id, slug, name, description, icon, category, scope, is_core, pricing, price_krw, install_count, avg_rating, version, created_at, created_by")
    .eq("is_public", true)
    .order("install_count", { ascending: false });

  const safeThreads = (!error && threads) ? threads : [];

  // User's own custom threads (drafts + published)
  const { data: myThreads } = await supabase
    .from("threads")
    .select("id, slug, name, description, icon, category, scope, is_core, pricing, price_krw, install_count, avg_rating, version, created_at, created_by, is_draft, builder_mode, created_bolt_id")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  // User's nuts (groups) and bolts (projects)
  const { data: gms } = await supabase
    .from("group_members")
    .select("group_id, role, groups:groups(id, name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const { data: pms } = await supabase
    .from("project_members")
    .select("project_id, role, projects:projects(id, title)")
    .eq("user_id", user.id);

  const nuts = (gms || [])
    .filter((m: any) => ["host", "moderator"].includes(m.role) && m.groups)
    .map((m: any) => ({ id: m.groups.id, name: m.groups.name }));
  const bolts = (pms || [])
    .filter((m: any) => m.role === "lead" && m.projects)
    .map((m: any) => ({ id: m.projects.id, name: m.projects.title }));

  // Already installed slugs (for [설치됨] hint, per-target)
  const { data: insts } = await supabase
    .from("thread_installations")
    .select("thread_id, target_type, target_id")
    .or(
      [
        nuts.length ? `target_id.in.(${nuts.map((n) => `"${n.id}"`).join(",")})` : "",
        bolts.length ? `target_id.in.(${bolts.map((b) => `"${b.id}"`).join(",")})` : "",
      ].filter(Boolean).join(",") || "target_id.is.null",
    );

  return (
    <StoreClient
      threads={safeThreads as any}
      myThreads={(myThreads as any) || []}
      nuts={nuts}
      bolts={bolts}
      installations={(insts as any) || []}
      migrationMissing={!!error && /relation .* does not exist/i.test(error.message || "")}
    />
  );
}
