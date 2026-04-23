"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Search, Users, Filter, Trophy, Sparkles, Flame, Zap, TrendingUp, MapPin, Grid3x3, List, Shuffle } from "lucide-react";
import { PageHero } from "@/components/shared/page-hero";
import { getGrade, getCategory } from "@/lib/constants";

interface MemberItem {
  id: string;
  name: string | null;
  nickname: string;
  email: string;
  specialty: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  grade: string | null;
  can_create_crew: boolean;
  created_at: string;
  points?: number | null;
  activity_score?: number | null;
}

type View = "grid" | "list" | "radial";

const SPECIALTY_META: Record<string, { label: string; color: string; emoji: string; vibe: string }> = {
  space:    { label: "공간", color: "bg-nu-blue",  emoji: "🏢", vibe: "Architect" },
  culture:  { label: "문화", color: "bg-nu-amber", emoji: "🎨", vibe: "Curator" },
  platform: { label: "플랫폼", color: "bg-nu-ink",  emoji: "💻", vibe: "Builder" },
  vibe:     { label: "바이브", color: "bg-nu-pink", emoji: "✨", vibe: "Designer" },
};

export default function MembersPage() {
  const [members, setMembers]   = useState<MemberItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [specialty, setSpecialty] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [view, setView] = useState<View>("grid");
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(60);
  const PAGE_SIZE = 60;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      // 1차 시도: points/activity_score 포함 (008 적용 시)
      const full = await supabase
        .from("profiles")
        .select("id, name, nickname, specialty, avatar_url, bio, role, grade, can_create_crew, created_at, points, activity_score")
        .order("created_at", { ascending: false });

      type ProfileRow = Partial<MemberItem> & { id: string; nickname: string; role: string; created_at: string };
      let rows: ProfileRow[] | null = (full.data as ProfileRow[] | null) ?? null;

      if (full.error) {
        console.warn("[members] full select failed, retrying with core columns:", full.error.message);
        // fallback: 필수 컬럼만
        const basic = await supabase
          .from("profiles")
          .select("id, name, nickname, specialty, avatar_url, bio, role, grade, can_create_crew, created_at")
          .order("created_at", { ascending: false });
        if (basic.error) {
          setLoadError(basic.error.message);
          setLoading(false);
          return;
        }
        rows = (basic.data as ProfileRow[] | null) ?? null;
      }

      setMembers(((rows) || []).map((m): MemberItem => ({
        id: m.id,
        name: m.name ?? null,
        nickname: m.nickname,
        email: "",
        specialty: m.specialty ?? null,
        avatar_url: m.avatar_url ?? null,
        bio: m.bio ?? null,
        role: m.role,
        grade: m.grade || (m.role === "admin" ? "vip" : m.can_create_crew ? "silver" : "bronze"),
        can_create_crew: m.can_create_crew ?? false,
        created_at: m.created_at,
        points: m.points ?? 0,
        activity_score: m.activity_score ?? 0,
      })));
      setLoading(false);
    }
    load();
  }, []);

  // seed 기반 PRNG (mulberry32) — deterministic
  function mulberry32(seed: number) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = members.filter((m) => {
      const matchSearch =
        !q ||
        m.nickname?.toLowerCase().includes(q) ||
        (m.name || "").toLowerCase().includes(q) ||
        (m.bio || "").toLowerCase().includes(q) ||
        (m.specialty || "").toLowerCase().includes(q) ||
        (SPECIALTY_META[m.specialty ?? ""]?.vibe.toLowerCase() || "").includes(q);
      const matchSpecialty = specialty === "all" || m.specialty === specialty;
      const effectiveGrade = m.role === "admin" ? "admin" : (m.grade || "bronze");
      const matchGrade = gradeFilter === "all" || effectiveGrade === gradeFilter;
      return matchSearch && matchSpecialty && matchGrade;
    });
    if (shuffleSeed > 0) {
      // Fisher-Yates with seeded PRNG — 진짜 랜덤
      const arr = [...base];
      const rand = mulberry32(shuffleSeed);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    return base;
  }, [members, search, specialty, gradeFilter, shuffleSeed]);

  // 필터 변경 시 보이는 카드 수 리셋
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, specialty, gradeFilter, shuffleSeed]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  // 👑 상위 기여자 3명 (활동 점수 + 포인트 기반)
  const topContributors = useMemo(() => {
    return [...members]
      .sort((a, b) => {
        const sa = (a.activity_score ?? 0) + (a.points ?? 0);
        const sb = (b.activity_score ?? 0) + (b.points ?? 0);
        return sb - sa;
      })
      .slice(0, 3);
  }, [members]);

  // 🎲 스포트라이트 — 랜덤 와셔 (bio 있는)
  const spotlight = useMemo(() => {
    const withBio = members.filter((m) => m.bio && m.bio.trim().length > 10);
    if (withBio.length === 0) return null;
    return withBio[Math.floor(Date.now() / 600000) % withBio.length];
  }, [members]);

  // 🆕 이번 주 새 와셔
  const newThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    return members.filter((m) => new Date(m.created_at).getTime() > weekAgo);
  }, [members]);

  // 분야별 집계
  const specialtyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      if (m.specialty) counts.set(m.specialty, (counts.get(m.specialty) ?? 0) + 1);
    }
    return counts;
  }, [members]);

  // 등급별 집계
  const gradeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      const g = m.role === "admin" ? "admin" : (m.grade || "bronze");
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return counts;
  }, [members]);

  // 활동 상위 75% 임계치 — 시각화 기준
  const activityStats = useMemo(() => {
    const scores = members.map((m) => (m.activity_score ?? 0) + (m.points ?? 0)).sort((a, b) => b - a);
    if (scores.length === 0) return { max: 1, p25: 0, p50: 0, p75: 0 };
    return {
      max: Math.max(1, scores[0]),
      p25: scores[Math.floor(scores.length * 0.25)] ?? 0,
      p50: scores[Math.floor(scores.length * 0.5)] ?? 0,
      p75: scores[Math.floor(scores.length * 0.75)] ?? 0,
    };
  }, [members]);

  return (
    <div className="bg-nu-paper min-h-screen pb-20">
      <PageHero
        compact
        category="Connect"
        title="와셔 (Washer)"
        description="너트를 단단하게 지지하는 구성원들. 분야별 전문가와 열정가가 모여있습니다."
        stats={[
          { label: "총 와셔", value: `${members.length}명`, icon: <Users size={12} /> },
          { label: "이번 주 신규", value: `${newThisWeek.length}명`, icon: <Sparkles size={12} /> },
        ]}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-6">
        {/* 🏆 TOP 3 Hall of Fame */}
        {!loading && topContributors.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={16} className="text-nu-amber" />
              <h2 className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-amber font-bold">
                🏆 Hall of Fame — 이번 달 상위 기여자
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {topContributors.map((m, i) => {
                const g = getGrade(m);
                const medals = ["🥇", "🥈", "🥉"];
                const bgGradients = [
                  "from-yellow-100 via-yellow-50 to-nu-paper",
                  "from-gray-100 via-gray-50 to-nu-paper",
                  "from-orange-100 via-orange-50 to-nu-paper",
                ];
                return (
                  <div
                    key={m.id}
                    className={`relative border-[2.5px] border-nu-ink bg-gradient-to-br ${bgGradients[i]} p-4 overflow-hidden`}
                  >
                    <div className="absolute -top-4 -right-4 text-[80px] opacity-20 select-none">
                      {medals[i]}
                    </div>
                    <div className="relative flex items-center gap-3">
                      {m.avatar_url ? (
                        <Image src={m.avatar_url} alt={m.nickname} width={56} height={56} className="rounded-full object-cover border-[2px] border-nu-ink shrink-0" unoptimized />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-nu-cream border-[2px] border-nu-ink flex items-center justify-center font-head text-xl font-bold text-nu-ink shrink-0">
                          {(m.nickname || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-amber font-bold">
                            #{i + 1}
                          </span>
                          <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 ${g.cls}`}>
                            {g.label}
                          </span>
                        </div>
                        <div className="font-bold text-[15px] text-nu-ink truncate mt-0.5">{m.nickname}</div>
                        <div className="font-mono-nu text-[10px] text-nu-graphite">
                          활동 {m.activity_score ?? 0} · 🥜 {m.points ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ✨ 스포트라이트 + 신규 */}
        {!loading && (spotlight || newThisWeek.length > 0) && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {spotlight && (
              <div className="border-[2.5px] border-nu-pink bg-nu-pink/5 p-4 relative overflow-hidden">
                <div className="absolute top-2 right-2 font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink font-bold">
                  ✨ Spotlight
                </div>
                <div className="flex items-start gap-3">
                  {spotlight.avatar_url ? (
                    <Image src={spotlight.avatar_url} alt="" width={48} height={48} className="rounded-full object-cover border-[2px] border-nu-pink shrink-0" unoptimized />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-nu-pink/20 border-[2px] border-nu-pink flex items-center justify-center font-head text-lg font-bold text-nu-pink shrink-0">
                      {spotlight.nickname.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[14px] text-nu-ink">{spotlight.nickname}</div>
                    {spotlight.specialty && SPECIALTY_META[spotlight.specialty] && (
                      <div className="font-mono-nu text-[10px] text-nu-graphite mt-0.5">
                        {SPECIALTY_META[spotlight.specialty].emoji} {SPECIALTY_META[spotlight.specialty].vibe}
                      </div>
                    )}
                    <p className="text-[12px] text-nu-graphite mt-1.5 leading-relaxed line-clamp-3 italic">
                      &ldquo;{spotlight.bio}&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            )}
            {newThisWeek.length > 0 && (
              <div className="border-[2.5px] border-green-600 bg-green-50 p-4">
                <div className="font-mono-nu text-[9px] uppercase tracking-widest text-green-700 font-bold mb-2">
                  🆕 이번 주 합류 ({newThisWeek.length}명)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {newThisWeek.slice(0, 8).map((m) => (
                    <div key={m.id} className="flex items-center gap-1 border border-green-300 bg-nu-paper px-1.5 py-1">
                      {m.avatar_url ? (
                        <Image src={m.avatar_url} alt="" width={20} height={20} className="rounded-full object-cover shrink-0" unoptimized />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-[10px] font-bold text-green-700 shrink-0">
                          {m.nickname.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-mono-nu text-[11px] text-nu-ink">{m.nickname}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 📊 Community Composition Dashboard */}
        {!loading && members.length > 0 && (
          <CompositionDashboard
            members={members}
            specialtyCounts={specialtyCounts}
            gradeCounts={gradeCounts}
          />
        )}

        {/* 🎯 분야별 탭 (visual filter) */}
        {!loading && specialtyCounts.size > 0 && (
          <section>
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
              분야별 분포
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSpecialty("all")}
                className={`shrink-0 px-3 py-2 border-[2px] font-mono-nu text-[11px] uppercase tracking-widest ${
                  specialty === "all" ? "border-nu-ink bg-nu-ink text-nu-paper" : "border-nu-ink/30 bg-nu-paper text-nu-ink hover:border-nu-ink"
                }`}
              >
                🎯 전체 {members.length}
              </button>
              {Object.entries(SPECIALTY_META).map(([key, meta]) => {
                const count = specialtyCounts.get(key) ?? 0;
                const active = specialty === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSpecialty(active ? "all" : key)}
                    className={`shrink-0 px-3 py-2 border-[2px] font-mono-nu text-[11px] uppercase tracking-widest transition-colors ${
                      active
                        ? `border-nu-ink ${meta.color} text-white`
                        : `border-nu-ink/30 bg-nu-paper text-nu-ink hover:border-nu-ink`
                    }`}
                  >
                    {meta.emoji} {meta.label} <span className="opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 🔎 Search + View Toggle */}
        <section className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
            <input
              type="text"
              placeholder="이름 · 닉네임 · 자기소개 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border-[2px] border-nu-ink/20 bg-nu-paper focus:outline-none focus:border-nu-pink transition-colors"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
            <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 text-sm border-[2px] border-nu-ink/20 bg-nu-paper focus:outline-none appearance-none cursor-pointer">
              <option value="all">전체 등급</option>
              <option value="admin">최고관리자</option>
              <option value="vip">VIP</option>
              <option value="gold">골드</option>
              <option value="silver">실버</option>
              <option value="bronze">브론즈</option>
            </select>
          </div>

          {/* View toggle */}
          <div className="inline-flex border-[2px] border-nu-ink">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`w-10 h-10 flex items-center justify-center ${view === "grid" ? "bg-nu-ink text-nu-paper" : "bg-nu-paper text-nu-ink hover:bg-nu-ink/5"}`}
              aria-label="그리드 보기"
              title="그리드"
            >
              <Grid3x3 size={15} />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`w-10 h-10 flex items-center justify-center border-l-[2px] border-nu-ink ${view === "list" ? "bg-nu-ink text-nu-paper" : "bg-nu-paper text-nu-ink hover:bg-nu-ink/5"}`}
              aria-label="리스트 보기"
              title="리스트"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => setView("radial")}
              className={`w-10 h-10 flex items-center justify-center border-l-[2px] border-nu-ink ${view === "radial" ? "bg-nu-ink text-nu-paper" : "bg-nu-paper text-nu-ink hover:bg-nu-ink/5"}`}
              aria-label="벌집 보기"
              title="벌집"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 22,8 22,16 12,22 2,16 2,8" strokeWidth="1.5" stroke="currentColor" fill="none" /></svg>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShuffleSeed(Date.now())}
            className="h-10 px-3 border-[2px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-pink hover:text-nu-paper hover:border-nu-pink inline-flex items-center gap-1.5"
            title="우연한 만남"
          >
            <Shuffle size={13} /> 섞기
          </button>
        </section>

        <div className="flex items-center justify-between">
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">
            {filtered.length}명 표시 / 전체 {members.length}명
          </p>
          {shuffleSeed > 0 && (
            <button type="button" onClick={() => setShuffleSeed(0)} className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink">
              원래 순서로 ↻
            </button>
          )}
        </div>

        {/* 뷰별 렌더 */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-nu-paper border-[2px] border-nu-ink/10 p-4 animate-pulse h-24" />
            ))}
          </div>
        ) : loadError ? (
          <div className="border-[2.5px] border-red-500 bg-red-50 p-6">
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-red-700 mb-1">⚠ 로드 실패</div>
            <p className="text-[13px] text-red-700 leading-relaxed">
              프로필 목록을 불러오지 못했습니다: <code className="font-mono-nu text-[11px]">{loadError}</code>
            </p>
            <p className="text-[12px] text-red-600 mt-2">RLS 정책 또는 컬럼 스키마를 확인하세요.</p>
          </div>
        ) : members.length === 0 ? (
          <div className="border-[2px] border-dashed border-nu-ink/30 p-12 text-center">
            <Users size={28} className="mx-auto text-nu-muted mb-3" />
            <p className="text-nu-gray text-sm">등록된 와셔가 없습니다</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border-[2px] border-dashed border-nu-ink/30 p-12 text-center">
            <Users size={28} className="mx-auto text-nu-muted mb-3" />
            <p className="text-nu-gray text-sm">검색/필터 조건에 맞는 와셔가 없습니다</p>
            <button
              type="button"
              onClick={() => { setSearch(""); setSpecialty("all"); setGradeFilter("all"); setShuffleSeed(0); }}
              className="mt-3 font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink hover:underline"
            >
              필터 초기화 →
            </button>
          </div>
        ) : view === "radial" ? (
          <HoneycombView members={visible} activityMax={activityStats.max} />
        ) : view === "list" ? (
          <MemberListView members={visible} activityMax={activityStats.max} />
        ) : (
          <MemberGridView members={visible} activityMax={activityStats.max} />
        )}

        {/* 더 보기 */}
        {!loading && filtered.length > visibleCount && (
          <div className="flex flex-col items-center gap-2 pt-4">
            <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite">
              {visibleCount} / {filtered.length} 표시 중
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="h-10 px-4 border-[2px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper transition-colors"
              >
                + {Math.min(PAGE_SIZE, filtered.length - visibleCount)}명 더 보기
              </button>
              <button
                type="button"
                onClick={() => setVisibleCount(filtered.length)}
                className="h-10 px-4 border-[2px] border-nu-ink/20 bg-nu-paper text-nu-graphite font-mono-nu text-[11px] uppercase tracking-widest hover:border-nu-ink hover:text-nu-ink transition-colors"
              >
                전체 보기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 그리드 뷰 ────────────────────────────────────────────────
function MemberGridView({ members, activityMax }: { members: MemberItem[]; activityMax: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {members.map((m) => {
        const g = getGrade(m);
        const GIcon = g.icon;
        const specMeta = m.specialty ? SPECIALTY_META[m.specialty] : null;
        const totalScore = (m.activity_score ?? 0) + (m.points ?? 0);
        const isActive = totalScore > 0;

        return (
          <Link
            key={m.id}
            href={`/portfolio/${m.id}`}
            className={`group relative bg-nu-paper border-[2px] ${isActive ? "border-nu-ink/20" : "border-nu-ink/10"} p-4 hover:border-nu-pink hover:shadow-[4px_4px_0_0_rgba(255,61,136,0.2)] transition-all no-underline overflow-hidden`}
          >
            {/* 분야 상단 컬러 스트라이프 */}
            {specMeta && (
              <div className={`absolute top-0 left-0 right-0 h-1 ${specMeta.color}`} />
            )}
            <div className="flex items-start gap-3">
              {/* 아바타 + Activity Ring 오버레이 */}
              <div className="relative shrink-0">
                {m.avatar_url ? (
                  <Image src={m.avatar_url} alt={m.nickname} width={52} height={52} className="rounded-full object-cover border-[1.5px] border-nu-ink/20 group-hover:border-nu-pink transition-colors" unoptimized />
                ) : (
                  <div className="w-[52px] h-[52px] rounded-full bg-gradient-to-br from-nu-pink/20 to-nu-blue/20 border-[1.5px] border-nu-ink/20 flex items-center justify-center font-head text-xl font-bold text-nu-ink">
                    {(m.nickname || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                {/* 활동 링 */}
                {isActive && (
                  <div className="absolute -inset-1 pointer-events-none">
                    <ActivityRing score={totalScore} max={activityMax} size={60} />
                  </div>
                )}
                {/* 등급 아이콘 배지 */}
                <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-[2px] border-nu-paper flex items-center justify-center ${g.cls}`}>
                  <GIcon size={9} />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-[14px] text-nu-ink truncate">{m.nickname}</span>
                  {m.role === "admin" && (
                    <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-red-600 text-white px-1 py-0.5">ADMIN</span>
                  )}
                </div>
                {m.name && <p className="text-[11px] text-nu-muted truncate">{m.name}</p>}
                {specMeta && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <span className={`inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 text-white ${specMeta.color}`}>
                      {specMeta.emoji} {specMeta.vibe}
                    </span>
                    <span className="font-mono-nu text-[9px] text-nu-graphite uppercase">{g.label}</span>
                  </div>
                )}
                {m.bio && <p className="text-[11px] text-nu-graphite mt-1.5 line-clamp-2 leading-relaxed">{m.bio}</p>}
              </div>
            </div>

            {/* 하단 스탯 바 */}
            {isActive && (
              <div className="mt-3 pt-3 border-t border-nu-ink/10 flex items-center gap-3 font-mono-nu text-[10px]">
                {(m.activity_score ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <Flame size={10} className="text-nu-pink" />
                    <span className="font-bold text-nu-ink tabular-nums">{m.activity_score}</span>
                    <span className="text-nu-graphite">활동</span>
                  </div>
                )}
                {(m.points ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-nu-amber">🥜</span>
                    <span className="font-bold text-nu-ink tabular-nums">{m.points}</span>
                    <span className="text-nu-graphite">pts</span>
                  </div>
                )}
                {/* Horizontal progress bar (intensity) */}
                <div className="flex-1 h-1.5 bg-nu-ink/5 overflow-hidden ml-auto">
                  <div
                    className="h-full bg-gradient-to-r from-nu-pink via-nu-amber to-nu-blue"
                    style={{ width: `${Math.min(100, (totalScore / Math.max(1, activityMax)) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

// ── 리스트 뷰 — 인라인 활동 bar ──────────────────────────────
function MemberListView({ members, activityMax }: { members: MemberItem[]; activityMax: number }) {
  return (
    <div className="border-[2px] border-nu-ink bg-nu-paper">
      <ul className="divide-y divide-nu-ink/10 list-none m-0 p-0">
        {members.map((m) => {
          const g = getGrade(m);
          const specMeta = m.specialty ? SPECIALTY_META[m.specialty] : null;
          const totalScore = (m.activity_score ?? 0) + (m.points ?? 0);
          const scorePct = activityMax > 0 ? Math.min(100, (totalScore / activityMax) * 100) : 0;
          return (
            <li key={m.id}>
              <Link
                href={`/portfolio/${m.id}`}
                className="flex items-center gap-3 p-3 hover:bg-nu-pink/5 no-underline group relative"
              >
                {/* 왼쪽 specialty 세로 stripe */}
                {specMeta && (
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${specMeta.color}`} />
                )}
                {m.avatar_url ? (
                  <Image src={m.avatar_url} alt="" width={36} height={36} className="rounded-full object-cover shrink-0" unoptimized />
                ) : (
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-head text-sm font-bold shrink-0 ${specMeta ? `${specMeta.color} text-white` : "bg-nu-cream text-nu-ink"}`}>
                    {m.nickname.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-[13px] text-nu-ink truncate">{m.nickname}</span>
                    <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-1 py-0.5 ${g.cls}`}>
                      {g.label}
                    </span>
                    {specMeta && (
                      <span className="font-mono-nu text-[9px] text-nu-graphite uppercase">
                        {specMeta.emoji} {specMeta.vibe}
                      </span>
                    )}
                    {m.role === "admin" && (
                      <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-red-600 text-white px-1">ADMIN</span>
                    )}
                  </div>
                  {m.bio && <p className="text-[11px] text-nu-graphite line-clamp-1">{m.bio}</p>}
                </div>
                {/* 활동 bar (세로) */}
                <div className="shrink-0 w-24 hidden sm:flex flex-col items-end gap-1">
                  <div className="font-mono-nu text-[10px] text-nu-graphite flex items-center gap-2 tabular-nums">
                    {(m.activity_score ?? 0) > 0 && <span><Flame size={9} className="inline text-nu-pink" /> {m.activity_score}</span>}
                    {(m.points ?? 0) > 0 && <span>🥜 {m.points}</span>}
                  </div>
                  <div className="h-1.5 w-full bg-nu-ink/5 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-nu-pink via-nu-amber to-nu-blue" style={{ width: `${scorePct}%` }} />
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── 벌집 (Honeycomb) 뷰 — 활동 intensity 채색 ────────────────
function HoneycombView({ members, activityMax }: { members: MemberItem[]; activityMax: number }) {
  return (
    <div className="border-[2.5px] border-nu-ink bg-gradient-to-br from-nu-paper via-nu-cream/20 to-nu-pink/5 p-4 sm:p-6 overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite">
          🧬 와셔 벌집 — {members.length}명의 연결체
        </div>
        <div className="flex items-center gap-2 font-mono-nu text-[9px] text-nu-graphite">
          <span>활동 강도:</span>
          <div className="flex items-center gap-0.5">
            <div className="w-3 h-3 bg-nu-ink/20" title="0" />
            <div className="w-3 h-3 bg-nu-blue/60" title="낮음" />
            <div className="w-3 h-3 bg-nu-amber" title="중간" />
            <div className="w-3 h-3 bg-nu-pink" title="높음" />
          </div>
        </div>
      </div>
      <div
        className="grid gap-1 justify-center"
        style={{ gridTemplateColumns: "repeat(auto-fill, 72px)" }}
      >
        {members.map((m) => {
          const g = getGrade(m);
          const specMeta = m.specialty ? SPECIALTY_META[m.specialty] : null;
          const totalScore = (m.activity_score ?? 0) + (m.points ?? 0);
          const intensity = activityMax > 0 ? totalScore / activityMax : 0;

          // intensity 기반 배경
          let bgClass = "bg-nu-ink/20";
          if (intensity > 0.66) bgClass = "bg-nu-pink";
          else if (intensity > 0.33) bgClass = "bg-nu-amber";
          else if (intensity > 0) bgClass = "bg-nu-blue/60";

          return (
            <Link
              key={m.id}
              href={`/portfolio/${m.id}`}
              className="group relative"
              title={`${m.nickname}${specMeta ? " · " + specMeta.vibe : ""} · 활동 ${totalScore}${m.bio ? "\n" + m.bio.slice(0, 80) : ""}`}
              style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
            >
              <div className={`w-[72px] h-[80px] flex items-center justify-center ${bgClass} group-hover:bg-nu-ink transition-colors relative overflow-hidden`}>
                {m.avatar_url ? (
                  <Image
                    src={m.avatar_url}
                    alt=""
                    width={72}
                    height={80}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-head text-xl font-bold text-nu-paper">
                    {m.nickname.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* specialty 코너 dot */}
                {specMeta && (
                  <div className={`absolute top-1.5 right-2 w-2 h-2 rounded-full border border-nu-paper ${specMeta.color}`} />
                )}

                {/* 호버 시 정보 */}
                <div className="absolute inset-0 bg-nu-ink/85 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-1">
                  <div className="font-bold text-[10px] text-nu-paper text-center truncate w-full">{m.nickname}</div>
                  <div className="font-mono-nu text-[8px] text-nu-paper/70 uppercase tracking-widest">{g.label}</div>
                  {totalScore > 0 && (
                    <div className="font-mono-nu text-[8px] text-nu-pink mt-0.5">⚡ {totalScore}</div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="mt-4 text-center font-mono-nu text-[10px] text-nu-graphite">
        💡 육각형 배경색 = 활동 강도 · 우측 dot = 분야 · 호버 시 상세
      </div>
    </div>
  );
}

// ── 📊 Composition Dashboard ─────────────────────────────────
function CompositionDashboard({
  members,
  specialtyCounts,
  gradeCounts,
}: {
  members: MemberItem[];
  specialtyCounts: Map<string, number>;
  gradeCounts: Map<string, number>;
}) {
  const total = members.length;
  const withSpec = [...specialtyCounts.entries()].reduce((s, [, v]) => s + v, 0);
  const otherSpec = total - withSpec;

  // 색상 맵
  const gradeMeta: Record<string, { label: string; color: string; emoji: string }> = {
    admin: { label: "ADMIN", color: "bg-red-600", emoji: "⚡" },
    vip:    { label: "VIP",   color: "bg-nu-pink", emoji: "💎" },
    gold:   { label: "GOLD",  color: "bg-yellow-500", emoji: "🥇" },
    silver: { label: "SILVER", color: "bg-gray-400", emoji: "🥈" },
    bronze: { label: "BRONZE", color: "bg-orange-400", emoji: "🥉" },
  };

  // 이번 주 신규 / 활동 중 / 비활동 분류
  const weekAgo = Date.now() - 7 * 86400000;
  const now = Date.now();
  const monthAgo = now - 30 * 86400000;
  const newMembers = members.filter((m) => new Date(m.created_at).getTime() > weekAgo).length;
  const active = members.filter((m) => (m.activity_score ?? 0) + (m.points ?? 0) > 0).length;
  const recent = members.filter((m) => new Date(m.created_at).getTime() > monthAgo).length;

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper overflow-hidden">
      <div className="px-4 py-3 border-b-[2px] border-nu-ink bg-gradient-to-r from-nu-pink/5 via-nu-paper to-nu-blue/5">
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink font-bold">
          📊 Community Composition
        </div>
        <div className="font-bold text-[15px] text-nu-ink mt-0.5">
          {total}명의 와셔가 만드는 콜렉티브
        </div>
      </div>

      {/* 분야별 stacked bar */}
      {withSpec > 0 && (
        <div className="p-4 border-b-[2px] border-nu-ink/10">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">
            Scene 분포
          </div>
          <div className="flex h-8 border-[2px] border-nu-ink overflow-hidden">
            {Object.entries(SPECIALTY_META).map(([key, meta]) => {
              const count = specialtyCounts.get(key) ?? 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              if (count === 0) return null;
              return (
                <div
                  key={key}
                  className={`${meta.color} text-white flex items-center justify-center gap-1 font-mono-nu text-[11px] font-bold relative group transition-all`}
                  style={{ width: `${pct}%`, minWidth: count > 0 ? "40px" : "0" }}
                  title={`${meta.label} ${count}명 (${pct.toFixed(1)}%)`}
                >
                  {pct > 8 ? (
                    <>
                      <span>{meta.emoji}</span>
                      <span>{count}</span>
                    </>
                  ) : (
                    <span>{meta.emoji}</span>
                  )}
                </div>
              );
            })}
            {otherSpec > 0 && (
              <div
                className="bg-nu-ink/20 text-nu-ink flex items-center justify-center font-mono-nu text-[11px]"
                style={{ width: `${(otherSpec / total) * 100}%`, minWidth: "30px" }}
                title={`미지정 ${otherSpec}명`}
              >
                <span>?</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-2 font-mono-nu text-[10px] text-nu-graphite">
            {Object.entries(SPECIALTY_META).map(([key, meta]) => {
              const count = specialtyCounts.get(key) ?? 0;
              if (count === 0) return null;
              return (
                <span key={key} className="inline-flex items-center gap-1">
                  <span className={`w-2 h-2 ${meta.color}`} />
                  {meta.label} {count}
                </span>
              );
            })}
            {otherSpec > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-nu-ink/20" />
                미지정 {otherSpec}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 메트릭 3분할 */}
      <div className="grid grid-cols-3 divide-x-[2px] divide-nu-ink/10">
        {/* 등급 구성 - 수평 bar */}
        <div className="p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">
            등급 구성
          </div>
          <div className="space-y-1">
            {["admin", "vip", "gold", "silver", "bronze"].map((key) => {
              const count = gradeCounts.get(key) ?? 0;
              if (count === 0) return null;
              const meta = gradeMeta[key];
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="font-mono-nu text-[9px] text-nu-graphite w-12 truncate">
                    {meta.emoji} {meta.label}
                  </span>
                  <div className="flex-1 h-3 bg-nu-ink/5 relative">
                    <div className={`h-full ${meta.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono-nu text-[10px] text-nu-ink font-bold tabular-nums w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 활동 상태 */}
        <div className="p-4">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-2">
            활동 상태
          </div>
          <div className="space-y-2">
            <ActivityBar label="🔥 활동 중" value={active} total={total} color="bg-nu-pink" />
            <ActivityBar label="✨ 최근 가입" value={recent} total={total} color="bg-nu-blue" />
            <ActivityBar label="🆕 이번 주" value={newMembers} total={total} color="bg-green-500" />
          </div>
        </div>

        {/* 도넛 — 분야 비율 (간소화 circle) */}
        <div className="p-4 flex flex-col items-center justify-center">
          <DonutChart specialtyCounts={specialtyCounts} total={total} />
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mt-2">
            Scene Mix
          </div>
        </div>
      </div>
    </section>
  );
}

function ActivityBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="font-mono-nu text-[10px] text-nu-graphite">{label}</span>
        <span className="font-mono-nu text-[11px] text-nu-ink font-bold tabular-nums">
          {value}
          <span className="text-nu-graphite font-normal">/{total}</span>
        </span>
      </div>
      <div className="h-2 bg-nu-ink/5 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DonutChart({ specialtyCounts, total }: { specialtyCounts: Map<string, number>; total: number }) {
  const size = 100;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const entries = Object.entries(SPECIALTY_META)
    .map(([key, meta]) => ({ key, meta, count: specialtyCounts.get(key) ?? 0 }))
    .filter((e) => e.count > 0);

  let cumOffset = 0;

  const colorMap: Record<string, string> = {
    space: "#3B82F6",
    culture: "#F59E0B",
    platform: "#0D0D0D",
    vibe: "#FF3D88",
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      {entries.map((e) => {
        const pct = total > 0 ? e.count / total : 0;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const offset = cumOffset;
        cumOffset += dash;
        return (
          <circle
            key={e.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colorMap[e.key] ?? "#0D0D0D"}
            strokeWidth="14"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
          />
        );
      })}
      <text
        x={size / 2}
        y={size / 2 + 6}
        textAnchor="middle"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
        className="font-bold fill-nu-ink"
        fontSize="22"
      >
        {total}
      </text>
    </svg>
  );
}

// ── Activity Ring (카드용) ───────────────────────────────────
function ActivityRing({ score, max, size = 36 }: { score: number; max: number; size?: number }) {
  const radius = size / 2 - 3;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(1, score / max) : 0;
  const dash = pct * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="3"
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={pct > 0.66 ? "#FF3D88" : pct > 0.33 ? "#F59E0B" : "#94A3B8"}
        strokeWidth="3"
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

