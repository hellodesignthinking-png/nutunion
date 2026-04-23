import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { VentureCleanupButton } from "./venture-cleanup-button";

interface ActivityEvent {
  event_type: string;
  event_id: string;
  event_at: string;
  author_id: string | null;
  author_nickname: string | null;
  author_avatar: string | null;
  title: string | null;
  detail: string | null;
}

const EVENT_META: Record<string, { icon: string; label: string; color: string }> = {
  stage_change:   { icon: "🔀", label: "단계 전환",   color: "text-nu-pink" },
  stage_revert:   { icon: "🔄", label: "단계 되돌림", color: "text-orange-600" },
  insight:        { icon: "👂", label: "인사이트",    color: "text-nu-blue" },
  problem:        { icon: "🎯", label: "HMW",        color: "text-purple-700" },
  problem_ai:     { icon: "🤖", label: "HMW (AI)",   color: "text-purple-700" },
  idea:           { icon: "💡", label: "아이디어",   color: "text-nu-amber" },
  idea_ai:        { icon: "🤖", label: "아이디어 (AI)", color: "text-nu-amber" },
  task:           { icon: "🛠", label: "태스크",      color: "text-green-700" },
  feedback:       { icon: "💬", label: "피드백",      color: "text-blue-600" },
  source:         { icon: "📚", label: "소스",        color: "text-nu-graphite" },
};

interface Props {
  projectId: string;
  projectTitle: string;
  canManage?: boolean;
  compact?: boolean;
}

/**
 * Venture Archive — 프로젝트의 모든 활동을 시간순 통합 피드로 표시.
 * 참여자별 기여 집계도 포함해 "누가 얼마나 기여했는지" 시각화.
 */
export async function VentureArchive({ projectId, projectTitle, canManage = false, compact = false }: Props) {
  const supabase = await createClient();

  let events: ActivityEvent[] = [];
  try {
    const { data } = await supabase.rpc("venture_activity_feed", {
      p_project_id: projectId,
      p_limit: compact ? 30 : 200,
    });
    events = (data as ActivityEvent[] | null) ?? [];
  } catch {
    // 064 미적용 시 빈 상태
  }

  if (events.length === 0) {
    return (
      <section className="border-[2.5px] border-nu-ink bg-nu-paper p-6 text-center">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2">📜 Archive</div>
        <p className="text-[12px] text-nu-graphite">아직 기록된 활동이 없습니다.</p>
        <p className="text-[11px] text-nu-graphite mt-2">
          (064 마이그레이션 적용 시 시간순 전체 기록이 여기에 표시됩니다)
        </p>
      </section>
    );
  }

  // 참여자별 기여 집계
  const contributorMap = new Map<string, { nickname: string; avatar: string | null; count: number; types: Set<string> }>();
  for (const e of events) {
    if (!e.author_id) continue;
    const existing = contributorMap.get(e.author_id) ?? { nickname: e.author_nickname ?? "(익명)", avatar: e.author_avatar, count: 0, types: new Set<string>() };
    existing.count += 1;
    existing.types.add(e.event_type);
    contributorMap.set(e.author_id, existing);
  }
  const contributors = [...contributorMap.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count);

  // 날짜별 그룹핑
  const dayGroups = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const day = new Date(e.event_at).toISOString().slice(0, 10);
    const arr = dayGroups.get(day) ?? [];
    arr.push(e);
    dayGroups.set(day, arr);
  }
  const sortedDays = [...dayGroups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper">
      <div className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink">
            📜 Venture Archive
          </div>
          <div className="font-bold text-[14px] text-nu-ink mt-0.5">
            {projectTitle} · 전체 활동 기록 ({events.length}건)
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canManage && <VentureCleanupButton projectId={projectId} />}
          <Link
            href={`/projects/${projectId}/venture/export`}
            className="h-9 px-3 border-[2px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[10px] uppercase tracking-widest no-underline hover:bg-nu-ink hover:text-nu-paper"
          >
            📄 전체 Export
          </Link>
        </div>
      </div>

      {/* 참여자 기여 집계 */}
      {contributors.length > 0 && (
        <div className="px-4 py-3 border-b-[2px] border-nu-ink/10 bg-nu-cream/20">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-2">
            👥 참여자 기여 ({contributors.length}명)
          </div>
          <div className="flex flex-wrap gap-2">
            {contributors.slice(0, 10).map((c, idx) => (
              <div
                key={c.id}
                className="flex items-center gap-1.5 border-[1.5px] border-nu-ink bg-nu-paper px-2 py-1"
                title={`${c.count}건 기여 · ${[...c.types].join(", ")}`}
              >
                {c.avatar ? (
                  <Image src={c.avatar} alt="" width={20} height={20} className="w-5 h-5 rounded-full object-cover" unoptimized />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-nu-cream flex items-center justify-center text-[9px] font-bold">
                    {c.nickname.slice(0, 1)}
                  </div>
                )}
                <span className={`font-mono-nu text-[11px] font-bold ${idx === 0 ? "text-nu-pink" : "text-nu-ink"}`}>
                  {c.nickname}
                </span>
                <span className={`font-mono-nu text-[10px] tabular-nums ${idx === 0 ? "text-nu-pink font-bold" : "text-nu-graphite"}`}>
                  {c.count}
                </span>
                {idx === 0 && <span className="text-[10px]">👑</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 시간순 활동 피드 */}
      <div className="divide-y-[1px] divide-nu-ink/10 max-h-[600px] overflow-y-auto">
        {sortedDays.map(([day, dayEvents]) => (
          <div key={day}>
            <div className="sticky top-0 bg-nu-paper border-b-[1.5px] border-nu-ink px-4 py-1.5 z-10">
              <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-ink font-bold">
                {new Date(day).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric", weekday: "short" })}
              </span>
              <span className="ml-2 font-mono-nu text-[10px] text-nu-graphite">{dayEvents.length}건</span>
            </div>
            <ul className="divide-y divide-nu-ink/5 list-none m-0 p-0">
              {dayEvents.map((e) => {
                const meta = EVENT_META[e.event_type] ?? { icon: "📌", label: e.event_type, color: "text-nu-graphite" };
                const time = new Date(e.event_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
                return (
                  <li key={e.event_id} className="px-4 py-2 flex items-start gap-2">
                    <div className="shrink-0 w-8 h-8 rounded-full border-[1.5px] border-nu-ink bg-nu-paper flex items-center justify-center text-[16px]">
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono-nu text-[9px] uppercase tracking-widest font-bold ${meta.color}`}>
                          {meta.label}
                        </span>
                        <span className="font-mono-nu text-[9px] text-nu-graphite tabular-nums">{time}</span>
                        {e.author_nickname && (
                          <span className="font-mono-nu text-[10px] text-nu-ink">· {e.author_nickname}</span>
                        )}
                      </div>
                      {e.title && (
                        <div className="text-[12px] text-nu-ink mt-0.5 leading-relaxed">{e.title}</div>
                      )}
                      {e.detail && (
                        <div className="text-[11px] text-nu-graphite mt-0.5 leading-relaxed">{e.detail}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
