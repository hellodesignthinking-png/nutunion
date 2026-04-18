import { createClient } from "@/lib/supabase/server";

interface ContribRow {
  user_id: string;
  day: string; // YYYY-MM-DD
  count: number;
}

interface Profile { id: string; nickname: string | null; avatar_url: string | null }

/**
 * 볼트별 팀원 주간 기여도 히트맵 (7일 × N 멤버)
 * venture_* 테이블의 created_at 을 일별 집계.
 */
export async function VentureContributionHeatmap({ projectId }: { projectId: string }) {
  const supabase = await createClient();

  // 최근 7일 범위
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  // 각 테이블 author 별 created_at 병합 집계
  const [insights, problems, ideas, feedback] = await Promise.all([
    supabase.from("venture_insights").select("author_id, created_at").eq("project_id", projectId).gte("created_at", sinceIso),
    supabase.from("venture_problems").select("author_id, created_at").eq("project_id", projectId).gte("created_at", sinceIso),
    supabase.from("venture_ideas").select("author_id, created_at").eq("project_id", projectId).gte("created_at", sinceIso),
    supabase.from("venture_feedback").select("author_id, created_at").eq("project_id", projectId).gte("created_at", sinceIso),
  ]);

  const rows: { author_id: string | null; created_at: string }[] = [
    ...((insights.data as { author_id: string | null; created_at: string }[] | null) ?? []),
    ...((problems.data as { author_id: string | null; created_at: string }[] | null) ?? []),
    ...((ideas.data as { author_id: string | null; created_at: string }[] | null) ?? []),
    ...((feedback.data as { author_id: string | null; created_at: string }[] | null) ?? []),
  ];

  // (user, day) → count
  const map = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!r.author_id) continue;
    const day = r.created_at.slice(0, 10);
    const inner = map.get(r.author_id) ?? new Map<string, number>();
    inner.set(day, (inner.get(day) ?? 0) + 1);
    map.set(r.author_id, inner);
  }

  const userIds = [...map.keys()];
  let profiles: Profile[] = [];
  if (userIds.length > 0) {
    const { data } = await supabase.from("profiles").select("id, nickname, avatar_url").in("id", userIds);
    profiles = (data as Profile[] | null) ?? [];
  }
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // 지난 7일 날짜 배열
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  // 최대값 (정규화용)
  let max = 1;
  for (const inner of map.values()) {
    for (const v of inner.values()) max = Math.max(max, v);
  }

  const userRows: ContribRow[][] = userIds.map((uid) =>
    days.map((d) => ({ user_id: uid, day: d, count: map.get(uid)?.get(d) ?? 0 }))
  );

  // 총 기여 많은 순 정렬
  userRows.sort((a, b) => {
    const sa = a.reduce((s, r) => s + r.count, 0);
    const sb = b.reduce((s, r) => s + r.count, 0);
    return sb - sa;
  });

  if (userIds.length === 0) {
    return (
      <section className="border-[2px] border-dashed border-nu-ink/30 bg-nu-paper p-5 text-center">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">
          🔥 Contribution Heatmap (최근 7일)
        </div>
        <p className="text-[12px] text-nu-graphite">이번 주 활동 없음</p>
      </section>
    );
  }

  const cellColor = (n: number) => {
    if (n === 0) return "bg-nu-ink/5";
    const ratio = n / max;
    if (ratio < 0.25) return "bg-nu-pink/25";
    if (ratio < 0.5) return "bg-nu-pink/50";
    if (ratio < 0.75) return "bg-nu-pink/75";
    return "bg-nu-pink";
  };

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper">
      <div className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center justify-between">
        <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
          🔥 기여 히트맵 (최근 7일)
        </span>
        <span className="font-mono-nu text-[10px] text-nu-graphite">{userIds.length}명 · max {max}/일</span>
      </div>

      <div className="p-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite pr-3 pb-2">멤버</th>
              {days.map((d) => {
                const isToday = d === new Date().toISOString().slice(0, 10);
                return (
                  <th key={d} className={`text-center font-mono-nu text-[9px] ${isToday ? "text-nu-pink font-bold" : "text-nu-graphite"} pb-2`}>
                    {d.slice(5).replace("-", "/")}
                  </th>
                );
              })}
              <th className="text-right font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite pl-3 pb-2">합계</th>
            </tr>
          </thead>
          <tbody>
            {userRows.map((row) => {
              const uid = row[0].user_id;
              const profile = profileMap.get(uid);
              const total = row.reduce((s, r) => s + r.count, 0);
              return (
                <tr key={uid}>
                  <td className="pr-3 py-0.5">
                    <span className="text-[12px] text-nu-ink truncate max-w-[120px] inline-block">
                      {profile?.nickname ?? uid.slice(0, 8)}
                    </span>
                  </td>
                  {row.map((c) => (
                    <td key={c.day} className="p-0.5">
                      <div
                        className={`w-full h-6 ${cellColor(c.count)} border border-nu-ink/10`}
                        title={`${c.day}: ${c.count}건`}
                      >
                        {c.count > 0 && (
                          <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-nu-ink">
                            {c.count}
                          </div>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="pl-3 py-0.5 text-right">
                    <span className="font-mono-nu text-[11px] font-bold text-nu-ink tabular-nums">
                      {total}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
