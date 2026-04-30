import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BuilderClient } from "@/components/threads/builder/builder-client";

export const dynamic = "force-dynamic";

export default async function BuildThreadPage({ searchParams }: { searchParams: Promise<{ prefill?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Optional prefill (from L2 AI builder hand-off)
  const sp = await searchParams;
  let prefill: any = null;
  if (sp.prefill) {
    try { prefill = JSON.parse(decodeURIComponent(sp.prefill)); } catch { prefill = null; }
  }

  return <BuilderClient userId={user.id} initial={prefill} />;
}
