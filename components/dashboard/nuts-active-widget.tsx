import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Users, Bell, Plus, ChevronRight, MessageSquare, UserPlus } from "lucide-react";
import { kstTodayStartISO, kstDaysLaterISO } from "@/lib/time-kst";

interface NutCard {
  id: string;
  name: string;
  category: string | null;
  role: string;
  imageUrl: string | null;
  unread: number;
  newEvents: number;
  pendingApprovals: number;
  activityScore: number;
  hint: string;
}

const SEVEN_DAYS_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
};
const TWO_DAYS_AGO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return d.toISOString();
};

/**
 * My Nuts Active — 최근 7일 활동 기반 정렬, 상위 3-5.
 * hint: 미확인 / 승인 대기 / 신규 이벤트 상태에 따라 자동 제안.
 */
export async function NutsActiveWidget({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: memberRows } = await supabase
    .from("group_members")
    .select("group_id, role, status, groups!group_members_group_id_fkey(id, name, category, image_url, is_active)")
    .eq("user_id", userId)
    .eq("status", "active");

  const memberships = ((memberRows as any[]) || [])
    .map((m) => ({ ...m, group: Array.isArray(m.groups) ? m.groups[0] : m.groups }))
    .filter((m) => m.group?.is_active !== false && m.group?.id);

  if (memberships.length === 0) return <EmptyPink />;

  const groupIds: string[] = memberships.map((m) => m.group.id);
  const hostGroupIds = memberships.filter((m) => m.role === "host").map((m) => m.group.id);
  const sinceIso = SEVEN_DAYS_AGO();
  const recentIso = TWO_DAYS_AGO();
  const todayStart = kstTodayStartISO();
  const in7Days = kstDaysLaterISO(7);

  // 각 너트의 chat rooms + unread (간소화: 방별 unread 집계)
  const unreadMap = new Map<string, number>();
  try {
    const { data: rooms } = await supabase
      .from("chat_rooms")
      .select("id, group_id")
      .in("group_id", groupIds);
    const roomIds = ((rooms as any[]) || []).map((r) => r.id);
    if (roomIds.length > 0) {
      const { data: myMembers } = await supabase
        .from("chat_members")
        .select("room_id, last_read_at")
        .eq("user_id", userId)
        .in("room_id", roomIds);
      const myMemberMap = new Map<string, string | null>();
      for (const m of ((myMembers as any[]) || [])) myMemberMap.set(m.room_id, m.last_read_at);

      for (const r of ((rooms as any[]) || [])) {
        if (!myMemberMap.has(r.id)) continue;
        const { count } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", r.id)
          .gt("created_at", myMemberMap.get(r.id) || new Date(0).toISOString())
          .neq("sender_id", userId);
        unreadMap.set(r.group_id, (unreadMap.get(r.group_id) || 0) + (count || 0));
      }
    }
  } catch { /* noop */ }

  // 최근 이벤트 (48h 내 생성 or 곧 열림)
  const newEventsMap = new Map<string, number>();
  try {
    const { data: evs } = await supabase
      .from("events")
      .select("id, group_id, created_at, start_at")
      .in("group_id", groupIds)
      .or(`created_at.gte.${recentIso},and(start_at.gte.${todayStart},start_at.lte.${in7Days})`);
    for (const e of ((evs as any[]) || [])) {
      newEventsMap.set(e.group_id, (newEventsMap.get(e.group_id) || 0) + 1);
    }
  } catch { /* noop */ }

  // Pending approvals (host 만)
  const pendingMap = new Map<string, number>();
  if (hostGroupIds.length > 0) {
    try {
      const { data: pend } = await supabase
        .from("group_members")
        .select("group_id")
        .in("group_id", hostGroupIds)
        .eq("status", "pending");
      for (const p of ((pend as any[]) || [])) {
        pendingMap.set(p.group_id, (pendingMap.get(p.group_id) || 0) + 1);
      }
    } catch { /* noop */ }
  }

  // 최근 메시지 총량 (단순 활동 점수)
  const recentMsgMap = new Map<string, number>();
  try {
    const { data: rooms2 } = await supabase
      .from("chat_rooms")
      .select("id, group_id")
      .in("group_id", groupIds);
    const roomIds2 = ((rooms2 as any[]) || []).map((r) => r.id);
    const roomToGroup = new Map<string, string>();
    for (const r of ((rooms2 as any[]) || [])) roomToGroup.set(r.id, r.group_id);
    if (roomIds2.length > 0) {
      for (const rid of roomIds2.slice(0, 30)) {
        const { count } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", rid)
          .gte("created_at", sinceIso);
        const gid = roomToGroup.get(rid);
        if (gid) recentMsgMap.set(gid, (recentMsgMap.get(gid) || 0) + (count || 0));
      }
    }
  } catch { /* noop */ }

  const cards: NutCard[] = memberships.map((m) => {
    const gid = m.group.id;
    const unread = unreadMap.get(gid) || 0;
    const newEvents = newEventsMap.get(gid) || 0;
    const pending = pendingMap.get(gid) || 0;
    const recent = recentMsgMap.get(gid) || 0;
    const score = unread * 3 + pending * 4 + newEvents * 2 + Math.min(recent, 30);

    let hint = "살펴보기";
    if (pending > 0) hint = `승인 대기 ${pending}`;
    else if (unread > 0) hint = `미확인 ${unread}`;
    else if (newEvents > 0) hint = "신규 이벤트";
    else if (recent > 0) hint = "최근 활발";
    else hint = "조용함";

    return {
      id: gid,
      name: m.group.name,
      category: m.group.category,
      role: m.role,
      imageUrl: m.group.image_url,
      unread,
      newEvents,
      pendingApprovals: pending,
      activityScore: score,
      hint,
    };
  });

  const ranked = cards.sort((a, b) => b.activityScore - a.activityScore).slice(0, 5);

  return (
    <section className="bg-nu-pink/10 border-[3px] border-nu-pink shadow-[4px_4px_0_0_#0D0F14] p-5">
      <header className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-nu-pink text-nu-paper border-[2px] border-nu-pink">
          <Users size={10} /> 활발한 너트
        </span>
        <h3 className="font-head text-base md:text-lg font-extrabold text-nu-ink tracking-tight uppercase">
          My Nuts
        </h3>
        <Link
          href="/groups"
          className="ml-auto font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink hover:text-nu-ink no-underline"
        >
          전체 →
        </Link>
      </header>

      <ul className="list-none m-0 p-0 space-y-2">
        {ranked.map((c) => (
          <li key={c.id}>
            <Link
              href={`/groups/${c.id}`}
              className="block bg-white border-[2px] border-nu-pink/60 hover:border-nu-pink hover:bg-nu-pink/5 transition-colors no-underline p-3"
            >
              <div className="flex items-center gap-3">
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt="" className="w-10 h-10 object-cover border-[2px] border-nu-pink/40 shrink-0" />
                ) : (
                  <div className="w-10 h-10 bg-nu-pink/20 border-[2px] border-nu-pink/40 flex items-center justify-center font-head font-extrabold text-nu-pink shrink-0">
                    {c.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-bold text-nu-ink truncate">{c.name}</span>
                    {c.category && (
                      <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink border border-nu-pink px-1.5 py-0.5">
                        {c.category}
                      </span>
                    )}
                    {c.role === "host" && (
                      <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-paper bg-nu-pink px-1.5 py-0.5">
                        Host
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.unread > 0 && (
                      <span className="inline-flex items-center gap-0.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
                        <MessageSquare size={10} /> 미확인 {c.unread}
                      </span>
                    )}
                    {c.pendingApprovals > 0 && (
                      <span className="inline-flex items-center gap-0.5 font-mono-nu text-[10px] uppercase tracking-widest text-amber-700">
                        <UserPlus size={10} /> 승인 {c.pendingApprovals}
                      </span>
                    )}
                    {c.newEvents > 0 && (
                      <span className="inline-flex items-center gap-0.5 font-mono-nu text-[10px] uppercase tracking-widest text-indigo-700">
                        <Bell size={10} /> 이벤트 {c.newEvents}
                      </span>
                    )}
                    {c.unread === 0 && c.pendingApprovals === 0 && c.newEvents === 0 && (
                      <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
                        {c.hint}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={14} className="text-nu-pink shrink-0" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyPink() {
  return (
    <section className="bg-nu-pink/10 border-[3px] border-nu-pink shadow-[4px_4px_0_0_#0D0F14] p-5">
      <header className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-nu-pink text-nu-paper border-[2px] border-nu-pink">
          <Users size={10} /> 활발한 너트
        </span>
      </header>
      <p className="text-sm text-nu-ink/80 mb-3">아직 참여 중인 너트가 없어요.</p>
      <Link
        href="/groups"
        className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 bg-nu-pink text-nu-paper border-[2px] border-nu-pink hover:bg-nu-pink/90 no-underline"
      >
        <Plus size={11} /> 너트 탐색하기
      </Link>
    </section>
  );
}
