import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Calendar, MessageSquare, AlertTriangle, Flame, TrendingUp, Users as UsersIcon } from "lucide-react";
import { daysUntilKST } from "@/lib/time-kst";

interface Props {
  groupId: string;
  userId: string;
}

// KST 일수 차이 — 공통 유틸 사용 (중복 제거)
function daysUntil(date: string | null | undefined): number | null {
  return daysUntilKST(date);
}

/**
 * 너트 진행 현황 + 이슈 + 내 기여도 패널.
 * - 다가오는 일정 / 최근 회의 활동
 * - 이슈: 오랜기간 회의 없음 / 미답변 안건 등
 * - 내 기여도: crew_posts + meeting_notes + resources 공유 중 내 비율
 */
export async function GroupStatusPanel({ groupId, userId }: Props) {
  const supabase = await createClient();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 30);

  // count/head 로 비용 최소화 — 큰 테이블은 rows 대신 count 만
  const [eventsRes, meetingsRes, postsTotalRes, postsMineRes, resTotalRes, resMineRes, membersRes, meetingIdsRes] = await Promise.all([
    supabase.from("events").select("id, title, start_at").eq("group_id", groupId).gte("start_at", new Date().toISOString()).order("start_at").limit(5),
    supabase.from("meetings").select("id, title, scheduled_at, status").eq("group_id", groupId).order("scheduled_at", { ascending: false }).limit(30),
    supabase.from("crew_posts").select("id", { count: "exact", head: true }).eq("group_id", groupId),
    supabase.from("crew_posts").select("id", { count: "exact", head: true }).eq("group_id", groupId).eq("author_id", userId),
    supabase.from("wiki_weekly_resources").select("id", { count: "exact", head: true }).eq("group_id", groupId),
    supabase.from("wiki_weekly_resources").select("id", { count: "exact", head: true }).eq("group_id", groupId).eq("shared_by", userId),
    supabase.from("group_members").select("user_id", { count: "exact", head: true }).eq("group_id", groupId).eq("status", "active"),
    supabase.from("meetings").select("id").eq("group_id", groupId).limit(200),
  ]);

  const events = (eventsRes.data as Array<{ id: string; title: string; start_at: string }> | null) ?? [];
  const meetings = (meetingsRes.data as Array<{ id: string; title: string; scheduled_at: string; status: string }> | null) ?? [];
  const totalPosts = postsTotalRes.count ?? 0;
  const myPosts = postsMineRes.count ?? 0;
  const totalResources = resTotalRes.count ?? 0;
  const myResources = resMineRes.count ?? 0;
  const totalMembers = membersRes.count ?? 0;
  const meetingIds = ((meetingIdsRes.data as { id: string }[] | null) ?? []).map((m) => m.id);

  // meeting_notes 는 meeting_id 통해 조회 (직접 group_id 필터 대안)
  let totalNotes = 0;
  let myNotes = 0;
  if (meetingIds.length > 0) {
    const [notesTotalRes, notesMineRes] = await Promise.all([
      supabase.from("meeting_notes").select("id", { count: "exact", head: true }).in("meeting_id", meetingIds),
      supabase.from("meeting_notes").select("id", { count: "exact", head: true }).in("meeting_id", meetingIds).eq("created_by", userId),
    ]);
    totalNotes = notesTotalRes.count ?? 0;
    myNotes = notesMineRes.count ?? 0;
  }

  // 최근 30일 회의 수
  const recent30Meetings = meetings.filter((m) => new Date(m.scheduled_at) >= weekAgo && m.status !== "cancelled");
  const lastMeeting = meetings.find((m) => m.status !== "cancelled");
  const daysSinceLastMeeting = lastMeeting ? Math.abs(daysUntil(lastMeeting.scheduled_at) ?? 0) : null;

  // "예정된 일정" 은 events + upcoming meetings 모두 포함 (KST 오늘 이후)
  const nowMs = Date.now();
  const upcomingMeetings = meetings
    .filter((m) => m.status !== "cancelled" && m.status !== "completed" && new Date(m.scheduled_at).getTime() >= nowMs)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const upcomingEvents = events;
  const upcomingCombined = [
    ...upcomingEvents.map((e) => ({ kind: "event" as const, id: e.id, title: e.title, at: e.start_at })),
    ...upcomingMeetings.map((m) => ({ kind: "meeting" as const, id: m.id, title: m.title, at: m.scheduled_at })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  // 이슈
  const issues: { level: "critical" | "warn" | "info"; label: string; detail: string }[] = [];
  if (daysSinceLastMeeting !== null && daysSinceLastMeeting > 14) {
    issues.push({
      level: daysSinceLastMeeting > 30 ? "critical" : "warn",
      label: `🌡 ${daysSinceLastMeeting}일째 회의 없음`,
      detail: `최근 활동: ${lastMeeting?.title ?? "-"}`,
    });
  }
  if (recent30Meetings.length === 0 && meetings.length === 0) {
    issues.push({
      level: "warn",
      label: "회의 이력 없음",
      detail: "첫 회의를 예약해보세요",
    });
  }
  if (upcomingCombined.length === 0) {
    issues.push({
      level: "info",
      label: "예정된 일정 없음",
      detail: "다가오는 일정을 등록해두세요",
    });
  }
  const upcomingFirst = upcomingCombined[0];
  const upcomingEvent = upcomingFirst ? { title: upcomingFirst.title, start_at: upcomingFirst.at } : null;
  if (upcomingFirst) {
    const d = daysUntil(upcomingFirst.at);
    if (d !== null && d <= 3) {
      issues.push({
        level: d <= 0 ? "critical" : "warn",
        label: `⏰ 다음 일정 ${d === 0 ? "오늘" : `D-${d}`}`,
        detail: upcomingFirst.title,
      });
    }
  }
  if (issues.length === 0) {
    issues.push({ level: "info", label: "✅ 건강한 상태", detail: "최근 활발히 진행 중" });
  }

  const myTotal = myPosts + myNotes + myResources;
  const grandTotal = totalPosts + totalNotes + totalResources;
  const myPct = grandTotal > 0 ? Math.round((myTotal / grandTotal) * 100) : 0;
  const avgPerMember = totalMembers > 0 ? Math.round(grandTotal / totalMembers) : 0;

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x-[2px] divide-nu-ink/10">
        {/* 진행 현황 */}
        <div className="p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2 flex items-center gap-1">
            <TrendingUp size={11} /> 진행 현황
          </div>
          <div className="space-y-1.5 text-[12px]">
            <div className="flex items-center gap-2">
              <UsersIcon size={12} className="text-nu-blue shrink-0" />
              <span className="text-nu-graphite">활성 멤버</span>
              <span className="ml-auto font-mono-nu font-bold text-nu-ink tabular-nums">{totalMembers}명</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-nu-pink shrink-0" />
              <span className="text-nu-graphite">예정 일정</span>
              <span className="ml-auto font-mono-nu font-bold text-nu-ink tabular-nums">{upcomingCombined.length}건</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare size={12} className="text-nu-amber shrink-0" />
              <span className="text-nu-graphite">최근 30일 회의</span>
              <span className="ml-auto font-mono-nu font-bold text-nu-ink tabular-nums">{recent30Meetings.length}회</span>
            </div>
            <div className="flex items-center gap-2">
              <Flame size={12} className="text-orange-600 shrink-0" />
              <span className="text-nu-graphite">누적 게시글</span>
              <span className="ml-auto font-mono-nu font-bold text-nu-ink tabular-nums">{totalPosts}건</span>
            </div>
          </div>
          {upcomingEvent && (
            <div className="mt-3 pt-2 border-t border-nu-ink/10 font-mono-nu text-[10px] text-nu-graphite">
              🗓 다음: <span className="text-nu-ink font-bold">{upcomingEvent.title}</span>
              <br />
              {new Date(upcomingEvent.start_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
            </div>
          )}
        </div>

        {/* 이슈 */}
        <div className="p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2 flex items-center gap-1">
            <AlertTriangle size={11} /> 이슈 사항
          </div>
          <ul className="space-y-1.5 list-none m-0 p-0">
            {issues.map((i, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className={`shrink-0 w-1 h-1 rounded-full mt-[7px] ${
                  i.level === "critical" ? "bg-red-600" : i.level === "warn" ? "bg-orange-500" : "bg-green-600"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className={`font-mono-nu text-[11px] font-bold ${
                    i.level === "critical" ? "text-red-700" : i.level === "warn" ? "text-orange-700" : "text-green-700"
                  }`}>
                    {i.label}
                  </div>
                  <div className="text-[11px] text-nu-graphite truncate">{i.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* 내 기여도 */}
        <div className="p-4">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2 flex items-center gap-1">
            <Flame size={11} /> 내 기여도
          </div>
          {grandTotal === 0 ? (
            <p className="text-[11px] text-nu-graphite italic">아직 활동 없음 — 첫 활동을 시작해보세요</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-head text-[36px] font-extrabold text-nu-pink tabular-nums leading-none">{myPct}%</span>
                <span className="font-mono-nu text-[10px] text-nu-graphite">
                  전체 {grandTotal}건 중 {myTotal}건
                </span>
              </div>
              <div className="h-2 bg-nu-ink/10 overflow-hidden mb-2">
                <div className="h-full bg-nu-pink" style={{ width: `${Math.min(100, myPct)}%` }} />
              </div>
              <div className="font-mono-nu text-[10px] text-nu-graphite space-y-0.5">
                <div>📝 게시글 {myPosts} / {totalPosts}</div>
                <div>📋 회의 노트 {myNotes} / {totalNotes}</div>
                <div>🔗 자료 공유 {myResources} / {totalResources}</div>
                {avgPerMember > 0 && (
                  <div className="pt-1 border-t border-nu-ink/10 mt-1">
                    팀 평균 {avgPerMember}건 {myTotal >= avgPerMember ? "· 👑 상회" : "· 분발 필요"}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 하단 퀵 링크 */}
      {(daysSinceLastMeeting !== null && daysSinceLastMeeting > 14) && (
        <div className="border-t-[2px] border-nu-ink/10 bg-nu-cream/20 px-4 py-2 font-mono-nu text-[10px] uppercase tracking-widest text-orange-700">
          <Link href={`/groups/${groupId}/meetings`} className="no-underline hover:underline inline-flex items-center gap-1">
            <Calendar size={10} /> 새 회의 예약하기 →
          </Link>
        </div>
      )}
    </section>
  );
}
