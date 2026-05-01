"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeMouseHandler,
  type NodeDragHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { NodeCard } from "./node-card";
import { NodeDrawer } from "./node-drawer";
import { CenterGenesisNode } from "./center-genesis-node";
import type { MindMapData, MindMapNodeData, NodeKind } from "@/lib/dashboard/mindmap-types";
import { NODE_COLORS } from "@/lib/dashboard/mindmap-types";

const nodeTypes = { card: NodeCard, center: CenterGenesisNode };
const LAYOUT_KEY = "dashboard.mindmap.layout";

// MiniMap 노드 색상 — kind 별 hex (Tailwind class 못 씀)
const MINIMAP_COLOR: Record<NodeKind, string> = {
  center: "#0D0F14",
  nut: "#FF3D88",
  bolt: "#F59E0B",
  schedule: "#10B981",
  issue: "#EF4444",
};

// 방사형 레이아웃 — 중앙에서 12시 방향부터 360°/N 각도로 배치.
// kind 별로 반경을 약간 다르게 줘서 종류별 그룹이 자연스럽게 형성.
const RADIUS: Record<string, number> = {
  nut: 280,
  bolt: 320,
  schedule: 360,
  issue: 240,
};

interface Props {
  nickname: string;
  data: MindMapData;
}

/**
 * Phase B 정적 마인드맵 — 중앙 Genesis + 너트/볼트/일정/이슈 가지.
 * Phase C 에서 중앙 노드를 입력 가능한 형태로 교체 예정.
 */
export function MindMapDashboard({ nickname, data }: Props) {
  const [selected, setSelected] = useState<MindMapNodeData | null>(null);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }>>({});

  // 저장된 노드 위치 — 사용자가 드래그한 후 다음 방문 시 복원
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (raw) setSavedPositions(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const onNodeDragStop: NodeDragHandler = useCallback((_, node) => {
    setSavedPositions((prev) => {
      const next = { ...prev, [node.id]: { x: node.position.x, y: node.position.y } };
      try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const onAnswer = useCallback((result: { text: string; keywords: string[] }) => {
    // 키워드와 노드 title/subtitle 매칭 → 5초간 ring 강조
    const matchedIds = new Set<string>();
    const allNodes = buildGraph(nickname, data, onAnswer).nodes;
    for (const n of allNodes) {
      if (n.id === "center") continue;
      const text = `${(n.data as MindMapNodeData).title} ${(n.data as MindMapNodeData).subtitle ?? ""}`.toLowerCase();
      for (const kw of result.keywords) {
        if (text.includes(kw)) {
          matchedIds.add(n.id);
          break;
        }
      }
    }
    setHighlighted(matchedIds);
    if (matchedIds.size > 0) {
      setTimeout(() => setHighlighted(new Set()), 6000);
    }
  }, [nickname, data]);

  const { nodes: baseNodes, edges } = useMemo(
    () => buildGraph(nickname, data, onAnswer),
    [nickname, data, onAnswer],
  );

  // 하이라이트 적용 + 저장된 위치 복원
  const nodes = useMemo(
    () => baseNodes.map((n) => {
      const pos = savedPositions[n.id];
      const out = { ...n };
      if (pos) out.position = pos;
      if (highlighted.has(n.id)) out.selected = true;
      return out;
    }),
    [baseNodes, highlighted, savedPositions],
  );

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.id === "center") return;
    setSelected(node.data as MindMapNodeData);
  }, []);

  const total = data.nuts.length + data.bolts.length + data.schedule.length + data.issues.length;

  return (
    <div className="border-[3px] border-nu-ink bg-nu-cream/20 shadow-[4px_4px_0_0_#0D0F14] overflow-hidden">
      <div className="px-3 py-2 border-b-[2px] border-nu-ink/15 flex items-center justify-between bg-white">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
          Genesis Mind Map · 노드 {total + 1}개
        </div>
        <div className="flex items-center gap-2">
          {Object.keys(savedPositions).length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSavedPositions({});
                try { localStorage.removeItem(LAYOUT_KEY); } catch { /* ignore */ }
              }}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border border-nu-ink/30 hover:bg-nu-cream"
              title="드래그한 노드 위치 초기화"
            >
              레이아웃 초기화
            </button>
          )}
          <div className="font-mono-nu text-[10px] text-nu-muted">드래그 · 휠 줌</div>
        </div>
      </div>
      <div style={{ width: "100%", height: 600 }} className="touch-pan-y">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          fitView
          minZoom={0.3}
          maxZoom={2}
          panOnDrag
          zoomOnScroll
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} color="#0D0F14" style={{ opacity: 0.06 }} />
          <Controls
            position="bottom-left"
            showInteractive={false}
            className="!border-[2px] !border-nu-ink !shadow-[2px_2px_0_0_#0D0F14]"
          />
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            nodeStrokeColor="#0D0F14"
            nodeColor={(node) => {
              const kind = (node.data as MindMapNodeData)?.kind;
              return kind ? MINIMAP_COLOR[kind] : "#888";
            }}
            nodeStrokeWidth={2}
            className="!border-[2px] !border-nu-ink !shadow-[2px_2px_0_0_#0D0F14]"
          />
        </ReactFlow>
      </div>
      <NodeDrawer node={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function buildGraph(
  nickname: string,
  data: MindMapData,
  onAnswer: (r: { text: string; keywords: string[] }) => void,
): { nodes: RFNode[]; edges: RFEdge[] } {
  const nodes: RFNode[] = [
    {
      id: "center",
      type: "center",
      position: { x: 0, y: 0 },
      data: {
        kind: "center",
        title: `${nickname}님의 공간`,
        subtitle: "Genesis AI 에 물어보세요",
        onAnswer,
      },
    },
  ];
  const edges: RFEdge[] = [];

  // 모든 가지 노드를 360° 등분배치 — 종류별 grouping
  const all: Array<{ id: string; data: MindMapNodeData; kind: keyof typeof RADIUS }> = [
    ...data.nuts.map((n) => ({
      id: `nut-${n.id}`,
      kind: "nut" as const,
      data: {
        kind: "nut" as const,
        title: n.name,
        subtitle: n.role === "host" ? "👑 호스트" : n.role === "moderator" ? "🛠 운영" : "멤버",
        href: `/groups/${n.id}`,
        meta: { 역할: n.role },
      },
    })),
    ...data.bolts.map((b) => ({
      id: `bolt-${b.id}`,
      kind: "bolt" as const,
      data: {
        kind: "bolt" as const,
        title: b.title,
        subtitle: b.daysLeft != null
          ? (b.daysLeft >= 0 ? `D-${b.daysLeft}` : `${-b.daysLeft}일 지남`)
          : b.status,
        href: `/projects/${b.id}`,
        meta: { 상태: b.status, "남은 일수": b.daysLeft ?? "정해지지 않음" },
      },
    })),
    ...data.schedule.map((s) => ({
      id: `sched-${s.id}`,
      kind: "schedule" as const,
      data: {
        kind: "schedule" as const,
        title: s.title,
        subtitle: new Date(s.at).toLocaleString("ko", {
          month: "short", day: "numeric", weekday: "short",
          hour: "2-digit", minute: "2-digit", hour12: false,
        }),
        href: s.source === "meeting" ? `/calendar` : `/calendar`,
        meta: { 시간: new Date(s.at).toLocaleString("ko"), 종류: s.source === "meeting" ? "회의" : "이벤트" },
      },
    })),
    ...data.issues.map((i) => ({
      id: `issue-${i.id}`,
      kind: "issue" as const,
      data: {
        kind: "issue" as const,
        title: i.title,
        subtitle: i.kind === "overdue_task" ? "⏰ 마감 지남" : "💬 멘션",
        href: i.kind === "mention" ? "/notifications" : undefined,
        meta: { 종류: i.kind === "overdue_task" ? "마감 지난 태스크" : "읽지 않은 멘션" },
      },
    })),
  ];

  if (all.length === 0) {
    // 빈 상태 — 시작 안내 노드
    nodes.push({
      id: "empty",
      type: "card",
      position: { x: 0, y: 220 },
      data: {
        kind: "nut",
        title: "아직 비어 있어요",
        subtitle: "너트나 볼트를 만들어 가지를 만들어보세요",
        href: "/groups/create",
      } satisfies MindMapNodeData,
    });
    edges.push({ id: "e-empty", source: "center", target: "empty", style: { strokeWidth: 2 } });
    return { nodes, edges };
  }

  // 360°/N 으로 각도 배분
  const N = all.length;
  all.forEach((entry, idx) => {
    const angle = (idx / N) * 2 * Math.PI - Math.PI / 2; // 12시부터
    const radius = RADIUS[entry.kind] ?? 300;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    nodes.push({
      id: entry.id,
      type: "card",
      position: { x, y },
      data: entry.data,
    });
    edges.push({
      id: `e-${entry.id}`,
      source: "center",
      target: entry.id,
      style: { stroke: "#0D0F14", strokeWidth: 2 },
    });
  });

  return { nodes, edges };
}
