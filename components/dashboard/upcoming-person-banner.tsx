import Link from "next/link";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/**
 * Small pink strip that appears above Morning Briefing when there's
 * a high-importance (>=4) person event today or within 3 days.
 * Renders nothing if no such event (or table missing).
 */
export async function UpcomingPersonBanner() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  try {
    const { data: events, error } = await supabase
      .from("person_events")
      .select("id, event_date, kind, title, people!inner(id, display_name, importance)")
      .eq("owner_id", auth.user.id);
    if (error || !events) return null;

    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const buckets: Array<{ month: number; day: number; delta: number; label: string }> = [];
    for (let i = 0; i <= 3; i++) {
      const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + i));
      const label = i === 0 ? "오늘" : i === 1 ? "내일" : `${i}일 후`;
      buckets.push({ month: d.getUTCMonth() + 1, day: d.getUTCDate(), delta: i, label });
    }
    const matches: Array<{ delta: number; label: string; name: string; kind: string; title: string }> = [];
    for (const e of (events as any[])) {
      if ((e.people?.importance || 0) < 4) continue;
      const d = new Date(e.event_date);
      if (isNaN(d.getTime())) continue;
      const b = buckets.find((x) => x.month === d.getUTCMonth() + 1 && x.day === d.getUTCDate());
      if (!b) continue;
      matches.push({ delta: b.delta, label: b.label, name: e.people.display_name, kind: e.kind, title: e.title });
    }
    if (matches.length === 0) return null;
    matches.sort((a, b) => a.delta - b.delta);
    const m = matches[0];

    const kindIcon: Record<string, string> = { birthday: "🎂", anniversary: "💍", founding_day: "🏢", memorial: "🕯️", milestone: "⭐", note: "📝" };

    return (
      <Link
        href="/people"
        className="block no-underline bg-nu-pink/20 border-[2px] border-nu-pink px-4 py-2.5 mb-3 hover:bg-nu-pink/30 transition-colors"
      >
        <div className="flex items-center gap-2 text-nu-ink text-sm">
          <Clock size={14} className="text-nu-pink shrink-0" />
          <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink shrink-0">다가오는 중요 이벤트</span>
          <span className="truncate">
            {m.label} {kindIcon[m.kind] || "·"} <strong>{m.name}</strong>
            {" "}{m.title}
            {matches.length > 1 && <span className="text-nu-muted ml-1">외 {matches.length - 1}건</span>}
          </span>
        </div>
      </Link>
    );
  } catch {
    return null;
  }
}
