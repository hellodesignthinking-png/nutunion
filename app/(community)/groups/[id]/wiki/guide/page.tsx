import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Brain,
  Sparkles,
  GitBranch,
  BookOpen,
  BarChart3,
  Zap,
  Users,
  Trophy,
  FileText,
  ArrowRight,
  Lightbulb,
  Calendar,
  Target,
  Shield,
  Layers,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wiki Guide — nutunion",
  description: "Living Wiki AI 지식 통합 기능 사용 가이드",
};

export default async function WikiGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: group } = await supabase.from("groups").select("name, host_id").eq("id", id).single();
  if (!group) notFound();

  const isHost = group.host_id === user.id;

  return (
    <div className="min-h-screen bg-nu-paper">
      {/* Hero */}
      <div className="border-b-[3px] border-nu-ink bg-gradient-to-br from-nu-cream/50 via-white to-nu-cream/30 relative overflow-hidden">
        <div className="absolute -right-32 -top-32 w-96 h-96 bg-nu-pink/[0.03] rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #0d0d0d 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 md:py-12 relative z-10">
          <div className="flex items-center gap-2 font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mb-6">
            <Link href={`/groups/${id}`} className="hover:text-nu-ink no-underline transition-colors">{group.name}</Link>
            <ChevronRight size={12} />
            <Link href={`/groups/${id}/wiki`} className="hover:text-nu-ink no-underline transition-colors">탭</Link>
            <ChevronRight size={12} />
            <span className="text-nu-ink font-bold">가이드</span>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 bg-nu-ink flex items-center justify-center -rotate-3">
              <BookOpen size={28} className="text-white" />
            </div>
            <div>
              <h1 className="font-head text-3xl md:text-4xl font-extrabold text-nu-ink tracking-tight leading-none">
                Wiki AI 사용 가이드
              </h1>
              <p className="font-mono-nu text-[10px] text-nu-pink uppercase tracking-[0.3em] font-bold">
                Living Wiki Manual
              </p>
            </div>
          </div>
          <p className="text-nu-graphite leading-relaxed text-sm font-medium mt-4 max-w-2xl">
            Living Wiki는 기록 &rarr; 분석 &rarr; 구조화 &rarr; 연결의 선순환 구조로 팀의 지식을 성장시킵니다.
            이 가이드에서 각 기능의 역할과 사용 방법을 확인하세요.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 md:py-14 space-y-16">

        {/* ── Overview ── */}
        <section>
          <h2 className="font-head text-2xl font-extrabold text-nu-ink mb-4 flex items-center gap-3">
            <Layers size={22} className="text-nu-blue" /> 전체 구조
          </h2>
          <div className="bg-white border-[2px] border-nu-ink p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              {[
                { step: "01", label: "기록 (Record)", desc: "미팅 메모, 리소스 공유", icon: <FileText size={20} />, color: "text-nu-pink" },
                { step: "02", label: "분석 (Analyze)", desc: "AI가 핵심 개념 추출", icon: <Brain size={20} />, color: "text-nu-blue" },
                { step: "03", label: "구조화 (Structure)", desc: "탭 페이지로 정리", icon: <Layers size={20} />, color: "text-nu-amber" },
                { step: "04", label: "연결 (Connect)", desc: "지식 그래프로 시각화", icon: <GitBranch size={20} />, color: "text-purple-500" },
              ].map((s, i) => (
                <div key={s.step} className="relative">
                  <div className={`w-12 h-12 mx-auto mb-3 bg-nu-ink/5 flex items-center justify-center ${s.color}`}>
                    {s.icon}
                  </div>
                  <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest mb-1">Step {s.step}</p>
                  <p className="font-head text-sm font-bold text-nu-ink">{s.label}</p>
                  <p className="text-xs text-nu-muted mt-1">{s.desc}</p>
                  {i < 3 && (
                    <ArrowRight size={14} className="absolute top-6 -right-3 text-nu-ink/20 hidden md:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Permission Info ── */}
        <section>
          <h2 className="font-head text-2xl font-extrabold text-nu-ink mb-4 flex items-center gap-3">
            <Shield size={22} className="text-nu-pink" /> 권한 안내
          </h2>
          <div className="bg-nu-pink/5 border-[2px] border-nu-pink/20 p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-head text-base font-bold text-nu-ink mb-3">호스트 (리더) 전용 기능</h3>
                <ul className="space-y-2 text-sm text-nu-graphite">
                  <li className="flex items-start gap-2"><Shield size={14} className="text-nu-pink shrink-0 mt-0.5" /> 지식 수집 & 통합 (AI Synthesis) 실행</li>
                  <li className="flex items-start gap-2"><Shield size={14} className="text-nu-pink shrink-0 mt-0.5" /> 주간 인사이트 다이제스트 생성 & 발행</li>
                  <li className="flex items-start gap-2"><Shield size={14} className="text-nu-pink shrink-0 mt-0.5" /> 월간 지식 진화 분석 실행</li>
                  <li className="flex items-start gap-2"><Shield size={14} className="text-nu-pink shrink-0 mt-0.5" /> AI 분석 결과를 탭에 자동 반영</li>
                </ul>
              </div>
              <div>
                <h3 className="font-head text-base font-bold text-nu-ink mb-3">모든 멤버 가능</h3>
                <ul className="space-y-2 text-sm text-nu-graphite">
                  <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" /> 주제(Topic) 생성 및 문서 작성</li>
                  <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" /> 리소스 공유 (Weekly Resource Feed)</li>
                  <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" /> 지식 그래프 탐색</li>
                  <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" /> 다이제스트 및 분석 결과 열람</li>
                  <li className="flex items-start gap-2"><CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" /> 문서 검색 및 편집</li>
                </ul>
              </div>
            </div>
            {isHost && (
              <div className="mt-4 p-3 bg-nu-pink/10 border border-nu-pink/20">
                <p className="font-mono-nu text-[10px] text-nu-pink font-bold uppercase tracking-widest">
                  현재 호스트 권한으로 모든 AI 기능을 사용할 수 있습니다
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── Feature 1: Knowledge Graph ── */}
        <GuideSection
          icon={<GitBranch size={22} className="text-nu-blue" />}
          title="지식 그래프 (Knowledge Graph)"
          tag="모든 멤버"
          description="탭에 등록된 문서들 간의 연결 관계를 시각적으로 보여주는 인터랙티브 맵입니다."
          steps={[
            "탭 메인 화면 상단에서 지식 그래프 영역을 확인합니다.",
            "노드(원)를 드래그하여 탐색하고, 클릭하면 해당 문서로 이동합니다.",
            "연결선은 문서 간 참조 관계(reference, extends, contradicts)를 나타냅니다.",
            "문서 작성 시 다른 문서를 링크하면 연결이 자동으로 추가됩니다.",
          ]}
          tip="문서 간 교차 참조를 많이 만들수록 지식 그래프가 풍부해집니다. AI 통합 시 자동으로 교차 참조도 제안됩니다."
        />

        {/* ── Feature 2: Resource Feed ── */}
        <GuideSection
          icon={<Sparkles size={22} className="text-nu-blue" />}
          title="지식 수집 (Weekly Resource Feed)"
          tag="모든 멤버"
          description="멤버들이 관련 자료(아티클, 영상, 논문 등)를 공유하는 공간입니다."
          steps={[
            "'지식 수집 & 통합' 섹션 왼쪽의 리소스 피드에서 '+ 리소스 공유' 버튼을 클릭합니다.",
            "URL, 제목, 유형(아티클/영상/논문 등), 설명을 입력합니다.",
            "공유된 리소스는 AI 통합 시 자동으로 분석됩니다.",
            "Google Drive에 연결된 문서도 자동으로 수집 대상에 포함됩니다.",
          ]}
          tip="미팅 전에 관련 자료를 미리 공유하면 AI 통합의 품질이 크게 향상됩니다."
        />

        {/* ── Feature 3: Synthesis Engine ── */}
        <GuideSection
          icon={<Brain size={22} className="text-nu-pink" />}
          title="지식 통합 엔진 (Weekly Synthesis)"
          tag="호스트 전용"
          description="공유된 리소스, 미팅 기록, 회의 노트를 AI(Gemini 2.5 Flash)가 분석하여 탭 문서를 자동 생성하거나 업데이트합니다."
          steps={[
            "'지식 수집 & 통합' 섹션 오른쪽의 통합 엔진에서 '지식 통합 시작' 버튼을 클릭합니다.",
            "AI가 마지막 통합 이후 새로 추가된 데이터만 분석합니다 (증분 방식).",
            "분석 결과로 탭 페이지 생성/수정 제안, 교차 참조, 지식 갭이 표시됩니다.",
            "제안된 페이지를 검토한 후 선택하여 '탭에 반영' 버튼으로 자동 적용합니다.",
            "통합 이력은 하단 히스토리에서 확인할 수 있습니다.",
          ]}
          tip="매주 1회 미팅 후 실행하는 것을 권장합니다. 증분 방식이므로 이전에 정리된 내용은 중복 분석하지 않습니다."
        />

        {/* ── Feature 4: Topic Tap ── */}
        <GuideSection
          icon={<Layers size={22} className="text-nu-pink" />}
          title="주제별 탭 (Topic Tap)"
          tag="모든 멤버"
          description="지식을 주제(Topic)별로 분류하고, 각 주제 아래 세부 문서(Page)를 관리하는 위키 구조입니다."
          steps={[
            "'새 주제 만들기' 버튼으로 주제를 생성합니다 (예: '마케팅 전략', '기술 리서치').",
            "주제를 클릭하면 해당 주제의 문서 목록이 표시됩니다.",
            "'+ 새 문서' 버튼으로 마크다운 문서를 작성합니다.",
            "문서에서 다른 문서를 [[링크]]하면 지식 그래프에 연결이 생깁니다.",
            "AI 통합 결과도 적절한 주제에 자동 배치됩니다.",
          ]}
          tip="주제는 5-7개 이내로 유지하는 것이 좋습니다. 너무 세분화하면 오히려 탐색이 어려워집니다."
        />

        {/* ── Feature 5: Weekly Digest ── */}
        <GuideSection
          icon={<BarChart3 size={22} className="text-nu-amber" />}
          title="주간 인사이트 다이제스트"
          tag="호스트 전용 (생성) / 모든 멤버 (열람)"
          description="한 주간의 탭 활동 데이터를 분석하여 핫 토픽, 성장 지표, 기여자 랭킹을 시각화합니다."
          steps={[
            "'주간 인사이트 다이제스트' 섹션에서 '이번 주 다이제스트 생성' 버튼을 클릭합니다.",
            "실제 DB 데이터(편집 수, 조회 수, 기여자 수)를 기반으로 분석됩니다.",
            "Overview, Trends, Insights 세 가지 탭으로 결과를 확인합니다.",
            "'Publish' 버튼으로 뉴스레터를 발행하면 모든 멤버가 열람할 수 있습니다.",
          ]}
          tip="매주 월요일에 지난주 다이제스트를 생성하고 발행하면 팀원들이 주간 활동을 한눈에 파악할 수 있습니다."
        />

        {/* ── Feature 6: Monthly Evolution ── */}
        <GuideSection
          icon={<Zap size={22} className="text-purple-500" />}
          title="월간 지식 진화 분석"
          tag="호스트 전용 (실행) / 모든 멤버 (열람)"
          description="한 달간의 데이터를 교차 분석하여 주제별 관점 변화, 개념 생애 주기, 지식 건강도를 평가합니다."
          steps={[
            "'월간 지식 진화 분석' 섹션에서 '교차 분석 실행' 버튼을 클릭합니다.",
            "이번 달과 지난 달의 편집 활동을 비교하여 성장/안정/감소 추세를 분석합니다.",
            "지식 건강도(Breadth, Depth, Connectivity, Freshness) 점수를 확인합니다.",
            "AI 액션 권고를 참고하여 다음 달 학습 방향을 설정합니다.",
          ]}
          tip="월초에 실행하여 지난 달을 회고하고, 이번 달 목표를 설정하는 데 활용하세요."
        />

        {/* ── Feature 7: Other Features ── */}
        <section>
          <h2 className="font-head text-2xl font-extrabold text-nu-ink mb-4 flex items-center gap-3">
            <Users size={22} className="text-nu-blue" /> 기타 기능
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border-[2px] border-nu-ink/[0.08] p-6">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={18} className="text-yellow-500" />
                <h3 className="font-head text-base font-bold text-nu-ink">지식 챔피언</h3>
              </div>
              <p className="text-sm text-nu-graphite leading-relaxed">
                위키 기여도를 기반으로 멤버 랭킹을 표시합니다. 문서 작성, 편집, 리소스 공유 등 모든 활동이 반영됩니다.
              </p>
            </div>
            <div className="bg-white border-[2px] border-nu-ink/[0.08] p-6">
              <div className="flex items-center gap-2 mb-3">
                <Users size={18} className="text-nu-pink" />
                <h3 className="font-head text-base font-bold text-nu-ink">인적 자원 (Human Capital)</h3>
              </div>
              <p className="text-sm text-nu-graphite leading-relaxed">
                멤버들의 전문 분야와 기여 영역을 시각화합니다. 어떤 주제에 누가 가장 많이 기여했는지 한눈에 파악할 수 있습니다.
              </p>
            </div>
            <div className="bg-white border-[2px] border-nu-ink/[0.08] p-6">
              <div className="flex items-center gap-2 mb-3">
                <Target size={18} className="text-nu-pink" />
                <h3 className="font-head text-base font-bold text-nu-ink">지식 지표</h3>
              </div>
              <p className="text-sm text-nu-graphite leading-relaxed">
                지식 커버리지, 연결 밀도, 참여 활성도를 실시간으로 추적합니다. 탭의 건강 상태를 한눈에 확인하세요.
              </p>
            </div>
            <div className="bg-white border-[2px] border-nu-ink/[0.08] p-6">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw size={18} className="text-nu-blue" />
                <h3 className="font-head text-base font-bold text-nu-ink">최근 지식 동기화</h3>
              </div>
              <p className="text-sm text-nu-graphite leading-relaxed">
                최근 수정된 문서를 타임라인 형태로 보여줍니다. 버전, 수정자, 소속 주제를 실시간으로 추적합니다.
              </p>
            </div>
          </div>
        </section>

        {/* ── Recommended Workflow ── */}
        <section>
          <h2 className="font-head text-2xl font-extrabold text-nu-ink mb-4 flex items-center gap-3">
            <Calendar size={22} className="text-nu-amber" /> 권장 워크플로우
          </h2>
          <div className="bg-nu-ink text-white p-6 md:p-8 border-[2px] border-nu-ink relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
            <div className="relative z-10 space-y-6">
              {[
                {
                  period: "미팅 전",
                  tasks: ["관련 리소스를 Weekly Resource Feed에 공유", "이전 미팅 노트와 액션 아이템 확인"],
                },
                {
                  period: "미팅 후",
                  tasks: ["미팅 노트, 결정 사항, 액션 아이템을 기록", "호스트: 지식 통합 엔진 실행 (증분 분석)", "제안된 탭 페이지 검토 후 반영"],
                },
                {
                  period: "매주 월요일",
                  tasks: ["호스트: 주간 인사이트 다이제스트 생성 & 발행", "지식 그래프에서 새로운 연결 확인"],
                },
                {
                  period: "매월 초",
                  tasks: ["호스트: 월간 지식 진화 분석 실행", "AI 권고에 따라 학습 방향 조정", "휴면 문서 정리 또는 아카이브"],
                },
              ].map((w, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-20 shrink-0">
                    <span className="font-mono-nu text-[10px] font-bold text-nu-pink uppercase tracking-widest">{w.period}</span>
                  </div>
                  <div className="flex-1 border-l border-white/10 pl-4">
                    <ul className="space-y-1.5">
                      {w.tasks.map((t, j) => (
                        <li key={j} className="text-sm text-white/70 flex items-start gap-2">
                          <CheckCircle2 size={12} className="text-nu-pink shrink-0 mt-0.5" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Back to Wiki */}
        <div className="text-center pt-4">
          <Link
            href={`/groups/${id}/wiki`}
            className="inline-flex items-center gap-2 bg-nu-ink text-white px-8 py-3 font-mono-nu text-xs font-bold uppercase tracking-widest hover:bg-nu-pink transition-colors no-underline"
          >
            <ArrowRight size={14} className="rotate-180" /> 탭으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable Guide Section Component ── */
function GuideSection({
  icon,
  title,
  tag,
  description,
  steps,
  tip,
}: {
  icon: React.ReactNode;
  title: string;
  tag: string;
  description: string;
  steps: string[];
  tip: string;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-head text-2xl font-extrabold text-nu-ink flex items-center gap-3">
          {icon} {title}
        </h2>
        <span className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest bg-nu-cream px-3 py-1 border border-nu-ink/10 shrink-0">
          {tag}
        </span>
      </div>
      <div className="bg-white border-[2px] border-nu-ink/[0.08] p-6 md:p-8">
        <p className="text-sm text-nu-graphite leading-relaxed mb-6">{description}</p>

        <h3 className="font-mono-nu text-[10px] font-bold text-nu-ink uppercase tracking-[0.2em] mb-4">사용 방법</h3>
        <ol className="space-y-3 mb-6">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-nu-graphite">
              <span className="w-6 h-6 bg-nu-ink text-white flex items-center justify-center shrink-0 font-mono-nu text-[10px] font-bold">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        <div className="bg-nu-amber/5 border border-nu-amber/20 p-4 flex gap-3">
          <Lightbulb size={16} className="text-nu-amber shrink-0 mt-0.5" />
          <p className="text-xs text-nu-graphite leading-relaxed">
            <span className="font-bold text-nu-ink">TIP: </span>{tip}
          </p>
        </div>
      </div>
    </section>
  );
}
