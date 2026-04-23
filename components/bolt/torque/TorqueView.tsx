"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  GraduationCap, Users, Calendar, AlertTriangle,
  MessageSquare, ChevronRight, Clock, FileText,
  CheckCircle2, TrendingUp, Zap, Plus, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { TeamMeetingsThread } from "./meetings/TeamMeetingsThread";
import { ConsultantMeetingsThread } from "./meetings/ConsultantMeetingsThread";
import { RequestQueueThread } from "./RequestQueueThread";
import { DeliverablesThread } from "./DeliverablesThread";

type MemberRole = "owner" | "team" | "consultant" | "observer" | null;

interface TorqueMeta {
  engagement_type: "one_time" | "retainer" | "hybrid";
  started_at: string;
  ended_at: string | null;
  scope_summary: string | null;
  retainer_monthly_hours: number | null;
  retainer_hourly_rate_krw: number | null;
}

interface Props {
  projectId: string;
  projectTitle: string;
  torqueMeta: TorqueMeta | null;
}

// 컨설팅 단계 정의
const CONSULTING_PHASES = [
  { key: "discovery",  label: "발견",  emoji: "🔍", color: "bg-blue-500" },
  { key: "diagnosis",  label: "진단",  emoji: "🩺", color: "bg-orange-500" },
  { key: "proposal",   label: "제안",  emoji: "📋", color: "bg-purple-500" },
  { key: "execution",  label: "실행",  emoji: "⚡", color: "bg-teal-500" },
  { key: "evaluation", label: "평가",  emoji: "📊", color: "bg-green-500" },
] as const;

type ConsultingPhaseKey = typeof CONSULTING_PHASES[number]["key"];

const TABS = [
  { key: "dashboard",   label: "대시보드",  emoji: "📊" },
  { key: "team",        label: "팀 미팅",   emoji: "👥" },
  { key: "consultant",  label: "컨설턴트",  emoji: "🎓" },
  { key: "requests",    label: "요청 큐",   emoji: "📮" },
  { key: "deliverables",label: "산출물",    emoji: "📄" },
] as const;

type TabKey = typeof TABS[number]["key"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function TorqueView({ projectId, projectTitle, torqueMeta: initialMeta }: Props) {
  const [role, setRole]             = useState<MemberRole>(null);
  const [meta, setMeta]             = useState<TorqueMeta | null>(initialMeta);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<TabKey>("dashboard");
  const [userId, setUserId]         = useState<string>("");

  // 대시보드 통계
  const [stats, setStats] = useState({
    pendingRequests: 0,
    highRisks: 0,
    deliverableCount: 0,
    nextSession: null as string | null,
    consultantCount: 0,
    teamCount: 0,
    currentPhase: "discovery" as ConsultingPhaseKey,
  });

  // 컨설팅 단계 (로컬 상태 — 향후 DB 저장)
  const [phase, setPhase] = useState<ConsultingPhaseKey>("discovery");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    // 역할 조회
    const [membershipRes, projectRes] = await Promise.all([
      supabase.from("bolt_memberships").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
      supabase.from("projects").select("created_by").eq("id", projectId).single(),
    ]);

    const myRole: MemberRole =
      projectRes.data?.created_by === user.id ? "owner"
      : (membershipRes.data?.role as MemberRole) ?? "observer";
    setRole(myRole);

    // torque 메타 조회 (initialMeta가 null인 경우)
    if (!initialMeta) {
      const { data: torqueData } = await supabase
        .from("project_torque")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (torqueData) setMeta(torqueData as TorqueMeta);
    }

    // 통계 병렬 조회
    const [reqRes, riskRes, delivRes, sessionRes, memberRes] = await Promise.allSettled([
      supabase.from("consulting_requests")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .in("status", ["submitted", "accepted", "in_progress"]),
      supabase.from("consulting_risks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .gte("likelihood", 3).gte("impact", 3)
        .not("mitigation_status", "in", '("mitigated","closed","accepted")'),
      supabase.from("consulting_deliverables")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId),
      supabase.from("project_meetings_torque")
        .select("scheduled_at")
        .eq("project_id", projectId)
        .eq("track", "consultant")
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at").limit(1),
      supabase.from("bolt_memberships").select("role").eq("project_id", projectId),
    ]);

    setStats({
      pendingRequests: reqRes.status === "fulfilled" ? (reqRes.value.count ?? 0) : 0,
      highRisks: riskRes.status === "fulfilled" ? (riskRes.value.count ?? 0) : 0,
      deliverableCount: delivRes.status === "fulfilled" ? (delivRes.value.count ?? 0) : 0,
      nextSession: (sessionRes.status === "fulfilled" && sessionRes.value.data?.[0]?.scheduled_at) || null,
      consultantCount: memberRes.status === "fulfilled"
        ? (memberRes.value.data as any[])?.filter(m => m.role === "consultant").length ?? 0 : 0,
      teamCount: memberRes.status === "fulfilled"
        ? (memberRes.value.data as any[])?.filter(m => m.role === "owner" || m.role === "team").length ?? 0 : 0,
      currentPhase: phase,
    });

    setLoading(false);
  }, [projectId, phase, initialMeta]);

  useEffect(() => { load(); }, [load]);

  const canEdit = role === "owner" || role === "team";
  const isConsultant = role === "consultant";
  const phaseIdx = CONSULTING_PHASES.findIndex(p => p.key === phase);
  const d = meta ? daysSince(meta.started_at) : null;

  if (loading) return (
    <div className="space-y-4 p-2">
      <div className="h-32 bg-gradient-to-br from-teal-900 to-teal-700 animate-pulse rounded" />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-teal-50 animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-0">
      {/* ══ 헤더 배너 ══ */}
      <div className="bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 text-white p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap size={16} className="text-teal-300" />
            <span className="font-mono-nu text-[11px] uppercase tracking-[0.2em] text-teal-300">
              Torque Bolt · {meta ? { one_time:"일회성", retainer:"리테이너", hybrid:"하이브리드" }[meta.engagement_type] : "컨설팅"}
            </span>
            {d !== null && d >= 0 && (
              <span className="ml-auto font-mono-nu text-[13px] font-bold text-teal-300">D+{d}</span>
            )}
          </div>

          <h2 className="font-head text-2xl font-extrabold text-white mb-1">{projectTitle}</h2>
          {meta?.scope_summary && (
            <p className="text-[13px] text-teal-200/80 mb-4 max-w-xl">{meta.scope_summary}</p>
          )}

          {/* 멤버 현황 */}
          <div className="flex items-center gap-5 text-[12px] text-teal-300">
            <span className="flex items-center gap-1.5"><Users size={12} />팀 {stats.teamCount}명</span>
            <span className="flex items-center gap-1.5"><GraduationCap size={12} />컨설턴트 {stats.consultantCount}명</span>
            {meta?.retainer_monthly_hours && (
              <span className="flex items-center gap-1.5"><Clock size={12} />월 {meta.retainer_monthly_hours}h 계약</span>
            )}
            {/* 내 역할 배지 */}
            {role && (
              <span className={`ml-auto font-mono-nu text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 border ${
                role === "consultant" ? "border-teal-400 bg-teal-400/20 text-teal-200"
                : role === "owner" ? "border-white/30 bg-white/10 text-white"
                : "border-teal-500 bg-teal-500/20 text-teal-200"
              }`}>
                {role === "owner" ? "🔑 오너" : role === "team" ? "👥 팀원" : "🎓 컨설턴트"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ══ 컨설팅 단계 진행 바 ══ */}
      <div className="bg-teal-950 px-6 py-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-1">
          {CONSULTING_PHASES.map((p, idx) => {
            const isActive  = idx === phaseIdx;
            const isDone    = idx < phaseIdx;
            const isNext    = idx === phaseIdx + 1;
            return (
              <div key={p.key} className="flex items-center flex-1">
                <button
                  onClick={() => canEdit && setPhase(p.key)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 transition-all ${
                    isActive  ? "opacity-100" :
                    isDone    ? "opacity-70"  :
                    "opacity-30 cursor-default"
                  } ${canEdit && !isDone ? "hover:opacity-90 cursor-pointer" : ""}`}
                >
                  <span className={`text-base ${isDone ? "grayscale-0" : ""}`}>{p.emoji}</span>
                  <span className={`font-mono-nu text-[9px] uppercase tracking-widest ${
                    isActive ? "text-white font-bold" : "text-teal-400"
                  }`}>{p.label}</span>
                  <div className={`w-full h-1 rounded-full ${
                    isDone ? "bg-teal-400" : isActive ? "bg-white" : "bg-teal-800"
                  }`} />
                </button>
                {idx < CONSULTING_PHASES.length - 1 && (
                  <ArrowRight size={10} className={`shrink-0 mx-0.5 ${isDone ? "text-teal-400" : "text-teal-700"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ 탭 네비게이션 ══ */}
      <div className="max-w-6xl mx-auto flex gap-0 border-b-[2px] border-nu-ink/[0.08] bg-nu-white overflow-x-auto scrollbar-hide">
        {TABS.map(tab => {
          // 팀 미팅은 컨설턴트에게 숨김
          if (tab.key === "team" && isConsultant) return null;
          const badge =
            tab.key === "requests" && stats.pendingRequests > 0 ? stats.pendingRequests :
            tab.key === "deliverables" && stats.deliverableCount > 0 ? stats.deliverableCount :
            null;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`font-mono-nu text-[12px] uppercase tracking-widest px-5 py-3.5 border-b-[3px] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === tab.key
                  ? "border-teal-500 text-teal-700 font-bold bg-teal-50/50"
                  : "border-transparent text-nu-muted hover:text-nu-graphite"
              }`}
            >
              <span>{tab.emoji}</span>{tab.label}
              {badge !== null && (
                <span className={`text-[10px] px-1.5 py-0.5 font-bold ${
                  activeTab === tab.key ? "bg-teal-500 text-white" : "bg-nu-ink/10 text-nu-muted"
                }`}>{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══ 탭 콘텐츠 ══ */}
      <div className="max-w-6xl mx-auto px-0 pb-16">

        {/* 대시보드 탭 */}
        {activeTab === "dashboard" && (
          <div className="space-y-6 pt-6">
            {/* 퀵 스탯 4개 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: "진행 중 요청", value: stats.pendingRequests,
                  sub: "요청 큐", color: stats.pendingRequests > 0 ? "text-nu-amber" : "text-nu-graphite",
                  action: () => setActiveTab("requests"),
                  badge: stats.pendingRequests > 0 ? "urgent" : null,
                },
                {
                  label: "주의 리스크", value: stats.highRisks,
                  sub: "리스크 레지스터", color: stats.highRisks > 0 ? "text-red-600" : "text-nu-graphite",
                  action: null, badge: stats.highRisks > 0 ? "danger" : null,
                },
                {
                  label: "산출물", value: stats.deliverableCount,
                  sub: "라이브러리", color: "text-teal-700",
                  action: () => setActiveTab("deliverables"), badge: null,
                },
                {
                  label: "다음 세션", value: stats.nextSession ? fmtDate(stats.nextSession) : "미정",
                  sub: "컨설턴트 일정", color: stats.nextSession ? "text-nu-blue" : "text-nu-muted",
                  action: () => setActiveTab("consultant"), badge: null,
                },
              ].map(s => (
                <div
                  key={s.label}
                  onClick={() => s.action?.()}
                  className={`bg-nu-white border-[2px] p-4 transition-all ${
                    s.badge === "urgent" ? "border-nu-amber/40 hover:border-nu-amber" :
                    s.badge === "danger" ? "border-red-200 hover:border-red-400" :
                    "border-nu-ink/[0.08] hover:border-teal-300"
                  } ${s.action ? "cursor-pointer" : ""}`}
                >
                  <p className={`font-head text-2xl font-extrabold tabular-nums ${s.color}`}>
                    {s.value}
                  </p>
                  <p className="font-mono-nu text-[11px] text-nu-graphite uppercase tracking-widest mt-0.5">
                    {s.label}
                  </p>
                  <p className="text-[10px] text-nu-muted mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* 현재 단계 설명 */}
            <div className="bg-teal-50 border-[2px] border-teal-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{CONSULTING_PHASES[phaseIdx].emoji}</span>
                <span className="font-mono-nu text-[11px] uppercase tracking-widest text-teal-700 font-bold">
                  현재 단계: {CONSULTING_PHASES[phaseIdx].label}
                </span>
              </div>
              <p className="text-[13px] text-teal-800 leading-relaxed">
                {phase === "discovery"  && "팀의 현황·문제·목표를 컨설턴트가 파악하는 단계. 인터뷰, 자료 수집, 현장 관찰이 주요 활동입니다."}
                {phase === "diagnosis"  && "수집된 데이터를 분석하여 핵심 문제를 특정하는 단계. 구조적 원인과 기회 영역을 도출합니다."}
                {phase === "proposal"   && "진단 결과를 바탕으로 구체적 해결 방안을 제안하는 단계. 로드맵과 우선순위를 정의합니다."}
                {phase === "execution"  && "제안된 방안을 실행하는 단계. 팀과 컨설턴트가 협력하여 변화를 만들어냅니다."}
                {phase === "evaluation" && "실행 결과를 측정하고 학습하는 단계. KPI 달성률을 검토하고 다음 단계를 결정합니다."}
              </p>
              {canEdit && phaseIdx < CONSULTING_PHASES.length - 1 && (
                <button
                  onClick={() => setPhase(CONSULTING_PHASES[phaseIdx + 1].key)}
                  className="mt-3 flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest text-teal-700 hover:text-teal-900 border border-teal-300 px-3 py-1.5 hover:bg-teal-100 transition-colors"
                >
                  다음 단계로 전환 <ArrowRight size={10} />
                </button>
              )}
            </div>

            {/* 역할별 빠른 액션 */}
            <div>
              <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite mb-3 flex items-center gap-1.5">
                <Zap size={11} /> 빠른 액션
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {canEdit && [
                  { icon: MessageSquare, label: "컨설턴트에게 요청", sub: "요청 큐에 새 요청 추가", tab: "requests" as TabKey, primary: true },
                  { icon: Calendar, label: "팀 미팅 예약", sub: "내부 팀 미팅 일정 등록", tab: "team" as TabKey, primary: false },
                  { icon: AlertTriangle, label: "리스크 등록", sub: "새로운 리스크 식별 및 등록", tab: "dashboard" as TabKey, primary: false },
                  { icon: FileText, label: "산출물 확인", sub: `${stats.deliverableCount}개 산출물 라이브러리`, tab: "deliverables" as TabKey, primary: false },
                ].map(a => (
                  <button
                    key={a.label}
                    onClick={() => setActiveTab(a.tab)}
                    className={`flex items-center gap-3 p-4 text-left transition-all ${
                      a.primary
                        ? "bg-teal-700 text-white hover:bg-teal-800"
                        : "border-[2px] border-nu-ink/[0.08] bg-nu-white hover:border-teal-300 hover:bg-teal-50/30"
                    }`}
                  >
                    <a.icon size={16} className={a.primary ? "text-teal-300 shrink-0" : "text-nu-muted shrink-0"} />
                    <div>
                      <p className={`font-mono-nu text-[12px] font-bold uppercase tracking-widest ${a.primary ? "text-white" : "text-nu-graphite"}`}>
                        {a.label}
                      </p>
                      <p className={`text-[11px] mt-0.5 ${a.primary ? "text-teal-200" : "text-nu-muted"}`}>{a.sub}</p>
                    </div>
                    <ChevronRight size={14} className={`ml-auto ${a.primary ? "text-teal-300" : "text-nu-muted"}`} />
                  </button>
                ))}

                {isConsultant && [
                  { icon: GraduationCap, label: "세션 예약", sub: "컨설턴트 세션 일정 등록", tab: "consultant" as TabKey, primary: true },
                  { icon: MessageSquare, label: "요청 큐 확인", sub: `${stats.pendingRequests}개 대기 중`, tab: "requests" as TabKey, primary: false },
                  { icon: FileText, label: "산출물 업로드", sub: "새 산출물 등록", tab: "deliverables" as TabKey, primary: false },
                  { icon: TrendingUp, label: "세션 브리프 작성", sub: "다음 세션 사전 준비", tab: "consultant" as TabKey, primary: false },
                ].map(a => (
                  <button
                    key={a.label}
                    onClick={() => setActiveTab(a.tab)}
                    className={`flex items-center gap-3 p-4 text-left transition-all ${
                      a.primary
                        ? "bg-teal-700 text-white hover:bg-teal-800"
                        : "border-[2px] border-nu-ink/[0.08] bg-nu-white hover:border-teal-300 hover:bg-teal-50/30"
                    }`}
                  >
                    <a.icon size={16} className={a.primary ? "text-teal-300 shrink-0" : "text-nu-muted shrink-0"} />
                    <div>
                      <p className={`font-mono-nu text-[12px] font-bold uppercase tracking-widest ${a.primary ? "text-white" : "text-nu-graphite"}`}>
                        {a.label}
                      </p>
                      <p className={`text-[11px] mt-0.5 ${a.primary ? "text-teal-200" : "text-nu-muted"}`}>{a.sub}</p>
                    </div>
                    <ChevronRight size={14} className={`ml-auto ${a.primary ? "text-teal-300" : "text-nu-muted"}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* 리테이너 계약 정보 */}
            {meta?.retainer_monthly_hours && (
              <div className="border-[2px] border-teal-200 p-5 bg-teal-50/30">
                <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-teal-700 font-bold mb-3">
                  💼 리테이너 계약 현황
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="font-head text-2xl font-extrabold text-teal-700">{meta.retainer_monthly_hours}h</p>
                    <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-0.5">월 계약 시간</p>
                  </div>
                  {meta.retainer_hourly_rate_krw && (
                    <div>
                      <p className="font-head text-2xl font-extrabold text-teal-700">
                        {(meta.retainer_hourly_rate_krw).toLocaleString("ko-KR")}
                      </p>
                      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-0.5">시간당 단가 (원)</p>
                    </div>
                  )}
                  {meta.retainer_monthly_hours && meta.retainer_hourly_rate_krw && (
                    <div>
                      <p className="font-head text-2xl font-extrabold text-teal-700">
                        {((meta.retainer_monthly_hours * meta.retainer_hourly_rate_krw) / 10000).toFixed(0)}만
                      </p>
                      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-0.5">월 계약액 (원)</p>
                    </div>
                  )}
                </div>
                {meta.started_at && (
                  <p className="text-[12px] text-nu-muted mt-3">
                    계약 시작: {fmtDate(meta.started_at)}
                    {meta.ended_at ? ` → 종료: ${fmtDate(meta.ended_at)}` : " (진행 중)"}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 팀 미팅 탭 */}
        {activeTab === "team" && !isConsultant && (
          <div className="pt-6">
            <TeamMeetingsThread
              projectId={projectId}
              userId={userId}
              canEdit={canEdit}
            />
          </div>
        )}

        {/* 컨설턴트 세션 탭 */}
        {activeTab === "consultant" && (
          <div className="pt-6">
            <ConsultantMeetingsThread
              projectId={projectId}
              userId={userId}
              userRole={role ?? undefined}
              canEdit={canEdit || isConsultant}
            />
          </div>
        )}

        {/* 요청 큐 탭 */}
        {activeTab === "requests" && (
          <div className="pt-6">
            <RequestQueueThread
              projectId={projectId}
              userId={userId}
              userRole={role ?? undefined}
              retainerMonthlyHours={meta?.retainer_monthly_hours}
            />
          </div>
        )}

        {/* 산출물 탭 */}
        {activeTab === "deliverables" && (
          <div className="pt-6">
            <DeliverablesThread
              projectId={projectId}
              userId={userId}
              canEdit={canEdit || isConsultant}
            />
          </div>
        )}
      </div>
    </div>
  );
}
