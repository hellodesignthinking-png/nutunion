"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, Calendar, ArrowRight, CheckCircle2 } from "lucide-react";

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

const catStyles: Record<string, { bg: string; gradient: string }> = {
  space: { bg: "bg-nu-blue", gradient: "from-[#001a4d] to-[#003399]" },
  culture: { bg: "bg-nu-amber", gradient: "from-[#2a1800] to-[#5a3800]" },
  platform: { bg: "bg-nu-ink", gradient: "from-[#0a0a0a] to-[#1a1a1a]" },
  vibe: { bg: "bg-nu-pink", gradient: "from-[#330019] to-[#660033]" },
};

const statusColors: Record<string, string> = {
  draft: "bg-nu-gray text-white",
  active: "bg-green-600 text-white",
  completed: "bg-nu-blue text-white",
  archived: "bg-nu-muted text-white",
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
  task_stats: { todo: number; in_progress: number; done: number } | null;
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

function getProgress(stats: { todo: number; in_progress: number; done: number } | null) {
  if (!stats) return null;
  const total = stats.todo + stats.in_progress + stats.done;
  if (total === 0) return null;
  return Math.round((stats.done / total) * 100);
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

  const filtered = projects.filter((p) => {
    if (catFilter !== "all" && p.category !== catFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {categoryFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setCatFilter(f.key)}
              className={`font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 border-[1.5px] transition-colors ${
                catFilter === f.key
                  ? "bg-nu-ink border-nu-ink text-nu-paper"
                  : "bg-transparent border-nu-ink/15 text-nu-graphite hover:border-nu-ink/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setView("grid")}
            className={`p-2 transition-colors ${view === "grid" ? "text-nu-ink" : "text-nu-muted"}`}
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

      {/* Status filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {statusFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`font-mono-nu text-[10px] tracking-[0.08em] uppercase px-4 py-2 border transition-colors ${
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
      <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-6">
        {filtered.length}개의 프로젝트
      </p>

      {/* Grid view */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((p) => {
            const style = catStyles[p.category || "platform"] || catStyles.platform;
            const progress = getProgress(p.task_stats);

            return (
              <div
                key={p.id}
                className="bg-nu-white border border-nu-ink/[0.06] overflow-hidden flex flex-col"
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
                    {p.category && (
                      <span
                        className={`font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 text-white ${style.bg}`}
                      >
                        {p.category}
                      </span>
                    )}
                    <span
                      className={`font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-1 ${statusColors[p.status] || "bg-nu-gray text-white"}`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-5 flex-1 flex flex-col">
                  <Link
                    href={userId ? `/projects/${p.id}` : "/login"}
                    className="no-underline block"
                  >
                    <h3 className="font-head text-lg font-extrabold text-nu-ink leading-tight mb-2 hover:text-nu-pink transition-colors">
                      {p.title}
                    </h3>
                  </Link>
                  <p className="text-xs text-nu-gray leading-relaxed mb-4 flex-1 line-clamp-3">
                    {p.description}
                  </p>

                  {/* Date range */}
                  {(p.start_date || p.end_date) && (
                    <div className="flex items-center gap-1.5 mb-3 text-xs text-nu-muted">
                      <Calendar size={12} />
                      <span className="font-mono-nu text-[10px]">
                        {formatDateRange(p.start_date, p.end_date)}
                      </span>
                    </div>
                  )}

                  {/* Progress bar */}
                  {progress !== null && (
                    <div className="mb-3">
                      <div className="progress-bar">
                        <div
                          className={`progress-bar-fill ${style.bg}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-1">
                          <CheckCircle2 size={10} /> {progress}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Footer info */}
                  <div className="flex items-center justify-between pt-3 border-t border-nu-ink/[0.06]">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-nu-cream flex items-center justify-center font-head text-[10px] font-bold">
                        {p.creator_nickname.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-mono-nu text-[10px] text-nu-muted">
                        {p.creator_nickname}
                      </span>
                    </div>
                    <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-1">
                      <Users size={10} /> {p.member_count}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="flex flex-col gap-3">
          {filtered.map((p) => {
            const style = catStyles[p.category || "platform"] || catStyles.platform;
            const progress = getProgress(p.task_stats);

            return (
              <div
                key={p.id}
                className="bg-nu-white border border-nu-ink/[0.06] p-5 flex items-center gap-5"
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
                    {p.category && (
                      <span
                        className={`font-mono-nu text-[8px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 text-white ${style.bg}`}
                      >
                        {p.category}
                      </span>
                    )}
                    <span
                      className={`font-mono-nu text-[8px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 ${statusColors[p.status] || "bg-nu-gray text-white"}`}
                    >
                      {p.status}
                    </span>
                    <Link
                      href={userId ? `/projects/${p.id}` : "/login"}
                      className="font-head text-base font-extrabold text-nu-ink no-underline hover:text-nu-pink truncate"
                    >
                      {p.title}
                    </Link>
                  </div>
                  <p className="text-xs text-nu-gray truncate">{p.description}</p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <span className="font-mono-nu text-[10px] text-nu-muted">
                      by {p.creator_nickname}
                    </span>
                    <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-1">
                      <Users size={10} /> {p.member_count}
                    </span>
                    {(p.start_date || p.end_date) && (
                      <span className="font-mono-nu text-[10px] text-nu-muted flex items-center gap-1">
                        <Calendar size={10} />{" "}
                        {formatDateRange(p.start_date, p.end_date)}
                      </span>
                    )}
                    {progress !== null && (
                      <span className="font-mono-nu text-[10px] text-nu-muted">
                        {progress}% 완료
                      </span>
                    )}
                  </div>
                </div>
                {/* Action */}
                <Link
                  href={userId ? `/projects/${p.id}` : "/login"}
                  className="shrink-0 font-mono-nu text-[10px] font-bold uppercase tracking-[0.1em] px-5 py-2.5 border border-nu-ink/15 text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-colors no-underline inline-flex items-center gap-1"
                >
                  보기 <ArrowRight size={12} />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-20 bg-nu-white border border-nu-ink/[0.06] p-12">
          <p className="text-nu-gray text-sm mb-4">
            해당 조건에 맞는 프로젝트가 없습니다
          </p>
        </div>
      )}
    </>
  );
}
