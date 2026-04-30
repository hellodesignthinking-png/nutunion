"use client";

/**
 * GenesisFlow — "Genesis AI" 로 공간을 설계하는 모달/섹션.
 *
 * 3 steps:
 *   1) intent 입력
 *   2) plan preview + 팀매칭
 *   3) provisioning → redirect
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Check, ArrowRight, Wand2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { matchesDevIntent, type DevPlan } from "@/lib/genesis/dev-plan-schema";
import { DevPlanPreview } from "./dev-plan-preview";

interface WikiPagePlan {
  title: string;
  outline: string;
}
interface PhasePlan {
  name: string;
  goal: string;
  duration_days: number | null;
  wiki_pages: WikiPagePlan[];
  milestones: string[];
}
interface RolePlan {
  role_name: string;
  specialty_tags: string[];
  why: string;
}
interface GenesisPlan {
  title: string;
  summary: string;
  category: string;
  phases: PhasePlan[];
  suggested_roles: RolePlan[];
  resources_folders: string[];
  first_tasks: string[];
}
interface TeamCandidate {
  profile_id: string;
  nickname: string;
  avatar_url: string | null;
  specialty: string | null;
  match_reasons: string[];
  score: number;
}
interface TeamMatch {
  role_name: string;
  why: string;
  candidates: TeamCandidate[];
}

const EXAMPLES_GROUP = [
  "브랜딩 디자인 스터디",
  "한남동 로컬크리에이터 모임",
  "주 1회 논문 읽기 모임",
];
const EXAMPLES_PROJECT = [
  "전통시장 활성화 스타트업",
  "창전동 빌딩 매각 관리",
  "팝업스토어 8주 운영",
];

const LOADING_MESSAGES = [
  "의도 분석 중...",
  "Phase 구성 중...",
  "위키 템플릿 작성 중...",
  "팀원 매칭 중...",
];

export function GenesisFlow({ kind }: { kind: "group" | "project" }) {
  const router = useRouter();
  const [step, setStep] = useState<"intent" | "preview" | "provisioning">("intent");
  const [intent, setIntent] = useState("");
  const [plan, setPlan] = useState<GenesisPlan | null>(null);
  const [modelUsed, setModelUsed] = useState<string>("");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionStep, setProvisionStep] = useState<string>("너트 생성 준비...");
  const [provisionFailures, setProvisionFailures] = useState<Array<{ step: string; error: string }>>([]);

  // Selection state (dropped indices)
  const [dropPhase, setDropPhase] = useState<Set<number>>(new Set());
  const [dropRole, setDropRole] = useState<Set<number>>(new Set());
  const [dropTask, setDropTask] = useState<Set<number>>(new Set());

  // Team matching
  const [teamMatches, setTeamMatches] = useState<TeamMatch[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  // Dev plan mode (project only)
  const [devMode, setDevMode] = useState<boolean>(false);
  const [devModeTouched, setDevModeTouched] = useState<boolean>(false);
  const [devPlan, setDevPlan] = useState<DevPlan | null>(null);
  const [lastIntentForPlan, setLastIntentForPlan] = useState<string>("");

  // Auto-detect dev intent unless user toggled manually
  useEffect(() => {
    if (kind !== "project" || devModeTouched) return;
    setDevMode(matchesDevIntent(intent));
  }, [intent, kind, devModeTouched]);

  // rotating loading messages
  useEffect(() => {
    if (!loadingPlan) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 900);
    return () => clearInterval(t);
  }, [loadingPlan]);

  async function generatePlan() {
    if (!intent.trim()) {
      toast.error("한 줄 의도를 입력해주세요");
      return;
    }
    setLoadingPlan(true);
    try {
      // Dev plan branch — project + toggle ON
      if (kind === "project" && devMode) {
        const res = await fetch("/api/genesis/dev-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intent: intent.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "AI 오류");
        setDevPlan(data.plan);
        setModelUsed(data.model_used || "");
        setLastIntentForPlan(intent.trim());
        setStep("preview");
        return;
      }

      const res = await fetch("/api/genesis/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: intent.trim(), kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 오류");
      setPlan(data.plan);
      setModelUsed(data.model_used || "");
      setDropPhase(new Set());
      setDropRole(new Set());
      setDropTask(new Set());
      setDevPlan(null);
      setLastIntentForPlan(intent.trim());
      setStep("preview");
    } catch (err: any) {
      toast.error(err?.message || "계획 생성 실패");
    } finally {
      setLoadingPlan(false);
    }
  }

  /** Dev-plan provision: minimal regular plan → /provision → attach dev_plan → redirect to dev-plan page */
  async function provisionDevPlan(selectedScenario: string) {
    if (!devPlan) return;
    setProvisioning(true);
    setStep("provisioning");
    setProvisionFailures([]);

    const stepMessages = [
      "볼트 생성 중...",
      "개발 로드맵 첨부 중...",
      "Gantt 구성 중...",
      "완료 검증 중...",
    ];
    let stepIdx = 0;
    setProvisionStep(stepMessages[0]);
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, stepMessages.length - 1);
      setProvisionStep(stepMessages[stepIdx]);
    }, 1200);

    try {
      // 1) Bootstrap a minimal regular genesis plan shape for provisioning
      const minimalPlan = {
        title: devPlan.project_name,
        summary: devPlan.mvp_target,
        category: "개발",
        phases: (devPlan.gantt || []).slice(0, 6).map((g, i) => ({
          name: `Week ${g.week}`,
          goal: g.milestones.join(" · ") || `주차 ${g.week}`,
          duration_days: 7,
          wiki_pages: [],
          milestones: g.milestones || [],
        })),
        suggested_roles: [],
        resources_folders: ["specs", "design", "evidence"],
        first_tasks: (devPlan.quick_wins || []).slice(0, 5),
      };

      const provRes = await fetch("/api/genesis/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "project",
          plan: minimalPlan,
          intent: `${intent} (선택 시나리오: ${selectedScenario})`,
          model_used: modelUsed,
          team_invites: [],
        }),
      });
      const provData = await provRes.json();
      if (!provRes.ok || !provData.verified) {
        clearInterval(stepTimer);
        setProvisionFailures(provData.failures || []);
        throw new Error(provData.error || "볼트 생성 실패");
      }
      const projectId = provData.project_id || provData.target_id;

      // 2) Attach already-generated dev plan to the new project (skip re-LLM)
      setProvisionStep("개발 로드맵 첨부 중...");
      await fetch("/api/genesis/dev-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, plan: devPlan }),
      });

      clearInterval(stepTimer);
      toast.success("개발 로드맵 볼트가 생성되었습니다");
      router.push(`/projects/${projectId}/dev-plan`);
    } catch (err: any) {
      clearInterval(stepTimer);
      toast.error(err?.message || "프로비저닝 실패");
      setStep("preview");
    } finally {
      setProvisioning(false);
    }
  }

  async function findTeam() {
    if (!plan) return;
    setMatchLoading(true);
    try {
      const res = await fetch("/api/genesis/match-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      setTeamMatches(data.matches || []);
      if ((data.matches || []).every((m: TeamMatch) => m.candidates.length === 0)) {
        toast.info("매칭 가능한 회원이 없어요. 나중에 직접 초대해주세요.");
      }
    } catch (err: any) {
      toast.error(err?.message || "팀매칭 실패");
    } finally {
      setMatchLoading(false);
    }
  }

  async function provision() {
    if (!plan) return;
    // filter plan by dropped selections
    const filtered: GenesisPlan = {
      ...plan,
      phases: plan.phases.filter((_, i) => !dropPhase.has(i)),
      suggested_roles: plan.suggested_roles.filter((_, i) => !dropRole.has(i)),
      first_tasks: plan.first_tasks.filter((_, i) => !dropTask.has(i)),
    };
    setProvisioning(true);
    setStep("provisioning");
    setProvisionFailures([]);

    // Optimistic step-by-step progress indicator (actual work is server-side)
    const stepMessages = [
      kind === "group" ? "너트 생성 중..." : "볼트 생성 중...",
      "위키/마일스톤 구성 중...",
      "Task 등록 중...",
      "자료실 폴더 스캐폴딩 중...",
      "멤버 초대 중...",
      "검증 중...",
    ];
    let stepIdx = 0;
    setProvisionStep(stepMessages[0]);
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, stepMessages.length - 1);
      setProvisionStep(stepMessages[stepIdx]);
    }, 1200);

    try {
      const res = await fetch("/api/genesis/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          plan: filtered,
          intent,
          model_used: modelUsed,
          team_invites: Array.from(invitedIds),
        }),
      });
      const data = await res.json();
      clearInterval(stepTimer);
      if (!res.ok) {
        setProvisionFailures(data.failures || []);
        throw new Error(data.error || "프로비저닝 실패");
      }
      const s = data.summary || {};
      const fails = Array.isArray(data.failures) ? data.failures : [];
      const id = data[`${kind}_id`] || data.target_id;

      if (!data.verified) {
        toast.error(`생성 검증 실패 — ${kind === "group" ? "너트" : "볼트"}가 DB에 저장되지 않았습니다.`);
        setProvisionFailures(fails);
        setStep("preview");
        return;
      }

      if (fails.length > 0) {
        toast.warning(
          `부분 성공 — 위키 ${s.wikis_created || 0} · 과제 ${s.tasks_created || 0} · 초대 ${s.members_invited || 0} (실패 ${fails.length}건)`,
          { duration: 6000 },
        );
        setProvisionFailures(fails);
      } else {
        toast.success(
          `생성 완료 — 위키 ${s.wikis_created || 0} · 과제 ${s.tasks_created || 0} · 초대 ${s.members_invited || 0}`,
        );
      }
      router.push(kind === "group" ? `/groups/${id}` : `/projects/${id}`);
    } catch (err: any) {
      clearInterval(stepTimer);
      toast.error(err?.message || "프로비저닝 실패");
      setStep("preview");
    } finally {
      setProvisioning(false);
    }
  }

  function toggleInvite(id: string) {
    setInvitedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSet(set: Set<number>, setFn: (s: Set<number>) => void, i: number) {
    const n = new Set(set);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    setFn(n);
  }

  const EXAMPLES = kind === "group" ? EXAMPLES_GROUP : EXAMPLES_PROJECT;

  /* ── Provisioning state ─────────────────────────────────────── */
  if (step === "provisioning") {
    return (
      <div className="border-2 border-nu-ink bg-nu-ink text-white p-10 min-h-[400px] flex flex-col items-center justify-center">
        <div className="flex items-center gap-3 mb-6">
          <Wand2 size={24} className="animate-pulse text-nu-pink" />
          <span className="font-mono-nu text-[11px] uppercase tracking-[0.25em] text-white/50">
            GENESIS AI
          </span>
        </div>
        <h2 className="font-head text-2xl font-black mb-2">AI 가 공간을 설계 중...</h2>
        <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink">
          {provisionStep}
        </p>
        <div className="mt-8 w-48 h-1 bg-white/10 overflow-hidden">
          <div className="h-full bg-nu-pink animate-pulse" style={{ width: "70%" }} />
        </div>
        {provisionFailures.length > 0 && (
          <div className="mt-6 max-w-md w-full border border-red-400/40 bg-red-900/20 p-3">
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-red-300 mb-2">
              ⚠ {provisionFailures.length} 단계 실패
            </p>
            <ul className="text-[11px] text-red-200 space-y-0.5 max-h-32 overflow-y-auto">
              {provisionFailures.map((f, i) => (
                <li key={i}>• <b>{f.step}</b>: {f.error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  /* ── Preview step — Dev Plan branch ──────────────────────────── */
  if (step === "preview" && devPlan) {
    return (
      <DevPlanPreview
        plan={devPlan}
        provisioning={provisioning}
        onBack={() => {
          setStep("intent");
          setDevPlan(null);
        }}
        onProvision={(scenario) => provisionDevPlan(scenario)}
      />
    );
  }

  /* ── Preview step ────────────────────────────────────────────── */
  if (step === "preview" && plan) {
    return (
      <div className="border-2 border-nu-ink/[0.08] bg-nu-white">
        <div className="p-6 border-b-2 border-nu-ink/[0.06] bg-gradient-to-br from-nu-pink/[0.04] to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={12} className="text-nu-pink" />
            <span className="font-mono-nu text-[10px] uppercase tracking-[0.2em] text-nu-pink font-bold">
              GENESIS AI PLAN
            </span>
            {modelUsed && (
              <span className="font-mono-nu text-[9px] text-nu-muted ml-auto">
                {modelUsed}
              </span>
            )}
          </div>
          <h1 className="font-head text-2xl font-black text-nu-ink mb-2">{plan.title}</h1>
          <p className="text-[13px] text-nu-gray leading-relaxed">{plan.summary}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-nu-ink text-nu-paper">
              {plan.category}
            </span>
          </div>
        </div>

        {/* Phases */}
        <div className="p-6 border-b border-nu-ink/[0.06]">
          <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray mb-4">
            📍 단계 ({plan.phases.length - dropPhase.size}/{plan.phases.length} 선택)
          </h3>
          <div className="space-y-3">
            {plan.phases.map((phase, i) => {
              const dropped = dropPhase.has(i);
              return (
                <div
                  key={i}
                  className={`border transition-all ${
                    dropped
                      ? "border-nu-ink/10 bg-nu-paper opacity-50"
                      : "border-nu-ink/20 bg-nu-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSet(dropPhase, setDropPhase, i)}
                    className="w-full flex items-start gap-3 p-3 text-left"
                  >
                    <div
                      className={`w-5 h-5 shrink-0 mt-0.5 border flex items-center justify-center ${
                        dropped
                          ? "border-nu-ink/20 bg-transparent"
                          : "bg-nu-ink border-nu-ink text-white"
                      }`}
                    >
                      {!dropped && <Check size={10} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-head text-[14px] font-bold text-nu-ink">
                          {phase.name}
                        </span>
                        {phase.duration_days && (
                          <span className="font-mono-nu text-[10px] px-1.5 py-0.5 bg-nu-ink/[0.06] text-nu-gray">
                            {phase.duration_days}일
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-nu-gray mt-1">{phase.goal}</p>
                      {phase.wiki_pages.length > 0 && !dropped && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {phase.wiki_pages.map((wp, j) => (
                            <span
                              key={j}
                              className="font-mono-nu text-[10px] px-1.5 py-0.5 bg-nu-blue/10 text-nu-blue"
                            >
                              📄 {wp.title}
                            </span>
                          ))}
                        </div>
                      )}
                      {phase.milestones.length > 0 && !dropped && (
                        <ul className="mt-2 text-[12px] text-nu-muted space-y-0.5">
                          {phase.milestones.map((m, j) => (
                            <li key={j}>• {m}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Suggested roles */}
        {plan.suggested_roles.length > 0 && (
          <div className="p-6 border-b border-nu-ink/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray">
                👥 추천 역할 ({plan.suggested_roles.length - dropRole.size}/{plan.suggested_roles.length})
              </h3>
              <button
                type="button"
                onClick={findTeam}
                disabled={matchLoading}
                className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border border-nu-pink text-nu-pink hover:bg-nu-pink hover:text-white transition-colors disabled:opacity-50"
              >
                {matchLoading ? <Loader2 size={11} className="animate-spin" /> : <Users size={11} />}
                팀원 찾기
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {plan.suggested_roles.map((role, i) => {
                const dropped = dropRole.has(i);
                const match = teamMatches.find((m) => m.role_name === role.role_name);
                return (
                  <div
                    key={i}
                    className={`border p-3 transition-all ${
                      dropped ? "border-nu-ink/10 bg-nu-paper opacity-50" : "border-nu-ink/20"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSet(dropRole, setDropRole, i)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className={`w-4 h-4 border flex items-center justify-center ${
                            dropped ? "border-nu-ink/20" : "bg-nu-ink border-nu-ink text-white"
                          }`}
                        >
                          {!dropped && <Check size={8} />}
                        </div>
                        <span className="font-head text-[13px] font-bold text-nu-ink">
                          {role.role_name}
                        </span>
                      </div>
                      <p className="text-[11px] text-nu-muted ml-6">{role.why}</p>
                      <div className="mt-1 ml-6 flex flex-wrap gap-1">
                        {role.specialty_tags.map((t, j) => (
                          <span
                            key={j}
                            className="font-mono-nu text-[9px] px-1 py-0.5 bg-nu-ink/[0.05] text-nu-gray"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </button>
                    {match && match.candidates.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-nu-ink/[0.06] space-y-1.5">
                        {match.candidates.map((c) => (
                          <button
                            key={c.profile_id}
                            type="button"
                            onClick={() => toggleInvite(c.profile_id)}
                            className={`w-full flex items-center gap-2 p-1.5 border text-left transition-colors ${
                              invitedIds.has(c.profile_id)
                                ? "border-nu-green bg-nu-green/10"
                                : "border-nu-ink/10 hover:border-nu-ink/25"
                            }`}
                          >
                            <div className="w-6 h-6 bg-nu-ink/10 flex items-center justify-center font-bold text-[10px] text-nu-ink overflow-hidden">
                              {c.avatar_url ? (
                                <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                c.nickname?.[0]?.toUpperCase()
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-nu-ink truncate">
                                {c.nickname}
                              </p>
                              {c.match_reasons.length > 0 && (
                                <p className="text-[9px] text-nu-muted truncate">
                                  {c.match_reasons.slice(0, 2).join(" · ")}
                                </p>
                              )}
                            </div>
                            {invitedIds.has(c.profile_id) ? (
                              <Check size={10} className="text-nu-green shrink-0" />
                            ) : (
                              <UserPlus size={10} className="text-nu-muted shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* First tasks */}
        {plan.first_tasks.length > 0 && (
          <div className="p-6 border-b border-nu-ink/[0.06]">
            <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray mb-4">
              ⚡ 즉시 착수 과제 ({plan.first_tasks.length - dropTask.size}/{plan.first_tasks.length})
            </h3>
            <div className="space-y-1.5">
              {plan.first_tasks.map((t, i) => {
                const dropped = dropTask.has(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleSet(dropTask, setDropTask, i)}
                    className={`w-full flex items-start gap-2 p-2 text-left border ${
                      dropped
                        ? "border-nu-ink/10 bg-nu-paper opacity-50"
                        : "border-nu-ink/15 hover:border-nu-ink/30"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 mt-0.5 shrink-0 border flex items-center justify-center ${
                        dropped ? "border-nu-ink/20" : "bg-nu-ink border-nu-ink text-white"
                      }`}
                    >
                      {!dropped && <Check size={8} />}
                    </div>
                    <span className="text-[12px] text-nu-ink">{t}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Resources folders */}
        {plan.resources_folders.length > 0 && (
          <div className="p-6 border-b border-nu-ink/[0.06]">
            <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray mb-3">
              📁 추천 폴더 구조
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {plan.resources_folders.map((f, i) => (
                <span
                  key={i}
                  className="font-mono text-[11px] px-2 py-1 bg-nu-paper border border-nu-ink/15 text-nu-gray"
                >
                  /{f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setStep("intent");
              setPlan(null);
              setTeamMatches([]);
              setInvitedIds(new Set());
            }}
            className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors"
          >
            ← 다시 작성
          </button>
          <button
            type="button"
            onClick={provision}
            disabled={provisioning}
            className="flex items-center gap-2 font-mono-nu text-[13px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-50"
          >
            🏗️ 이 공간으로 만들기
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    );
  }

  /* ── Intent step ─────────────────────────────────────────────── */
  return (
    <div className="border-2 border-nu-ink/[0.08] bg-nu-white p-8">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={14} className="text-nu-pink" />
        <span className="font-mono-nu text-[11px] uppercase tracking-[0.2em] text-nu-pink font-bold">
          GENESIS AI
        </span>
      </div>
      <h2 className="font-head text-2xl font-black text-nu-ink mb-2">
        어떤 {kind === "group" ? "너트" : "볼트"}를 만들고 싶으세요?
      </h2>
      <p className="text-[13px] text-nu-gray mb-6">
        한 줄이면 충분합니다. AI 가 로드맵·위키·팀원까지 자동 설계합니다.
      </p>

      <textarea
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder={`예: ${EXAMPLES[0]}`}
        className="w-full px-4 py-3 border-2 border-nu-ink/15 bg-transparent text-[14px] focus:outline-none focus:border-nu-pink transition-colors resize-none"
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIntent(ex)}
            className="font-mono-nu text-[11px] px-2.5 py-1 border border-nu-ink/15 bg-nu-paper hover:border-nu-pink hover:text-nu-pink transition-colors text-nu-gray"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Dev Plan mode toggle — project only */}
      {kind === "project" && (
        <div className="mt-5 border-[3px] border-nu-ink bg-nu-ink text-nu-paper p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="font-head text-[14px] font-black mb-1">🛠️ 개발 로드맵 모드</p>
              <p className="text-[12px] text-nu-paper/75 leading-relaxed">
                플랫폼/앱/서비스 개발 프로젝트라면 SecondWind 수준의 상세 개발 일정을 자동
                생성합니다 — 전략 결정 · 공수 분해 · 주간 Gantt · 리스크 매트릭스 포함
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDevModeTouched(true);
                setDevMode((v) => !v);
              }}
              aria-pressed={devMode}
              className={`shrink-0 w-12 h-7 border-2 border-nu-paper/60 relative transition-colors ${
                devMode ? "bg-nu-pink" : "bg-transparent"
              }`}
            >
              <span
                className={`absolute top-[2px] w-4 h-4 bg-nu-paper transition-all ${
                  devMode ? "left-[26px]" : "left-[2px]"
                }`}
              />
            </button>
          </div>
          {devMode && (
            <p className="mt-2 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
              ✔ 활성화됨 — /api/genesis/dev-plan 호출
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={generatePlan}
        disabled={loadingPlan || !intent.trim()}
        className="mt-6 w-full flex items-center justify-center gap-2 font-mono-nu text-[13px] font-bold uppercase tracking-widest py-3.5 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-40"
      >
        {loadingPlan ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            {loadingMsg}
          </>
        ) : kind === "project" && devMode ? (
          <>
            <Sparkles size={13} />
            🛠️ 개발 로드맵 생성
          </>
        ) : (
          <>
            <Sparkles size={13} />
            ✨ 계획 생성
          </>
        )}
      </button>
    </div>
  );
}
