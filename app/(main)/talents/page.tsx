"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, Search, Filter, Award, Zap, Briefcase, 
  CheckCircle2, Star, ChefHat, BookOpen, Layers,
  ChevronRight, ArrowRight, UserPlus, Trophy
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHero } from "@/components/shared/page-hero";

const tierConfig: Record<string, { label: string; className: string; icon: any }> = {
  bronze: { label: "브론즈", className: "bg-amber-100 text-amber-700 border-amber-200", icon: Award },
  silver: { label: "실버",  className: "bg-slate-100 text-slate-600 border-slate-200", icon: Star },
  gold:   { label: "골드",  className: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Star },
  vip:    { label: "VIP",   className: "bg-nu-pink/10 text-nu-pink border-nu-pink/20", icon: Trophy },
};

const specialtyColors: Record<string, string> = {
  space: "bg-nu-blue text-white",
  culture: "bg-nu-amber text-white",
  platform: "bg-nu-ink text-white",
  vibe: "bg-nu-pink text-white",
};

interface Talent {
  profile_id: string;
  nickname: string;
  avatar_url: string | null;
  skill_tags: string[];
  tier: string;
  activity_score: number;
  points: number;
  specialty: string | null;
  total_attendances: number;
  leadership_count: number;
  project_count: number;
}

export default function TalentSearchPage() {
  const [talents, setTalents] = useState<Talent[]>([]);
  const [filtered, setFiltered] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minActivity, setMinActivity] = useState(0);
  const [minAttendances, setMinAttendances] = useState(0);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      // Using the view 'talent_stats' we created in the migration
      const { data, error } = await supabase.from("talent_stats").select("*").order("activity_score", { ascending: false });
      if (error) {
        // Fallback if view doesn't exist yet
        console.error("View talent_stats not found, check migration.");
        return;
      }
      setTalents(data as Talent[]);
      setFiltered(data as Talent[]);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    let res = talents.filter(t => 
      (t.nickname?.toLowerCase().includes(search.toLowerCase()) || (t.skill_tags || []).some(s => s.toLowerCase().includes(search.toLowerCase()))) &&
      (t.activity_score >= minActivity) &&
      (t.total_attendances >= minAttendances)
    );
    if (selectedTag) {
      res = res.filter(t => (t.skill_tags || []).includes(selectedTag));
    }
    setFiltered(res);
  }, [search, minActivity, minAttendances, selectedTag, talents]);

  // Extract all tags for filter
  const allTags = Array.from(new Set(talents.flatMap(t => t.skill_tags || []))).sort();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-40 bg-nu-cream/50 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-nu-cream/50 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-nu-paper min-h-screen pb-20">
      <PageHero 
        category="Talent"
        title="Talent Hunter"
        description="너트유니온의 데이터로 검증된 인재를 찾아보세요. 활동 지수, 리더십 경험, 역량 배지 등 실무 데이터 기반의 팀 빌딩을 지원합니다."
      />

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* TOP TALENT READY Banner as a sub-header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-nu-pink/5 border border-nu-pink/20 p-6 md:p-8">
           <div className="flex-1">
             <h4 className="font-head text-2xl font-extrabold text-nu-ink mb-1 flex items-center gap-2">
               <Zap size={20} className="text-nu-pink fill-nu-pink" /> TOP TALENT READY
             </h4>
             <p className="text-nu-gray text-sm font-medium">데이터가 증명하는 최상위 인재들이 실전 투입을 기다리고 있습니다.</p>
           </div>
           <div className="text-center md:text-right shrink-0">
             <p className="font-head text-4xl font-extrabold text-nu-pink">{talents.filter(t => t.activity_score >= 80).length}</p>
             <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink/60 font-bold">Available Talents</p>
           </div>
        </div>

      {/* Filter Bar */}
      <div className="bg-nu-white border border-nu-ink/[0.08] p-6 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" size={16} />
            <Input 
              placeholder="이름 또는 스킬 태그 검색 (ex. 기획, 디자인, JS...)" 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-12 bg-nu-cream/20 border-nu-ink/10"
            />
          </div>
          <div>
            <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-2">활동 지수 ({minActivity}%+)</label>
            <input 
              type="range" min="0" max="100" step="10" 
              value={minActivity} onChange={e => setMinActivity(parseInt(e.target.value))}
              className="w-full h-1.5 bg-nu-cream rounded-lg appearance-none cursor-pointer accent-nu-pink"
            />
          </div>
          <div>
            <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted block mb-2">최소 출석 (평균)</label>
            <select 
              value={minAttendances} onChange={e => setMinAttendances(parseInt(e.target.value))}
              className="w-full h-10 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none"
            >
              <option value="0">전체</option>
              <option value="3">3회 이상 (성실)</option>
              <option value="10">10회 이상 (숙련)</option>
              <option value="30">30회 이상 (마스터)</option>
            </select>
          </div>
        </div>
        
        {/* Popular Tags */}
        <div className="mt-6 flex flex-wrap gap-2">
           <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted self-center mr-2">인기 태그:</p>
           {allTags.slice(0, 15).map(tag => (
             <button 
               key={tag} 
               onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
               className={`text-[10px] px-2.5 py-1 transition-all ${selectedTag === tag ? "bg-nu-ink text-white" : "border border-nu-ink/10 text-nu-muted hover:border-nu-pink"}`}
             >
               #{tag}
             </button>
           ))}
        </div>
      </div>

      {/* Talent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(talent => {
          const tier = tierConfig[talent.tier] || tierConfig.bronze;
          const isProjectReady = talent.activity_score >= 80 && talent.leadership_count >= 2;
          
          return (
            <div key={talent.profile_id} className="bg-nu-white border border-nu-ink/[0.08] relative group hover:border-nu-pink/30 hover:shadow-xl hover:shadow-nu-ink/5 transition-all duration-500 overflow-hidden">
               {isProjectReady && (
                 <div className="absolute top-0 right-0 z-10">
                    <div className="bg-nu-pink text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1 flex items-center gap-1 shadow-lg">
                      <Zap size={10} fill="currentColor" /> PROJECT READY
                    </div>
                 </div>
               )}
               
               <div className="p-6">
                 <div className="flex items-start gap-4 mb-4">
                    <div className="relative">
                      {talent.avatar_url ? (
                        <img src={talent.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-nu-cream" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-nu-pink text-white flex items-center justify-center font-head text-2xl font-bold">
                          {talent.nickname.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 p-1 bg-white rounded-full shadow-sm border border-nu-cream">
                         <tier.icon size={12} className={tier.className.split(' ')[1]} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                       <h3 className="font-head text-xl font-extrabold text-nu-ink group-hover:text-nu-pink transition-colors truncate">{talent.nickname}</h3>
                       <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[9px] px-1.5 py-0.5 font-bold uppercase ${tier.className}`}>
                             {tier.label}
                          </span>
                          {talent.specialty && (
                            <span className={`text-[9px] px-1.5 py-0.5 font-bold uppercase ${specialtyColors[talent.specialty] || "bg-nu-muted text-white"}`}>
                               {talent.specialty}
                            </span>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-2 bg-nu-cream/30 border border-nu-ink/5">
                       <p className="font-head text-sm font-extrabold">{talent.activity_score}%</p>
                       <p className="text-[8px] uppercase font-mono-nu text-nu-muted">활동지수</p>
                    </div>
                    <div className="text-center p-2 bg-nu-cream/30 border border-nu-ink/5">
                       <p className="font-head text-sm font-extrabold">{talent.total_attendances}회</p>
                       <p className="text-[8px] uppercase font-mono-nu text-nu-muted">출석</p>
                    </div>
                    <div className="text-center p-2 bg-nu-cream/30 border border-nu-ink/5">
                       <p className="font-head text-sm font-extrabold">{talent.leadership_count}회</p>
                       <p className="text-[8px] uppercase font-mono-nu text-nu-muted">리더십</p>
                    </div>
                 </div>

                 <div className="flex flex-wrap gap-1 mb-6 h-[44px] overflow-hidden">
                    {(talent.skill_tags || []).map(tag => (
                      <span key={tag} className="text-[10px] border border-nu-ink/10 px-2 py-0.5 text-nu-muted">#{tag}</span>
                    ))}
                 </div>

                 <Button 
                   variant="outline" 
                   className="w-full font-mono-nu text-[10px] uppercase tracking-widest group-hover:bg-nu-pink group-hover:text-white transition-all group-hover:border-nu-pink"
                   onClick={() => toast.promise(new Promise(r => setTimeout(r, 800)), {
                     loading: '프로필 확인 중...',
                     success: '정보가 로드되었습니다.',
                     error: '오류가 발생했습니다.'
                   })}
                 >
                   VIEW PROFILE <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                 </Button>
               </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 bg-nu-white border border-nu-ink/[0.08]">
          <Search size={40} className="text-nu-muted mx-auto mb-4" />
          <p className="text-nu-gray font-medium">일치하는 인재를 찾을 수 없습니다.</p>
          <p className="text-nu-muted text-sm mt-1">필터를 조정하여 검색 범위를 넓혀보세요.</p>
        </div>
      )}
      </div>
    </div>
  );
}
