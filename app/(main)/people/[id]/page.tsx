import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PersonDetailClient } from "@/components/people/person-detail-client";

export const dynamic = "force-dynamic";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: person }, { data: events }, { data: notes }] = await Promise.all([
    supabase.from("people").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle(),
    supabase.from("person_events").select("*").eq("person_id", id).eq("owner_id", user.id).order("event_date", { ascending: true }),
    supabase.from("person_context_notes").select("*").eq("person_id", id).eq("owner_id", user.id).order("created_at", { ascending: false }),
  ]);

  if (!person) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
      <Link href="/people" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted no-underline inline-flex items-center gap-1 mb-4 hover:text-nu-ink">
        <ChevronLeft size={12} /> 인맥 목록
      </Link>
      <PersonDetailClient
        personId={id}
        initialPerson={person}
        initialEvents={(events as any[]) || []}
        initialNotes={(notes as any[]) || []}
      />
    </div>
  );
}
