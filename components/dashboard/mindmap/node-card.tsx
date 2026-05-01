"use client";

import { Handle, Position } from "reactflow";
import { Users, Briefcase, Calendar, AlertTriangle, Sparkles, User, BookOpen, Lightbulb, ListTodo } from "lucide-react";
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
  "ai-role": Lightbulb,
  "ai-task": ListTodo,
};

/**
 * 모든 종류의 마인드맵 노드를 렌더링하는 단일 컴포넌트.
 * data.kind 로 색상/아이콘/모양 분기.
 *
 * Phase B 의 정적 노드 — 클릭 시 부모 onNodeClick 으로 drawer 트리거.
 */
export function NodeCard({ data, selected }: { data: MindMapNodeData; selected?: boolean }) {
  const colors = NODE_COLORS[data.kind];
  const Icon = ICONS[data.kind];
  const isCenter = data.kind === "center";

  return (
    <div
      className={`
        ${colors.bg} ${colors.ink}
        border-[3px] ${colors.border}
        ${isCenter ? "px-5 py-4 min-w-[180px]" : "px-3 py-2 min-w-[140px]"}
        shadow-[3px_3px_0_0_#0D0F14]
        ${selected ? `ring-4 ring-offset-2 ${colors.pulse}` : ""}
        transition-all
      `}
    >
      {/* 양방향 연결 핸들 — 중앙 노드는 4방향, 가지는 1개만 */}
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
    </div>
  );
}
