import Link from "next/link";
import { Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TodaysConnectionsActions } from "./todays-connections-actions";

type TodayEntry = {
  event_id: string;
  person_id: string;
  kind: string;
  title: string;
  event_date: string;
  detail: string | null;
  delta_days: number;
  person: {
    id: string; display_name: string; role_hint: string | null; company: string | null;
    relationship: string | null; importance: number;
    phone: string | null; email: string | null; kakao_id: string | null; avatar_url: string | null;
    last_contact_at: string | null;
  };
};
type Dormant = {
  id: string; display_name: string; role_hint: string | null; company: string | null;
  relationship: string | null; importance: number; last_contact_at: string | null;
  phone: string | null; email: string | null; kakao_id: string | null; avatar_url: string | null;
};

const KIND_ICON: Record<string, string> = { birthday: "🎂", anniversary: "💍", founding_day: "🏢", memorial: "🕯️", milestone: "⭐", note: "📝" };
const KIND_LABEL: Record<string, string> = { birthday: "생일", anniversary: "기념일", founding_day: "창립일", memorial: "추모일", milestone: "마일스톤", note: "메모" };

export async function TodaysConnectionsWidget() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  // Try to fetch; gracefully degrade if table missing
  let migrationNeeded = false;
  let peopleExist = false;
  let today: TodayEntry[] = [];
  let upcoming: TodayEntry[] = [];
  let dormant: Dormant[] = [];

  try {
    const { count: pCount, error: pErr } = await supabase
      .from("people")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", auth.user.id);
    if (pErr && /relation .* does not exist/i.test(pErr.message)) {
      migrationNeeded = true;
    } else {
      peopleExist = (pCount || 0) > 0;
    }
  } catch { /* swallow */ }

  if (!migrationNeeded && peopleExist) {
    const { data: events } = await supabase
      .from("person_events")
      .select("id, person_id, kind, title, event_date, recurring, detail, people!inner(id, display_name, role_hint, company, relationship, importance, phone, email, kakao_id, avatar_url, last_contact_at)")
      .eq("owner_id", auth.user.id);

    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayYear = kst.getUTCFullYear();
    const buckets: Array<{ month: number; day: number; delta: number }> = [];
    for (let i = 0; i <= 3; i++) {
      const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + i));
      buckets.push({ month: d.getUTCMonth() + 1, day: d.getUTCDate(), delta: i });
    }

    for (const e of ((events as any[]) || [])) {
      const d = new Date(e.event_date);
      if (isNaN(d.getTime())) continue;
      const m = d.getUTCMonth() + 1;
      const day = d.getUTCDate();
      const hit = buckets.find((b) => b.month === m && b.day === day);
      if (!hit) continue;
      if (!e.recurring && d.getUTCFullYear() !== todayYear) continue;
      const entry: TodayEntry = {
        event_id: e.id, person_id: e.person_id, kind: e.kind, title: e.title,
        event_date: e.event_date, detail: e.detail, delta_days: hit.delta, person: e.people,
      };
      if (hit.delta === 0) today.push(entry);
      else upcoming.push(entry);
    }
    today.sort((a, b) => (b.person?.importance || 0) - (a.person?.importance || 0));
    upcoming.sort((a, b) => a.delta_days - b.delta_days);

    // dormant: last_contact_at > 60 days + importance >= 4
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const { data: dormantRows } = await supabase
      .from("people")
      .select("id, display_name, role_hint, company, relationship, importance, last_contact_at, phone, email, kakao_id, avatar_url")
      .eq("owner_id", auth.user.id)
      .gte("importance", 4)
      .or(`last_contact_at.lt.${sixtyDaysAgo},last_contact_at.is.null`)
      .order("importance", { ascending: false })
      .order("last_contact_at", { ascending: true, nullsFirst: true })
      .limit(2);
    dormant = (dormantRows as Dormant[] | null) || [];
  }

  const todayLabel = new Date().toLocaleDateString("ko", { month: "long", day: "numeric", weekday: "short" });

  return (
    <section className="bg-nu-cream border-[3px] border-nu-ink shadow-[4px_4px_0_0_#0D0F14] p-5">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Gift size={18} className="text-nu-pink" />
          <h2 className="font-head text-lg md:text-xl font-extrabold text-nu-ink tracking-tight uppercase">
            Today&apos;s Connections
          </h2>
          <span className="font-mono-nu text-[11px] text-nu-muted uppercase tracking-widest">{todayLabel}</span>
        </div>
        <Link href="/people" className="font-mono-nu text-[11px] uppercase tracking-widest no-underline px-3 py-1.5 border-[2px] border-nu-ink bg-white hover:bg-nu-ink hover:text-nu-paper">
          인맥 관리
        </Link>
      </div>

      {migrationNeeded ? (
        <p className="text-sm text-nu-muted">
          마이그레이션 <code className="font-mono-nu bg-nu-ink text-nu-paper px-1.5 py-0.5">101_person_crm.sql</code> 을 적용해주세요.
        </p>
      ) : !peopleExist ? (
        <p className="text-sm text-nu-ink">
          아직 등록된 인맥이 없어요.{" "}
          <Link href="/people" className="text-nu-pink font-bold underline">/people</Link>
          {" "}에서 추가해주세요.
        </p>
      ) : (
        <TodaysConnectionsActions
          today={today.map((t) => ({
            ...t,
            kindIcon: KIND_ICON[t.kind] || "·",
            kindLabel: KIND_LABEL[t.kind] || t.kind,
          }))}
          upcoming={upcoming.map((t) => ({
            ...t,
            kindIcon: KIND_ICON[t.kind] || "·",
            kindLabel: KIND_LABEL[t.kind] || t.kind,
          }))}
          dormant={dormant}
        />
      )}
    </section>
  );
}
