import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { PeopleListClient } from "@/components/people/people-list-client";

export const dynamic = "force-dynamic";

type Person = {
  id: string;
  display_name: string;
  role_hint: string | null;
  company: string | null;
  relationship: string | null;
  importance: number;
  avatar_url: string | null;
  last_contact_at: string | null;
};

type NextEvent = { person_id: string; kind: string; title: string; event_date: string; delta_days: number };

export default async function PeoplePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let migrationNeeded = false;
  let people: Person[] = [];
  let nextEvents: Record<string, NextEvent> = {};

  try {
    const { data, error } = await supabase
      .from("people")
      .select("id, display_name, role_hint, company, relationship, importance, avatar_url, last_contact_at")
      .eq("owner_id", user.id)
      .order("importance", { ascending: false })
      .order("display_name", { ascending: true });
    if (error && /relation .* does not exist/i.test(error.message)) migrationNeeded = true;
    people = (data as Person[] | null) || [];

    if (!migrationNeeded && people.length > 0) {
      const { data: evs } = await supabase
        .from("person_events")
        .select("person_id, kind, title, event_date")
        .eq("owner_id", user.id);
      // For each person, compute nearest upcoming event (recurring handled by MM-DD bucket)
      const today = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const todayMD = today.getUTCMonth() * 100 + today.getUTCDate();
      for (const e of ((evs as any[]) || [])) {
        const d = new Date(e.event_date);
        if (isNaN(d.getTime())) continue;
        const md = d.getUTCMonth() * 100 + d.getUTCDate();
        // delta days 0..365 through wrap
        let delta = md - todayMD;
        if (delta < 0) delta += 365;
        const cur = nextEvents[e.person_id];
        if (!cur || delta < cur.delta_days) {
          nextEvents[e.person_id] = { person_id: e.person_id, kind: e.kind, title: e.title, event_date: e.event_date, delta_days: delta };
        }
      }
    }
  } catch {}

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest px-2 py-1 bg-nu-pink text-nu-paper">
              <Users size={10} /> CRM
            </span>
          </div>
          <h1 className="font-head text-3xl md:text-4xl font-extrabold text-nu-ink tracking-tight">AI 인맥 관리</h1>
          <p className="font-mono-nu text-[13px] text-nu-muted uppercase tracking-widest mt-1">
            기억해야 할 사람, 놓치지 말아야 할 순간
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/people/parse"
            className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all no-underline"
          >
            카톡 파싱
          </Link>
        </div>
      </div>

      {migrationNeeded ? (
        <div className="bg-nu-cream border-[3px] border-nu-ink shadow-[4px_4px_0_0_#0D0F14] p-6">
          <p className="font-head text-lg font-extrabold mb-2">마이그레이션이 필요합니다</p>
          <p className="text-sm text-nu-ink/80">
            <code className="font-mono-nu bg-nu-ink text-nu-paper px-2 py-0.5">supabase/migrations/101_person_crm.sql</code> 를 적용해 주세요.
          </p>
        </div>
      ) : (
        <PeopleListClient
          initialPeople={people}
          nextEvents={nextEvents}
        />
      )}
    </div>
  );
}
