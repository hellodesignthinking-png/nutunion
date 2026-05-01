"use client";

import { Handle, Position } from "reactflow";
import { Users, Briefcase, Calendar, AlertTriangle, Sparkles, User, BookOpen, Lightbulb, ListTodo, Plus, File, Crown, Wrench } from "lucide-react";
import type { NodeKind, MindMapNodeData } from "@/lib/dashboard/mindmap-types";
import { NODE_COLORS } from "@/lib/dashboard/mindmap-types";

const ICONS: Record<NodeKind, typeof Users> = {
  center: Sparkles,
  nut: Users,
  bolt: Briefcase,
  schedule: Calendar,
  issue: AlertTriangle,
  washer: User,
  topic: BookOpen,
  file: File,
  "ai-role": Lightbulb,
  "ai-task": ListTodo,
  empty: Plus,
};

/**
 * 통합 카드 — kind 별로 accent 영역을 다르게.
 *
 * - bolt: 상태→진행률 바
 * - schedule: D-Day 큰 뱃지
 * - issue: 긴급도 칩 + 좌측 빨간 띠
 * - nut: 역할 칩 (호스트/운영/멤버)
 * - washer: 공유 너트·볼트 카운트
 * - file: 파일 유형 칩
 */
export function NodeCard({ data }: { data: MindMapNodeData }) {
  const colors = NODE_COLORS[data.kind];
  const Icon = ICONS[data.kind];
  const isCenter = data.kind === "center";
  const highlighted = data.highlighted;
  const dimmed = data.dimmed;

  return (
    <div
      role="button"
      aria-label={`${data.kind}: ${data.title}`}
      tabIndex={isCenter ? -1 : 0}
      className={`
        ${colors.bg} ${colors.ink}
        border-[3px] ${colors.border}
        ${isCenter ? "px-5 py-4 min-w-[180px]" : "px-3 py-2 min-w-[160px] max-w-[220px]"}
        shadow-[3px_3px_0_0_#0D0F14]
        ${highlighted ? `ring-4 ring-offset-2 ${colors.pulse} scale-110 z-10 relative` : ""}
        ${dimmed ? "opacity-30" : ""}
        ${data.kind === "issue" ? "relative overflow-hidden" : ""}
        transition-all duration-300 ease-out
        focus:outline-none focus-visible:ring-4 focus-visible:ring-nu-ink/50
      `}
    >
      {/* issue 좌측 빨간 경고 띠 */}
      {data.kind === "issue" && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-700" aria-hidden />
      )}

      {/* 핸들 — 중앙은 4방향, 가지는 1개 */}
      {isCenter ? (
        <>
          <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
          <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
          <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
          <Handle type="source" position={Position.Left} style={{ opacity: 0 }} />
        </>
      ) : (
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      )}

      <div className="flex items-center gap-1.5">
        <Icon size={isCenter ? 16 : 12} />
        <div className="font-mono-nu text-[10px] uppercase tracking-widest opacity-70">
          {data.kind === "center" ? "Genesis" : data.kind}
        </div>
      </div>
      <div className={`font-head font-extrabold mt-1 ${isCenter ? "text-base" : "text-[13px]"} truncate`}>
        {data.title}
      </div>
      {data.subtitle && (
        <div className="text-[11px] opacity-80 mt-0.5 truncate">{data.subtitle}</div>
      )}

      {/* kind-specific accent — 주요 정보를 시각적 요소로 강조 */}
      {!isCenter && <Accent data={data} />}
    </div>
  );
}

function Accent({ data }: { data: MindMapNodeData }) {
  switch (data.kind) {
    case "bolt": {
      const status = String(data.meta?.["상태"] || "active");
      const pct = boltStatusPct(status);
      const daysLeft = data.meta?.["남은 일수"];
      const isOverdue = typeof daysLeft === "number" && daysLeft < 0;
      const leadName = String(data.meta?.["담당"] || "");
      const leadAvatar = String(data.meta?.["담당_avatar"] || "");
      const hasLead = leadName && leadName !== "미지정";
      return (
        <div className="mt-1.5">
          <div className="h-1.5 bg-white/70 border border-nu-ink overflow-hidden">
            <div
              className={`h-full ${isOverdue ? "bg-red-600" : "bg-nu-amber"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1 font-mono-nu text-[9px] uppercase tracking-widest opacity-70">
            <span>{statusLabel(status)}</span>
            <span>{pct}%</span>
          </div>
          {hasLead && (
            <div className="mt-1.5 inline-flex items-center gap-1 bg-white/80 border border-nu-ink/30 px-1 py-0.5">
              {leadAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={leadAvatar}
                  alt=""
                  className="w-3.5 h-3.5 rounded-full object-cover"
                />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full bg-nu-pink text-white font-mono-nu text-[8px] flex items-center justify-center">
                  {leadName[0]}
                </span>
              )}
              <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-ink/80">
                {leadName}
              </span>
            </div>
          )}
        </div>
      );
    }
    case "schedule": {
      const at = data.meta?.["시간"] ? new Date(String(data.meta["시간"])) : null;
      if (!at || Number.isNaN(at.getTime())) return null;
      const hours = (at.getTime() - Date.now()) / (1000 * 60 * 60);
      const ddBadge = formatDDay(hours);
      return (
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="bg-emerald-700 text-emerald-50 font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 border border-emerald-900">
            {ddBadge}
          </div>
          <div className="font-mono-nu text-[9px] uppercase tracking-widest opacity-60">
            {String(data.meta?.["종류"] || "")}
          </div>
        </div>
      );
    }
    case "issue": {
      const kind = String(data.meta?.["종류"] || "");
      const urgent = kind.includes("마감"); // overdue_task = 긴급
      return (
        <div className="mt-1.5 flex items-center gap-1">
          <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${urgent ? "bg-red-700 text-white border-red-900" : "bg-red-100 text-red-900 border-red-700"}`}>
            {urgent ? "🔥 HIGH" : "💬 MED"}
          </span>
        </div>
      );
    }
    case "nut": {
      const role = String(data.meta?.["역할"] || "member");
      const isHost = role === "host";
      const isMod = role === "moderator";
      const RoleIcon = isHost ? Crown : isMod ? Wrench : Users;
      return (
        <div className="mt-1.5">
          <span className={`inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${isHost ? "bg-nu-pink/20 border-nu-pink text-nu-pink" : "border-nu-ink/30"}`}>
            <RoleIcon size={9} />
            {isHost ? "호스트" : isMod ? "운영" : "멤버"}
          </span>
        </div>
      );
    }
    case "washer": {
      const nuts = Number(data.meta?.["너트"] || 0);
      const bolts = Number(data.meta?.["볼트"] || 0);
      const avatar = String(data.meta?.["avatar"] || "");
      return (
        <div className="mt-1.5 flex items-center gap-1.5">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              className="w-7 h-7 rounded-full object-cover border-[2px] border-violet-700"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-violet-200 border-[2px] border-violet-700 flex items-center justify-center font-head font-extrabold text-[12px] text-violet-900">
              {data.title[0] || "?"}
            </div>
          )}
          <div className="flex flex-col gap-0.5 font-mono-nu text-[9px] uppercase tracking-widest opacity-70">
            <span className="px-1 border border-nu-pink/40 text-nu-pink">N {nuts}</span>
            <span className="px-1 border border-nu-amber/60 text-nu-ink">B {bolts}</span>
          </div>
        </div>
      );
    }
    case "file": {
      const type = String(data.meta?.["종류"] || "").split("/").pop()?.toUpperCase() || "FILE";
      const size = String(data.meta?.["크기"] || "");
      return (
        <div className="mt-1.5 flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest opacity-70">
          <span className="px-1 border border-stone-700 bg-white">{type}</span>
          {size && <span>{size}</span>}
        </div>
      );
    }
    default:
      return null;
  }
}

function boltStatusPct(status: string): number {
  // 상태 → 진행률 추정. 실제 진행률 컬럼이 없을 때의 발견적 기준.
  switch (status) {
    case "draft":   return 15;
    case "active":  return 60;
    case "paused":  return 50;
    case "review":  return 85;
    case "closed":
    case "done":
    case "completed": return 100;
    default: return 40;
  }
}

function statusLabel(status: string): string {
  return ({
    draft: "초안",
    active: "진행 중",
    paused: "일시 중지",
    review: "검토",
    closed: "완료",
    done: "완료",
    completed: "완료",
  } as Record<string, string>)[status] || status;
}

function formatDDay(hours: number): string {
  if (hours < 0) return `D+${Math.ceil(-hours / 24)}`;
  if (hours < 24) return `D-Day`;
  return `D-${Math.ceil(hours / 24)}`;
}
