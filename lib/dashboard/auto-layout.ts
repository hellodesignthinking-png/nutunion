import dagre from "dagre";
import type { Node as RFNode, Edge as RFEdge } from "reactflow";

/**
 * Dagre 레이아웃 — 노드/엣지를 트리·DAG 형태로 자동 정렬.
 *
 * 마인드맵의 기본은 방사형 sector 클러스터지만, "정렬" 버튼은 사용자가
 * 노드를 자유 드래그로 어지럽혔을 때 dagre 트리로 깔끔히 재배치하는 옵션.
 * "레이아웃 초기화"로 다시 sector 기본값으로 돌아갈 수 있음.
 *
 * 방향:
 *   - "TB" (Top-Bottom): 가족 트리 — 중앙→가지가 위에서 아래로
 *   - "LR" (Left-Right): 워크플로우 — 중앙→가지가 좌→우
 */

const NODE_W = 200;
const NODE_H = 110;
const SECTOR_W = 360;
const SECTOR_H = 200;

export type LayoutDirection = "TB" | "LR";

export function dagreLayout(
  nodes: RFNode[],
  edges: RFEdge[],
  direction: LayoutDirection = "TB",
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    ranksep: direction === "TB" ? 120 : 180,
    nodesep: 60,
    edgesep: 30,
    marginx: 40,
    marginy: 40,
  });

  for (const n of nodes) {
    // sector halo 와 ai 임시 노드는 dagre 가 무시 — 위치 영속도 안 됨
    if (n.type === "sector") continue;
    if (typeof n.id === "string" && n.id.startsWith("ai-")) continue;
    const isCenter = n.type === "center";
    const isSector = n.type === "sector";
    g.setNode(n.id, {
      width: isSector ? SECTOR_W : isCenter ? 280 : NODE_W,
      height: isSector ? SECTOR_H : isCenter ? 130 : NODE_H,
    });
  }

  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const id of g.nodes()) {
    const node = g.node(id);
    if (!node) continue;
    // dagre 는 노드 중심 좌표 — reactflow 는 좌상단 기준이므로 보정
    positions[id] = {
      x: node.x - node.width / 2,
      y: node.y - node.height / 2,
    };
  }
  return positions;
}
