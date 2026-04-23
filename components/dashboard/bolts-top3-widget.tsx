import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Rocket, Flame, Clock, Circle, Plus, ChevronRight } from "lucide-react";
import { kstTodayStartISO, kstDaysLaterISO } from "@/lib/time-kst";

interface BoltCard {
  id: string;
  title: string;
  stage: string | null;
  status: string;
  urgency: number;
  nextAction: string | null;
  nextActionDue: string | null;
  overdue: number;
  dueSoon: number;
  meetingsSoon: number;
}

/**
 * My Bolts Top 3 — 긴급도 점수 기반 상위 3개 볼트.
 * 점수 = 지연 태스크 × 3 + 3일 내 마감 × 2 + 7일 내 미팅 × 1
 */
export async function BoltsTop3Widget({ userId }: { userId: string }) {
  const supabase = await createClient();
  const todayStart = kstTodayStartISO();
  const in7Days = kstDaysLaterISO(7);
  const todayDate = todayStart.slice(0, 10);
  const in3DaysDate = kstDaysLaterISO(3).slice(0, 10);

  // 내가 멤버인 + 리더인 프로젝트
  const { data: memberRows } = await supabase
    .from("project_members")
    .select("project_id, role")
    .eq("user_id", userId);

  const projectIds = [...new Set(((memberRows as any[]) ?? []).map((r) => r.project_id))];
  const leadIds = new Set(((memberRows as any[]) ?? []).filter((r) => r.role === "lead" || r.role === "owner").map((r) => r.project_id));

  if (projectIds.length === 0) {
    return <EmptyAmber />;
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, status, venture_stage")
    .in("id", projectIds)
    .in("status", ["active", "draft"]);

  const bolts = (projects as any[]) || [];
  if (bolts.length === 0) return <EmptyAmber />;
  const boltIds = bolts.map((b) => b.id);

  // 태스크: 내게 배정된 것 + (리더 프로젝트의) 미배정 것
  const [{ data: myTasks }, { data: meetings }] = await Promise.all([
    supabase
      .from("project_tasks")
      .select("id, title, due_date, project_id, assigned_to, status")
      .in("project_id", boltIds)
      .in("status", ["todo", "in_progress"]),
    supabase
      .from("meetings")
      .select("title, scheduled_at, project_id")
      .in("project_id", boltIds)
      .gte("scheduled_at", todayStart)
      .lte("scheduled_at", in7Days)
      .not("status", "in", "(cancelled,completed)"),
  ]);

  const cardMap = new Map<string, BoltCard>();
  for (const b of bolts) {
    cardMap.set(b.id, {
      id: b.id,
      title: b.title,
      stage: b.venture_stage,
      status: b.status,
      urgency: 0,
      nextAction: null,
      nextActionDue: null,
      overdue: 0,
      dueSoon: 0,
      meetingsSoon: 0,
    });
  }

  for (const t of ((myTasks as any[]) || [])) {
    const relevant =
      t.assigned_to === userId ||
      (t.assigned_to == null && leadIds.has(t.project_id));
    if (!relevant) continue;
    const c = cardMap.get(t.project_id);
    if (!c) continue;

    if (t.due_date) {
      if (t.due_date < todayDate) {
        c.urgency += 3;
        c.overdue += 1;
        if (!c.nextAction || (c.nextActionDue && t.due_date < c.nextActionDue)) {
          c.nextAction = `${t.title} · 마감 지남`;
          c.nextActionDue = t.due_date;
        }
      } else if (t.due_date <= in3DaysDate) {
        c.urgency += 2;
        c.dueSoon += 1;
        if (!c.nextAction || (c.nextActionDue && t.due_date < c.nextActionDue)) {
          const days = Math.max(0, Math.round((new Date(t.due_date).getTime() - new Date(todayDate).getTime()) / 86400000));
          c.nextAction = `${t.title} · D-${days}`;
          c.nextActionDue = t.due_date;
        }
      }
    }
  }

  for (const m of ((meetings as any[]) || [])) {
    const c = cardMap.get(m.project_id);
    if (!c) continue;
    c.urgency += 1;
    c.meetingsSoon += 1;
    if (!c.nextAction) {
      const dt = new Date(m.scheduled_at);
      const s = dt.toLocaleDateString("ko", { month: "short", day: "numeric", timeZone: "Asia/Seoul" });
      c.nextAction = `${m.title} · ${s} 미팅`;
    }
  }

  const ranked = [...cardMap.values()].sort((a, b) => b.urgency - a.urgency).slice(0, 3);

  return (
    <section className="bg-amber-50 border-[3px] border-amber-900 shadow-[4px_4px_0_0_#0D0F14] p-5">
      <header className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-amber-400 text-nu-ink border-[2px] border-amber-900">
          <Rocket size={10} /> 볼트 TOP 3
        </span>
        <h3 className="font-head text-base md:text-lg font-extrabold text-nu-ink tracking-tight uppercase">
          My Bolts
        </h3>
        <Link
          href="/projects"
          className="ml-auto font-mono-nu text-[10px] uppercase tracking-widest text-amber-900 hover:text-nu-ink no-underline"
        >
          전체 →
        </Link>
      </header>

      <ul className="list-none m-0 p-0 space-y-2">
        {ranked.map((c) => (
          <li key={c.id}>
            <Link
              href={`/projects/${c.id}`}
              className="block bg-white border-[2px] border-amber-900 hover:bg-amber-100 transition-colors no-underline p-3"
            >
              <div className="flex items-start gap-2">
                <UrgencyBadge urgency={c.urgency} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-bold text-nu-ink truncate">{c.title}</span>
                    {c.stage && (
                      <span className="font-mono-nu text-[9px] uppercase tracking-widest text-amber-900 border border-amber-900 px-1.5 py-0.5">
                        {c.stage}
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-nu-ink/80 truncate">
                    {c.nextAction || "오늘 할 일 없음 — 다음 단계 기획"}
                  </div>
                  {(c.overdue > 0 || c.dueSoon > 0 || c.meetingsSoon > 0) && (
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {c.overdue > 0 && (
                        <span className="font-mono-nu text-[9px] uppercase tracking-widest text-red-700">
                          지연 {c.overdue}
                        </span>
                      )}
                      {c.dueSoon > 0 && (
                        <span className="font-mono-nu text-[9px] uppercase tracking-widest text-amber-800">
                          곧마감 {c.dueSoon}
                        </span>
                      )}
                      {c.meetingsSoon > 0 && (
                        <span className="font-mono-nu text-[9px] uppercase tracking-widest text-indigo-700">
                          미팅 {c.meetingsSoon}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <ChevronRight size={14} className="text-amber-900 shrink-0 mt-1" />
              </div>
            </Link>
          </li>
        ))}
        {Array.from({ length: Math.max(0, 3 - ranked.length) }).map((_, i) => (
          <li key={`empty-${i}`}>
            <Link
              href="/projects/create"
              className="flex items-center justify-center gap-1.5 bg-white border-[2px] border-dashed border-amber-900/40 hover:border-amber-900 py-3 no-underline text-amber-900"
            >
              <Plus size={12} />
              <span className="font-mono-nu text-[11px] uppercase tracking-widest">
                새 볼트 만들기
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UrgencyBadge({ urgency }: { urgency: number }) {
  if (urgency >= 6) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono-nu text-[10px] uppercase tracking-widest text-red-700 border-[2px] border-red-700 bg-red-50 px-1.5 py-0.5 shrink-0">
        <Flame size={10} /> 긴급
      </span>
    );
  }
  if (urgency >= 3) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono-nu text-[10px] uppercase tracking-widest text-amber-800 border-[2px] border-amber-800 bg-amber-100 px-1.5 py-0.5 shrink-0">
        <Clock size={10} /> 주의
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 font-mono-nu text-[10px] uppercase tracking-widest text-yellow-700 border-[2px] border-yellow-600 bg-yellow-50 px-1.5 py-0.5 shrink-0">
      <Circle size={10} /> 평온
    </span>
  );
}

function EmptyAmber() {
  return (
    <section className="bg-amber-50 border-[3px] border-amber-900 shadow-[4px_4px_0_0_#0D0F14] p-5">
      <header className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-amber-400 text-nu-ink border-[2px] border-amber-900">
          <Rocket size={10} /> 볼트 TOP 3
        </span>
      </header>
      <p className="text-sm text-nu-ink/80 mb-3">아직 참여 중인 볼트가 없어요.</p>
      <Link
        href="/projects/create"
        className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 bg-amber-400 text-nu-ink border-[2px] border-amber-900 hover:bg-amber-300 no-underline"
      >
        <Plus size={11} /> 새 볼트 만들기
      </Link>
    </section>
  );
}
