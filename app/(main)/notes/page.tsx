import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotesClient } from "@/components/notes/notes-client";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <NotesClient />;
}
