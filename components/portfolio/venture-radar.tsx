import { createClient } from "@/lib/supabase/server";

const STAGES = [
  { key: "empathize",           label: "공감" },
  { key: "define",              label: "정의" },
  { key: "ideate",              label: "아이디어" },
  { key: "ideate-vote",         label: "투표" },
  { key: "prototype",           label: "프로토" },
  { key: "prototype-feedback",  label: "피드백" },
  { key: "plan",                label: "사업계획" },
] as const;

interface Row { stage: string; total_weight: number; items: number }

export async function VentureRadar({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("venture_contributions_view")
    .select("stage, total_weight, items")
    .eq("user_id", userId);

  const rows = (data as Row[]) ?? [];
  const map = new Map(rows.map((r) => [r.stage, r]));
  const totalItems = rows.reduce((s, r) => s + r.items, 0);

  if (totalItems === 0) {
    return (
      <div className="border-[2px] border-dashed border-nu-ink/30 bg-nu-paper p-6 text-center">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">
          Venture Contributions
        </div>
        <p className="text-[12px] text-nu-graphite">
          아직 Venture Builder 프로젝트 참여 이력이 없습니다.
        </p>
      </div>
    );
  }

  // 정규화 — 최대값을 100 으로
  const maxWeight = Math.max(1, ...rows.map((r) => r.total_weight));
  const points = STAGES.map((s, i) => {
    const r = map.get(s.key);
    const normalized = (r?.total_weight ?? 0) / maxWeight;
    const angle = (i / STAGES.length) * Math.PI * 2 - Math.PI / 2;
    const radius = 80 * normalized;
    return {
      x: 120 + Math.cos(angle) * radius,
      y: 120 + Math.sin(angle) * radius,
      label: s.label,
      value: r?.total_weight ?? 0,
      items: r?.items ?? 0,
      // 라벨 위치 (차트 외곽)
      lx: 120 + Math.cos(angle) * 105,
      ly: 120 + Math.sin(angle) * 105,
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="border-[2.5px] border-nu-ink bg-nu-paper p-5">
      <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-1">
            Venture Radar
          </div>
          <h3 className="text-[16px] font-bold text-nu-ink">디자인 씽킹 기여 분포</h3>
        </div>
        <div className="font-mono-nu text-[10px] text-nu-graphite">
          총 {totalItems}건 · 가중치 {rows.reduce((s, r) => s + r.total_weight, 0)}
        </div>
      </div>

      <div className="flex flex-col items-center">
        <svg viewBox="0 0 240 240" width="100%" style={{ maxWidth: 360 }}>
          {/* 배경 그리드 (3단) */}
          {[0.33, 0.66, 1].map((r) => {
            const pts = STAGES.map((_, i) => {
              const angle = (i / STAGES.length) * Math.PI * 2 - Math.PI / 2;
              return `${120 + Math.cos(angle) * 80 * r},${120 + Math.sin(angle) * 80 * r}`;
            }).join(" ");
            return (
              <polygon
                key={r}
                points={pts}
                fill="none"
                stroke="#0D0D0D"
                strokeOpacity={0.15}
                strokeWidth={1}
              />
            );
          })}
          {/* 축 */}
          {STAGES.map((_, i) => {
            const angle = (i / STAGES.length) * Math.PI * 2 - Math.PI / 2;
            return (
              <line
                key={i}
                x1={120} y1={120}
                x2={120 + Math.cos(angle) * 80}
                y2={120 + Math.sin(angle) * 80}
                stroke="#0D0D0D" strokeOpacity={0.15}
                strokeWidth={1}
              />
            );
          })}
          {/* 데이터 폴리곤 */}
          <polygon
            points={polygonPoints}
            fill="#FF3D88"
            fillOpacity={0.2}
            stroke="#FF3D88"
            strokeWidth={2.5}
          />
          {/* 꼭짓점 */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#0D0D0D" />
          ))}
          {/* 라벨 */}
          {points.map((p, i) => (
            <text
              key={i}
              x={p.lx}
              y={p.ly}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: 1,
                fill: "#0D0D0D",
              }}
            >
              {p.label}
            </text>
          ))}
        </svg>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 w-full">
          {points.map((p, i) => (
            <div key={i} className="border-[1.5px] border-nu-ink/30 p-1.5 text-center">
              <div className="font-mono-nu text-[8px] uppercase tracking-wider text-nu-graphite">
                {p.label}
              </div>
              <div className="font-bold text-[13px] text-nu-ink tabular-nums">
                {p.value}
              </div>
              <div className="font-mono-nu text-[8px] text-nu-graphite">
                {p.items}건
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
