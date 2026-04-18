import { createClient } from "@/lib/supabase/server";
import { STAGES } from "@/lib/venture/types";

interface HistoryRow {
  id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  changed_at: string;
  note: string | null;
  changed_by_name?: string | null;
}

export async function VentureTimeline({ projectId }: { projectId: string }) {
  const supabase = await createClient();

  // safe fetch — 060 미적용 대비
  let rows: HistoryRow[] = [];
  try {
    const { data } = await supabase
      .from("venture_stage_history")
      .select("id, from_stage, to_stage, changed_by, changed_at, note")
      .eq("project_id", projectId)
      .order("changed_at", { ascending: false })
      .limit(30);
    rows = (data as HistoryRow[]) ?? [];
  } catch {
    rows = [];
  }

  // 이름 조인
  const userIds = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))] as string[];
  if (userIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id, nickname").in("id", userIds);
    const map = new Map((profs as { id: string; nickname: string | null }[] | null ?? []).map((p) => [p.id, p.nickname]));
    for (const r of rows) {
      if (r.changed_by) r.changed_by_name = map.get(r.changed_by);
    }
  }

  if (rows.length === 0) {
    return (
      <section className="border-[2px] border-dashed border-nu-ink/30 bg-nu-paper p-5 text-center">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">
          🗓 Venture Timeline
        </div>
        <p className="text-[12px] text-nu-graphite">
          아직 단계 전환 이력이 없습니다. 마이그레이션 060 실행 후 생성됩니다.
        </p>
      </section>
    );
  }

  const label = (s: string | null) => {
    if (!s) return "시작";
    if (s === "completed") return "완료";
    return STAGES.find((st) => st.id === s)?.label ?? s;
  };

  const icon = (s: string | null) => {
    if (!s) return "🌱";
    if (s === "completed") return "🏁";
    return STAGES.find((st) => st.id === s)?.icon ?? "•";
  };

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper">
      <div className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center justify-between">
        <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
          🗓 Venture Timeline
        </span>
        <span className="font-mono-nu text-[10px] text-nu-graphite">{rows.length} 전환</span>
      </div>

      <ol className="p-4 space-y-3">
        {rows.map((r, idx) => {
          const prev = rows[idx + 1]; // 최신순이므로 다음 이벤트가 이전
          const elapsedMs = prev ? new Date(r.changed_at).getTime() - new Date(prev.changed_at).getTime() : 0;
          const days = Math.max(0, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
          const hours = Math.floor((elapsedMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

          return (
            <li key={r.id} className="flex gap-3">
              {/* 타임라인 축 */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-10 h-10 border-[2.5px] border-nu-ink bg-nu-paper flex items-center justify-center text-[18px]">
                  {icon(r.to_stage)}
                </div>
                {idx < rows.length - 1 && (
                  <div className="w-[2.5px] flex-1 bg-nu-ink/30 my-1" />
                )}
              </div>

              {/* 카드 */}
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-bold text-[13px] text-nu-ink">
                    {label(r.from_stage)} → <span className="text-nu-pink">{label(r.to_stage)}</span>
                  </span>
                  {prev && (
                    <span className="font-mono-nu text-[10px] text-nu-graphite">
                      {days > 0 ? `${days}일` : `${hours}시간`} 소요
                    </span>
                  )}
                </div>
                <div className="font-mono-nu text-[10px] uppercase tracking-wider text-nu-graphite mt-0.5">
                  {new Date(r.changed_at).toLocaleString("ko-KR")}
                  {r.changed_by_name && <> · by <strong className="text-nu-ink">{r.changed_by_name}</strong></>}
                </div>
                {r.note && (
                  <p className="text-[12px] text-nu-ink mt-1">{r.note}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
