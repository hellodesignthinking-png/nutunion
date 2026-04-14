"use client";

import { useState, useEffect } from "react";
import {
  Briefcase, Send, Users, CheckCircle2,
  Star, Shield, TrendingUp, Clock, Sparkles,
  FileText, ArrowRight, Loader2, Eye, ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { PageHero } from "@/components/shared/page-hero";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

interface ChallengeForm {
  companyName: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  projectTitle: string;
  description: string;
  budget: string;
  timeline: string;
  requiredSkills: string[];
}

interface MyProposal {
  id: string;
  project_title: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  company_name: string;
}

const SKILL_OPTIONS = [
  "브랜딩", "기획", "마케팅", "디자인", "개발", "영상",
  "SNS운영", "공간기획", "커뮤니티", "데이터분석", "UX리서치", "콘텐츠"
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: "접수됨", color: "text-blue-600", bg: "bg-blue-50" },
  reviewing: { label: "검토 중", color: "text-orange-600", bg: "bg-orange-50" },
  approved: { label: "승인됨", color: "text-green-600", bg: "bg-green-50" },
  rejected: { label: "반려됨", color: "text-red-500", bg: "bg-red-50" },
  converted: { label: "볼트 전환됨", color: "text-nu-pink", bg: "bg-nu-pink/10" },
};

export default function ChallengesPage() {
  const supabase = createBrowserClient();
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState<ChallengeForm>({
    companyName: "",
    contactEmail: "",
    contactName: "",
    contactPhone: "",
    projectTitle: "",
    description: "",
    budget: "",
    timeline: "",
    requiredSkills: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [myProposals, setMyProposals] = useState<MyProposal[]>([]);
  const [showMyProposals, setShowMyProposals] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      setUser(user);
      if (user) {
        // Pre-fill email
        setForm(prev => ({ ...prev, contactEmail: user.email || "" }));
        // Fetch my proposals
        loadMyProposals();
      }
    });
  }, []);

  async function loadMyProposals() {
    try {
      const res = await fetch("/api/challenges");
      const data = await res.json();
      setMyProposals(data.proposals || []);
    } catch {
      // ignore
    }
  }

  const toggleSkill = (skill: string) => {
    setForm(prev => ({
      ...prev,
      requiredSkills: prev.requiredSkills.includes(skill)
        ? prev.requiredSkills.filter(s => s !== skill)
        : [...prev.requiredSkills, skill]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.contactEmail || !form.projectTitle) {
      toast.error("필수 항목을 모두 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "의뢰 등록에 실패했습니다");
      }

      setSubmittedId(data.proposal?.id);
      setSubmitted(true);
      toast.success("볼트 의뢰가 접수되었습니다!");

      // Refresh my proposals
      if (user) {
        loadMyProposals();
      }
    } catch (err: any) {
      toast.error(err.message || "의뢰 등록에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      companyName: "",
      contactEmail: user?.email || "",
      contactName: "",
      contactPhone: "",
      projectTitle: "",
      description: "",
      budget: "",
      timeline: "",
      requiredSkills: [],
    });
    setSubmitted(false);
    setSubmittedId(null);
  };

  return (
    <div className="bg-nu-paper min-h-screen pb-20">
      <PageHero
        category="Business"
        title="Challenge Portal"
        description="넛유니온의 검증된 와셔풀에 볼트를 의뢰하세요. 관리자가 검토 후 최적의 PM을 배정합니다."
      />

      <div className="max-w-6xl mx-auto px-8 py-12">
        {/* Trust Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { icon: Users, value: "150+", label: "검증된 와셔", color: "text-nu-pink" },
            { icon: Shield, value: "2,400+", label: "누적 동료 보증", color: "text-nu-blue" },
            { icon: Briefcase, value: "45+", label: "완료된 볼트", color: "text-nu-amber" },
            { icon: Star, value: "4.8/5", label: "클라이언트 만족도", color: "text-green-600" },
          ].map(m => (
            <div key={m.label} className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-5 text-center">
              <m.icon size={20} className={`mx-auto mb-2 ${m.color}`} />
              <p className="font-head text-2xl font-extrabold text-nu-ink">{m.value}</p>
              <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted mt-1">{m.label}</p>
            </div>
          ))}
        </div>

        {/* My Proposals (로그인한 경우) */}
        {user && myProposals.length > 0 && (
          <div className="mb-8">
            <button
              onClick={() => setShowMyProposals(!showMyProposals)}
              className="flex items-center gap-2 w-full bg-nu-white border-[2px] border-nu-ink/[0.08] px-5 py-3 hover:border-nu-pink/30 transition-all cursor-pointer"
            >
              <FileText size={16} className="text-nu-pink" />
              <span className="font-head text-sm font-bold text-nu-ink">내 의뢰 현황</span>
              <span className="font-mono-nu text-[10px] bg-nu-pink/10 text-nu-pink px-2 py-0.5 font-bold">
                {myProposals.length}
              </span>
              <ChevronDown size={14} className={`ml-auto text-nu-muted transition-transform ${showMyProposals ? "rotate-180" : ""}`} />
            </button>

            {showMyProposals && (
              <div className="bg-nu-white border-x-[2px] border-b-[2px] border-nu-ink/[0.08] divide-y divide-nu-ink/[0.06]">
                {myProposals.map(p => {
                  const st = STATUS_MAP[p.status] || STATUS_MAP.submitted;
                  return (
                    <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-nu-ink truncate">{p.project_title}</p>
                        <p className="text-[10px] text-nu-muted">{p.company_name} · {new Date(p.created_at).toLocaleDateString("ko")}</p>
                      </div>
                      <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-2 py-1 font-bold ${st.color} ${st.bg}`}>
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            {!submitted ? (
              <form onSubmit={handleSubmit} className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
                <div className="bg-nu-ink text-nu-paper px-6 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Send size={14} className="text-nu-pink" />
                    <span className="font-mono-nu text-[9px] font-black uppercase tracking-[0.25em] text-nu-pink">
                      New_Challenge
                    </span>
                  </div>
                  <p className="text-[11px] text-nu-paper/60">볼트 정보를 입력하시면 관리자가 검토 후 최적의 PM을 배정합니다</p>
                </div>

                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1.5">회사/단체명 *</label>
                      <input value={form.companyName} onChange={e => setForm(p => ({...p, companyName: e.target.value}))}
                        className="w-full h-10 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none focus:border-nu-pink" placeholder="(주)넛유니온" />
                    </div>
                    <div>
                      <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1.5">연락처 이메일 *</label>
                      <input type="email" value={form.contactEmail} onChange={e => setForm(p => ({...p, contactEmail: e.target.value}))}
                        className="w-full h-10 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none focus:border-nu-pink" placeholder="hello@company.com" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1.5">담당자명</label>
                      <input value={form.contactName} onChange={e => setForm(p => ({...p, contactName: e.target.value}))}
                        className="w-full h-10 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none focus:border-nu-pink" placeholder="홍길동" />
                    </div>
                    <div>
                      <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1.5">연락처</label>
                      <input value={form.contactPhone} onChange={e => setForm(p => ({...p, contactPhone: e.target.value}))}
                        className="w-full h-10 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none focus:border-nu-pink" placeholder="010-1234-5678" />
                    </div>
                  </div>

                  <div>
                    <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1.5">볼트 제목 *</label>
                    <input value={form.projectTitle} onChange={e => setForm(p => ({...p, projectTitle: e.target.value}))}
                      className="w-full h-10 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none focus:border-nu-pink" placeholder="신림동 로컬 카페 브랜딩" />
                  </div>

                  <div>
                    <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1.5">상세 설명</label>
                    <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={4}
                      className="w-full border border-nu-ink/10 bg-nu-cream/10 px-3 py-2 text-sm focus:outline-none focus:border-nu-pink resize-none"
                      placeholder="볼트의 목표, 기대 결과물, 특별한 요구사항 등을 설명해주세요..." />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1.5">예산 범위</label>
                      <select value={form.budget} onChange={e => setForm(p => ({...p, budget: e.target.value}))}
                        className="w-full h-10 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none">
                        <option value="">선택해주세요</option>
                        <option value="small">100만원 이하</option>
                        <option value="medium">100~500만원</option>
                        <option value="large">500만원 이상</option>
                        <option value="tbd">협의 필요</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1.5">일정</label>
                      <select value={form.timeline} onChange={e => setForm(p => ({...p, timeline: e.target.value}))}
                        className="w-full h-10 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none">
                        <option value="">선택해주세요</option>
                        <option value="urgent">긴급 (2주 이내)</option>
                        <option value="normal">일반 (1~2개월)</option>
                        <option value="long">장기 (3개월+)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-2">필요 역량 (복수 선택)</label>
                    <div className="flex flex-wrap gap-2">
                      {SKILL_OPTIONS.map(skill => (
                        <button key={skill} type="button" onClick={() => toggleSkill(skill)}
                          className={`font-mono-nu text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 transition-all border cursor-pointer ${
                            form.requiredSkills.includes(skill)
                              ? "bg-nu-pink text-white border-nu-pink"
                              : "bg-nu-cream/20 text-nu-muted border-nu-ink/10 hover:border-nu-pink/30"
                          }`}>
                          {skill}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button type="submit" disabled={submitting}
                    className="w-full font-mono-nu text-[11px] font-bold uppercase tracking-widest px-6 py-4 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer border-none">
                    {submitting ? (
                      <><Loader2 size={16} className="animate-spin" /> 제출 중...</>
                    ) : (
                      <><Send size={16} /> 볼트 의뢰하기</>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Success State */
              <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
                <div className="bg-gradient-to-r from-nu-ink to-nu-ink/90 text-nu-paper px-6 py-8 text-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-5 left-10 w-32 h-32 bg-nu-pink rounded-full blur-3xl" />
                    <div className="absolute bottom-5 right-10 w-40 h-40 bg-nu-blue rounded-full blur-3xl" />
                  </div>
                  <div className="relative">
                    <CheckCircle2 size={40} className="text-nu-pink mx-auto mb-3" />
                    <h2 className="font-head text-2xl font-extrabold mb-2">의뢰가 접수되었습니다!</h2>
                    <p className="text-sm text-nu-paper/70">관리자가 검토 후 최적의 PM을 배정합니다. 진행 상황은 이메일로 안내드립니다.</p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* Process Flow */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { step: "1", label: "의뢰 접수", desc: "완료", active: true, done: true },
                      { step: "2", label: "관리자 검토", desc: "대기 중", active: true, done: false },
                      { step: "3", label: "PM 배정", desc: "예정", active: false, done: false },
                      { step: "4", label: "볼트 시작", desc: "예정", active: false, done: false },
                    ].map(s => (
                      <div key={s.step} className={`text-center p-3 border ${s.done ? "border-green-300 bg-green-50" : s.active ? "border-orange-300 bg-orange-50" : "border-nu-ink/[0.06] bg-nu-ink/[0.02]"}`}>
                        <div className={`w-6 h-6 mx-auto mb-1 flex items-center justify-center text-[10px] font-bold ${
                          s.done ? "bg-green-500 text-white" : s.active ? "bg-orange-400 text-white" : "bg-nu-ink/10 text-nu-muted"
                        }`}>
                          {s.done ? <CheckCircle2 size={12} /> : s.step}
                        </div>
                        <p className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-ink">{s.label}</p>
                        <p className="font-mono-nu text-[8px] text-nu-muted mt-0.5">{s.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-nu-ink/[0.02] border border-nu-ink/5">
                    <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-2">제출 정보 요약</p>
                    <p className="text-sm font-bold text-nu-ink">{form.projectTitle}</p>
                    <p className="text-[11px] text-nu-muted mt-1">{form.companyName} · {form.contactEmail}</p>
                    {form.requiredSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {form.requiredSkills.map(s => (
                          <span key={s} className="font-mono-nu text-[8px] bg-nu-pink/10 text-nu-pink px-2 py-0.5 font-bold uppercase">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={resetForm}
                    className="w-full font-mono-nu text-[11px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink/5 text-nu-ink hover:bg-nu-ink/10 transition-all flex items-center justify-center gap-2 cursor-pointer border border-nu-ink/10"
                  >
                    <Send size={14} /> 새 의뢰 작성하기
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Process Guide */}
            <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-5">
              <h3 className="font-head text-sm font-bold text-nu-ink flex items-center gap-2 mb-4">
                <ArrowRight size={14} className="text-nu-pink" /> 진행 절차
              </h3>
              <div className="space-y-3">
                {[
                  { step: "01", title: "의뢰 제출", desc: "볼트 정보를 입력하고 제출합니다" },
                  { step: "02", title: "관리자 검토", desc: "관리자가 의뢰를 검토하고 적합성을 판단합니다" },
                  { step: "03", title: "볼트 등록", desc: "승인된 의뢰는 볼트로 전환됩니다" },
                  { step: "04", title: "PM 배정", desc: "최적의 PM이 배정되어 볼트를 진행합니다" },
                  { step: "05", title: "팀 구성 & 킥오프", desc: "PM이 팀을 구성하고 볼트를 시작합니다" },
                ].map(s => (
                  <div key={s.step} className="flex gap-3">
                    <span className="font-mono-nu text-[10px] font-bold text-nu-pink shrink-0 mt-0.5">{s.step}</span>
                    <div>
                      <p className="text-sm font-medium text-nu-ink">{s.title}</p>
                      <p className="text-[11px] text-nu-muted">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Why NutUnion */}
            <div className="bg-nu-ink text-nu-paper p-5">
              <p className="font-head text-sm font-bold mb-3">왜 넛유니온인가?</p>
              <div className="space-y-2.5 text-[11px] text-nu-paper/70">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={12} className="text-nu-pink shrink-0 mt-0.5" />
                  <span>모든 와셔의 역량이 <strong className="text-nu-paper">데이터로 검증</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={12} className="text-nu-pink shrink-0 mt-0.5" />
                  <span>동료가 직접 보증하는 <strong className="text-nu-paper">Peer Endorsement</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={12} className="text-nu-pink shrink-0 mt-0.5" />
                  <span>관리자 검토 후 <strong className="text-nu-paper">최적 PM 배정</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={12} className="text-nu-pink shrink-0 mt-0.5" />
                  <span>마일스톤별 <strong className="text-nu-paper">투명한 정산</strong></span>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-5 text-center">
              <Clock size={20} className="mx-auto mb-2 text-nu-muted" />
              <p className="font-head text-sm font-bold text-nu-ink mb-1">빠른 응답</p>
              <p className="text-[11px] text-nu-muted">의뢰 접수 후 영업일 기준 1-2일 내 검토 결과를 안내드립니다.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
