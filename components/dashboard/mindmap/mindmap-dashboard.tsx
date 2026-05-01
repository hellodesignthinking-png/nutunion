"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Camera, Search, X, Filter, Radio, Clock, Network } from "lucide-react";
import { toast } from "sonner";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
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
import { CursorOverlay } from "./cursor-overlay";
import { FileHoverPreview } from "./file-hover-preview";
import type { MindMapData, MindMapNodeData, NodeKind } from "@/lib/dashboard/mindmap-types";
import { NODE_COLORS } from "@/lib/dashboard/mindmap-types";

const nodeTypes = { card: NodeCard, center: CenterGenesisNode };
const LAYOUT_KEY = "dashboard.mindmap.layout";
const VIEW_MODE_KEY = "dashboard.mindmap.viewMode";

type ViewMode = "radial" | "timeline";

// Timeline 모드 — 7일 시간축 (now → +168h). schedule 노드만 시간순 배치.
const TIMELINE_HOURS = 168; // 7일
const TIMELINE_WIDTH = 800; // x 범위 -400 ~ +400

// MiniMap 노드 색상 — kind 별 hex (Tailwind class 못 씀)
const MINIMAP_COLOR: Record<NodeKind, string> = {
  center: "#0D0F14",
  nut: "#FF3D88",
  bolt: "#F59E0B",
  schedule: "#10B981",
  issue: "#EF4444",
  washer: "#7C3AED",
  topic: "#0EA5E9",
  file: "#78716C",
  "ai-role": "#EAB308",
  "ai-task": "#F97316",
  empty: "#A8A29E",
};

// 필터 칩에 보일 종류 (center/empty/ai-* 제외)
const FILTERABLE_KINDS: { kind: NodeKind; label: string }[] = [
  { kind: "nut", label: "너트" },
  { kind: "bolt", label: "볼트" },
  { kind: "schedule", label: "일정" },
  { kind: "issue", label: "이슈" },
  { kind: "topic", label: "탭" },
  { kind: "washer", label: "와셔" },
  { kind: "file", label: "파일" },
];

// 방사형 레이아웃 — 중앙에서 12시 방향부터 360°/N 각도로 배치.
// kind 별로 반경을 약간 다르게 줘서 종류별 그룹이 자연스럽게 형성.
// 외곽으로 갈수록 "더 멀리 연결된" 의미 — 동료(washer) 가 가장 바깥.
const RADIUS: Record<string, number> = {
  issue: 220,
  nut: 300,
  bolt: 340,
  topic: 380,
  schedule: 380,
  file: 420,
  washer: 460,
};

interface Props {
  nickname: string;
  data: MindMapData;
  /** realtime 구독을 위한 사용자 id — 없으면 구독 비활성 */
  userId?: string;
}

/**
 * Phase B 정적 마인드맵 — 중앙 Genesis + 너트/볼트/일정/이슈 가지.
 * Phase C 에서 중앙 노드를 입력 가능한 형태로 교체 예정.
 */
interface AiSuggestion {
  roles: Array<{ name: string; tags?: string[]; why?: string }>;
  tasks: string[];
}

export function MindMapDashboard({ nickname, data, userId }: Props) {
  const [selected, setSelected] = useState<MindMapNodeData | null>(null);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [filterText, setFilterText] = useState("");
  const [filterKinds, setFilterKinds] = useState<Set<NodeKind>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("radial");
  const flowRef = useRef<HTMLDivElement | null>(null);
  const [exporting, setExporting] = useState(false);

  // viewMode 복원/저장 — localStorage 즉시 캐시 + 클라우드 디바운스 동기화 (cloudHydrated 후만)
  const [cloudHydrated, setCloudHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VIEW_MODE_KEY);
      if (raw === "timeline" || raw === "radial") setViewMode(raw);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch { /* ignore */ }
    if (!cloudHydrated) return;
    // 디바운스 — 빠른 토글 시 한 번만 PUT
    const t = setTimeout(() => {
      void fetch("/api/dashboard/mindmap-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewMode }),
      }).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [viewMode, cloudHydrated]);

  // ref 로 최신 data 보관 — onAnswer 가 deps 변화 없이 항상 최신 데이터로 매칭
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);
  const nicknameRef = useRef(nickname);
  useEffect(() => { nicknameRef.current = nickname; }, [nickname]);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Cmd/Ctrl+K 검색 포커스 — 표준 단축키
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleExport = useCallback(async () => {
    if (!flowRef.current || exporting) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      // reactflow viewport — pan/zoom 까지 포함된 렌더링 영역
      const viewport = flowRef.current.querySelector<HTMLElement>(".react-flow__viewport");
      const target = (viewport?.parentElement as HTMLElement) || flowRef.current;
      const dataUrl = await toPng(target, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#FFFCF6", // nu-cream tone
        filter: (node) => {
          // MiniMap, Controls 는 제외 — 깨끗한 마인드맵만
          if (node?.classList?.contains("react-flow__minimap")) return false;
          if (node?.classList?.contains("react-flow__controls")) return false;
          return true;
        },
      });
      const link = document.createElement("a");
      link.download = `mindmap-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("마인드맵 PNG 저장됨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "내보내기 실패");
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  // 저장된 노드 위치 — localStorage 즉시 복원 → 클라우드 fetch 로 덮어쓰기 (다기기 동기화)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (raw) setSavedPositions(JSON.parse(raw));
    } catch { /* ignore */ }
    // 클라우드 hydration — 인증 안 됐거나 fetch 실패 시 그냥 localStorage 만 사용
    let cancelled = false;
    fetch("/api/dashboard/mindmap-layout", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { layout?: Record<string, { x: number; y: number }>; viewMode?: ViewMode } | null) => {
        if (cancelled || !j) return;
        if (j.layout && Object.keys(j.layout).length > 0) {
          setSavedPositions(j.layout);
          try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(j.layout)); } catch { /* ignore */ }
        }
        if (j.viewMode === "timeline" || j.viewMode === "radial") setViewMode(j.viewMode);
        setCloudHydrated(true);
      })
      .catch(() => setCloudHydrated(true));
    return () => { cancelled = true; };
  }, []);

  // 클라우드 PUT 디바운스 — 드래그 연속 시 마지막 위치만 저장
  const layoutPutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueLayoutSync = useCallback((next: Record<string, { x: number; y: number }>) => {
    if (!cloudHydrated) return;
    if (layoutPutTimer.current) clearTimeout(layoutPutTimer.current);
    layoutPutTimer.current = setTimeout(() => {
      void fetch("/api/dashboard/mindmap-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: next }),
      }).catch(() => undefined);
    }, 600);
  }, [cloudHydrated]);

  const onNodeDragStop: NodeDragHandler = useCallback((_, node) => {
    setSavedPositions((prev) => {
      const next = { ...prev, [node.id]: { x: node.position.x, y: node.position.y } };
      try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      queueLayoutSync(next);
      return next;
    });
  }, [queueLayoutSync]);

  const onAnswer = useCallback((result: {
    text: string;
    keywords: string[];
    roles: Array<{ name: string; tags?: string[]; why?: string }>;
    tasks: string[];
  }) => {
    // 노드 데이터로부터 키워드 매칭 — ref 통해 최신 data 사용 (deps 안정화)
    const d = dataRef.current;
    const matchedIds = new Set<string>();
    const candidates: Array<{ id: string; text: string }> = [
      ...d.nuts.map((n) => ({ id: `nut-${n.id}`, text: n.name.toLowerCase() })),
      ...d.bolts.map((b) => ({ id: `bolt-${b.id}`, text: b.title.toLowerCase() })),
      ...d.schedule.map((s) => ({ id: `sched-${s.id}`, text: s.title.toLowerCase() })),
      ...d.issues.map((i) => ({ id: `issue-${i.id}`, text: i.title.toLowerCase() })),
      ...d.topics.map((t) => ({ id: `topic-${t.id}`, text: t.name.toLowerCase() })),
      ...d.washers.map((w) => ({ id: `washer-${w.id}`, text: w.nickname.toLowerCase() })),
    ];
    for (const c of candidates) {
      for (const kw of result.keywords) {
        if (c.text.includes(kw)) {
          matchedIds.add(c.id);
          break;
        }
      }
    }
    setHighlighted(matchedIds);
    if (matchedIds.size > 0) {
      setTimeout(() => setHighlighted(new Set()), 6000);
    }

    // AI 제안 임시 노드 추가 — 30초 후 자동 사라짐 (또는 dismiss 버튼)
    if (result.roles.length > 0 || result.tasks.length > 0) {
      setAiSuggestion({ roles: result.roles, tasks: result.tasks });
      setTimeout(() => setAiSuggestion(null), 30_000);
    }
  }, []);

  const { nodes: baseNodes, edges } = useMemo(
    () => viewMode === "timeline"
      ? buildTimelineGraph(nickname, data, onAnswer)
      : buildGraph(nickname, data, onAnswer, aiSuggestion),
    [nickname, data, onAnswer, aiSuggestion, viewMode],
  );

  // 하이라이트 + 필터 매칭 + 저장된 위치 복원
  // selected 는 reactflow 내부 클릭 selection 용 — 우리 highlight 와 분리해 data.highlighted 사용.
  const filterActive = filterText.trim().length > 0 || filterKinds.size > 0;
  const filterLower = filterText.trim().toLowerCase();

  // hover focus state — useMemo 들이 참조하므로 위쪽에 선언
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const focusNodeIds = useMemo<Set<string> | null>(() => {
    if (!hoverNodeId) return null;
    const ids = new Set<string>([hoverNodeId, "center"]);
    if (hoverNodeId.startsWith("washer-")) {
      const wid = hoverNodeId.slice("washer-".length);
      const w = data.washers.find((x) => x.id === wid);
      if (w) {
        w.nutIds.forEach((n) => ids.add(`nut-${n}`));
        w.boltIds.forEach((b) => ids.add(`bolt-${b}`));
      }
    } else if (hoverNodeId.startsWith("topic-")) {
      const tid = hoverNodeId.slice("topic-".length);
      const t = data.topics.find((x) => x.id === tid);
      if (t) ids.add(`nut-${t.groupId}`);
    } else if (hoverNodeId.startsWith("file-")) {
      const fid = hoverNodeId.slice("file-".length);
      const f = data.files.find((x) => x.id === fid);
      if (f?.projectId) ids.add(`bolt-${f.projectId}`);
    }
    return ids;
  }, [hoverNodeId, data.washers, data.topics, data.files]);

  const nodes = useMemo(
    () => baseNodes.map((n) => {
      const data = n.data as MindMapNodeData;
      const isHighlighted = highlighted.has(n.id);
      let isDimmed = false;
      if (filterActive && data.kind !== "center") {
        const matchesText = !filterLower
          || data.title.toLowerCase().includes(filterLower)
          || (data.subtitle?.toLowerCase().includes(filterLower) ?? false);
        const matchesKind = filterKinds.size === 0 || filterKinds.has(data.kind);
        isDimmed = !(matchesText && matchesKind);
      }
      // hover focus — 활성 시 focusNodeIds 에 없는 노드는 dim
      if (focusNodeIds && !focusNodeIds.has(n.id)) {
        isDimmed = true;
      }
      // timeline 모드에서는 saved 위치를 적용하지 않음 — 시간축 정합성 유지
      const pos = viewMode === "radial" ? savedPositions[n.id] : undefined;
      return {
        ...n,
        ...(pos ? { position: pos } : {}),
        data: { ...data, highlighted: isHighlighted, dimmed: isDimmed },
      };
    }),
    [baseNodes, highlighted, savedPositions, filterActive, filterLower, filterKinds, focusNodeIds, viewMode],
  );

  // 필터 매칭 결과 — 안내 오버레이 + 엣지 dimming 에 사용
  const dimmedIds = useMemo(
    () => new Set(nodes.filter((n) => (n.data as MindMapNodeData).dimmed).map((n) => n.id)),
    [nodes],
  );
  const visibleNonCenterCount = filterActive
    ? nodes.filter((n) => (n.data as MindMapNodeData).kind !== "center" && !(n.data as MindMapNodeData).dimmed).length
    : Infinity;

  // 엣지도 양 끝 노드가 dimmed 면 같이 dim — 고아 엣지 방지 (filter + hover 통합)
  const styledEdges = useMemo(() => {
    if (!filterActive && !focusNodeIds) return edges;
    return edges.map((e) => {
      const sDim = dimmedIds.has(e.source);
      const tDim = dimmedIds.has(e.target);
      if (!sDim && !tDim) return e;
      const baseStyle = (e.style ?? {}) as React.CSSProperties;
      const baseOpacity = typeof baseStyle.opacity === "number" ? baseStyle.opacity : 1;
      return {
        ...e,
        style: { ...baseStyle, opacity: baseOpacity * 0.15 },
        labelStyle: e.labelStyle ? { ...e.labelStyle, opacity: 0.3 } : undefined,
        labelBgStyle: e.labelBgStyle ? { ...e.labelBgStyle, fillOpacity: 0.2 } : undefined,
      };
    });
  }, [edges, dimmedIds, filterActive, focusNodeIds]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.id === "center") return;
    setSelected({ ...(node.data as MindMapNodeData), id: node.id });
  }, []);

  // realtime — 새 멘션 알림 시 해당 노드 펄스 강조 + 토스트
  const [liveBadge, setLiveBadge] = useState(false);
  useEffect(() => {
    if (!userId) return;
    const supa = createBrowserClient();
    const channel = supa
      .channel(`dashboard:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { category?: string; title?: string };
          if (row.category === "mention") {
            toast.info(`💬 새 멘션: ${row.title || ""}`, { duration: 4000 });
            // 잠시 헤더 LIVE 배지 펄스
            setLiveBadge(true);
            setTimeout(() => setLiveBadge(false), 3000);
          }
        },
      )
      .subscribe();
    return () => { void supa.removeChannel(channel); };
  }, [userId]);

  // hover 핸들러 — washer/topic 은 focus dim, file 은 프리뷰 카드
  const [hoveredFile, setHoveredFile] = useState<typeof data.files[number] | null>(null);
  const onNodeMouseEnter: NodeMouseHandler = useCallback((_, node) => {
    const kind = (node.data as MindMapNodeData).kind;
    if (kind === "washer" || kind === "topic" || kind === "file") setHoverNodeId(node.id);
    if (kind === "file") {
      const fid = node.id.startsWith("file-") ? node.id.slice("file-".length) : null;
      const f = fid ? dataRef.current.files.find((x) => x.id === fid) : null;
      if (f) setHoveredFile(f);
    }
  }, []);
  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoverNodeId(null);
    setHoveredFile(null);
  }, []);

  const total = data.nuts.length + data.bolts.length + data.schedule.length + data.issues.length + data.files.length;

  return (
    <div className="border-[3px] border-nu-ink bg-nu-cream/20 shadow-[4px_4px_0_0_#0D0F14] overflow-hidden">
      <div className="px-3 py-2 border-b-[2px] border-nu-ink/15 flex flex-wrap items-center justify-between gap-2 bg-white">
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted shrink-0 flex items-center gap-1.5">
          Genesis Mind Map · 노드 {total + 1}개
          {userId && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 border ${liveBadge ? "border-emerald-700 text-emerald-700 bg-emerald-50 animate-pulse" : "border-nu-ink/15 text-nu-muted"}`}
              title="멘션 알림 실시간 구독 중"
            >
              <Radio size={9} /> LIVE
            </span>
          )}
        </div>

        {/* 검색 + 종류 필터 */}
        <div className="flex items-center gap-1 flex-1 min-w-0 max-w-md">
          <div className="relative flex-1 min-w-0">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-nu-muted" />
            <input
              ref={searchRef}
              type="search"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="노드 검색 (⌘K)"
              className="w-full pl-7 pr-12 py-1 text-[12px] border border-nu-ink/20 focus:border-nu-ink outline-none"
              aria-label="마인드맵 노드 검색 — Cmd 또는 Ctrl+K 로 포커스"
            />
            <kbd className="absolute right-6 top-1/2 -translate-y-1/2 font-mono-nu text-[9px] text-nu-muted border border-nu-ink/20 px-1 py-px hidden sm:inline-block">
              ⌘K
            </kbd>
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-nu-muted hover:text-nu-ink"
                aria-label="검색어 지우기"
              ><X size={10} /></button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 보기 모드 토글 — 방사형(기본) / 타임라인(7일 시간축) */}
          <div className="inline-flex border-[2px] border-nu-ink" role="group" aria-label="마인드맵 보기 모드">
            <button
              type="button"
              onClick={() => setViewMode("radial")}
              aria-pressed={viewMode === "radial"}
              title="방사형 — 모든 노드 펼치기"
              className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 flex items-center gap-1 ${viewMode === "radial" ? "bg-nu-ink text-nu-cream" : "text-nu-ink hover:bg-nu-cream"}`}
            >
              <Network size={11} /> 방사형
            </button>
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              aria-pressed={viewMode === "timeline"}
              title="타임라인 — 일정만 시간축에 배치"
              className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 flex items-center gap-1 border-l-[2px] border-nu-ink ${viewMode === "timeline" ? "bg-nu-ink text-nu-cream" : "text-nu-ink hover:bg-nu-cream"}`}
            >
              <Clock size={11} /> 타임라인
            </button>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border border-nu-ink/30 hover:bg-nu-cream disabled:opacity-50 flex items-center gap-1"
            title="현재 마인드맵을 PNG 로 저장"
          >
            <Camera size={11} /> {exporting ? "저장 중…" : "PNG 저장"}
          </button>
          {Object.keys(savedPositions).length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSavedPositions({});
                try { localStorage.removeItem(LAYOUT_KEY); } catch { /* ignore */ }
                if (cloudHydrated) {
                  void fetch("/api/dashboard/mindmap-layout", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ layout: {} }),
                  }).catch(() => undefined);
                }
              }}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border border-nu-ink/30 hover:bg-nu-cream"
              title="드래그한 노드 위치 초기화"
            >
              레이아웃 초기화
            </button>
          )}
          {aiSuggestion && (
            <button
              type="button"
              onClick={() => setAiSuggestion(null)}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border border-orange-600 text-orange-700 hover:bg-orange-50 flex items-center gap-1"
              title="AI 제안 노드 닫기"
            >
              <X size={10} /> AI 노드
            </button>
          )}
          <div className="font-mono-nu text-[10px] text-nu-muted hidden sm:inline">드래그 · 휠 줌</div>
        </div>
      </div>

      {/* 종류 필터 칩 */}
      <div className="px-3 py-1.5 border-b border-nu-ink/10 flex items-center gap-1.5 flex-wrap bg-white/60">
        <Filter size={11} className="text-nu-muted shrink-0" />
        {FILTERABLE_KINDS.map(({ kind, label }) => {
          const active = filterKinds.has(kind);
          const color = NODE_COLORS[kind];
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setFilterKinds((prev) => {
                const next = new Set(prev);
                if (next.has(kind)) next.delete(kind); else next.add(kind);
                return next;
              })}
              aria-pressed={active}
              className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border ${active ? `${color.bg} ${color.border} ${color.ink}` : "border-nu-ink/20 text-nu-muted hover:bg-nu-cream"}`}
            >
              {label}
            </button>
          );
        })}
        {filterKinds.size > 0 && (
          <button
            type="button"
            onClick={() => setFilterKinds(new Set())}
            className="font-mono-nu text-[10px] text-nu-muted hover:text-nu-ink ml-auto"
          >
            필터 해제
          </button>
        )}
      </div>
      <div
        ref={flowRef}
        style={{ width: "100%", height: 600 }}
        className="touch-pan-y relative"
        role="region"
        aria-label="Genesis 마인드맵 — 너트, 볼트, 일정, 이슈, 탭, 와셔 노드 그래프"
      >
        {filterActive && visibleNonCenterCount === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="pointer-events-auto bg-white border-[3px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] px-4 py-3 max-w-xs text-center">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">결과 없음</div>
              <div className="font-head text-[14px] font-extrabold text-nu-ink mt-1">필터에 맞는 노드가 없어요</div>
              <button
                type="button"
                onClick={() => { setFilterText(""); setFilterKinds(new Set()); }}
                className="mt-2 font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1 border-[2px] border-nu-ink hover:bg-nu-cream"
              >
                필터 모두 해제
              </button>
            </div>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
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
        <CursorOverlay userId={userId} nickname={nickname} containerRef={flowRef} />
        <FileHoverPreview file={hoveredFile} />
      </div>
      <NodeDrawer
        node={selected}
        onClose={() => setSelected(null)}
        bolts={data.bolts.map((b) => ({ id: b.id, title: b.title }))}
      />
    </div>
  );
}

function shortMime(mime: string): string {
  if (mime.startsWith("image/")) return mime.slice(6).toUpperCase();
  if (mime.startsWith("video/")) return "비디오";
  if (mime.startsWith("audio/")) return "오디오";
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "스프레드시트";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "프레젠테이션";
  if (mime.includes("word") || mime.includes("document")) return "문서";
  return mime.split("/").pop()?.toUpperCase() || mime;
}

function buildGraph(
  nickname: string,
  data: MindMapData,
  onAnswer: (r: {
    text: string;
    keywords: string[];
    roles: Array<{ name: string; tags?: string[]; why?: string }>;
    tasks: string[];
  }) => void,
  aiSuggestion: AiSuggestion | null,
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
    ...data.topics.map((t) => ({
      id: `topic-${t.id}`,
      kind: "topic" as const,
      data: {
        kind: "topic" as const,
        title: t.name,
        subtitle: "📚 wiki 탭",
        href: `/groups/${t.groupId}/wiki/topics/${t.id}`,
        meta: { 소속_너트: t.groupId },
      },
    })),
    ...data.washers.map((w) => {
      const total = w.nutIds.length + w.boltIds.length;
      return {
        id: `washer-${w.id}`,
        kind: "washer" as const,
        data: {
          kind: "washer" as const,
          title: w.nickname,
          subtitle: `🔗 ${total}개 공간 공유`,
          href: `/people/${w.id}`,
          meta: {
            너트: w.nutIds.length,
            볼트: w.boltIds.length,
          },
        },
      };
    }),
    ...data.files.map((f) => ({
      id: `file-${f.id}`,
      kind: "file" as const,
      data: {
        kind: "file" as const,
        title: f.name,
        subtitle: f.fileType ? `📎 ${shortMime(f.fileType)}` : "📎 파일",
        href: f.projectId ? `/projects/${f.projectId}` : f.url || undefined,
        meta: {
          종류: f.fileType || "알 수 없음",
          저장소: f.storageType || "supabase",
          크기: f.sizeBytes ? `${Math.round(f.sizeBytes / 1024)} KB` : "-",
          소속_볼트: f.projectId || "-",
          URL: f.url || "-",
        },
      },
    })),
  ];

  if (all.length === 0) {
    // 빈 상태 — 안내 노드 (empty kind, 중립 색상)
    nodes.push({
      id: "empty",
      type: "card",
      position: { x: 0, y: 220 },
      data: {
        kind: "empty",
        title: "아직 비어 있어요",
        subtitle: "너트·볼트를 만들면 가지가 자라요",
        href: "/groups/create",
      } satisfies MindMapNodeData,
    });
    edges.push({
      id: "e-empty",
      source: "center",
      target: "empty",
      style: { strokeWidth: 2, strokeDasharray: "4 4", opacity: 0.4 },
    });
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

    // 중앙→가지 기본 엣지 — washer/topic/file 은 cross-ref 만으로 연결되도록 생략
    if (entry.kind !== "washer" && entry.kind !== "topic" && entry.kind !== "file") {
      edges.push({
        id: `e-${entry.id}`,
        source: "center",
        target: entry.id,
        style: { stroke: "#0D0F14", strokeWidth: 2 },
      });
    }
  });

  // ── Cross-reference 엣지 ─────────────────────────────────────────
  // 너트 ↔ 탭 (소속) — 점선 sky
  for (const t of data.topics) {
    if (data.nuts.some((n) => n.id === t.groupId)) {
      edges.push({
        id: `e-cr-topic-${t.id}`,
        source: `nut-${t.groupId}`,
        target: `topic-${t.id}`,
        style: { stroke: "#0EA5E9", strokeWidth: 1.5, strokeDasharray: "4 3" },
      });
    }
  }
  // 너트 ↔ 와셔 (소속) — 실선 violet 얇게
  for (const w of data.washers) {
    for (const nutId of w.nutIds) {
      if (data.nuts.some((n) => n.id === nutId)) {
        edges.push({
          id: `e-cr-w-n-${w.id}-${nutId}`,
          source: `nut-${nutId}`,
          target: `washer-${w.id}`,
          style: { stroke: "#7C3AED", strokeWidth: 1, opacity: 0.5 },
        });
      }
    }
    // 볼트 ↔ 와셔 — 실선 amber 얇게
    for (const boltId of w.boltIds) {
      if (data.bolts.some((b) => b.id === boltId)) {
        edges.push({
          id: `e-cr-w-b-${w.id}-${boltId}`,
          source: `bolt-${boltId}`,
          target: `washer-${w.id}`,
          style: { stroke: "#F59E0B", strokeWidth: 1, opacity: 0.5 },
        });
      }
    }
  }
  // 파일 ↔ 볼트 — 점선 stone (소속 표시)
  for (const f of data.files) {
    if (f.projectId && data.bolts.some((b) => b.id === f.projectId)) {
      edges.push({
        id: `e-cr-file-${f.id}`,
        source: `bolt-${f.projectId}`,
        target: `file-${f.id}`,
        style: { stroke: "#78716C", strokeWidth: 1.2, strokeDasharray: "3 3", opacity: 0.55 },
      });
    }
  }
  // 너트 ↔ 볼트 (공유 와셔 ≥1) — 굵은 검정 점선 (강한 협업 신호)
  for (const nut of data.nuts) {
    for (const bolt of data.bolts) {
      const sharedWashers = data.washers.filter(
        (w) => w.nutIds.includes(nut.id) && w.boltIds.includes(bolt.id),
      );
      if (sharedWashers.length > 0) {
        edges.push({
          id: `e-cr-n-b-${nut.id}-${bolt.id}`,
          source: `nut-${nut.id}`,
          target: `bolt-${bolt.id}`,
          style: { stroke: "#0D0F14", strokeWidth: 1.5, strokeDasharray: "6 4", opacity: 0.4 },
          label: `${sharedWashers.length}명 공유`,
          labelStyle: { fontSize: 10, fontFamily: "ui-monospace, monospace" },
          labelBgStyle: { fill: "#FFFCF6", fillOpacity: 0.9 },
          labelBgPadding: [4, 2],
        });
      }
    }
  }

  // ── AI 임시 노드 (suggested_roles + first_tasks) ─────────────────
  // 중앙 위쪽 (12시 방향) 가까이 작은 호 형태로 배치 — 30초 후 사라짐
  if (aiSuggestion) {
    const aiItems: Array<{ id: string; data: MindMapNodeData }> = [
      ...aiSuggestion.roles.map((r, i) => ({
        id: `ai-role-${i}`,
        data: {
          kind: "ai-role" as const,
          title: r.name,
          subtitle: r.tags?.length ? r.tags.slice(0, 3).join(" · ") : "💡 추천 역할",
          meta: { 이유: r.why || "Genesis AI 추천" },
        },
      })),
      ...aiSuggestion.tasks.map((t, i) => ({
        id: `ai-task-${i}`,
        data: {
          kind: "ai-task" as const,
          title: t.length > 30 ? t.slice(0, 30) + "…" : t,
          subtitle: "🎯 첫 액션",
          meta: { 전체: t, 출처: "Genesis 첫 액션 제안" },
        },
      })),
    ];
    const M = aiItems.length;
    aiItems.forEach((entry, idx) => {
      // 12시 방향 위쪽 호 (-90° ± 60° 범위)
      const angleSpan = (Math.PI * 2) / 3; // 120°
      const angle = -Math.PI / 2 - angleSpan / 2 + (M > 1 ? (idx / (M - 1)) * angleSpan : 0);
      const radius = 180; // 중앙에 가깝게
      nodes.push({
        id: entry.id,
        type: "card",
        position: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius },
        data: entry.data,
      });
      edges.push({
        id: `e-${entry.id}`,
        source: "center",
        target: entry.id,
        animated: true,
        style: { stroke: entry.data.kind === "ai-role" ? "#EAB308" : "#F97316", strokeWidth: 2 },
      });
    });
  }

  return { nodes, edges };
}

/**
 * Timeline 모드 — schedule 노드만 7일 시간축에 배치.
 * x: 시간 (지금=-400, +7일=+400),  y: 인덱스 짝홀 stagger.
 * center 는 좌측 외부에 두고, 시간 마커 4개 (지금/+2/+5/+7) 를 axis 라벨로 표시.
 */
function buildTimelineGraph(
  nickname: string,
  data: MindMapData,
  onAnswer: (r: {
    text: string;
    keywords: string[];
    roles: Array<{ name: string; tags?: string[]; why?: string }>;
    tasks: string[];
  }) => void,
): { nodes: RFNode[]; edges: RFEdge[] } {
  const nodes: RFNode[] = [];
  const edges: RFEdge[] = [];
  const now = Date.now();
  const timelineHalf = TIMELINE_WIDTH / 2;
  const xForHours = (h: number) => {
    const clamped = Math.min(TIMELINE_HOURS, Math.max(0, h));
    return -timelineHalf + (clamped / TIMELINE_HOURS) * TIMELINE_WIDTH;
  };

  // center — 좌측 위에 고정 (시간축의 시작점 표지)
  nodes.push({
    id: "center",
    type: "center",
    position: { x: -timelineHalf - 220, y: -40 },
    data: {
      kind: "center",
      title: `${nickname}님의 7일`,
      subtitle: "타임라인 — 일정 중심",
      onAnswer,
    },
  });

  // 시간축 마커 — empty kind 카드로 ghost 라벨
  const markers: Array<{ id: string; label: string; sub: string; hours: number }> = [
    { id: "t-now",   label: "지금",  sub: "0h",   hours: 0 },
    { id: "t-d2",    label: "+2일",  sub: "48h",  hours: 48 },
    { id: "t-d5",    label: "+5일",  sub: "120h", hours: 120 },
    { id: "t-end",   label: "+7일",  sub: "168h", hours: TIMELINE_HOURS },
  ];
  for (const m of markers) {
    nodes.push({
      id: m.id,
      type: "card",
      position: { x: xForHours(m.hours), y: -180 },
      data: {
        kind: "empty",
        title: m.label,
        subtitle: m.sub,
      },
      draggable: false,
      selectable: false,
    });
  }

  // schedule 정렬 + 배치 — 같은 시간대 stagger
  const sorted = [...data.schedule].sort((a, b) => a.at.localeCompare(b.at));
  if (sorted.length === 0) {
    nodes.push({
      id: "empty",
      type: "card",
      position: { x: 0, y: 0 },
      data: {
        kind: "empty",
        title: "예정된 일정 없음",
        subtitle: "7일 안에 회의·이벤트가 없어요",
        href: "/calendar",
      },
    });
    edges.push({
      id: "e-empty",
      source: "center",
      target: "empty",
      style: { strokeWidth: 2, strokeDasharray: "4 4", opacity: 0.4 },
    });
    return { nodes, edges };
  }

  sorted.forEach((s, idx) => {
    const dueMs = new Date(s.at).getTime();
    const hours = (dueMs - now) / (1000 * 60 * 60);
    const x = xForHours(hours);
    // 같은 시각 충돌 방지 — 짝/홀 인덱스로 위/아래 stagger
    const y = (idx % 2 === 0 ? -1 : 1) * 60;
    const id = `sched-${s.id}`;
    nodes.push({
      id,
      type: "card",
      position: { x, y },
      data: {
        kind: "schedule",
        title: s.title,
        subtitle: new Date(s.at).toLocaleString("ko", {
          month: "short", day: "numeric", weekday: "short",
          hour: "2-digit", minute: "2-digit", hour12: false,
        }),
        href: "/calendar",
        meta: {
          시간: new Date(s.at).toLocaleString("ko"),
          종류: s.source === "meeting" ? "회의" : "이벤트",
          남은시간: hours < 1 ? "1시간 미만" : `${Math.round(hours)}시간 후`,
        },
      },
    });
    // 점선 — center → 일정 (시간축 흐름 시각화)
    edges.push({
      id: `e-${id}`,
      source: "center",
      target: id,
      style: { stroke: "#10B981", strokeWidth: 1, strokeDasharray: "3 4", opacity: 0.4 },
    });
  });

  // 인접 일정 연결선 — 시간 흐름 강조 (동일 y 라인)
  for (let i = 0; i < sorted.length - 1; i++) {
    edges.push({
      id: `e-flow-${i}`,
      source: `sched-${sorted[i].id}`,
      target: `sched-${sorted[i + 1].id}`,
      style: { stroke: "#0D0F14", strokeWidth: 1.5, opacity: 0.6 },
    });
  }

  return { nodes, edges };
}
