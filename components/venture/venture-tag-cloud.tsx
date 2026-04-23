import { createClient } from "@/lib/supabase/server";

interface InsightRow { tags: string[] | null }

/**
 * 프로젝트 인사이트의 태그를 집계해 클라우드 형태로 표시.
 * 빈도 기반 크기 조절 + 유사 태그 그룹화 (포함 관계 + 한글 2자 prefix 휴리스틱).
 *
 * 안전: 모든 실패 경로에서 null 반환 — 페이지 전체가 깨지지 않도록.
 *       (상위 페이지에서 이미 membership 검증 완료 가정)
 */
export async function VentureTagCloud({ projectId }: { projectId: string }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("venture_insights")
      .select("tags")
      .eq("project_id", projectId)
      .limit(500);

    // 058 마이그레이션 미적용 시 테이블 없음 → graceful null
    if (error) return null;

    const rows = (data as InsightRow[] | null) ?? [];
    if (rows.length === 0) return null;

    const counts = new Map<string, number>();
    for (const r of rows) {
      for (const tag of r.tags ?? []) {
        const key = typeof tag === "string" ? tag.trim() : "";
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    if (counts.size === 0) return null;

    const clusters = clusterTags(counts);
    const maxCount = Math.max(...counts.values());

    return (
      <section className="border-[2.5px] border-nu-ink bg-nu-paper p-4" aria-label="인사이트 태그 클러스터">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink m-0">
            🏷 인사이트 태그 ({counts.size}종 · {clusters.length}그룹)
          </h3>
          <div className="font-mono-nu text-[9px] text-nu-graphite">AI 자동 태깅</div>
        </div>

        <ul className="space-y-2 list-none p-0 m-0">
          {clusters.map((cluster) => {
            const total = cluster.reduce((s, t) => s + t.count, 0);
            const groupKey = cluster[0]?.name ?? "";
            return (
              <li key={groupKey} className="border-l-[3px] border-nu-pink/40 pl-2">
                <div className="flex flex-wrap gap-1.5 items-center">
                  {cluster.map((t) => {
                    const size = 11 + Math.floor((t.count / maxCount) * 5);
                    const weight = t.count >= maxCount / 2 ? 700 : 500;
                    return (
                      <span
                        key={t.name}
                        className="inline-flex items-center gap-1 border-[1.5px] border-nu-ink bg-nu-paper px-2 py-0.5 font-mono-nu uppercase tracking-wider text-nu-ink"
                        style={{ fontSize: `${size}px`, fontWeight: weight }}
                        aria-label={`태그 ${t.name} ${t.count}회`}
                      >
                        #{t.name}
                        <span className="text-nu-graphite font-normal" aria-hidden="true">{t.count}</span>
                      </span>
                    );
                  })}
                  <span className="ml-auto font-mono-nu text-[9px] text-nu-graphite">
                    그룹 {cluster.length}개 · 총 {total}건
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  } catch (err) {
    console.warn("[VentureTagCloud] render failed", err);
    return null;
  }
}

// ── 유사 태그 클러스터링 ──────────────────────────────────────
function clusterTags(counts: Map<string, number>): { name: string; count: number }[][] {
  const sorted = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const buckets = new Map<string, { name: string; count: number }[]>();
  for (const t of sorted) {
    const key = prefixKey(t.name);
    const arr = buckets.get(key) ?? [];
    arr.push(t);
    buckets.set(key, arr);
  }

  const clusters: { name: string; count: number }[][] = [];
  const used = new Set<string>();

  for (const t of sorted) {
    if (used.has(t.name)) continue;
    const group = [t];
    used.add(t.name);
    const key = prefixKey(t.name);
    const candidates = buckets.get(key) ?? [];
    for (const other of candidates) {
      if (used.has(other.name)) continue;
      if (isSimilar(t.name, other.name)) {
        group.push(other);
        used.add(other.name);
      }
    }
    clusters.push(group);
  }
  return clusters;
}

function prefixKey(s: string): string {
  const l = s.toLowerCase().trim();
  if (/^[가-힣]/.test(l)) return l.slice(0, 2);
  return l.slice(0, 3);
}

function isSimilar(a: string, b: string): boolean {
  const aL = a.toLowerCase();
  const bL = b.toLowerCase();
  if ((aL.length >= 3 || bL.length >= 3) && (aL.includes(bL) || bL.includes(aL))) return true;
  if (/[가-힣]/.test(a) && /[가-힣]/.test(b) && a.length >= 2 && b.length >= 2 && a.slice(0, 2) === b.slice(0, 2)) return true;
  return false;
}
