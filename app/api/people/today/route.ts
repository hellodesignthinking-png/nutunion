import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/people/today
 * 오늘의 생일/기념일, D-1~D-3, 오랜만인 인연을 반환.
 */
export const GET = withRouteLog("people.today", async (_req: NextRequest) => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // KST 기준 오늘 MM-DD
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayMonth = kst.getUTCMonth() + 1;
  const todayDay = kst.getUTCDate();

  const upcoming: Array<{ month: number; day: number; label: "today" | "d1" | "d2" | "d3"; deltaDays: number }> = [];
  for (let i = 0; i <= 3; i++) {
    const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + i));
    upcoming.push({
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      label: i === 0 ? "today" : (`d${i}` as "d1" | "d2" | "d3"),
      deltaDays: i,
    });
  }

  // 모든 이벤트(+ 사람) 가져와서 MM-DD 매칭
  const { data: events, error } = await supabase
    .from("person_events")
    .select("id, person_id, kind, title, event_date, lunar, recurring, detail, people!inner(id, display_name, role_hint, company, relationship, importance, phone, email, kakao_id, avatar_url, last_contact_at)")
    .eq("owner_id", auth.user.id);
  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ migration_needed: true, today: [], upcoming: [], dormant: [] });
    }
    log.error(error, "people.today.events.failed", { user_id: auth.user.id });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const matchBucket = (date: string): { deltaDays: number } | null => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    for (const u of upcoming) {
      if (u.month === m && u.day === day) return { deltaDays: u.deltaDays };
    }
    return null;
  };

  const todayRows: any[] = [];
  const upcomingRows: any[] = [];

  for (const e of (events || []) as any[]) {
    const hit = matchBucket(e.event_date);
    if (!hit) continue;
    // non-recurring events only this year
    if (!e.recurring) {
      const ev = new Date(e.event_date);
      if (ev.getUTCFullYear() !== kst.getUTCFullYear()) continue;
    }
    const entry = {
      event_id: e.id,
      person_id: e.person_id,
      kind: e.kind,
      title: e.title,
      event_date: e.event_date,
      detail: e.detail,
      delta_days: hit.deltaDays,
      person: e.people,
    };
    if (hit.deltaDays === 0) todayRows.push(entry);
    else upcomingRows.push(entry);
  }

  // 오랜만인 인연 — last_contact_at > 60일 + importance >= 4
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: dormant } = await supabase
    .from("people")
    .select("id, display_name, role_hint, company, relationship, importance, last_contact_at, phone, kakao_id, email, avatar_url")
    .eq("owner_id", auth.user.id)
    .gte("importance", 4)
    .or(`last_contact_at.lt.${sixtyDaysAgo},last_contact_at.is.null`)
    .order("importance", { ascending: false })
    .order("last_contact_at", { ascending: true, nullsFirst: true })
    .limit(2);

  // importance desc sort for today
  todayRows.sort((a, b) => (b.person?.importance || 0) - (a.person?.importance || 0));
  upcomingRows.sort((a, b) => a.delta_days - b.delta_days || (b.person?.importance || 0) - (a.person?.importance || 0));

  return NextResponse.json({
    today: todayRows,
    upcoming: upcomingRows,
    dormant: dormant || [],
    today_date: `${kst.getUTCFullYear()}-${String(todayMonth).padStart(2,"0")}-${String(todayDay).padStart(2,"0")}`,
  }, {
    headers: { "Cache-Control": "private, max-age=120, must-revalidate" },
  });
});
