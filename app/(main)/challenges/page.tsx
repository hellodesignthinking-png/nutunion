"use client";

import { useState } from "react";
import { 
  Briefcase, Send, DollarSign, Users, Zap, CheckCircle2,
  ArrowRight, Star, Shield, TrendingUp, Clock, Sparkles, Target
} from "lucide-react";
import { toast } from "sonner";
import { PageHero } from "@/components/shared/page-hero";

interface ChallengeForm {
  companyName: string;
  contactEmail: string;
  projectTitle: string;
  description: string;
  budget: string;
  timeline: string;
  requiredSkills: string[];
}

const SKILL_OPTIONS = [
  "브랜딩", "기획", "마케팅", "디자인", "개발", "영상", 
  "SNS운영", "공간기획", "커뮤니티", "데이터분석", "UX리서치", "콘텐츠"
];

// Case studies data would be fetched from database if available
// For now, returning empty array as no challenges table exists yet
const CASE_STUDIES: Array<{
  title: string;
  client: string;
  squad: number;
  duration: string;
  result: string;
  synergy: number;
}> = [];

export default function ChallengesPage() {
  const [form, setForm] = useState<ChallengeForm>({
    companyName: "",
    contactEmail: "",
    projectTitle: "",
    description: "",
    budget: "",
    timeline: "",
    requiredSkills: [],
  });
  const [submitted, setSubmitted] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);

  const toggleSkill = (skill: string) => {
    setForm(prev => ({
      ...prev,
      requiredSkills: prev.requiredSkills.includes(skill)
        ? prev.requiredSkills.filter(s => s !== skill)
        : [...prev.requiredSkills, skill]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.contactEmail || !form.projectTitle) {
      toast.error("필수 항목을 모두 입력해주세요.");
      return;
    }
    // Estimate price based on skills and timeline
    const basePrice = form.requiredSkills.length * 500000;
    const timeMultiplier = form.timeline === "urgent" ? 1.5 : form.timeline === "long" ? 0.8 : 1;
    setEstimatedPrice(Math.round(basePrice * timeMultiplier));
    setSubmitted(true);
    toast.success("🚀 프로젝트 의뢰가 접수되었습니다! AI가 최적의 스쿼드를 매칭 중입니다.");
  };

  return (
    <div className="bg-nu-paper min-h-screen pb-20">
      <PageHero
        category="Business"
        title="Challenge Portal"
        description="넛유니온의 검증된 인재풀에 프로젝트를 의뢰하세요. AI가 최적의 팀을 매칭해 드립니다."
      />

      <div className="max-w-6xl mx-auto px-8 py-12">
        {/* Trust Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-12">
          {[
            { icon: Users, value: "150+", label: "검증된 인재", color: "text-nu-pink" },
            { icon: Shield, value: "2,400+", label: "누적 동료 보증", color: "text-nu-blue" },
            { icon: Briefcase, value: "45+", label: "완료된 프로젝트", color: "text-nu-amber" },
            { icon: Star, value: "4.8/5", label: "클라이언트 만족도", color: "text-green-600" },
          ].map(m => (
            <div key={m.label} className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-5 text-center">
              <m.icon size={20} className={`mx-auto mb-2 ${m.color}`} />
              <p className="font-head text-2xl font-extrabold text-nu-ink">{m.value}</p>
              <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted mt-1">{m.label}</p>
            </div>
          ))}
        </div>

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
                  <p className="text-[11px] text-nu-paper/60">프로젝트 정보를 입력하면 AI가 최적의 팀과 예상 단가를 제안합니다</p>
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

                  <div>
                    <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1.5">프로젝트 제목 *</label>
                    <input value={form.projectTitle} onChange={e => setForm(p => ({...p, projectTitle: e.target.value}))}
                      className="w-full h-10 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none focus:border-nu-pink" placeholder="신림동 로컬 카페 브랜딩" />
                  </div>

                  <div>
                    <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1.5">상세 설명</label>
                    <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={4}
                      className="w-full border border-nu-ink/10 bg-nu-cream/10 px-3 py-2 text-sm focus:outline-none focus:border-nu-pink resize-none"
                      placeholder="프로젝트의 목표, 기대 결과물, 특별한 요구사항 등을 설명해주세요..." />
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
                          className={`font-mono-nu text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 transition-all ${
                            form.requiredSkills.includes(skill)
                              ? "bg-nu-pink text-white border border-nu-pink"
                              : "bg-nu-cream/20 text-nu-muted border border-nu-ink/10 hover:border-nu-pink/30"
                          }`}>
                          {skill}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button type="submit"
                    className="w-full font-mono-nu text-[11px] font-bold uppercase tracking-widest px-6 py-4 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-all flex items-center justify-center gap-2 shadow-lg">
                    <Sparkles size={16} /> AI 매칭 시작하기
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
                    <p className="text-sm text-nu-paper/70">AI가 최적의 스쿼드를 매칭 중입니다. 24시간 이내에 제안서를 보내드립니다.</p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-nu-cream/20 border border-nu-ink/5">
                    <div>
                      <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">AI 추정 프로젝트 단가</p>
                      <p className="font-head text-2xl font-extrabold text-nu-pink">{estimatedPrice?.toLocaleString()}원~</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">매칭 예상</p>
                      <p className="font-head text-lg font-bold text-nu-ink">{form.requiredSkills.length}명 스쿼드</p>
                    </div>
                  </div>

                  <div className="p-4 bg-nu-ink/[0.02] border border-nu-ink/5">
                    <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-2">제출 정보 요약</p>
                    <p className="text-sm font-bold text-nu-ink">{form.projectTitle}</p>
                    <p className="text-[11px] text-nu-muted mt-1">{form.companyName} · {form.contactEmail}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {form.requiredSkills.map(s => (
                        <span key={s} className="font-mono-nu text-[8px] bg-nu-pink/10 text-nu-pink px-2 py-0.5 font-bold uppercase">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: Case Studies */}
          <div className="space-y-4">
            <h3 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
              <TrendingUp size={18} className="text-nu-pink" /> 성공 사례
            </h3>
            {CASE_STUDIES.length > 0 ? (
              CASE_STUDIES.map(cs => (
                <div key={cs.title} className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-5 hover:border-nu-pink/30 transition-all">
                  <p className="font-head text-sm font-bold text-nu-ink mb-2">{cs.title}</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between font-mono-nu text-[9px]">
                      <span className="text-nu-muted uppercase tracking-widest">Client</span>
                      <span className="text-nu-ink font-bold">{cs.client}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono-nu text-[9px]">
                      <span className="text-nu-muted uppercase tracking-widest">Squad</span>
                      <span className="text-nu-ink font-bold">{cs.squad}명</span>
                    </div>
                    <div className="flex items-center justify-between font-mono-nu text-[9px]">
                      <span className="text-nu-muted uppercase tracking-widest">Duration</span>
                      <span className="text-nu-ink font-bold">{cs.duration}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono-nu text-[9px]">
                      <span className="text-nu-muted uppercase tracking-widest">Result</span>
                      <span className="text-nu-pink font-bold">{cs.result}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between pt-3 border-t border-nu-ink/5">
                    <span className="font-mono-nu text-[8px] text-nu-muted uppercase tracking-widest">Team Synergy</span>
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-1.5 bg-nu-ink/5 overflow-hidden">
                        <div className="h-full bg-nu-pink" style={{ width: `${cs.synergy}%` }} />
                      </div>
                      <span className="font-mono-nu text-[9px] text-nu-pink font-bold">{cs.synergy}%</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] p-5 text-center">
                <div className="text-nu-muted mb-2">
                  <TrendingUp size={24} className="mx-auto opacity-30" />
                </div>
                <p className="font-head text-sm font-bold text-nu-ink mb-1">아직 등록된 의뢰가 없습니다</p>
                <p className="text-[11px] text-nu-muted">성공 사례는 첫 번째 프로젝트 완료 후 추가됩니다.</p>
              </div>
            )}

            {/* CTA */}
            <div className="bg-nu-ink text-nu-paper p-5">
              <p className="font-head text-sm font-bold mb-2">💡 왜 넛유니온인가?</p>
              <ul className="space-y-2 text-[11px] text-nu-paper/70">
                <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-nu-pink shrink-0 mt-0.5" /> 모든 인재의 역량이 <strong className="text-nu-paper">데이터로 검증</strong></li>
                <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-nu-pink shrink-0 mt-0.5" /> 동료가 직접 보증하는 <strong className="text-nu-paper">Peer Endorsement</strong></li>
                <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-nu-pink shrink-0 mt-0.5" /> AI가 최적의 팀을 <strong className="text-nu-paper">자동 매칭</strong></li>
                <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-nu-pink shrink-0 mt-0.5" /> 마일스톤별 <strong className="text-nu-paper">투명한 정산</strong></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
