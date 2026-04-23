"use client";

/**
 * Dev Plan Preview — compact card view of /api/genesis/dev-plan output,
 * used inside GenesisFlow when the 🛠️ dev plan toggle is on.
 */

import { useMemo, useState } from "react";
import type { DevPlan } from "@/lib/genesis/dev-plan-schema";
import { ArrowRight, ShieldAlert, Zap, Users, Clock, Layers } from "lucide-react";

interface Props {
  plan: DevPlan;
  onBack: () => void;
  onProvision: (selectedScenario: string) => void;
  provisioning?: boolean;
}

export function DevPlanPreview({ plan, onBack, onProvision, provisioning }: Props) {
  const [scenario, setScenario] = useState<string>(
    plan.team_scenarios?.[0]?.name || "",
  );

  const totalTasks = useMemo(
    () => (plan.effort_breakdown || []).reduce((acc, a) => acc + (a.tasks?.length || 0), 0),
    [plan],
  );
  const totalDays = useMemo(
    () =>
      (plan.effort_breakdown || []).reduce(
        (acc, a) => acc + (a.tasks || []).reduce((s, t) => s + (t.estimated_days || 0), 0),
        0,
      ),
    [plan],
  );
  const highRisk = (plan.risks || []).filter((r) => r.severity === "high").length;

  return (
    <div className="border-[3px] border-nu-ink bg-nu-paper">
      {/* Hero */}
      <div className="bg-nu-ink text-nu-paper p-6 border-b-[3px] border-nu-ink">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-pink font-bold">
            🛠️ GENESIS DEV ROADMAP
          </span>
        </div>
        <h1 className="font-head text-3xl font-black mb-1">{plan.project_name}</h1>
        <p className="text-[13px] text-nu-paper/75 leading-relaxed">{plan.mvp_target}</p>
        <div className="mt-4 grid grid-cols-4 gap-3">
          <Stat icon={<Clock size={12} />} label="추천 기간" value={`${plan.recommended_weeks}주`} />
          <Stat icon={<Users size={12} />} label="팀 규모" value={`${plan.recommended_team_size}명`} />
          <Stat icon={<Layers size={12} />} label="태스크" value={`${totalTasks}개`} />
          <Stat icon={<ShieldAlert size={12} />} label="고위험" value={`${highRisk}건`} />
        </div>
      </div>

      {/* Strategic decisions */}
      {plan.strategic_decisions?.length > 0 && (
        <section className="p-5 border-b border-nu-ink/10">
          <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray mb-3">
            🎯 전략 결정
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {plan.strategic_decisions.map((d, i) => (
              <div key={i} className="border-2 border-nu-ink/15 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-head text-[13px] font-bold text-nu-ink uppercase">
                    {d.platform}
                  </span>
                  <PriorityBadge priority={d.priority} />
                </div>
                <p className="text-[11px] text-nu-muted leading-snug">{d.rationale}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Effort summary */}
      {plan.effort_breakdown?.length > 0 && (
        <section className="p-5 border-b border-nu-ink/10">
          <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray mb-3">
            💪 공수 분해 · 총 {totalDays.toFixed(1)}일
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {plan.effort_breakdown.map((a, i) => {
              const days = (a.tasks || []).reduce((s, t) => s + (t.estimated_days || 0), 0);
              return (
                <span
                  key={i}
                  className="font-mono-nu text-[11px] px-2 py-1 border-2 border-nu-ink/15 bg-nu-white text-nu-ink"
                >
                  {a.area} · {a.tasks.length}개 · {days.toFixed(1)}일
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* Gantt compressed */}
      {plan.gantt?.length > 0 && (
        <section className="p-5 border-b border-nu-ink/10">
          <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray mb-3">
            📅 주간 Gantt ({plan.gantt.length}주)
          </h3>
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-full pb-1">
              {plan.gantt.map((g, i) => (
                <div
                  key={i}
                  className="shrink-0 w-[120px] border-2 border-nu-ink/10 bg-nu-white p-2"
                >
                  <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink font-bold mb-1">
                    W{g.week}
                  </p>
                  <ul className="text-[11px] text-nu-ink space-y-0.5">
                    {g.milestones.map((m, j) => (
                      <li key={j}>• {m}</li>
                    ))}
                  </ul>
                  {g.parallel_tracks.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-0.5">
                      {g.parallel_tracks.map((t, j) => (
                        <span
                          key={j}
                          className="font-mono-nu text-[9px] px-1 py-[1px] bg-nu-ink/[0.06] text-nu-gray"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Team scenarios — pick one */}
      {plan.team_scenarios?.length > 0 && (
        <section className="p-5 border-b border-nu-ink/10">
          <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray mb-3">
            👥 팀 시나리오 선택
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {plan.team_scenarios.map((s, i) => {
              const active = scenario === s.name;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setScenario(s.name)}
                  className={`text-left border-2 p-3 transition-all ${
                    active
                      ? "border-nu-pink bg-nu-pink/10"
                      : "border-nu-ink/15 hover:border-nu-ink/40"
                  }`}
                >
                  <p className="font-head text-[13px] font-bold text-nu-ink">{s.name}</p>
                  <p className="font-mono-nu text-[11px] text-nu-muted mt-0.5">
                    {s.size}명 · {s.duration_weeks}주
                  </p>
                  <p className="text-[11px] text-nu-gray mt-1 leading-snug">{s.trade_offs}</p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Risks + Quick wins */}
      <section className="p-5 border-b border-nu-ink/10 grid grid-cols-1 md:grid-cols-2 gap-4">
        {plan.risks?.length > 0 && (
          <div>
            <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray mb-2 flex items-center gap-1">
              <ShieldAlert size={11} /> 리스크 ({plan.risks.length})
            </h3>
            <ul className="space-y-1.5">
              {plan.risks.slice(0, 5).map((r, i) => (
                <li key={i} className="text-[11px] text-nu-ink">
                  <span
                    className={`font-mono-nu text-[9px] uppercase tracking-widest px-1 py-[1px] mr-1.5 ${
                      r.severity === "high"
                        ? "bg-red-100 text-red-700"
                        : r.severity === "medium"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-nu-ink/[0.06] text-nu-gray"
                    }`}
                  >
                    {r.severity}
                  </span>
                  {r.description}
                </li>
              ))}
            </ul>
          </div>
        )}
        {plan.quick_wins?.length > 0 && (
          <div>
            <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray mb-2 flex items-center gap-1">
              <Zap size={11} /> Quick Wins ({plan.quick_wins.length})
            </h3>
            <ul className="space-y-1">
              {plan.quick_wins.map((q, i) => (
                <li key={i} className="text-[11px] text-nu-ink">
                  ⚡ {typeof q === "string" ? q : (q as any).title}
                  {typeof q !== "string" && (q as any).shortens_weeks != null && (
                    <span className="ml-1 text-nu-pink">(~{(q as any).shortens_weeks}주 단축)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Tech stack */}
      {plan.tech_stack?.length > 0 && (
        <section className="p-5 border-b border-nu-ink/10">
          <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray mb-2">
            🧰 Tech Stack
          </h3>
          <div className="flex flex-wrap gap-1">
            {plan.tech_stack.map((t, i) => (
              <span
                key={i}
                className="font-mono text-[11px] px-2 py-0.5 bg-nu-paper border border-nu-ink/15 text-nu-gray"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="p-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors"
        >
          ← 다시 작성
        </button>
        <button
          type="button"
          onClick={() => onProvision(scenario)}
          disabled={provisioning}
          className="flex items-center gap-2 font-mono-nu text-[13px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-50"
        >
          🏗️ 이 로드맵으로 볼트 생성
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border border-nu-paper/20 p-2">
      <div className="flex items-center gap-1 text-nu-paper/60">
        {icon}
        <span className="font-mono-nu text-[9px] uppercase tracking-widest">{label}</span>
      </div>
      <p className="font-head text-lg font-black mt-0.5">{value}</p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    high: "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-nu-ink/[0.06] text-nu-gray",
    skip: "bg-nu-paper text-nu-muted line-through",
  };
  return (
    <span
      className={`font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-[1px] ${
        map[priority] || map.low
      }`}
    >
      {priority}
    </span>
  );
}
