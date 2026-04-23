"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { VentureStageBadge } from "@/components/venture/venture-stage-badge";
import {
  Users,
  Calendar,
  ArrowRight,
  Search,
  FolderOpen,
  Circle,
  CheckCircle2,
  Pencil,
  Archive,
  RotateCcw,
  Check,
} from "lucide-react";

const categoryFilters = [
  { key: "all", label: "전체" },
  { key: "space", label: "Space" },
  { key: "culture", label: "Culture" },
  { key: "platform", label: "Platform" },
  { key: "vibe", label: "Vibe" },
];

const statusFilters = [
  { key: "all", label: "전체" },
  { key: "active", label: "진행 중" },
  { key: "completed", label: "완료" },
];

type SortKey = "latest" | "deadline" | "members";

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "latest", label: "최신순" },
  { key: "deadline", label: "마감임박" },
  { key: "members", label: "참여자순" },
];

const catStyles: Record<string, { bg: string; gradient: string }> = {
  space: { bg: "bg-nu-blue", gradient: "from-[#001a4d] to-[#003399]" },
  culture: { bg: "bg-nu-amber", gradient: "from-[#2a1800] to-[#5a3800]" },
  platform: { bg: "bg-nu-ink", gradient: "from-[#0a0a0a] to-[#1a1a1a]" },
  vibe: { bg: "bg-nu-pink", gradient: "from-[#330019] to-[#660033]" },
};

interface ProjectItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  category: string | null;
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  creator_nickname: string;
  creator_avatar: string | null;
  member_count: number;
  milestone_total?: number;
  milestone_completed?: number;
  user_role?: string | null;
  venture_mode?: boolean | null;
  venture_stage?: string | null;
  recruiting?: boolean | null;
  has_dev_plan?: boolean | null;
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "";
  const s = new Date(start).toLocaleDateString("ko", {
    month: "short",
    day: "numeric",
  });
  if (!end) return s + " ~";
  const e = new Date(end).toLocaleDateString("ko", {
    month: "short",
    day: "numeric",
  });
  return `${s} — ${e}`;
}

function getDaysUntil(endDate: string | null): number | null {
  if (!endDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return (
        <span className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 bg-green-600 text-white inline-flex items-center gap-1">
          <Circle size={7} fill="currentColor" /> 진행중
        </span>
      );
    case "completed":
      return (
        <span className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 bg-nu-blue text-white inline-flex items-center gap-1">
          <CheckCircle2 size={9} /> 완료
        </span>
      );
    case "draft":
      return (
        <span className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 bg-nu-gray text-white inline-flex items-center gap-1">
          <Pencil size={8} /> 준비중
        </span>
      );
    case "archived":
      return (
        <span className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 bg-nu-muted text-white inline-flex items-center gap-1">
          <Archive size={8} /> 보관
        </span>
      );
    default:
      return (
        <span className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 bg-nu-gray text-white">
          {status}
        </span>
      );
  }
}

function DeadlineBadge({ endDate, status }: { endDate: string | null; status: string }) {
  if (status === "completed" || status === "archived") return null;
  const days = getDaysUntil(endDate);
  if (days === null) return null;

  // 색상 단계: ≤3일 빨강 긴급, ≤7일 주황, ≤30일 노랑, >30일 무채
  let bg = "bg-nu-ink";
  let fg = "text-nu-paper";
  let label: string;

  if (days < 0) {
    bg = "bg-red-700"; fg = "text-white";
    label = `D+${Math.abs(days)} 지남`;
  } else if (days === 0) {
    bg = "bg-red-600"; fg = "text-white";
    label = "D-DAY";
  } else if (days <= 3) {
    bg = "bg-red-600"; fg = "text-white";
    label = `D-${days}`;
  } else if (days <= 7) {
    bg = "bg-orange-500"; fg = "text-white";
    label = `D-${days}`;
  } else if (days <= 30) {
    bg = "bg-nu-amber"; fg = "text-nu-ink";
    label = `D-${days}`;
  } else {
    bg = "bg-nu-ink/80"; fg = "text-nu-paper";
    label = `D-${days}`;
  }

  return (
    <span className={`absolute top-4 right-4 font-mono-nu text-[11px] font-black uppercase tracking-wider px-2 py-1 ${bg} ${fg} shadow-sm`}>
      {label}
    </span>
  );
}

function ProgressBar({ total, completed }: { total: number; completed: number }) {
  if (total <= 0) return null;
  const pct = Math.round((completed / total) * 100);
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">
          마일스톤
        </span>
        <span className="font-mono-nu text-[11px] font-bold text-nu-ink">
          {completed}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 bg-nu-cream overflow-hidden">
        <div
          className={`h-full transition-all ${pct === 100 ? "bg-green-600" : "bg-nu-pink"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}


export function ProjectsGrid({
  projects,
  userId,
}: {
  projects: ProjectItem[];
  userId?: string;
}) {
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("latest");

  const filtered = useMemo(() => {
    let result = projects.filter((p) => {
      if (catFilter !== "all" && p.category !== catFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!p.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    // Sort: joined projects first, then by user-chosen key
    result = [...result].sort((a, b) => {
      // 1) Membership — joined projects float to top
      const aJoined = a.user_role ? 0 : 1;
      const bJoined = b.user_role ? 0 : 1;
      if (aJoined !== bJoined) return aJoined - bJoined;

      // 2) User-chosen sort within each group
      switch (sortKey) {
        case "latest":
          return new Date(b.start_date || b.created_at).getTime() - new Date(a.start_date || a.created_at).getTime();
        case "deadline": {
          const aEnd = a.status === "active" && a.end_date ? new Date(a.end_date).getTime() : Infinity;
          const bEnd = b.status === "active" && b.end_date ? new Date(b.end_date).getTime() : Infinity;
          return aEnd - bEnd;
        }
        case "members":
          return b.member_count - a.member_count;
        default:
          return 0;
      }
    });

    return result;
  }, [projects, catFilter, statusFilter, searchQuery, sortKey]);

  const hasActiveFilters = catFilter !== "all" || statusFilter !== "all" || searchQuery.trim() !== "";

  function resetFilters() {
    setCatFilter("all");
    setStatusFilter("all");
    setSearchQuery("");
    setSortKey("latest");
  }

  return (
    <>
      {/* Search + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-shrink-0 w-full sm:w-auto sm:min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-ink/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="볼트 검색..."
              className="w-full border-[2px] border-nu-ink/10 focus:border-nu-pink px-4 py-2.5 pl-9 text-sm bg-transparent font-mono-nu placeholder:text-nu-ink/30 outline-none transition-colors"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categoryFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setCatFilter(f.key)}
                className={`font-mono-nu text-[13px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 border-[1.5px] transition-colors ${
                  catFilter === f.key
                    ? "bg-nu-ink border-nu-ink text-nu-paper"
                    : "bg-transparent border-nu-ink/15 text-nu-graphite hover:border-nu-ink/40"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Sort pills */}
          <div className="flex gap-1">
            {sortOptions.map((s) => (
              <button
                key={s.key}
                onClick={() => setSortKey(s.key)}
                className={`font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-3 py-1.5 border transition-colors ${
                  sortKey === s.key
                    ? "bg-nu-graphite border-nu-graphite text-nu-paper"
                    : "bg-transparent border-nu-ink/10 text-nu-muted hover:border-nu-ink/30"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {/* View toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => setView("grid")}
              className={`p-2 transition-colors ${view === "grid" ? "text-nu-ink" : "text-nu-muted"}`}
              aria-label="그리드 보기"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect width="7" height="7" />
                <rect x="9" width="7" height="7" />
                <rect y="9" width="7" height="7" />
                <rect x="9" y="9" width="7" height="7" />
              </svg>
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2 transition-colors ${view === "list" ? "text-nu-ink" : "text-nu-muted"}`}
              aria-label="리스트 보기"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect width="16" height="3" />
                <rect y="5" width="16" height="3" />
                <rect y="10" width="16" height="3" />
                <rect y="15" width="10" height="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {statusFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`font-mono-nu text-[12px] tracking-[0.08em] uppercase px-4 py-2 border transition-colors ${
              statusFilter === f.key
                ? "bg-nu-graphite border-nu-graphite text-nu-paper"
                : "bg-transparent border-nu-ink/10 text-nu-muted hover:border-nu-ink/30"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-6">
        {filtered.length}개의 볼트
      </p>

      {/* Grid view */}
      {view === "grid" && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => {
            const style = catStyles[p.category || "platform"] || catStyles.platform;

            return (
              <div
                key={p.id}
                className="bg-nu-white border border-nu-ink/[0.06] overflow-hidden flex flex-col hover:translate-y-[-2px] hover:shadow-lg transition-all duration-200"
              >
                {/* Card header */}
                <div
                  className={`relative h-40 bg-gradient-to-br ${style.gradient} overflow-hidden`}
                >
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-80"
                    />
                  ) : (
                    <>
                      <div
                        className="absolute inset-0 opacity-[0.05]"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle, #F4F1EA 1px, transparent 1px)",
                          backgroundSize: "20px 20px",
                        }}
                      />
                      <div className="absolute bottom-4 right-4 font-head text-[60px] font-extrabold leading-none text-nu-paper/[0.06]">
                        {p.title.charAt(0)}
                      </div>
                    </>
                  )}
                  <div className="absolute top-4 left-4 flex gap-2">
                    {p.user_role && (
                      <span className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 bg-green-600 text-white inline-flex items-center gap-1">
                        <Check size={9} /> {p.user_role === "lead" ? "리드" : "참여중"}
                      </span>
                    )}
                    {p.category && (
                      <span
                        className={`font-mono-nu text-[11px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 text-white ${style.bg}`}
                      >
                        {p.category}
                      </span>
                    )}
                    <StatusBadge status={p.status} />
                    <VentureStageBadge
                      ventureMode={!!p.venture_mode}
                      ventureStage={p.venture_stage ?? null}
                      completed={p.status === "completed"}
                      size="sm"
                    />
                    {p.recruiting && (
                      <span className="font-mono-nu text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-nu-pink text-nu-paper border-[1.5px] border-nu-ink">
                        🔎 구인중
                      </span>
                    )}
                    {p.has_dev_plan && (
                      <Link
                        href={userId ? `/projects/${p.id}/dev-plan` : "/login"}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono-nu text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-nu-ink text-nu-paper border-[1.5px] border-nu-ink no-underline hover:bg-nu-pink transition-colors"
                        title="기술 개발 로드맵 보기"
                      >
                        🛠️ 로드맵
                      </Link>
                    )}
                  </div>
                  <DeadlineBadge endDate={p.end_date} status={p.status} />
                </div>

                {/* Card body */}
                <div className="p-5 flex-1 flex flex-col">
                  <Link
                    href={userId ? `/projects/${p.id}` : "/login"}
                    className="no-underline block"
                    prefetch={true}
                  >
                    <h3 className="font-head text-lg font-extrabold text-nu-ink leading-tight mb-2 hover:text-nu-pink transition-colors">
                      {p.title}
                    </h3>
                  </Link>
                  <p className="text-xs text-nu-gray leading-relaxed mb-4 flex-1 line-clamp-3">
                    {p.description}
                  </p>

                  {/* Progress bar (milestone data) */}
                  {p.milestone_total != null && p.milestone_total > 0 && (
                    <ProgressBar
                      total={p.milestone_total}
                      completed={p.milestone_completed ?? 0}
                    />
                  )}

                  {/* Date range */}
                  {(p.start_date || p.end_date) && (
                    <div className="flex items-center gap-1.5 mb-3 text-xs text-nu-muted">
                      <Calendar size={12} />
                      <span className="font-mono-nu text-[12px]">
                        {formatDateRange(p.start_date, p.end_date)}
                      </span>
                    </div>
                  )}


                  {/* Footer info */}
                  <div className="flex items-center justify-between pt-3 border-t border-nu-ink/[0.06]">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-nu-cream flex items-center justify-center font-head text-[12px] font-bold">
                        {p.creator_nickname.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-mono-nu text-[12px] text-nu-muted">
                        {p.creator_nickname}
                      </span>
                    </div>
                    <span className="font-mono-nu text-[12px] text-nu-muted flex items-center gap-1">
                      <Users size={10} /> {p.member_count}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view === "list" && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((p) => {
            const style = catStyles[p.category || "platform"] || catStyles.platform;
            const daysLeft = getDaysUntil(p.end_date);
            const showDeadline = p.status === "active" && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

            return (
              <div
                key={p.id}
                className="bg-nu-white border border-nu-ink/[0.06] p-5 flex items-center gap-5 hover:translate-y-[-1px] hover:shadow-md transition-all duration-200"
              >
                {/* Mini visual */}
                <div
                  className={`w-20 h-20 shrink-0 bg-gradient-to-br ${style.gradient} overflow-hidden relative`}
                >
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-80"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center font-head text-2xl font-extrabold text-nu-paper/10">
                      {p.title.charAt(0)}
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {p.user_role && (
                      <span className="font-mono-nu text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 bg-green-600 text-white inline-flex items-center gap-1">
                        <Check size={8} /> {p.user_role === "lead" ? "리드" : "참여중"}
                      </span>
                    )}
                    {p.category && (
                      <span
                        className={`font-mono-nu text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 text-white ${style.bg}`}
                      >
                        {p.category}
                      </span>
                    )}
                    <StatusBadge status={p.status} />
                    {showDeadline && (
                      <span className="font-mono-nu text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-red-600 text-white">
                        D-{daysLeft}
                      </span>
                    )}
                    {p.has_dev_plan && (
                      <Link
                        href={userId ? `/projects/${p.id}/dev-plan` : "/login"}
                        className="font-mono-nu text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-nu-ink text-nu-paper no-underline hover:bg-nu-pink transition-colors"
                        title="기술 개발 로드맵 보기"
                      >
                        🛠️ 로드맵
                      </Link>
                    )}
                    <Link
                      href={userId ? `/projects/${p.id}` : "/login"}
                      className="font-head text-base font-extrabold text-nu-ink no-underline hover:text-nu-pink truncate"
                      prefetch={true}
                    >
                      {p.title}
                    </Link>
                  </div>
                  <p className="text-xs text-nu-gray truncate">{p.description}</p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <span className="font-mono-nu text-[12px] text-nu-muted">
                      by {p.creator_nickname}
                    </span>
                    <span className="font-mono-nu text-[12px] text-nu-muted flex items-center gap-1">
                      <Users size={10} /> {p.member_count}
                    </span>
                    {(p.start_date || p.end_date) && (
                      <span className="font-mono-nu text-[12px] text-nu-muted flex items-center gap-1">
                        <Calendar size={10} />{" "}
                        {formatDateRange(p.start_date, p.end_date)}
                      </span>
                    )}
                    {p.milestone_total != null && p.milestone_total > 0 && (
                      <span className="font-mono-nu text-[12px] text-nu-muted">
                        마일스톤 {p.milestone_completed ?? 0}/{p.milestone_total}
                      </span>
                    )}
                  </div>
                </div>
                {/* Action */}
                <Link
                  href={userId ? `/projects/${p.id}` : "/login"}
                  className="shrink-0 font-mono-nu text-[12px] font-bold uppercase tracking-[0.1em] px-5 py-2.5 border border-nu-ink/15 text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-colors no-underline inline-flex items-center gap-1"
                  prefetch={true}
                >
                  보기 <ArrowRight size={12} />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-20 bg-nu-white border-[2px] border-nu-ink/[0.06] p-12">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 bg-nu-cream flex items-center justify-center">
              <FolderOpen size={28} className="text-nu-muted" />
            </div>
          </div>
          <h3 className="font-head text-lg font-extrabold text-nu-ink mb-2">
            볼트를 찾을 수 없습니다
          </h3>
          <p className="font-mono-nu text-[13px] text-nu-muted uppercase tracking-widest mb-6">
            필터를 변경하거나 새 볼트를 만들어보세요
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="font-mono-nu text-[13px] font-bold uppercase tracking-[0.08em] px-6 py-2.5 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors inline-flex items-center gap-2"
            >
              <RotateCcw size={12} /> 필터 초기화
            </button>
          )}
        </div>
      )}
    </>
  );
}
