"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { NodeKind } from "@/lib/dashboard/mindmap-types";
import { NODE_COLORS } from "@/lib/dashboard/mindmap-types";

export interface SectorHaloData {
  kind: "sector";
  /** 섹터가 감싸는 노드 종류. */
  groupKind: NodeKind;
  label: string;
  count: number;
  collapsed: boolean;
  /** 외부 토글 핸들러 — 라벨 클릭 시 호출 */
  onToggle: (kind: NodeKind) => void;
}

/**
 * 종류별 시각 그룹 박스 — Miro 스타일 "프레임".
 *
 * reactflow parent/child 의 무거운 리뷰어링 대신, 같은 섹터의 노드들을
 * 시각적으로 감싸는 반투명 카드. 라벨 클릭 시 접기/펴기.
 *
 * - draggable/selectable 모두 false → 사용자 인터랙션은 헤더만
 * - z-index 음수로 다른 노드 뒤에 깔림
 */
export function SectorHalo({ data }: { data: SectorHaloData }) {
  const colors = NODE_COLORS[data.groupKind];
  return (
    <div
      className={`relative w-full h-full pointer-events-none`}
      aria-hidden="true"
    >
      {/* 본체 — opacity 낮고 dashed 보더 */}
      <div
        className={`absolute inset-0 ${colors.bg} ${colors.border} border-[3px] border-dashed`}
        style={{ opacity: 0.18 }}
      />
      {/* 헤더 라벨 — 좌상단, pointer-events 활성 */}
      <button
        type="button"
        onClick={() => data.onToggle(data.groupKind)}
        className={`pointer-events-auto absolute -top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 ${colors.bg} ${colors.ink} border-[2px] ${colors.border} font-mono-nu text-[10px] uppercase tracking-widest shadow-[2px_2px_0_0_#0D0F14] hover:bg-white`}
        title={data.collapsed ? "펼치기" : "접기"}
      >
        {data.collapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        <span>{data.label}</span>
        <span className="opacity-60">· {data.count}</span>
      </button>
    </div>
  );
}
