import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AiBuilderClient } from "@/components/threads/builder/ai-builder-client";

export const dynamic = "force-dynamic";

export default async function AiBuilderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <AiBuilderClient />;
}
