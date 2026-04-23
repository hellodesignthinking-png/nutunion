"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, Search, Filter, Award, Zap, Briefcase,
  CheckCircle2, Star, ChefHat, BookOpen, Layers,
  ChevronRight, ArrowRight, UserPlus, Trophy, ChevronDown,
  FileText, Award as AwardIcon, Heart
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHero } from "@/components/shared/page-hero";
import { RecruitingBoltsBanner } from "@/components/talents/recruiting-bolts-banner";

type TierIcon = React.ComponentType<{ size?: number | string; className?: string }>;
const tierConfig: Record<string, { label: string; className: string; icon: TierIcon }> = {
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

const desiredFieldsOptions = [
  "브랜딩",
  "개발",
  "디자인",
  "마케팅",
  "기획",
  "데이터",
  "콘텐츠",
  "운영",
];

interface Portfolio {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
}

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
  bio: string | null;
  desired_fields: string[];
  available_hours: number | null;
  portfolio_count: number;
  endorsement_count: number;
  portfolios: Portfolio[];
}

// Mini radar chart for talent cards
function MiniRadar({ scores }: { scores: number[] }) {
  const r = 28, cx = 35, cy = 35;
  const getP = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    return `${cx + (r * v / 100) * Math.cos(a)},${cy + (r * v / 100) * Math.sin(a)}`;
  };
  return (
    <svg width="70" height="70" className="shrink-0">
      {[30, 60, 100].map(v => (
        <polygon key={v} points={Array.from({length:6}).map((_,i)=>getP(i,v)).join(' ')} className="fill-none stroke-nu-ink/5 stroke-[0.5]" />
      ))}
      <polygon points={scores.map((s,i)=>getP(i,s)).join(' ')} className="fill-nu-blue/15 stroke-nu-blue stroke-[1.5]" />
    </svg>
  );
}

export default function TalentSearchPage() {
  const [talents, setTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minActivity, setMinActivity] = useState(0);
  const [minAttendances, setMinAttendances] = useState(0);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [minPlanning, setMinPlanning] = useState(0);
  const [minExecution, setMinExecution] = useState(0);
  const [minCollab, setMinCollab] = useState(0);
  const [selectedDesiredFields, setSelectedDesiredFields] = useState<string[]>([]);
  const [selectedAvailableHours, setSelectedAvailableHours] = useState<string>("전체");
  const [minEndorsements, setMinEndorsements] = useState(0);
  const [sortBy, setSortBy] = useState<"activity" | "competency" | "endorsements">("activity");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    competency: false,
    advanced: false,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // ── Step 1: Load profiles (most resilient approach) ──
      let profiles: any[] | null = null;

      // Try progressively simpler queries until one works
      const queries = [
        "id, nickname, avatar_url, bio, created_at, skill_tags, tier, activity_score, points, specialty, desired_fields, available_hours",
        "id, nickname, avatar_url, bio, created_at, skill_tags, tier, activity_score, points, specialty",
        "id, nickname, avatar_url, bio, created_at, skill_tags",
        "id, nickname, avatar_url, created_at",
      ];

      for (const cols of queries) {
        const { data, error } = await supabase
          .from("profiles")
          .select(cols)
          .order("created_at", { ascending: false });
        if (!error && data) {
          profiles = data;
          break;
        }
        console.warn(`profiles query failed with columns [${cols}]:`, error?.message);
      }

      if (!profiles || profiles.length === 0) {
        console.error("No profiles found or all queries failed");
        setLoading(false);
        return;
      }

      // ── Step 2: Enrich each profile with activity counts ──
      const enriched: Talent[] = [];

      for (const p of profiles) {
        // Run all count queries in parallel — each wrapped in allSettled so failures don't break anything
        const results = await Promise.allSettled([
          supabase.from("group_members").select("user_id", { count: "exact", head: true }).eq("user_id", p.id).eq("status", "active"),
          supabase.from("project_members").select("user_id", { count: "exact", head: true }).eq("user_id", p.id),
          supabase.from("meeting_notes").select("meeting_id", { count: "exact", head: true }).eq("created_by", p.id),
          supabase.from("crew_posts").select("id", { count: "exact", head: true }).eq("author_id", p.id),
          supabase.from("portfolios").select("id", { count: "exact", head: true }).eq("user_id", p.id),
          supabase.from("endorsements").select("id", { count: "exact", head: true }).eq("endorsed_id", p.id),
        ]);

        const c = (i: number) => {
          const r = results[i];
          return r.status === "fulfilled" && !r.value.error ? r.value.count || 0 : 0;
        };

        const gc = c(0);
        const pj = c(1);
        const mc = c(2);
        const pc = c(3);
        const portfolioCount = c(4);
        const endorsementCount = c(5);

        const activityScore = p.activity_score || Math.min(100, mc * 10 + pc * 8 + pj * 15 + gc * 5);

        // Map DB tier values (scout/settler/pioneer/master) to UI tier values (bronze/silver/gold/vip)
        const tierMap: Record<string, string> = {
          scout: "bronze",
          settler: "silver",
          pioneer: "gold",
          master: "vip",
        };
        const rawTier = p.tier || "";
        const uiTier = tierMap[rawTier] || rawTier || (activityScore >= 80 ? "gold" : activityScore >= 40 ? "silver" : "bronze");

        enriched.push({
          profile_id: p.id,
          nickname: p.nickname || "와셔",
          avatar_url: p.avatar_url || null,
          skill_tags: p.skill_tags || [],
          tier: uiTier,
          activity_score: activityScore,
          points: p.points || 0,
          specialty: p.specialty || null,
          total_attendances: mc,
          leadership_count: gc,
          project_count: pj,
          bio: p.bio || null,
          desired_fields: p.desired_fields || [],
          available_hours: p.available_hours || null,
          portfolio_count: portfolioCount,
          endorsement_count: endorsementCount,
          portfolios: [],
        });
      }

      enriched.sort((a, b) => b.activity_score - a.activity_score);
      setTalents(enriched);
      setLoading(false);
    }
    load();
  }, []);

  // Compute competency scores for each talent
  const getCompetency = (t: Talent) => {
    const planning = Math.min(100, t.total_attendances * 12 + t.leadership_count * 15);
    const sincerity = Math.min(100, t.total_attendances * 10);
    const docs = Math.min(100, t.activity_score * 0.8 + t.leadership_count * 10);
    const execution = Math.min(100, t.project_count * 20 + t.total_attendances * 5);
    const expertise = Math.min(100, t.activity_score * 0.9 + t.project_count * 10);
    const collab = Math.min(100, t.total_attendances * 8 + t.leadership_count * 12);
    return [planning, sincerity, docs, execution, expertise, collab];
  };

  const getCompetencyAverage = (t: Talent) => {
    const scores = getCompetency(t);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const mapAvailableHours = (hourStr: string): number => {
    switch (hourStr) {
      case "전체":
        return 0;
      case "주 5시간 이상":
        return 5;
      case "주 10시간 이상":
        return 10;
      case "주 20시간 이상":
        return 20;
      default:
        return 0;
    }
  };

  const filtered = useMemo(() => {
    let res = talents.filter((t) => {
      const [planning, , , execution, , collab] = getCompetency(t);
      const searchLower = search.toLowerCase();
      const matchesSearch =
        (t.nickname?.toLowerCase().includes(searchLower) ||
          (t.skill_tags || []).some((s) => s.toLowerCase().includes(searchLower)) ||
          (t.bio && t.bio.toLowerCase().includes(searchLower)) ||
          (t.portfolios || []).some(
            (p) =>
              (p.title && p.title.toLowerCase().includes(searchLower)) ||
              (p.description && p.description.toLowerCase().includes(searchLower))
          )) ??
        false;

      const matchesDesiredFields =
        selectedDesiredFields.length === 0 ||
        selectedDesiredFields.some((field) => (t.desired_fields || []).includes(field));

      const minHours = mapAvailableHours(selectedAvailableHours);
      const matchesAvailableHours =
        minHours === 0 || (t.available_hours || 0) >= minHours;

      return (
        matchesSearch &&
        t.activity_score >= minActivity &&
        t.total_attendances >= minAttendances &&
        planning >= minPlanning &&
        execution >= minExecution &&
        collab >= minCollab &&
        matchesDesiredFields &&
        matchesAvailableHours &&
        t.endorsement_count >= minEndorsements &&
        (!selectedTag || (t.skill_tags || []).includes(selectedTag))
      );
    });

    // Apply sorting
    if (sortBy === "competency") {
      res.sort((a, b) => getCompetencyAverage(b) - getCompetencyAverage(a));
    } else if (sortBy === "endorsements") {
      res.sort((a, b) => b.endorsement_count - a.endorsement_count);
    } else {
      // Default: activity
      res.sort((a, b) => b.activity_score - a.activity_score);
    }

    return res;
  }, [
    search,
    minActivity,
    minAttendances,
    selectedTag,
    minPlanning,
    minExecution,
    minCollab,
    selectedDesiredFields,
    selectedAvailableHours,
    minEndorsements,
    sortBy,
    talents,
  ]);

  // Extract all tags for filter
  const allTags = useMemo(() => Array.from(new Set(talents.flatMap((t) => t.skill_tags || []))).sort(), [talents]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const resetFilters = () => {
    setSearch("");
    setMinActivity(0);
    setMinAttendances(0);
    setSelectedTag(null);
    setMinPlanning(0);
    setMinExecution(0);
    setMinCollab(0);
    setSelectedDesiredFields([]);
    setSelectedAvailableHours("전체");
    setMinEndorsements(0);
    setSortBy("activity");
  };

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
        compact
        category="Talent"
        title="와셔 (Washer)"
        description="데이터로 검증된 와셔를 찾아보세요. 역량 배지 + 동료 보증 기반의 팀 빌딩."
      />

      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* 구인 중인 볼트 — 신뢰 기반 매칭 (Venture 데이터 연동) */}
        <RecruitingBoltsBanner />

        {/* TOP TALENT READY Banner as a sub-header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-nu-pink/5 border border-nu-pink/20 p-6 md:p-8">
           <div className="flex-1">
             <h4 className="font-head text-2xl font-extrabold text-nu-ink mb-1 flex items-center gap-2">
               <Zap size={20} className="text-nu-pink fill-nu-pink" /> TOP TALENT READY
             </h4>
             <p className="text-nu-gray text-sm font-medium">데이터가 증명하는 최상위 와셔들이 실전 투입을 기다리고 있습니다.</p>
           </div>
           <div className="text-center md:text-right shrink-0">
             <p className="font-head text-4xl font-extrabold text-nu-pink">{talents.filter(t => t.activity_score >= 80).length}</p>
             <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink/60 font-bold">Available Talents</p>
           </div>
        </div>

      {/* Filter Bar */}
      <div className="bg-nu-white border border-nu-ink/[0.08] p-6 mb-8">
        {/* Search + Sort + Reset */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" size={16} />
            <Input
              placeholder="이름, 스킬, 포트폴리오, 소개 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 bg-nu-cream/20 border-nu-ink/10"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "activity" | "competency" | "endorsements")}
              className="flex-1 h-12 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none font-mono-nu text-[12px] uppercase tracking-widest"
            >
              <option value="activity">최신 활동순</option>
              <option value="competency">역량 점수 높은순</option>
              <option value="endorsements">동료 보증 많은순</option>
            </select>
            <Button
              variant="outline"
              onClick={resetFilters}
              className="font-mono-nu text-[11px] uppercase tracking-widest"
            >
              필터 초기화
            </Button>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6 pb-4 border-b border-nu-ink/5">
          <p className="font-head text-sm font-bold text-nu-ink">
            {filtered.length}명의 와셔
          </p>
        </div>

        {/* Basic Filters (Collapsible) */}
        <div className="mb-4">
          <button
            onClick={() => toggleSection("basic")}
            className="w-full flex items-center justify-between p-3 bg-nu-cream/20 border border-nu-ink/5 hover:bg-nu-cream/30 transition-colors"
          >
            <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-ink font-bold flex items-center gap-2">
              <Filter size={12} /> 기본 필터
            </p>
            <ChevronDown
              size={16}
              className={`transition-transform ${expandedSections.basic ? "" : "-rotate-90"}`}
            />
          </button>
          {expandedSections.basic && (
            <div className="p-4 border border-t-0 border-nu-ink/5 grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div>
                <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block mb-2">
                  강성 ({minActivity}%+)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={minActivity}
                  onChange={(e) => setMinActivity(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-nu-cream rounded-lg appearance-none cursor-pointer accent-nu-pink"
                />
              </div>
              <div>
                <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block mb-2">
                  최소 출석
                </label>
                <select
                  value={minAttendances}
                  onChange={(e) => setMinAttendances(parseInt(e.target.value))}
                  className="w-full h-10 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none"
                >
                  <option value="0">전체</option>
                  <option value="3">3회 이상</option>
                  <option value="10">10회 이상</option>
                  <option value="30">30회 이상</option>
                </select>
              </div>
              <div>
                <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block mb-2">
                  희망 분야
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {desiredFieldsOptions.map((field) => (
                    <button
                      key={field}
                      onClick={() => {
                        setSelectedDesiredFields((prev) =>
                          prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
                        );
                      }}
                      className={`text-[11px] px-2 py-1 transition-all ${
                        selectedDesiredFields.includes(field)
                          ? "bg-nu-pink text-white"
                          : "border border-nu-ink/10 text-nu-muted hover:border-nu-pink"
                      }`}
                    >
                      {field}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block mb-2">
                  가용 시간
                </label>
                <select
                  value={selectedAvailableHours}
                  onChange={(e) => setSelectedAvailableHours(e.target.value)}
                  className="w-full h-10 border border-nu-ink/10 bg-nu-cream/10 px-3 text-sm focus:outline-none"
                >
                  <option value="전체">전체</option>
                  <option value="주 5시간 이상">주 5시간 이상</option>
                  <option value="주 10시간 이상">주 10시간 이상</option>
                  <option value="주 20시간 이상">주 20시간 이상</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Competency Filter (Collapsible) */}
        <div className="mb-4">
          <button
            onClick={() => toggleSection("competency")}
            className="w-full flex items-center justify-between p-3 bg-nu-cream/20 border border-nu-ink/5 hover:bg-nu-cream/30 transition-colors"
          >
            <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-ink font-bold flex items-center gap-2">
              <Layers size={12} /> 역량 필터
            </p>
            <ChevronDown
              size={16}
              className={`transition-transform ${expandedSections.competency ? "" : "-rotate-90"}`}
            />
          </button>
          {expandedSections.competency && (
            <div className="p-4 border border-t-0 border-nu-ink/5 grid grid-cols-3 gap-4">
              <div>
                <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-blue font-bold block mb-1">
                  기획 ({minPlanning}+)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={minPlanning}
                  onChange={(e) => setMinPlanning(parseInt(e.target.value))}
                  className="w-full h-1 bg-nu-cream rounded-lg appearance-none cursor-pointer accent-nu-blue"
                />
              </div>
              <div>
                <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink font-bold block mb-1">
                  실행 ({minExecution}+)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={minExecution}
                  onChange={(e) => setMinExecution(parseInt(e.target.value))}
                  className="w-full h-1 bg-nu-cream rounded-lg appearance-none cursor-pointer accent-nu-pink"
                />
              </div>
              <div>
                <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-amber font-bold block mb-1">
                  협업 ({minCollab}+)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={minCollab}
                  onChange={(e) => setMinCollab(parseInt(e.target.value))}
                  className="w-full h-1 bg-nu-cream rounded-lg appearance-none cursor-pointer accent-nu-amber"
                />
              </div>
            </div>
          )}
        </div>

        {/* Advanced Filters (Collapsible) */}
        <div className="mb-4">
          <button
            onClick={() => toggleSection("advanced")}
            className="w-full flex items-center justify-between p-3 bg-nu-cream/20 border border-nu-ink/5 hover:bg-nu-cream/30 transition-colors"
          >
            <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-ink font-bold flex items-center gap-2">
              <Award size={12} /> 고급 필터
            </p>
            <ChevronDown
              size={16}
              className={`transition-transform ${expandedSections.advanced ? "" : "-rotate-90"}`}
            />
          </button>
          {expandedSections.advanced && (
            <div className="p-4 border border-t-0 border-nu-ink/5 space-y-4">
              <div>
                <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted block mb-3">
                  최소 보증 수 ({minEndorsements})
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 3, 5, 10].map((val) => (
                    <button
                      key={val}
                      onClick={() => setMinEndorsements(val)}
                      className={`py-2 text-[12px] font-bold uppercase tracking-widest transition-all ${
                        minEndorsements === val
                          ? "bg-nu-pink text-white"
                          : "border border-nu-ink/10 text-nu-muted hover:border-nu-pink"
                      }`}
                    >
                      {val}건
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-3 flex items-center gap-2">
                  인기 태그:
                </p>
                <div className="flex flex-wrap gap-2">
                  {allTags.slice(0, 15).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      className={`text-[12px] px-2.5 py-1 transition-all ${
                        selectedTag === tag
                          ? "bg-nu-ink text-white"
                          : "border border-nu-ink/10 text-nu-muted hover:border-nu-pink"
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
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
                    <div className="bg-nu-pink text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 flex items-center gap-1 shadow-lg">
                      <Zap size={10} fill="currentColor" /> PROJECT READY
                    </div>
                 </div>
               )}
               
               <div className="p-6">
                 <div className="flex items-start gap-4 mb-4">
                    <div className="relative">
                      {talent.avatar_url ? (
                        <Image src={talent.avatar_url} alt={talent.nickname || "프로필"} width={64} height={64} className="rounded-full object-cover border-2 border-nu-cream" />
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
                          <span className={`text-[11px] px-1.5 py-0.5 font-bold uppercase ${tier.className}`}>
                             {tier.label}
                          </span>
                          {talent.specialty && (
                            <span className={`text-[11px] px-1.5 py-0.5 font-bold uppercase ${specialtyColors[talent.specialty] || "bg-nu-muted text-white"}`}>
                               {talent.specialty}
                            </span>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="flex items-center gap-3 mb-4">
                    <MiniRadar scores={getCompetency(talent)} />
                    <div className="flex-1 grid grid-cols-3 gap-1.5">
                       <div className="text-center p-1.5 bg-nu-cream/30 border border-nu-ink/5">
                          <p className="font-head text-xs font-extrabold">{talent.activity_score}%</p>
                          <p className="text-[9px] uppercase font-mono-nu text-nu-muted">활동</p>
                       </div>
                       <div className="text-center p-1.5 bg-nu-cream/30 border border-nu-ink/5">
                          <p className="font-head text-xs font-extrabold">{talent.total_attendances}</p>
                          <p className="text-[9px] uppercase font-mono-nu text-nu-muted">출석</p>
                       </div>
                       <div className="text-center p-1.5 bg-nu-cream/30 border border-nu-ink/5">
                          <p className="font-head text-xs font-extrabold">{talent.endorsement_count}</p>
                          <p className="text-[9px] uppercase font-mono-nu text-nu-muted">보증</p>
                       </div>
                    </div>
                 </div>

                 <div className="flex flex-wrap gap-1 mb-6 h-[44px] overflow-hidden">
                    {(talent.skill_tags || []).map((tag) => (
                      <span key={tag} className="text-[12px] border border-nu-ink/10 px-2 py-0.5 text-nu-muted">
                        #{tag}
                      </span>
                    ))}
                    {talent.portfolio_count > 0 && (
                      <span className="text-[12px] border border-nu-pink/30 bg-nu-pink/5 px-2 py-0.5 text-nu-pink font-bold flex items-center gap-1">
                        <FileText size={10} /> 포트폴리오 {talent.portfolio_count}건
                      </span>
                    )}
                 </div>

                 <Link href={`/portfolio/${talent.profile_id}`}>
                   <Button
                     variant="outline"
                     className="w-full font-mono-nu text-[12px] uppercase tracking-widest group-hover:bg-nu-pink group-hover:text-white transition-all group-hover:border-nu-pink"
                   >
                     VIEW PROFILE <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                   </Button>
                 </Link>
               </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20 bg-nu-white border border-nu-ink/[0.08]">
          <Search size={40} className="text-nu-muted mx-auto mb-4" />
          <p className="text-nu-gray font-medium">일치하는 와셔를 찾을 수 없습니다.</p>
          <p className="text-nu-muted text-sm mt-1">필터를 조정하여 검색 범위를 넓혀보세요.</p>
        </div>
      )}
      </div>
    </div>
  );
}
