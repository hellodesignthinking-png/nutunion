import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TracksClient } from "@/components/tracks/tracks-client";

export const dynamic = "force-dynamic";

export default async function TracksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <TracksClient />;
}
