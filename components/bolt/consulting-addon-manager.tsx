"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  GraduationCap, MessageSquare, FileText, AlertTriangle,
  TrendingUp, DollarSign, BookOpen, Bot, Calendar,
  CheckCircle2, Plus, Trash2, Loader2, Lock,
} from "lucide-react";

// ── 모듈 정의 ──────────────────────────────────────────────
export interface ConsultingModule {
  key: string;
  label: string;
  labelEn: string;
  description: string;
  icon: React.ElementType;
  color: string;          // 카드 배경
  accentColor: string;    // 아이콘 색
  borderColor: string;
  tier: "free" | "pro";   // 향후 tier 분기용
  category: "communication" | "deliverable" | "tracking" | "ai";
}

const CONSULTING_MODULES: ConsultingModule[] = [
  {
    key: "consultant-sessions",
    label: "컨설턴트 세션",
    labelEn: "Consultant Sessions",
    description: "외부 컨설턴트와의 세션 일정·안건·브리프를 구조화합니다. Discovery·진단·제안·리뷰·체크인 5가지 세션 유형 지원.",
    icon: GraduationCap,
    color: "bg-teal-50", accentColor: "text-teal-600", borderColor: "border-teal-300",
    tier: "free", category: "communication",
  },
  {
    key: "request-queue",
    label: "요청 큐",
    labelEn: "Request Queue",
    description: "팀 → 컨설턴트 방향의 업무 요청을 구조화. 긴급도·유형·소요 시간 추적. 컨설턴트가 직접 수락/거절 처리.",
    icon: MessageSquare,
    color: "bg-orange-50", accentColor: "text-orange-600", borderColor: "border-orange-300",
    tier: "free", category: "communication",
  },
  {
    key: "deliverables",
    label: "산출물 라이브러리",
    labelEn: "Deliverables",
    description: "제안서·분석보고서·플레이북 등 컨설팅 산출물을 버전 관리. Draft→Review→Approved→Delivered 스테이지 워크플로우.",
    icon: FileText,
    color: "bg-blue-50", accentColor: "text-blue-600", borderColor: "border-blue-300",
    tier: "free", category: "deliverable",
  },
  {
    key: "risk-register",
    label: "리스크 레지스터",
    labelEn: "Risk Register",
    description: "컨설팅 과정에서 식별되는 리스크를 5×5 매트릭스로 관리. 심각도·가능성·대응 상태 추적.",
    icon: AlertTriangle,
    color: "bg-red-50", accentColor: "text-red-600", borderColor: "border-red-300",
    tier: "free", category: "tracking",
  },
  {
    key: "decision-log",
    label: "의사결정 로그",
    labelEn: "Decision Log",
    description: "컨설팅 중 내려진 주요 결정을 DEC-001 형식으로 기록. 맥락·대안·선택 근거·후속 영향 포함.",
    icon: BookOpen,
    color: "bg-purple-50", accentColor: "text-purple-600", borderColor: "border-purple-300",
    tier: "free", category: "tracking",
  },
  {
    key: "kpi-dashboard",
    label: "KPI 대시보드",
    labelEn: "KPI Dashboard",
    description: "컨설팅 목표 KPI를 정의하고 달성률을 추적. 팀·컨설턴트 모두 실시간 현황 공유.",
    icon: TrendingUp,
    color: "bg-green-50", accentColor: "text-green-600", borderColor: "border-green-300",
    tier: "free", category: "tracking",
  },
  {
    key: "retainer-meter",
    label: "리테이너 소진 미터",
    labelEn: "Retainer Meter",
    description: "월 계약 시간과 시간당 단가를 기반으로 소진율을 실시간 추적. 초과 경고 알림 포함.",
    icon: DollarSign,
    color: "bg-amber-50", accentColor: "text-amber-600", borderColor: "border-amber-300",
    tier: "free", category: "tracking",
  },
  {
    key: "team-meetings",
    label: "팀 내부 미팅",
    labelEn: "Team Meetings",
    description: "컨설턴트에게 공개하지 않는 내부 팀 미팅 트랙. 공유 여부를 미팅별로 개별 설정 가능.",
    icon: Calendar,
    color: "bg-slate-50", accentColor: "text-slate-600", borderColor: "border-slate-300",
    tier: "free", category: "communication",
  },
  {
    key: "ai-copilot",
    label: "AI Copilot",
    labelEn: "AI Copilot",
    description: "컨설팅 맥락(세션·요청·리스크)을 기반으로 AI가 다음 단계를 제안. 팀용·컨설턴트용 각각 제공.",
    icon: Bot,
    color: "bg-indigo-50", accentColor: "text-indigo-600", borderColor: "border-indigo-300",
    tier: "pro", category: "ai",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  communication: "🗣 커뮤니케이션",
  deliverable: "📄 산출물",
  tracking: "📊 추적 & 분석",
  ai: "🤖 AI",
};

interface Props {
  projectId: string;
  canEdit: boolean;
}

interface InstalledAddon {
  key: string;
  installed_at: string;
}

export function ConsultingAddonManager({ projectId, canEdit }: Props) {
  const [installed, setInstalled]   = useState<InstalledAddon[]>([]);
  const [loading, setLoading]       = useState(true);
  const [toggling, setToggling]     = useState<string | null>(null);
  const [activeCategory, setCategory] = useState<string>("all");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("project_consulting_addons")
      .select("key, installed_at")
      .eq("project_id", projectId);
    setInstalled(data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const isInstalled = (key: string) => installed.some(i => i.key === key);

  async function toggleModule(mod: ConsultingModule) {
    if (!canEdit) { toast.error("편집 권한이 없습니다"); return; }
    setToggling(mod.key);
    const supabase = createClient();

    if (isInstalled(mod.key)) {
      // 비활성화
      const { error } = await supabase
        .from("project_consulting_addons")
        .delete()
        .eq("project_id", projectId)
        .eq("key", mod.key);
      if (error) { toast.error("제거 실패: " + error.message); }
      else {
        setInstalled(prev => prev.filter(i => i.key !== mod.key));
        toast.success(`${mod.label} 모듈을 제거했습니다`);
      }
    } else {
      // 활성화
      const { error } = await supabase
        .from("project_consulting_addons")
        .insert({ project_id: projectId, key: mod.key });
      if (error) { toast.error("설치 실패: " + error.message); }
      else {
        setInstalled(prev => [...prev, { key: mod.key, installed_at: new Date().toISOString() }]);
        toast.success(`✅ ${mod.label} 모듈이 활성화됐습니다`);
      }
    }
    setToggling(null);
  }

  const categories = ["all", "communication", "deliverable", "tracking", "ai"];
  const filtered = activeCategory === "all"
    ? CONSULTING_MODULES
    : CONSULTING_MODULES.filter(m => m.category === activeCategory);

  const installedCount = installed.length;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-center gap-2">
            🧩 컨설팅 모듈
          </h2>
          <p className="text-[13px] text-nu-muted mt-1">
            기존 볼트에 컨설팅 기능을 모듈 단위로 추가합니다.
            {installedCount > 0 && (
              <span className="ml-1 font-bold text-teal-700">{installedCount}개 활성화됨</span>
            )}
          </p>
        </div>
      </div>

      {/* 활성화된 모듈 요약 */}
      {installedCount > 0 && (
        <div className="bg-teal-50 border-[2px] border-teal-200 p-4">
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-teal-700 font-bold mb-3">
            ✅ 활성화된 모듈 ({installedCount}개)
          </p>
          <div className="flex flex-wrap gap-2">
            {installed.map(addon => {
              const mod = CONSULTING_MODULES.find(m => m.key === addon.key);
              if (!mod) return null;
              return (
                <div key={addon.key}
                  className="flex items-center gap-1.5 bg-white border border-teal-200 px-2.5 py-1.5">
                  <mod.icon size={12} className={mod.accentColor} />
                  <span className="font-mono-nu text-[11px] font-bold text-nu-graphite">{mod.label}</span>
                  {canEdit && (
                    <button
                      onClick={() => toggleModule(mod)}
                      disabled={toggling === mod.key}
                      className="ml-1 text-nu-muted hover:text-red-500 transition-colors"
                    >
                      {toggling === mod.key
                        ? <Loader2 size={10} className="animate-spin" />
                        : <Trash2 size={10} />
                      }
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 카테고리 필터 */}
      <div className="flex gap-1 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
              activeCategory === cat
                ? "bg-nu-ink text-nu-paper border-nu-ink"
                : "border-nu-ink/20 text-nu-muted hover:border-nu-ink/40 hover:text-nu-graphite"
            }`}
          >
            {cat === "all" ? "전체" : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* 모듈 그리드 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 bg-nu-ink/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(mod => {
            const active = isInstalled(mod.key);
            const busy   = toggling === mod.key;
            return (
              <div
                key={mod.key}
                className={`border-[2px] p-4 transition-all relative ${
                  active
                    ? `${mod.borderColor} ${mod.color}`
                    : "border-nu-ink/10 bg-nu-white hover:border-nu-ink/20"
                }`}
              >
                {/* 활성 뱃지 */}
                {active && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 size={16} className={mod.accentColor} />
                  </div>
                )}

                {/* Pro 뱃지 */}
                {mod.tier === "pro" && (
                  <div className="absolute top-3 right-3 flex items-center gap-0.5 bg-indigo-100 px-1.5 py-0.5">
                    <Lock size={8} className="text-indigo-500" />
                    <span className="font-mono-nu text-[8px] uppercase tracking-widest text-indigo-600 font-bold">Pro</span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 flex items-center justify-center ${mod.color} border ${mod.borderColor}`}>
                    <mod.icon size={14} className={mod.accentColor} />
                  </div>
                  <div>
                    <p className={`font-head text-[13px] font-extrabold ${active ? mod.accentColor : "text-nu-ink"}`}>
                      {mod.label}
                    </p>
                    <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
                      {mod.labelEn}
                    </p>
                  </div>
                </div>

                <p className="text-[12px] text-nu-graphite leading-relaxed mb-4">
                  {mod.description}
                </p>

                {canEdit ? (
                  <button
                    onClick={() => toggleModule(mod)}
                    disabled={busy}
                    className={`w-full flex items-center justify-center gap-1.5 font-mono-nu text-[11px] font-bold uppercase tracking-widest py-2 transition-all ${
                      active
                        ? `border border-current ${mod.accentColor} hover:bg-white`
                        : "bg-nu-ink text-nu-paper hover:bg-nu-graphite"
                    } disabled:opacity-50`}
                  >
                    {busy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : active ? (
                      <><Trash2 size={12} />비활성화</>
                    ) : (
                      <><Plus size={12} />모듈 추가</>
                    )}
                  </button>
                ) : (
                  <div className="text-[11px] text-nu-muted text-center py-1">
                    {active ? "✅ 활성화됨" : "비활성"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 안내 */}
      <div className="bg-nu-cream/30 border border-nu-ink/[0.06] p-4 text-[12px] text-nu-muted leading-relaxed">
        💡 모듈을 추가하면 해당 기능이 볼트 대시보드에 즉시 반영됩니다.
        모든 모듈은 언제든 비활성화할 수 있으며, 데이터는 보존됩니다.
      </div>
    </div>
  );
}
