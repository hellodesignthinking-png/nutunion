import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CodeBuilderClient } from "@/components/threads/builder/code-builder-client";

export const dynamic = "force-dynamic";

export default async function CodeBuilderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <CodeBuilderClient userId={user.id} />;
}
