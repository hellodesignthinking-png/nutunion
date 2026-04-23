"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Rocket, Clock, Users, Target, Gauge, Flag, CheckCircle2, UserPlus, Briefcase } from "lucide-react";
import type { DevPlan } from "@/lib/genesis/dev-plan-schema";
import { DevPlanActions, EditableNarrative } from "./dev-plan-actions";

const PLATFORM_LABEL: Record<string, string> = {
  pc_web: "PC 웹",
  mobile_app: "모바일 앱",
  admin: "어드민",
  api: "API",
  landing: "랜딩",
};

const AREA_LABEL: Record<string, string> = {
  infra: "인프라",
  backend: "백엔드",
  frontend: "프론트엔드",
  ai: "AI",
  qa: "QA",
  devops: "DevOps",
};

const AREA_COLOR: Record<string, string> = {
  infra: "bg-nu-amber text-nu-ink",
  backend: "bg-nu-pink text-nu-paper",
  frontend: "bg-nu-blue text-nu-paper",
  ai: "bg-emerald-400 text-nu-ink",
  qa: "bg-nu-ink text-nu-paper",
  devops: "bg-nu-cream text-nu-ink",
};

// Track color — for gantt parallel bars
function trackColor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("be") || l.includes("backend") || l.includes("백엔드")) return "bg-nu-pink text-nu-paper border-nu-pink";
  if (l.includes("fe") || l.includes("frontend") || l.includes("프론트")) return "bg-nu-blue text-nu-paper border-nu-blue";
  if (l.includes("ai")) return "bg-emerald-400 text-nu-ink border-emerald-500";
  if (l.includes("qa") || l.includes("test")) return "bg-nu-ink text-nu-paper border-nu-ink";
  if (l.includes("infra") || l.includes("devops") || l.includes("인프라")) return "bg-nu-amber text-nu-ink border-nu-amber";
  return "bg-nu-cream text-nu-ink border-nu-ink";
}

const SEVERITY_LABEL: Record<string, string> = {
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

const SEVERITY_CLASS: Record<string, string> = {
  high: "bg-red-500 text-white border-red-600",
  medium: "bg-nu-amber text-nu-ink border-nu-amber",
  low: "bg-emerald-400 text-nu-ink border-emerald-500",
};

const PRIORITY_CARD: Record<string, string> = {
  high: "bg-red-500 text-white border-nu-ink",
  medium: "bg-nu-amber text-nu-ink border-nu-ink",
  low: "bg-nu-ink/20 text-nu-ink border-nu-ink",
  skip: "bg-nu-ink/5 text-nu-ink/60 border-nu-ink line-through",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  skip: "SKIP",
};

const SCENARIO_ACCENT: string[] = [
  "bg-nu-ink text-nu-paper",
  "bg-nu-pink text-nu-paper",
  "bg-nu-amber text-nu-ink",
];

const AVAILABILITY: Record<string, { icon: string; label: string }> = {
  internal: { icon: "✅", label: "내부 조달" },
  external_hire: { icon: "🔎", label: "영입 필요" },
  outsource: { icon: "📋", label: "외주" },
};

const BRUTAL_CARD = "border-[4px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14]";

export function DevPlanView({
  projectId,
  projectTitle,
  plan,
  generatedAt,
  isHost,
  intent,
}: {
  projectId: string;
  projectTitle: string;
  plan: DevPlan;
  generatedAt: string | null;
  isHost: boolean;
  intent: string | null;
}) {
  const [editMode, setEditMode] = useState(false);

  const weeks = Math.max(plan.recommended_weeks || plan.gantt.length || 1, plan.gantt.length || 1);
  const ganttByWeek = new Map<number, { milestones: string[]; tracks: string[] }>();
  for (const g of plan.gantt || []) {
    ganttByWeek.set(g.week, {
      milestones: g.milestones || [],
      tracks: g.parallel_tracks || [],
    });
  }

  const totalDays = (plan.effort_breakdown || []).reduce(
    (acc, area) => acc + (area.tasks || []).reduce((a2, t) => a2 + (t.estimated_days || 0), 0),
    0,
  );

  // Milestone weeks for marker lines
  const milestoneWeeks = new Set<number>(
    (plan.gantt || []).filter((g) => (g.milestones || []).length > 0).map((g) => g.week),
  );

  return (
    <div className="min-h-screen bg-nu-paper print:bg-white">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          .print\\:hidden { display: none !important; }
          body { background: #fff !important; }
          .devplan-hero-card { box-shadow: none !important; }
          details { page-break-inside: avoid; }
          section { page-break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <Link
          href={`/projects/${projectId}`}
          className="print:hidden inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-ink no-underline"
        >
          <ArrowLeft size={12} /> {projectTitle}
        </Link>

        {/* Action bar */}
        <div className="mt-6">
          <DevPlanActions
            projectId={projectId}
            intent={intent}
            isHost={isHost}
            editMode={editMode}
            onToggleEdit={() => setEditMode((v) => !v)}
          />
        </div>

        {/* Hero */}
        <header className={`${BRUTAL_CARD} bg-nu-cream p-6 sm:p-8`}>
          <div className="flex items-center gap-2 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
            <Rocket size={12} /> 기술 개발 로드맵 · Genesis AI
          </div>
          <h1 className="mt-2 font-head text-3xl sm:text-5xl font-black text-nu-ink leading-tight break-words">
            {plan.project_name || projectTitle}
          </h1>
          {plan.mvp_target && (
            <p className="mt-4 text-sm text-nu-ink/80 max-w-3xl">
              <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mr-2">
                MVP 목표
              </span>
              <EditableNarrative
                projectId={projectId}
                plan={plan}
                path={["mvp_target"]}
                editMode={editMode}
              />
            </p>
          )}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3 devplan-hero-card">
            <HeroStat icon={<Target size={14} />} label="MVP" bg="bg-nu-pink/10" value={plan.mvp_target ? "정의됨" : "—"} />
            <HeroStat
              icon={<Clock size={14} />}
              label="주차"
              bg="bg-amber-300/20"
              value={`${plan.recommended_weeks}`}
              unit="주"
            />
            <HeroStat
              icon={<Users size={14} />}
              label="팀"
              bg="bg-emerald-300/20"
              value={`${plan.recommended_team_size}`}
              unit="명"
            />
            <HeroStat
              icon={<Rocket size={14} />}
              label="런칭"
              bg="bg-nu-pink/10"
              value={plan.target_launch || "—"}
              small
            />
            <HeroStat
              icon={<Gauge size={14} />}
              label="총 공수"
              bg="bg-amber-300/20"
              value={`${totalDays.toFixed(0)}`}
              unit="d"
            />
          </div>
          {generatedAt && (
            <p className="mt-4 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
              생성 · {new Date(generatedAt).toLocaleString("ko")}
            </p>
          )}
        </header>

        {/* Strategic decisions */}
        {plan.strategic_decisions?.length > 0 && (
          <Section title="플랫폼 우선순위" subtitle="PC / Mobile / Admin / API / Landing — high · medium · low · skip">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {plan.strategic_decisions.map((d, i) => (
                <div
                  key={`sd-${i}`}
                  className={`border-[4px] p-4 ${PRIORITY_CARD[d.priority] || PRIORITY_CARD.medium} flex flex-col`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-head text-base font-black uppercase">
                      {PLATFORM_LABEL[d.platform] || d.platform}
                    </span>
                    <span className="font-mono-nu text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-nu-ink text-nu-paper">
                      {PRIORITY_LABEL[d.priority] || d.priority}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed flex-1">
                    <EditableNarrative
                      projectId={projectId}
                      plan={plan}
                      path={["strategic_decisions", i, "rationale"]}
                      editMode={editMode}
                    />
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Effort breakdown */}
        {plan.effort_breakdown?.length > 0 && (
          <Section title="공수 분해" subtitle="영역별 태스크 · 예상 일수">
            <div className="space-y-3">
              {plan.effort_breakdown.map((area, i) => {
                const areaDays = area.tasks.reduce((a, t) => a + (t.estimated_days || 0), 0);
                return (
                  <details
                    key={`area-${i}`}
                    open
                    className="border-[3px] border-nu-ink bg-nu-paper"
                  >
                    <summary className="cursor-pointer px-4 py-3 flex items-center gap-3 list-none">
                      <span
                        className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border-2 border-nu-ink ${AREA_COLOR[area.area] || AREA_COLOR.backend}`}
                      >
                        {AREA_LABEL[area.area] || area.area}
                      </span>
                      <span className="font-head text-sm font-bold text-nu-ink">
                        {area.tasks.length}개 태스크
                      </span>
                      <span className="ml-auto font-mono-nu text-[11px] text-nu-muted">
                        {areaDays.toFixed(1)}d
                      </span>
                    </summary>
                    <div className="border-t-[3px] border-nu-ink">
                      <table className="w-full text-sm">
                        <tbody>
                          {area.tasks.map((t, ti) => (
                            <tr key={`t-${ti}`} className="border-b border-nu-ink/10 last:border-0">
                              <td className="px-4 py-2 text-nu-ink">{t.title}</td>
                              <td className="px-4 py-2 text-right font-mono-nu text-[11px] text-nu-muted whitespace-nowrap">
                                {t.estimated_days.toFixed(1)}d
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </div>
          </Section>
        )}

        {/* Gantt */}
        {plan.gantt?.length > 0 && (
          <Section title="병렬 Gantt" subtitle="주차별 마일스톤 · BE/FE/AI/QA/Infra 병렬 트랙">
            <p className="md:hidden font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted text-center mb-1">
              ← 좌우로 스크롤 →
            </p>
            <div className="-mx-4 px-4 md:mx-0 md:px-0 border-y-[4px] md:border-[4px] border-nu-ink bg-nu-paper overflow-x-auto">
              <div className="min-w-[720px]">
                <div
                  className="grid sticky top-0 z-10 border-b-[3px] border-nu-ink bg-nu-cream"
                  style={{ gridTemplateColumns: `120px repeat(${weeks}, minmax(120px,1fr))` }}
                >
                  <div className="px-3 py-2 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted border-r-2 border-nu-ink">
                    주차
                  </div>
                  {Array.from({ length: weeks }, (_, wi) => wi + 1).map((w) => (
                    <div
                      key={`h-${w}`}
                      className={`px-3 py-2 font-mono-nu text-[10px] uppercase tracking-widest border-r border-nu-ink/20 last:border-0 ${
                        milestoneWeeks.has(w) ? "bg-nu-pink/15 text-nu-pink font-black" : "text-nu-ink"
                      }`}
                    >
                      W{w}
                      {milestoneWeeks.has(w) && <span className="ml-1">🏁</span>}
                    </div>
                  ))}
                </div>
                {/* Milestones */}
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `120px repeat(${weeks}, minmax(120px,1fr))` }}
                >
                  <div className="px-3 py-3 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted border-r-2 border-nu-ink bg-nu-cream/40">
                    마일스톤
                  </div>
                  {Array.from({ length: weeks }, (_, wi) => wi + 1).map((w) => {
                    const g = ganttByWeek.get(w);
                    const hasMilestone = (g?.milestones || []).length > 0;
                    return (
                      <div
                        key={`m-${w}`}
                        className={`px-2 py-2 border-r last:border-0 border-b border-nu-ink/10 ${
                          hasMilestone ? "border-r-[4px] border-r-nu-pink" : "border-r border-nu-ink/20"
                        }`}
                      >
                        {(g?.milestones || []).map((m, mi) => (
                          <div
                            key={`mm-${w}-${mi}`}
                            className="text-[11px] text-nu-ink bg-nu-pink/15 border-l-[3px] border-nu-pink px-2 py-1 mb-1 leading-snug font-bold flex items-start gap-1"
                          >
                            <Flag size={10} className="shrink-0 mt-0.5 text-nu-pink" />
                            <span>
                              M{mi + 1} · {m}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                {/* Parallel tracks */}
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `120px repeat(${weeks}, minmax(120px,1fr))` }}
                >
                  <div className="px-3 py-3 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted border-r-2 border-nu-ink bg-nu-cream/40">
                    병렬 트랙
                  </div>
                  {Array.from({ length: weeks }, (_, wi) => wi + 1).map((w) => {
                    const g = ganttByWeek.get(w);
                    return (
                      <div
                        key={`p-${w}`}
                        className="px-2 py-2 border-r border-nu-ink/20 last:border-0"
                      >
                        {(g?.tracks || []).map((tr, ti) => (
                          <div
                            key={`tt-${w}-${ti}`}
                            className={`text-[11px] px-2 py-1 mb-1 leading-snug font-mono-nu border-[2px] font-bold ${trackColor(tr)}`}
                          >
                            {tr}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-2 print:hidden">
              {[
                { label: "BE", cls: "bg-nu-pink text-nu-paper" },
                { label: "FE", cls: "bg-nu-blue text-nu-paper" },
                { label: "AI", cls: "bg-emerald-400 text-nu-ink" },
                { label: "QA", cls: "bg-nu-ink text-nu-paper" },
                { label: "Infra", cls: "bg-nu-amber text-nu-ink" },
              ].map((l) => (
                <span
                  key={l.label}
                  className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border-2 border-nu-ink ${l.cls}`}
                >
                  {l.label}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Team scenarios */}
        {plan.team_scenarios?.length > 0 && (
          <Section title="팀 시나리오" subtitle="구성별 기간 · trade-offs · 롤 가용성">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plan.team_scenarios.map((s, i) => {
                const accent = SCENARIO_ACCENT[i % SCENARIO_ACCENT.length];
                return (
                  <div
                    key={`ts-${i}`}
                    className={`${BRUTAL_CARD} bg-nu-paper flex flex-col`}
                  >
                    <div className={`px-4 py-2 ${accent} font-mono-nu text-[11px] uppercase tracking-widest font-black`}>
                      시나리오 {i + 1} · {s.name}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-baseline gap-4">
                        <div>
                          <div className="font-head text-5xl font-black text-nu-ink leading-none">
                            {s.size}
                          </div>
                          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-1">
                            인원
                          </div>
                        </div>
                        <div>
                          <div className="font-head text-5xl font-black text-nu-pink leading-none">
                            {s.duration_weeks}
                          </div>
                          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-1">
                            주
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 bg-nu-ink text-nu-paper p-3">
                        <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-paper/70 mb-1">
                          Trade-offs
                        </div>
                        <p className="text-[12px] leading-relaxed">
                          <EditableNarrative
                            projectId={projectId}
                            plan={plan}
                            path={["team_scenarios", i, "trade_offs"]}
                            editMode={editMode}
                          />
                        </p>
                      </div>
                      {s.roles && s.roles.length > 0 && (
                        <ul className="mt-4 space-y-1.5">
                          {s.roles.map((r, ri) => {
                            const a = AVAILABILITY[r.availability] || AVAILABILITY.internal;
                            return (
                              <li
                                key={`r-${ri}`}
                                className="flex items-start gap-2 text-[12px] text-nu-ink"
                              >
                                <span className="shrink-0">{a.icon}</span>
                                <div className="flex-1">
                                  <span className="font-bold">{r.role}</span>
                                  <span className="text-nu-muted ml-1.5 font-mono-nu text-[10px] uppercase tracking-widest">
                                    {a.label}
                                  </span>
                                  {r.note && (
                                    <div className="text-[11px] text-nu-ink/70 leading-snug">
                                      {r.note}
                                    </div>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <button className="print:hidden mt-5 font-mono-nu text-[11px] uppercase tracking-widest border-[3px] border-nu-ink bg-nu-paper text-nu-ink px-3 py-2 hover:bg-nu-ink hover:text-nu-paper transition-colors font-bold">
                        이 시나리오 선택
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Risks */}
        {plan.risks?.length > 0 && (
          <Section title="리스크 매트릭스" subtitle="카테고리 · 심각도 · 구체적 완화 방안">
            <p className="md:hidden font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted text-center mb-1">
              ← 좌우로 스크롤 →
            </p>
            <div className="-mx-4 px-4 md:mx-0 md:px-0 border-y-[4px] md:border-[4px] border-nu-ink bg-nu-paper overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm border-collapse">
                <thead className="bg-nu-ink text-nu-paper">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-mono-nu text-[10px] uppercase tracking-widest border-r-2 border-nu-paper/20">
                      카테고리
                    </th>
                    <th className="text-left px-3 py-2.5 font-mono-nu text-[10px] uppercase tracking-widest border-r-2 border-nu-paper/20">
                      설명
                    </th>
                    <th className="text-left px-3 py-2.5 font-mono-nu text-[10px] uppercase tracking-widest border-r-2 border-nu-paper/20">
                      심각도
                    </th>
                    <th className="text-left px-3 py-2.5 font-mono-nu text-[10px] uppercase tracking-widest">
                      완화 방안
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plan.risks.map((r, i) => (
                    <tr key={`risk-${i}`} className="border-b-[3px] border-nu-ink last:border-0">
                      <td className="px-3 py-3 font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink whitespace-nowrap border-r-2 border-nu-ink/10 bg-nu-cream/50 font-bold">
                        {r.category}
                      </td>
                      <td className="px-3 py-3 text-nu-ink border-r-2 border-nu-ink/10">
                        {r.description}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap border-r-2 border-nu-ink/10">
                        <span
                          className={`font-mono-nu text-[10px] font-black uppercase tracking-widest px-2 py-1 border-2 ${SEVERITY_CLASS[r.severity] || SEVERITY_CLASS.medium}`}
                        >
                          {SEVERITY_LABEL[r.severity] || r.severity}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-nu-ink/80 leading-relaxed">
                        <EditableNarrative
                          projectId={projectId}
                          plan={plan}
                          path={["risks", i, "mitigation"]}
                          editMode={editMode}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Quick wins */}
        {plan.quick_wins?.length > 0 && (
          <Section title="Quick Wins" subtitle="일정 단축 옵션 · 포기할수록 빨라진다">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plan.quick_wins.map((q, i) => {
                const isStr = typeof q === "string";
                const title = isStr ? (q as string) : (q as any).title;
                const shorten = isStr ? null : (q as any).shortens_weeks;
                const note = isStr ? null : (q as any).note;
                return (
                  <div
                    key={`qw-${i}`}
                    className="border-[4px] border-nu-ink bg-nu-cream p-4 flex gap-3 items-start"
                  >
                    <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink font-black shrink-0">
                      QW{String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-nu-ink leading-relaxed font-bold">
                          {title}
                        </span>
                        {shorten != null && (
                          <span className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 bg-nu-pink text-nu-paper font-black shrink-0">
                            ~{shorten}주 단축
                          </span>
                        )}
                      </div>
                      {note && (
                        <p className="mt-1 text-[11px] text-nu-ink/70 leading-relaxed">
                          {note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Tech stack */}
        {plan.tech_stack?.length > 0 && (
          <Section title="기술 스택" subtitle="Inferred from context">
            <div className="flex flex-wrap gap-2">
              {plan.tech_stack.map((t, i) => (
                <span
                  key={`ts-${i}`}
                  className="font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1 border-2 border-nu-ink bg-nu-paper text-nu-ink font-bold"
                >
                  {t}
                </span>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-3">
        <h2 className="font-head text-2xl font-black text-nu-ink uppercase">{title}</h2>
        {subtitle && (
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function HeroStat({
  icon,
  label,
  value,
  unit,
  bg,
  small = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  bg?: string;
  small?: boolean;
}) {
  return (
    <div className={`border-[4px] border-nu-ink ${bg || "bg-nu-paper"} px-3 py-3 shadow-[4px_4px_0_0_#0D0F14]`}>
      <div className="flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
        {icon}
        {label}
      </div>
      <div
        className={`mt-1 font-head font-black text-nu-ink truncate leading-none ${
          small ? "text-base" : "text-4xl sm:text-5xl"
        }`}
      >
        {value}
        {unit && <span className="font-mono-nu text-sm ml-1 font-bold">{unit}</span>}
      </div>
    </div>
  );
}
