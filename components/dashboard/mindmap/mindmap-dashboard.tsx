"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Camera, Search, X, Filter, Radio, Clock, Network, Wand2, ArrowDown, ArrowRight, ChevronDown, Trash2, Focus, Keyboard, Info, List, Route, Command } from "lucide-react";
import { dagreLayout, type LayoutDirection } from "@/lib/dashboard/auto-layout";
import { toast } from "sonner";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeMouseHandler,
  type NodeDragHandler,
  type ReactFlowInstance,
  type Connection,
  type EdgeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { NodeCard } from "./node-card";
import { NodeDrawer } from "./node-drawer";
import { CenterGenesisNode } from "./center-genesis-node";
import { CursorOverlay } from "./cursor-overlay";
import { FileHoverPreview } from "./file-hover-preview";
import { SectorHalo } from "./sector-halo";
import { ContextMenu, type ContextMenuTarget } from "./context-menu";
import { EdgeLabelEditor } from "./edge-label-editor";
import { GenesisPlanPanel, type GenesisPlan } from "./genesis-plan-panel";
import { HelpOverlay } from "./help-overlay";
import { OutlineView } from "./outline-view";
import { CommandPalette, type PaletteAction } from "./command-palette";
import type { MindMapData, MindMapNodeData, NodeKind } from "@/lib/dashboard/mindmap-types";
import { NODE_COLORS } from "@/lib/dashboard/mindmap-types";

const nodeTypes = { card: NodeCard, center: CenterGenesisNode, sector: SectorHalo };
const LAYOUT_KEY = "dashboard.mindmap.layout";
const VIEW_MODE_KEY = "dashboard.mindmap.viewMode";

type ViewMode = "radial" | "timeline" | "outline";

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
  /** 부모 컨테이너 높이를 모두 채울지 (true) 아니면 고정 600px (false, 기본). */
  fillContainer?: boolean;
}

// 종류별 표시 순서 — 12시 방향부터 시계방향. 풀-블리드 모드에서 섹터 배치 기준.
const KIND_DISPLAY_ORDER = [
  "nut",
  "bolt",
  "schedule",
  "issue",
  "topic",
  "file",
  "washer",
] as const;

const KIND_LABEL: Record<string, string> = {
  nut: "너트 · 그룹",
  bolt: "볼트 · 프로젝트",
  schedule: "일정",
  issue: "이슈",
  topic: "위키 탭",
  file: "파일",
  washer: "와셔 · 동료",
};
const COLLAPSED_KEY = "dashboard.mindmap.collapsed";
const LAYOUT_DIR_KEY = "dashboard.mindmap.layoutDir";

/**
 * Phase B 정적 마인드맵 — 중앙 Genesis + 너트/볼트/일정/이슈 가지.
 * Phase C 에서 중앙 노드를 입력 가능한 형태로 교체 예정.
 */
interface AiSuggestion {
  roles: Array<{ name: string; tags?: string[]; why?: string }>;
  tasks: string[];
}

export function MindMapDashboard({ nickname, data, userId, fillContainer = false }: Props) {
  const [selected, setSelected] = useState<MindMapNodeData | null>(null);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  // Genesis 가 만든 plan 전체 — 풀 패널로 펼쳐 보여줌. intent 도 같이 보관해 panel 헤더에 표시.
  const [aiPlan, setAiPlan] = useState<{ plan: GenesisPlan; intent?: string } | null>(null);
  // 포커스 모드 — 단일 노드 + 1-hop 만 보임. F 키 또는 우클릭 / 버튼.
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  // 키보드 단축키 도움말 / Legend 오버레이
  const [showHelp, setShowHelp] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  // 경로 찾기 모드 — null 이면 비활성, source 정해지면 다음 클릭이 target.
  const [pathMode, setPathMode] = useState<{ source: string | null; target: string | null } | null>(null);
  // 명령 팔레트 (Cmd+P)
  const [showPalette, setShowPalette] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterKinds, setFilterKinds] = useState<Set<NodeKind>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("radial");
  const [collapsedKinds, setCollapsedKinds] = useState<Set<NodeKind>>(new Set());
  const [layoutDir, setLayoutDir] = useState<LayoutDirection>("TB");
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  // 다중 선택 — reactflow onSelectionChange 가 갱신.
  const [selection, setSelection] = useState<{ nodes: RFNode[]; edges: RFEdge[] }>({ nodes: [], edges: [] });
  // L11.1 — owner(nut/bolt) 별 미확인 카운트.
  //  • 초기 + 백업 폴링 (5분)
  //  • Realtime: 새 활동/댓글 INSERT 시 즉시 재조회 (debounce 300ms)
  const [unreadByOwner, setUnreadByOwner] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const supabase = createBrowserClient();

    const fetchUnread = async () => {
      try {
        const r = await fetch("/api/activity/global?summary=1&limit=1");
        const j = await r.json();
        if (alive && j?.summary?.unread) setUnreadByOwner(j.summary.unread);
      } catch { /* ignore */ }
    };
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchUnread, 300);
    };

    fetchUnread();
    const ch = supabase.channel("mindmap-activity-badges")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "space_activity_log" }, debouncedFetch)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_updates"   }, debouncedFetch)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crew_posts"        }, debouncedFetch)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments"          }, debouncedFetch)
      .subscribe();
    const t = setInterval(fetchUnread, 5 * 60_000);

    return () => {
      alive = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, []);

  // collapsed 복원/저장 — localStorage 만 (서버 영속은 과한 비용)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setCollapsedKinds(new Set(arr));
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(Array.from(collapsedKinds))); } catch { /* ignore */ }
  }, [collapsedKinds]);

  // layoutDir + minimapKinds 영속
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_DIR_KEY);
      if (raw === "TB" || raw === "LR") setLayoutDir(raw);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LAYOUT_DIR_KEY, layoutDir); } catch { /* ignore */ }
  }, [layoutDir]);

  const toggleSectorCollapse = useCallback((kind: NodeKind) => {
    setCollapsedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind); else next.add(kind);
      return next;
    });
  }, []);
  const flowRef = useRef<HTMLDivElement | null>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const [exporting, setExporting] = useState(false);

  // viewMode 복원/저장 — localStorage 즉시 캐시 + 클라우드 디바운스 동기화 (cloudHydrated 후만)
  const [cloudHydrated, setCloudHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VIEW_MODE_KEY);
      if (raw === "timeline" || raw === "radial" || raw === "outline") setViewMode(raw);
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

  // Cmd/Ctrl+K 검색 포커스 + F 포커스모드 + ? 도움말 + Esc 종료
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // input/textarea 에서는 발화 안 됨
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowHelp((v) => !v);
        return;
      }
      if (e.key.toLowerCase() === "i" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setShowLegend((v) => !v);
        return;
      }
      // Cmd/Ctrl+P — 명령 팔레트
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setShowPalette((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (showPalette) { setShowPalette(false); return; }
        if (pathMode) { setPathMode(null); return; }
        if (focusedNodeId) { setFocusedNodeId(null); return; }
        if (showHelp) { setShowHelp(false); return; }
        if (showLegend) { setShowLegend(false); return; }
      }
      if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // 선택 노드가 있으면 그것을 포커스. 없으면 토글로 끄기.
        if (focusedNodeId) {
          setFocusedNodeId(null);
        } else if (selected?.id && selected.id !== "center") {
          setFocusedNodeId(selected.id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedNodeId, selected, showHelp, showLegend, showPalette, pathMode]);

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
        if (j.viewMode === "timeline" || j.viewMode === "radial" || j.viewMode === "outline") setViewMode(j.viewMode);
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

  // Dagre 자동 정렬 — 트리 형태로 재배치 + 영속.
  // direction: TB(상하) / LR(좌우). nodeIds 지정 시 그 노드들만 부분 정렬.
  const handleAutoLayout = useCallback((direction?: LayoutDirection, nodeIds?: string[]) => {
    const inst = rfRef.current;
    if (!inst) return;
    const allCur = inst.getNodes();
    const allEdgesNow = inst.getEdges();
    const dir = direction ?? layoutDir;

    // 부분 정렬 — 선택된 노드만 dagre 적용, 나머지는 기존 위치 유지.
    let cur = allCur;
    let ce = allEdgesNow;
    if (nodeIds && nodeIds.length > 1) {
      const idSet = new Set(nodeIds);
      cur = allCur.filter((n) => idSet.has(n.id));
      ce = allEdgesNow.filter((e) => idSet.has(e.source) && idSet.has(e.target));
    }
    if (cur.length === 0) return;

    const positions = dagreLayout(cur, ce, dir);
    if (Object.keys(positions).length === 0) return;

    // 기존 savedPositions 와 머지 — 부분 정렬 시 다른 노드는 그대로
    setSavedPositions((prev) => {
      const next = { ...prev, ...positions };
      try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      queueLayoutSync(next);
      return next;
    });
    setTimeout(() => inst.fitView({ padding: 0.2, duration: 600 }), 50);
  }, [layoutDir]); // eslint-disable-line react-hooks/exhaustive-deps

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
    plan?: Record<string, unknown>;
    intent?: string;
  }) => {
    // 풀 plan 패널 — 사용자가 phases/milestones/wiki/folders 까지 자세히 볼 수 있게
    if (result.plan) {
      setAiPlan({ plan: result.plan as GenesisPlan, intent: result.intent });
    }
    // 노드 데이터로부터 키워드 매칭 — ref 통해 최신 data 사용 (deps 안정화)
    const d = dataRef.current;
    const matchedIds = new Set<string>();
    const candidates: Array<{ id: string; text: string }> = [
      ...d.nuts.map((n)     => ({ id: `nut-${n.id}`,     text: (n.name     || "").toLowerCase() })),
      ...d.bolts.map((b)    => ({ id: `bolt-${b.id}`,    text: (b.title    || "").toLowerCase() })),
      ...d.schedule.map((s) => ({ id: `sched-${s.id}`,   text: (s.title    || "").toLowerCase() })),
      ...d.issues.map((i)   => ({ id: `issue-${i.id}`,   text: (i.title    || "").toLowerCase() })),
      ...d.topics.map((t)   => ({ id: `topic-${t.id}`,   text: (t.name     || "").toLowerCase() })),
      ...d.washers.map((w)  => ({ id: `washer-${w.id}`,  text: (w.nickname || "").toLowerCase() })),
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
      // 매칭 노드 + center 함께 줌 — Genesis 답변 박스가 카메라 밖으로 나가지 않게.
      if (rfRef.current) {
        const targets = [{ id: "center" }, ...Array.from(matchedIds).map((id) => ({ id }))];
        try {
          rfRef.current.fitView({ nodes: targets, padding: 0.3, duration: 800, maxZoom: 1.4 });
        } catch { /* SSR 또는 노드 미마운트 — 무시 */ }
      }
      setTimeout(() => setHighlighted(new Set()), 6000);
    } else if (rfRef.current) {
      // 매칭 0 + AI 제안만 있을 때 — center 자체로 살짝 줌 인 (답변 박스가 잘 보이게)
      try {
        rfRef.current.fitView({ nodes: [{ id: "center" }], padding: 0.5, duration: 600, maxZoom: 1.2 });
      } catch { /* ignore */ }
    }

    // AI 제안 임시 노드 추가 — 30초 후 자동 사라짐 (또는 dismiss 버튼)
    if (result.roles.length > 0 || result.tasks.length > 0) {
      setAiSuggestion({ roles: result.roles, tasks: result.tasks });
      setTimeout(() => setAiSuggestion(null), 30_000);
    }
  }, []);

  // Genesis 입력창 컨텍스트 제안 — 사용자가 가진 데이터 기반으로 무엇을 물어볼지 가이드
  const aiSuggestions = useMemo<string[]>(() => {
    const list: string[] = [];
    const overdueCount = data.issues.filter((i) => i.kind === "overdue_task").length;
    if (overdueCount > 0) list.push(`마감 지난 ${overdueCount}개 어떻게 정리할까`);
    const upcoming = data.schedule.filter((s) => {
      const h = (new Date(s.at).getTime() - Date.now()) / (1000 * 60 * 60);
      return h >= 0 && h < 48;
    });
    if (upcoming.length > 0) list.push(`이번 주 ${upcoming[0].title} 준비할 것`);
    if (data.bolts.some((b) => b.status === "draft")) list.push("이 새 프로젝트 어떻게 시작");
    if (data.nuts.length > 0 && data.washers.length === 0) list.push("이 너트에 어울릴 사람 추천");
    if (data.bolts.length > 1) list.push("이번 분기 우선순위 정리");
    if (list.length === 0) {
      // 빈 상태 — 신규 사용자 시작 질문
      list.push("독서 모임 만들고 싶어");
      list.push("브랜딩 프로젝트 시작");
      list.push("이번 주 시급한 일은");
    }
    return list.slice(0, 4);
  }, [data]);

  const { nodes: baseNodes, edges } = useMemo(
    () => viewMode === "timeline"
      ? buildTimelineGraph(nickname, data, onAnswer, aiSuggestions)
      : buildGraph(nickname, data, onAnswer, aiSuggestion, collapsedKinds, toggleSectorCollapse, aiSuggestions),
    [nickname, data, onAnswer, aiSuggestion, viewMode, collapsedKinds, toggleSectorCollapse, aiSuggestions],
  );

  // 하이라이트 + 필터 매칭 + 저장된 위치 복원
  // selected 는 reactflow 내부 클릭 selection 용 — 우리 highlight 와 분리해 data.highlighted 사용.
  const filterActive = filterText.trim().length > 0 || filterKinds.size > 0;
  const filterLower = filterText.trim().toLowerCase();

  // hover focus state — useMemo 들이 참조하므로 위쪽에 선언
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  // 자유 엣지 — useState 만 위쪽에. fetch/onConnect 콜백은 아래.
  const [userEdges, setUserEdges] = useState<Array<{ id: string; source_id: string; target_id: string; label: string | null }>>([]);
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

  // 포커스 진입 시 카메라 줌 — 1-hop 노드들로 fitView.
  useEffect(() => {
    if (!focusedNodeId || !rfRef.current) return;
    const inst = rfRef.current;
    const targets: Array<{ id: string }> = [{ id: focusedNodeId }];
    // 엣지 기반 1-hop
    for (const e of inst.getEdges()) {
      if (e.source === focusedNodeId) targets.push({ id: e.target });
      else if (e.target === focusedNodeId) targets.push({ id: e.source });
    }
    if (targets.length > 1) {
      try { inst.fitView({ nodes: targets, padding: 0.3, duration: 600, maxZoom: 1.6 }); }
      catch { /* ignore */ }
    } else {
      try { inst.fitView({ nodes: targets, padding: 0.5, duration: 600, maxZoom: 1.5 }); }
      catch { /* ignore */ }
    }
  }, [focusedNodeId]);

  // 포커스 모드 — 선택 노드 + 1-hop (엣지 기준) + center + 그 노드의 sector halo.
  const focusModeIds = useMemo<Set<string> | null>(() => {
    if (!focusedNodeId) return null;
    const ids = new Set<string>([focusedNodeId, "center"]);
    // 모든 엣지를 훑어 source/target 매칭하는 반대쪽을 추가
    for (const e of edges) {
      if (e.source === focusedNodeId) ids.add(e.target);
      else if (e.target === focusedNodeId) ids.add(e.source);
    }
    // 사용자 자유 엣지도 포함
    for (const e of userEdges) {
      if (e.source_id === focusedNodeId) ids.add(e.target_id);
      else if (e.target_id === focusedNodeId) ids.add(e.source_id);
    }
    // sector halo — 노드의 kind 부터 추출해 그 halo 도 같이 보여줌
    const kindMatch = focusedNodeId.match(/^([a-z]+)-/);
    const kind = kindMatch?.[1] === "sched" ? "schedule" : kindMatch?.[1];
    if (kind) ids.add(`halo-${kind}`);
    return ids;
  }, [focusedNodeId, edges, userEdges]);

  const aiActive = highlighted.size > 0;

  // 경로 찾기 — pathMode source+target 설정 시 BFS 로 최단 경로의 노드/엣지 id 계산.
  // (선언 위치: nodes useMemo 가 deps 로 참조하므로 그 앞에.)
  const pathResult = useMemo<{ nodeIds: Set<string>; edgeIds: Set<string> } | null>(() => {
    if (!pathMode?.source || !pathMode.target) return null;
    const adj = new Map<string, Array<{ neighbor: string; edgeId: string }>>();
    const addEdge = (s: string, t: string, id: string) => {
      if (!adj.has(s)) adj.set(s, []);
      if (!adj.has(t)) adj.set(t, []);
      adj.get(s)!.push({ neighbor: t, edgeId: id });
      adj.get(t)!.push({ neighbor: s, edgeId: id });
    };
    for (const e of edges) addEdge(e.source, e.target, e.id);
    for (const ue of userEdges) addEdge(ue.source_id, ue.target_id, `user-${ue.id}`);

    const start = pathMode.source;
    const goal = pathMode.target;
    if (start === goal) return { nodeIds: new Set([start]), edgeIds: new Set() };

    const visited = new Map<string, { prev: string; edgeId: string } | null>();
    visited.set(start, null);
    const queue: string[] = [start];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur === goal) break;
      for (const { neighbor, edgeId } of (adj.get(cur) ?? [])) {
        if (!visited.has(neighbor)) {
          visited.set(neighbor, { prev: cur, edgeId });
          queue.push(neighbor);
        }
      }
    }
    if (!visited.has(goal)) return { nodeIds: new Set([start, goal]), edgeIds: new Set() };

    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    let cursor: string | undefined = goal;
    while (cursor) {
      nodeIds.add(cursor);
      const step: { prev: string; edgeId: string } | null = visited.get(cursor) ?? null;
      if (!step) break;
      edgeIds.add(step.edgeId);
      cursor = step.prev;
    }
    return { nodeIds, edgeIds };
  }, [pathMode, edges, userEdges]);

  const nodes = useMemo(
    () => baseNodes.map((n) => {
      const data = n.data as MindMapNodeData;
      let isHighlighted = highlighted.has(n.id);
      let isDimmed = false;
      if (filterActive && data.kind !== "center") {
        // sector/halo 노드는 data.title 이 비어 있을 수 있어 옵셔널 가드.
        const titleLower    = (data.title    || "").toLowerCase();
        const subtitleLower = (data.subtitle || "").toLowerCase();
        const matchesText = !filterLower
          || titleLower.includes(filterLower)
          || subtitleLower.includes(filterLower);
        const matchesKind = filterKinds.size === 0 || filterKinds.has(data.kind);
        isDimmed = !(matchesText && matchesKind);
      }
      // hover focus — 활성 시 focusNodeIds 에 없는 노드는 dim
      if (focusNodeIds && !focusNodeIds.has(n.id)) {
        isDimmed = true;
      }
      // 포커스 모드 — 선택 노드 + 1-hop 외 모두 dim. center 는 항상 보임.
      if (focusModeIds && !focusModeIds.has(n.id)) {
        isDimmed = true;
      }
      // 경로 강조 — path 노드 외 모두 dim, path 노드는 highlighted
      if (pathResult && pathResult.nodeIds.size > 0 && data.kind !== "center") {
        if (pathResult.nodeIds.has(n.id)) {
          isHighlighted = true;
          isDimmed = false;
        } else {
          isDimmed = true;
        }
      }
      // AI 답변 활성 — 매칭 안 된 노드는 dim (center/sector 제외, 매칭은 강조)
      if (aiActive && data.kind !== "center" && (data as unknown as { kind: string }).kind !== "sector" && !isHighlighted) {
        isDimmed = true;
      }
      // timeline 모드에서는 saved 위치를 적용하지 않음 — 시간축 정합성 유지
      const pos = viewMode === "radial" ? savedPositions[n.id] : undefined;
      // L11 — nut-{id} / bolt-{id} prefix 분리 후 unreadByOwner 매핑.
      let unreadCount = 0;
      if (data.kind === "nut" && n.id.startsWith("nut-")) {
        unreadCount = unreadByOwner[`nut:${n.id.slice(4)}`] || 0;
      } else if (data.kind === "bolt" && n.id.startsWith("bolt-")) {
        unreadCount = unreadByOwner[`bolt:${n.id.slice(5)}`] || 0;
      }
      return {
        ...n,
        ...(pos ? { position: pos } : {}),
        data: { ...data, highlighted: isHighlighted, dimmed: isDimmed, unreadCount },
      };
    }),
    [baseNodes, highlighted, aiActive, savedPositions, filterActive, filterLower, filterKinds, focusNodeIds, focusModeIds, pathResult, viewMode, unreadByOwner],
  );

  // 필터 매칭 결과 — 안내 오버레이 + 엣지 dimming 에 사용
  const dimmedIds = useMemo(
    () => new Set(nodes.filter((n) => (n.data as MindMapNodeData).dimmed).map((n) => n.id)),
    [nodes],
  );
  const visibleNonCenterCount = filterActive
    ? nodes.filter((n) => (n.data as MindMapNodeData).kind !== "center" && !(n.data as MindMapNodeData).dimmed).length
    : Infinity;

  // 사용자 자유 엣지 — 컴퓨티드 엣지에 합치기 (id 충돌 방지 위해 user- 접두사)
  const allEdges = useMemo<RFEdge[]>(() => {
    const ue: RFEdge[] = userEdges.map((e) => ({
      id: `user-${e.id}`,
      source: e.source_id,
      target: e.target_id,
      type: "smoothstep",
      animated: false,
      style: { stroke: "#FF3D88", strokeWidth: 2, strokeDasharray: "6 3" },
      label: e.label || undefined,
      labelStyle: e.label ? { fontSize: 10, fontFamily: "ui-monospace, monospace", fill: "#BE185D" } : undefined,
      labelBgStyle: e.label ? { fill: "#FFFCF6", fillOpacity: 0.95 } : undefined,
      labelBgPadding: [4, 2],
      data: { isUser: true },
    }));
    return [...edges, ...ue];
  }, [edges, userEdges]);

  // 엣지도 양 끝 노드가 dimmed 면 같이 dim — 고아 엣지 방지 (filter + hover + path 통합)
  const styledEdges = useMemo(() => {
    const pathActive = pathResult && pathResult.edgeIds.size > 0;
    if (!filterActive && !focusNodeIds && !pathActive) return allEdges;
    return allEdges.map((e) => {
      // 경로 강조 — path 안 엣지는 굵은 핑크, 그 외 모두 dim
      if (pathActive) {
        const baseStyle = (e.style ?? {}) as React.CSSProperties;
        if (pathResult!.edgeIds.has(e.id)) {
          return {
            ...e,
            animated: true,
            style: { ...baseStyle, stroke: "#FF3D88", strokeWidth: 3.5, opacity: 1 },
          };
        }
        const baseOpacity = typeof baseStyle.opacity === "number" ? baseStyle.opacity : 1;
        return {
          ...e,
          style: { ...baseStyle, opacity: baseOpacity * 0.1 },
          labelStyle: e.labelStyle ? { ...e.labelStyle, opacity: 0.2 } : undefined,
          labelBgStyle: e.labelBgStyle ? { ...e.labelBgStyle, fillOpacity: 0.15 } : undefined,
        };
      }
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
  }, [allEdges, dimmedIds, filterActive, focusNodeIds, pathResult]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    if (node.id === "center") return;
    // 경로 모드 — 첫 클릭은 source, 두 번째는 target
    if (pathMode) {
      if (!pathMode.source) {
        setPathMode({ source: node.id, target: null });
        toast.info("두 번째 노드를 클릭해서 경로 보기", { duration: 4000 });
      } else if (!pathMode.target && node.id !== pathMode.source) {
        setPathMode({ source: pathMode.source, target: node.id });
      } else {
        // 이미 둘 다 정해진 상태에서 또 클릭 — 새 source 로 reset
        setPathMode({ source: node.id, target: null });
        toast.info("새 경로 — 두 번째 노드를 클릭", { duration: 3000 });
      }
      return;
    }
    setSelected({ ...(node.data as MindMapNodeData), id: node.id });
  }, [pathMode]);

  // 다중 선택 핸들러 — reactflow 가 shift+drag/click 으로 다중 선택할 때 갱신.
  const onSelectionChange = useCallback((sel: { nodes: RFNode[]; edges: RFEdge[] }) => {
    // sector halo / center 는 비편집 → 선택에서 제외
    const filteredNodes = sel.nodes.filter(
      (n) => n.id !== "center" && n.type !== "sector",
    );
    setSelection({ nodes: filteredNodes, edges: sel.edges });
  }, []);

  // 선택만 정렬 — 부분 dagre.
  const handleAlignSelection = useCallback(() => {
    if (selection.nodes.length < 2) return;
    handleAutoLayout(undefined, selection.nodes.map((n) => n.id));
  }, [selection.nodes, handleAutoLayout]);

  // 선택된 사용자 엣지 일괄 삭제 — 자동 엣지는 도메인 데이터 변경으로만 사라짐
  const handleDeleteSelectedEdges = useCallback(() => {
    const userIds = selection.edges
      .filter((e) => (e.data as { isUser?: boolean } | undefined)?.isUser)
      .map((e) => e.id.startsWith("user-") ? e.id.slice("user-".length) : e.id);
    if (userIds.length === 0) {
      toast.info("자동 관계는 삭제할 수 없어요");
      return;
    }
    setUserEdges((prev) => prev.filter((e) => !userIds.includes(e.id)));
    setSelection({ nodes: selection.nodes, edges: [] });
    Promise.all(
      userIds.map((id) =>
        fetch(`/api/dashboard/mindmap/edges?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined),
      ),
    );
    toast.success(`${userIds.length}개 연결 삭제`);
  }, [selection]);

  // 우클릭 컨텍스트 메뉴 — 노드 또는 사용자 엣지에서.
  const [ctxMenu, setCtxMenu] = useState<ContextMenuTarget | null>(null);
  const onNodeContextMenu: NodeMouseHandler = useCallback((e, node) => {
    if (node.id === "center" || node.type === "sector") return;
    e.preventDefault();
    const d = node.data as MindMapNodeData;
    setCtxMenu({
      kind: "node",
      x: e.clientX,
      y: e.clientY,
      targetId: node.id,
      href: d.href,
    });
  }, []);
  // 엣지 라벨 편집 — 사용자 엣지 더블클릭으로 열림.
  const [edgeLabelTarget, setEdgeLabelTarget] = useState<{ edgeId: string; current: string | null; x: number; y: number } | null>(null);
  const onEdgeDoubleClick: EdgeMouseHandler = useCallback((e, edge) => {
    const isUser = (edge.data as { isUser?: boolean } | undefined)?.isUser;
    if (!isUser) {
      toast.info("자동 관계는 라벨을 바꿀 수 없어요");
      return;
    }
    e.preventDefault();
    setEdgeLabelTarget({
      edgeId: edge.id,
      current: typeof edge.label === "string" ? edge.label : null,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);
  const saveEdgeLabel = useCallback((edgeId: string, label: string | null) => {
    if (!edgeId.startsWith("user-")) return;
    const realId = edgeId.slice("user-".length);
    // optimistic
    setUserEdges((prev) => prev.map((e) => (e.id === realId ? { ...e, label } : e)));
    void fetch(`/api/dashboard/mindmap/edges?id=${encodeURIComponent(realId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    }).catch(() => toast.error("라벨 저장 실패"));
  }, []);

  const onEdgeContextMenu: EdgeMouseHandler = useCallback((e, edge) => {
    e.preventDefault();
    const isUser = (edge.data as { isUser?: boolean } | undefined)?.isUser === true;
    setCtxMenu({
      kind: "edge",
      x: e.clientX,
      y: e.clientY,
      targetId: edge.id,
      isUserEdge: isUser,
    });
  }, []);
  const openDrawerById = useCallback((id: string) => {
    const n = rfRef.current?.getNode(id);
    if (n) setSelected({ ...(n.data as MindMapNodeData), id });
  }, []);

  // Genesis 노드 확장 — 컨텍스트 메뉴에서 호출. 결과는 ai-task 임시 노드 형태로 추가.
  const expandNode = useCallback(async (nodeId: string) => {
    const n = rfRef.current?.getNode(nodeId);
    if (!n) return;
    const d = n.data as MindMapNodeData;
    if (d.kind === "center" || d.kind === "empty" || d.kind?.startsWith("ai-")) {
      toast.info("이 종류는 분기할 수 없어요");
      return;
    }
    toast.loading(`Genesis 가 "${d.title}" 에서 분기 중…`, { id: "expand-node" });
    try {
      const res = await fetch("/api/dashboard/mindmap/expand-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: d.kind, title: d.title, sub: d.subtitle, meta: d.meta }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(`분기 실패: ${json?.error || res.status}`, { id: "expand-node" });
        return;
      }
      const sugs = (json.suggestions || []) as Array<{ title: string; why: string }>;
      if (sugs.length === 0) {
        toast.error("AI 가 분기를 만들지 못했어요", { id: "expand-node" });
        return;
      }
      // 임시 ai-task 노드들로 변환 — 기존 aiSuggestion 메커니즘 재사용
      setAiSuggestion({
        roles: [],
        tasks: sugs.map((s) => `${s.title} — ${s.why}`),
      });
      toast.success(`💡 ${sugs.length}개 분기 — 30초 후 자동 사라짐`, { id: "expand-node" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "네트워크 오류", { id: "expand-node" });
    }
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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/mindmap/edges")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { edges: Array<{ id: string; source_id: string; target_id: string; label: string | null }> } | null) => {
        if (cancelled || !j) return;
        setUserEdges(j.edges ?? []);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return;
    // 옵티미스틱: 임시 id 로 즉시 추가 → 서버 응답 시 진짜 id 로 교체
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setUserEdges((prev) => [
      ...prev,
      { id: tempId, source_id: conn.source!, target_id: conn.target!, label: null },
    ]);
    fetch("/api/dashboard/mindmap/edges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_id: conn.source, target_id: conn.target }),
    })
      .then((r) => r.json())
      .then((j: { edge?: { id: string; source_id: string; target_id: string; label: string | null }; error?: string }) => {
        if (j.edge) {
          setUserEdges((prev) => prev.map((e) => (e.id === tempId ? j.edge! : e)));
        } else if (j.error === "duplicate") {
          // 중복은 서버가 거부 — UI 에서 임시 엣지 제거
          setUserEdges((prev) => prev.filter((e) => e.id !== tempId));
          toast.info("이미 그어진 연결이에요");
        } else {
          setUserEdges((prev) => prev.filter((e) => e.id !== tempId));
          toast.error("연결 저장 실패");
        }
      })
      .catch(() => {
        setUserEdges((prev) => prev.filter((e) => e.id !== tempId));
        toast.error("연결 저장 실패");
      });
  }, []);

  const deleteUserEdge = useCallback((edgeId: string) => {
    if (edgeId.startsWith("user-")) {
      const realId = edgeId.slice("user-".length);
      // optimistic 제거
      setUserEdges((prev) => prev.filter((e) => e.id !== realId));
      void fetch(`/api/dashboard/mindmap/edges?id=${encodeURIComponent(realId)}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
  }, []);
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
    <div className={`border-[3px] border-nu-ink bg-nu-cream/20 shadow-[4px_4px_0_0_#0D0F14] overflow-hidden ${fillContainer ? "flex flex-col h-full" : ""}`}>
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
          {/* 보기 모드 토글 — 방사형 / 타임라인 / 아웃라인 */}
          <div className="inline-flex border-[2px] border-nu-ink" role="group" aria-label="마인드맵 보기 모드">
            <button
              type="button"
              onClick={() => setViewMode("radial")}
              aria-pressed={viewMode === "radial"}
              title="방사형 — 모든 노드 그래프"
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
            <button
              type="button"
              onClick={() => setViewMode("outline")}
              aria-pressed={viewMode === "outline"}
              title="아웃라인 — 계층형 텍스트 트리 (스캔/공유용)"
              className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 flex items-center gap-1 border-l-[2px] border-nu-ink ${viewMode === "outline" ? "bg-nu-ink text-nu-cream" : "text-nu-ink hover:bg-nu-cream"}`}
            >
              <List size={11} /> 아웃라인
            </button>
          </div>
          {/* 시각 구분선 — 보기 그룹과 정렬/AI/도움말 그룹 분리 */}
          <span className="w-px h-5 bg-nu-ink/15" aria-hidden />
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border border-nu-ink/30 hover:bg-nu-cream disabled:opacity-50 flex items-center gap-1"
            title="현재 마인드맵을 PNG 로 저장"
          >
            <Camera size={11} /> {exporting ? "저장 중…" : "PNG 저장"}
          </button>
          {/* Auto-layout — Dagre 트리. radial 모드에서만 의미 있음.
              Split button: 본체 = 현재 방향으로 정렬 / chevron = 방향 메뉴 */}
          {viewMode === "radial" && (
            <div className="relative inline-flex border border-nu-ink/30">
              <button
                type="button"
                onClick={() => handleAutoLayout()}
                className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 hover:bg-nu-cream flex items-center gap-1"
                title={`${layoutDir === "TB" ? "위→아래" : "좌→우"} 방향으로 자동 정렬`}
              >
                <Wand2 size={11} />
                {layoutDir === "TB" ? <ArrowDown size={10} /> : <ArrowRight size={10} />}
                정렬
              </button>
              <button
                type="button"
                onClick={() => setLayoutMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={layoutMenuOpen}
                className="px-1 py-1 border-l border-nu-ink/30 hover:bg-nu-cream"
                title="정렬 방향 선택"
              >
                <ChevronDown size={11} />
              </button>
              {layoutMenuOpen && (
                <div
                  role="menu"
                  className="absolute top-full right-0 mt-0.5 z-50 bg-white border-[2px] border-nu-ink shadow-[2px_2px_0_0_#0D0F14] min-w-[140px]"
                  onMouseLeave={() => setLayoutMenuOpen(false)}
                >
                  {([
                    { dir: "TB" as const, label: "위 → 아래", Icon: ArrowDown },
                    { dir: "LR" as const, label: "좌 → 우",   Icon: ArrowRight },
                  ]).map(({ dir, label, Icon }) => (
                    <button
                      key={dir}
                      type="button"
                      role="menuitemradio"
                      aria-checked={layoutDir === dir}
                      onClick={() => {
                        setLayoutDir(dir);
                        setLayoutMenuOpen(false);
                        handleAutoLayout(dir);
                      }}
                      className={`w-full text-left flex items-center gap-2 px-2 py-1 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-cream ${layoutDir === dir ? "bg-nu-cream" : ""}`}
                    >
                      <Icon size={11} /> {label}
                      {layoutDir === dir && <span className="ml-auto text-nu-pink">●</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
          {aiPlan && (
            <button
              type="button"
              onClick={() => setAiPlan({ ...aiPlan })}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border border-nu-pink text-nu-pink hover:bg-nu-pink/10 flex items-center gap-1"
              title="Genesis 답변 다시 펼치기"
            >
              💡 답변 패널
            </button>
          )}
          {/* 구분선 — 정렬/AI 그룹과 탐색/도움말 그룹 사이 */}
          <span className="w-px h-5 bg-nu-ink/15" aria-hidden />
          {viewMode === "radial" && (
            <button
              type="button"
              onClick={() => setPathMode(pathMode ? null : { source: null, target: null })}
              className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border flex items-center gap-1 ${pathMode ? "border-nu-pink bg-nu-pink/10 text-nu-pink" : "border-nu-ink/30 hover:bg-nu-cream"}`}
              title="두 노드 사이 최단 경로 강조"
            >
              <Route size={11} /> 경로
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPalette(true)}
            className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-1 border border-nu-ink/30 hover:bg-nu-cream flex items-center gap-1"
            title="명령 팔레트 (⌘P)"
          >
            <Command size={11} />
          </button>
          <button
            type="button"
            onClick={() => setShowLegend(true)}
            className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-1 border border-nu-ink/30 hover:bg-nu-cream flex items-center gap-1"
            title="Legend — 시각 언어 설명 (I 키)"
          >
            <Info size={11} />
          </button>
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-1 border border-nu-ink/30 hover:bg-nu-cream flex items-center gap-1"
            title="키보드 단축키 (? 키)"
          >
            <Keyboard size={11} />
          </button>
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
        style={fillContainer ? { width: "100%", flex: 1, minHeight: 0 } : { width: "100%", height: 600 }}
        className="touch-pan-y relative"
        role="region"
        aria-label="Genesis 마인드맵 — 너트, 볼트, 일정, 이슈, 탭, 와셔 노드 그래프"
      >
        {/* 포커스 모드 배너 — 1-hop 만 보이는 zen 모드 */}
        {focusedNodeId && (
          <div className="absolute top-3 left-3 z-30 bg-nu-ink text-nu-paper border-[3px] border-nu-ink shadow-[3px_3px_0_0_rgba(255,61,136,0.5)] flex items-center gap-2 px-3 py-1.5">
            <Focus size={12} className="text-nu-pink" />
            <span className="font-mono-nu text-[10px] uppercase tracking-widest">
              포커스 모드 · 1-hop
            </span>
            <button
              type="button"
              onClick={() => setFocusedNodeId(null)}
              className="font-mono-nu text-[10px] uppercase tracking-widest border border-nu-paper/40 px-1.5 py-0.5 hover:bg-nu-paper/10"
              title="포커스 해제 (F 또는 ESC)"
            >
              <X size={10} />
            </button>
          </div>
        )}

        {/* 경로 찾기 배너 */}
        {pathMode && (
          <div className="absolute top-3 left-3 z-30 bg-nu-pink text-white border-[3px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] flex items-center gap-2 px-3 py-1.5">
            <Route size={12} />
            <span className="font-mono-nu text-[10px] uppercase tracking-widest">
              {!pathMode.source
                ? "경로 — 첫 노드 클릭"
                : !pathMode.target
                  ? "경로 — 두 번째 노드 클릭"
                  : pathResult && pathResult.edgeIds.size > 0
                    ? `경로 ${pathResult.edgeIds.size}홉`
                    : "경로 없음"}
            </span>
            <button
              type="button"
              onClick={() => setPathMode(null)}
              className="font-mono-nu text-[10px] uppercase tracking-widest border border-white/40 px-1.5 py-0.5 hover:bg-white/10"
              title="경로 종료 (ESC)"
            >
              <X size={10} />
            </button>
          </div>
        )}

        {/* 다중 선택 액션바 — 2개 이상 선택 시 캔버스 상단 가운데 떠오름 */}
        {(selection.nodes.length + selection.edges.length) > 1 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white border-[3px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] flex items-center gap-1 px-2 py-1.5">
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mr-1">
              {selection.nodes.length}개 노드 / {selection.edges.length}개 엣지
            </span>
            {selection.nodes.length > 1 && viewMode === "radial" && (
              <button
                type="button"
                onClick={handleAlignSelection}
                className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border-[2px] border-nu-ink hover:bg-nu-cream flex items-center gap-1"
                title="선택된 노드만 dagre 트리로 정렬"
              >
                <Wand2 size={10} /> 선택만 정렬
              </button>
            )}
            {selection.edges.some((e) => (e.data as { isUser?: boolean } | undefined)?.isUser) && (
              <button
                type="button"
                onClick={handleDeleteSelectedEdges}
                className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border-[2px] border-red-700 text-red-700 hover:bg-red-50 flex items-center gap-1"
                title="선택된 사용자 연결 일괄 삭제"
              >
                <Trash2 size={10} /> 연결 삭제
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                rfRef.current?.setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
                rfRef.current?.setEdges((es) => es.map((e) => ({ ...e, selected: false })));
                setSelection({ nodes: [], edges: [] });
              }}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 hover:bg-nu-cream"
              title="선택 해제"
            >
              <X size={11} />
            </button>
          </div>
        )}
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
        {viewMode === "outline" ? (
          <OutlineView
            data={data}
            onJumpToNode={(nodeId) => {
              setViewMode("radial");
              // 다음 tick 에서 fitView — viewMode 전환 + nodes 재빌드 후
              setTimeout(() => {
                const inst = rfRef.current;
                const target = inst?.getNode(nodeId);
                if (target) {
                  setSelected({ ...(target.data as MindMapNodeData), id: target.id });
                  try { inst?.fitView({ nodes: [{ id: nodeId }, { id: "center" }], padding: 0.3, duration: 700, maxZoom: 1.4 }); }
                  catch { /* ignore */ }
                }
              }, 80);
            }}
          />
        ) : (
        <ReactFlow
          nodes={nodes}
          edges={styledEdges}
          nodeTypes={nodeTypes}
          onInit={(inst) => { rfRef.current = inst; }}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onNodeDragStop={onNodeDragStop}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          selectionOnDrag
          multiSelectionKeyCode={["Meta", "Shift", "Control"]}
          connectionRadius={30}
          fitView
          minZoom={0.3}
          maxZoom={2}
          panOnDrag
          zoomOnScroll
          proOptions={{ hideAttribution: true }}
        >
          {/* Miro 풍 점 격자 — variant=Dots 가 reactflow 기본값이지만 명시. */}
          <Background variant={BackgroundVariant.Dots} gap={28} size={1.5} color="#0D0F14" style={{ opacity: 0.08 }} />
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
            // 필터 칩이 활성이면 미니맵도 그에 맞춰 색깔 표시 — "내 너트만 보고 싶다" UX 일관성.
            // 필터 미적용 시: 모든 kind 풀컬러. 필터 적용 시: 매칭 kind 만 컬러, 나머지 회색.
            nodeColor={(node) => {
              const kind = (node.data as MindMapNodeData)?.kind;
              if (!kind) return "#888";
              if (filterKinds.size > 0 && !filterKinds.has(kind)) return "#D1D5DB";
              return MINIMAP_COLOR[kind] ?? "#888";
            }}
            nodeStrokeWidth={2}
            className="!border-[2px] !border-nu-ink !shadow-[2px_2px_0_0_#0D0F14]"
          />
        </ReactFlow>
        )}
        <CursorOverlay userId={userId} nickname={nickname} containerRef={flowRef} />
        <FileHoverPreview file={hoveredFile} />
      </div>
      <NodeDrawer
        node={selected}
        onClose={() => setSelected(null)}
        bolts={data.bolts.map((b) => ({ id: b.id, title: b.title }))}
        data={data}
        onNavigate={(targetId) => {
          // drawer 안 chip 클릭 → 그 노드로 selected 변경 + 카메라 줌
          const inst = rfRef.current;
          const target = inst?.getNode(targetId);
          if (!target) return;
          setSelected({ ...(target.data as MindMapNodeData), id: target.id });
          try {
            inst?.fitView({ nodes: [{ id: targetId }, { id: "center" }], padding: 0.3, duration: 600, maxZoom: 1.4 });
          } catch { /* ignore */ }
        }}
      />
      <ContextMenu
        target={ctxMenu}
        onClose={() => setCtxMenu(null)}
        onOpenDrawer={openDrawerById}
        onDeleteEdge={deleteUserEdge}
        onFocusNode={(id) => setFocusedNodeId(id)}
        onExpandNode={expandNode}
      />
      <EdgeLabelEditor
        target={edgeLabelTarget}
        onClose={() => setEdgeLabelTarget(null)}
        onSave={saveEdgeLabel}
      />
      <GenesisPlanPanel
        plan={aiPlan?.plan ?? null}
        intent={aiPlan?.intent}
        onClose={() => setAiPlan(null)}
      />
      <HelpOverlay
        mode={showHelp ? "help" : showLegend ? "legend" : null}
        onClose={() => { setShowHelp(false); setShowLegend(false); }}
      />
      <CommandPalette
        open={showPalette}
        data={data}
        onClose={() => setShowPalette(false)}
        onJumpToNode={(targetId) => {
          if (viewMode !== "radial") setViewMode("radial");
          setTimeout(() => {
            const inst = rfRef.current;
            const target = inst?.getNode(targetId);
            if (target) {
              setSelected({ ...(target.data as MindMapNodeData), id: target.id });
              try { inst?.fitView({ nodes: [{ id: targetId }, { id: "center" }], padding: 0.3, duration: 700, maxZoom: 1.4 }); }
              catch { /* ignore */ }
            }
          }, 80);
        }}
        actions={[
          { id: "view-radial",   label: "방사형 뷰",        icon: Network,  hint: "그래프", run: () => setViewMode("radial") },
          { id: "view-timeline", label: "타임라인 뷰",      icon: Clock,    hint: "시간축", run: () => setViewMode("timeline") },
          { id: "view-outline",  label: "아웃라인 뷰",      icon: List,     hint: "텍스트", run: () => setViewMode("outline") },
          { id: "auto-layout",   label: `정렬 (${layoutDir})`, icon: Wand2, hint: "Dagre", run: () => handleAutoLayout() },
          { id: "path-mode",     label: "경로 찾기",        icon: Route,    hint: "두 노드 사이", run: () => setPathMode({ source: null, target: null }) },
          { id: "help",          label: "단축키 도움말",    icon: Keyboard, hint: "?", run: () => setShowHelp(true) },
          { id: "legend",        label: "Legend",           icon: Info,     hint: "I", run: () => setShowLegend(true) },
        ] satisfies PaletteAction[]}
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
  collapsedKinds: Set<NodeKind>,
  onToggleSector: (k: NodeKind) => void,
  centerSuggestions: string[],
): { nodes: RFNode[]; edges: RFEdge[] } {
  const nodes: RFNode[] = [
    {
      id: "center",
      type: "center",
      position: { x: 0, y: 0 },
      // 중앙 컨트롤러는 항상 최상단 — sector halo / dim 위에
      zIndex: 100,
      data: {
        kind: "center",
        title: `${nickname}님의 공간`,
        subtitle: "Genesis AI 에 물어보세요",
        onAnswer,
        suggestions: centerSuggestions,
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
        meta: {
          상태: b.status,
          "남은 일수": b.daysLeft ?? "정해지지 않음",
          담당: b.leadNickname || "미지정",
          담당_avatar: b.leadAvatarUrl || "",
        },
      },
    })),
    ...data.schedule.map((s) => {
      const nut = s.groupId ? data.nuts.find((n) => n.id === s.groupId) : null;
      return {
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
          meta: {
            시간: new Date(s.at).toLocaleString("ko"),
            종류: s.source === "meeting" ? "회의" : "이벤트",
            소속_너트: nut?.name || "전체",
          },
        },
      };
    }),
    ...data.issues.map((i) => {
      const bolt = i.projectId ? data.bolts.find((b) => b.id === i.projectId) : null;
      return {
        id: `issue-${i.id}`,
        kind: "issue" as const,
        data: {
          kind: "issue" as const,
          title: i.title,
          subtitle: i.kind === "overdue_task"
            ? (bolt ? `⏰ ${bolt.title}` : "⏰ 마감 지남")
            : "💬 멘션",
          href: i.kind === "mention"
            ? "/notifications"
            : (bolt ? `/projects/${bolt.id}` : undefined),
          meta: {
            종류: i.kind === "overdue_task" ? "마감 지난 태스크" : "읽지 않은 멘션",
            소속_볼트: bolt?.title || "-",
          },
        },
      };
    }),
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
            avatar: w.avatar_url || "",
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
    // 빈 상태 — 행동 가능한 3개 CTA 노드를 중앙 주변에 배치 + Genesis 자체 안내.
    // 단순 "비어 있어요" 대신 사용자가 다음 한 걸음을 즉시 결정할 수 있게.
    const ctaItems: Array<{ id: string; data: MindMapNodeData; angle: number }> = [
      {
        id: "empty-nut",
        angle: -Math.PI / 2 - 0.6, // ~10시
        data: {
          kind: "nut",
          title: "첫 너트 만들기",
          subtitle: "사람들과 모일 그룹",
          href: "/groups/create",
          meta: { 안내: "너트 = 소모임/팀. 정기 모임이나 관심사를 같이하는 그룹." },
        },
      },
      {
        id: "empty-bolt",
        angle: -Math.PI / 2 + 0.6, // ~2시
        data: {
          kind: "bolt",
          title: "첫 볼트 만들기",
          subtitle: "마감과 결과가 있는 일",
          href: "/projects/create",
          meta: { 안내: "볼트 = 프로젝트. 마감일과 결과물이 있는 일." },
        },
      },
      {
        id: "empty-genesis",
        angle: Math.PI / 2, // 6시
        data: {
          kind: "ai-task",
          title: "Genesis 에 물어보기",
          subtitle: "위쪽 입력창에 한 줄로",
          meta: { 예시: "예: '독서 모임 만들고 싶어' / '브랜딩 프로젝트 시작'" },
        },
      },
    ];
    for (const item of ctaItems) {
      const r = 220;
      nodes.push({
        id: item.id,
        type: "card",
        position: { x: Math.cos(item.angle) * r, y: Math.sin(item.angle) * r },
        data: item.data,
      });
      edges.push({
        id: `e-${item.id}`,
        source: "center",
        target: item.id,
        animated: item.id === "empty-genesis",
        style: {
          stroke: item.id === "empty-genesis" ? "#FF3D88" : "#0D0F14",
          strokeWidth: 2,
          strokeDasharray: "4 4",
          opacity: 0.55,
        },
      });
    }
    return { nodes, edges };
  }

  // ── 종류별 섹터 클러스터 배치 ──────────────────────────────────
  // 같은 kind 끼리 한 부채꼴 안에 모이도록 — "내 세계관"이 영역으로 나뉘어 보임.
  // 각 섹터는 항목 수에 비례하지만 최소 sector 가 보장돼 1개짜리도 시각적 자리 차지.
  const byKind = new Map<string, typeof all>();
  for (const entry of all) {
    const arr = byKind.get(entry.kind) ?? [];
    arr.push(entry);
    byKind.set(entry.kind, arr);
  }
  const presentKinds = (KIND_DISPLAY_ORDER as readonly string[]).filter(
    (k) => (byKind.get(k)?.length ?? 0) > 0,
  );
  const TWO_PI = Math.PI * 2;
  const SECTOR_GAP = 0.04 * TWO_PI; // 섹터 사이 4% gap → 7개 섹터면 ~28% gap
  const totalGap = SECTOR_GAP * presentKinds.length;
  const remaining = TWO_PI - totalGap;
  // 섹터 크기 — 항목 수 비례 + 최소 보장 (전체의 5%)
  const minShare = 0.05;
  const counts = presentKinds.map((k) => byKind.get(k)!.length);
  const totalCount = counts.reduce((s, c) => s + c, 0) || 1;
  const rawShares = counts.map((c) => c / totalCount);
  // 최소 보장 후 나머지를 비례 분배
  const sharesAfterMin = rawShares.map((s) => Math.max(s, minShare));
  const sumShares = sharesAfterMin.reduce((s, x) => s + x, 0);
  const normalizedShares = sharesAfterMin.map((s) => s / sumShares);
  const sectorAngles = normalizedShares.map((s) => s * remaining);

  let cursor = -Math.PI / 2 - sectorAngles[0] / 2; // 첫 섹터 중앙이 12시 방향
  // 카드 평균 사이즈 — bbox padding 산정용
  const CARD_W = 200;
  const CARD_H = 110;
  const HALO_PAD = 30;
  for (let s = 0; s < presentKinds.length; s++) {
    const kind = presentKinds[s];
    const items = byKind.get(kind)!;
    const sector = sectorAngles[s];
    const M = items.length;
    const collapsed = collapsedKinds.has(kind as NodeKind);
    // 섹터 안 가장자리 padding — 노드끼리 너무 붙지 않게
    const padding = sector * 0.08;
    const innerSpan = sector - padding * 2;
    const baseRadius = RADIUS[kind] ?? 300;

    // 1패스: item 위치 계산 + bbox 누적
    const placed: Array<{ entry: typeof items[number]; x: number; y: number }> = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach((entry, idx) => {
      const t = M === 1 ? 0.5 : idx / (M - 1);
      const angle = cursor + padding + t * innerSpan;
      const r = baseRadius + (idx % 2 === 0 ? -25 : 25);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      placed.push({ entry, x, y });
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    // halo 노드 — 섹터 박스 시각화. collapsed 일 때도 라벨은 표시.
    if (placed.length > 0) {
      const halo = {
        x: minX - CARD_W / 2 - HALO_PAD,
        y: minY - CARD_H / 2 - HALO_PAD,
        w: (maxX - minX) + CARD_W + HALO_PAD * 2,
        h: (maxY - minY) + CARD_H + HALO_PAD * 2,
      };
      nodes.push({
        id: `halo-${kind}`,
        type: "sector",
        position: { x: halo.x, y: halo.y },
        // reactflow 는 width/height 를 style 로 전달해야 노드 박스가 정확히 잡힘
        style: { width: halo.w, height: halo.h, zIndex: -1 },
        zIndex: -1,
        selectable: false,
        draggable: false,
        data: {
          kind: "sector",
          groupKind: kind as NodeKind,
          label: KIND_LABEL[kind] || kind,
          count: items.length,
          collapsed,
          onToggle: onToggleSector,
        },
      });
    }

    // 2패스: collapsed 면 자식 카드는 그리지 않음 — halo 만 남김
    if (!collapsed) placed.forEach(({ entry, x, y }, idx) => {
      nodes.push({
        id: entry.id,
        type: "card",
        position: { x, y },
        data: entry.data,
      });
      // 중앙→가지 기본 엣지 — washer/topic/file 은 cross-ref 만으로 연결
      if (kind !== "washer" && kind !== "topic" && kind !== "file") {
        // 활성 상태 → 애니메이션 + smoothstep 곡선
        const dataStatus = entry.data.meta?.["상태"];
        const dataKind = entry.data.meta?.["종류"];
        const dataTime = entry.data.meta?.["시간"];
        let animated = false;
        let stroke = "#0D0F14";
        let strokeWidth = 2;
        let label: string | undefined;
        if (kind === "bolt" && (dataStatus === "active" || dataStatus === "review")) {
          animated = true; // 진행 중 → 흐르는 점선
          stroke = "#F59E0B";
          strokeWidth = 2.5;
        } else if (kind === "schedule" && typeof dataTime === "string") {
          const h = (new Date(dataTime).getTime() - Date.now()) / (1000 * 60 * 60);
          if (h >= 0 && h < 48) {
            animated = true; // 임박 → 흐르는
            stroke = "#10B981";
            strokeWidth = 2.5;
          }
        } else if (kind === "issue" && String(dataKind).includes("마감")) {
          animated = true; // 마감 지남 → 빨갛게 흐르는
          stroke = "#DC2626";
          strokeWidth = 2.5;
          label = "긴급";
        }
        edges.push({
          id: `e-${entry.id}`,
          source: "center",
          target: entry.id,
          type: "smoothstep",
          animated,
          style: { stroke, strokeWidth },
          ...(label
            ? {
                label,
                labelStyle: { fontSize: 9, fontFamily: "ui-monospace, monospace", fill: stroke },
                labelBgStyle: { fill: "#FFFCF6", fillOpacity: 0.95 },
                labelBgPadding: [3, 1] as [number, number],
              }
            : {}),
        });
      }
    });
    cursor += sector + SECTOR_GAP;
  }

  // ── Cross-reference 엣지 ─────────────────────────────────────────
  // collapsed 된 kind 의 노드는 사라졌으므로 그쪽으로 가는 엣지도 만들지 않음
  const isAlive = (k: NodeKind) => !collapsedKinds.has(k);
  // 너트 ↔ 탭 (소속) — 점선 sky + "지식" 라벨 (탭당 1개만 표시 — 노이즈 줄임)
  const topicLabelShown = new Set<string>();
  if (isAlive("nut") && isAlive("topic")) for (const t of data.topics) {
    if (data.nuts.some((n) => n.id === t.groupId)) {
      const showLabel = !topicLabelShown.has(t.groupId);
      topicLabelShown.add(t.groupId);
      edges.push({
        id: `e-cr-topic-${t.id}`,
        source: `nut-${t.groupId}`,
        target: `topic-${t.id}`,
        type: "bezier",
        style: { stroke: "#0EA5E9", strokeWidth: 1.5, strokeDasharray: "4 3" },
        ...(showLabel
          ? {
              label: "지식",
              labelStyle: { fontSize: 9, fontFamily: "ui-monospace, monospace", fill: "#0369A1" },
              labelBgStyle: { fill: "#FFFCF6", fillOpacity: 0.9 },
              labelBgPadding: [3, 1] as [number, number],
            }
          : {}),
      });
    }
  }
  // 너트 ↔ 와셔 (소속) — 실선 violet 얇게
  if (isAlive("washer")) for (const w of data.washers) {
    if (isAlive("nut")) for (const nutId of w.nutIds) {
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
    if (isAlive("bolt")) for (const boltId of w.boltIds) {
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
  // 파일 ↔ 볼트 — 점선 stone (소속 표시) + "첨부" 라벨 (볼트당 1번만)
  const fileLabelShown = new Set<string>();
  if (isAlive("file") && isAlive("bolt")) for (const f of data.files) {
    if (f.projectId && data.bolts.some((b) => b.id === f.projectId)) {
      const showLabel = !fileLabelShown.has(f.projectId);
      fileLabelShown.add(f.projectId);
      edges.push({
        id: `e-cr-file-${f.id}`,
        source: `bolt-${f.projectId}`,
        target: `file-${f.id}`,
        style: { stroke: "#78716C", strokeWidth: 1.2, strokeDasharray: "3 3", opacity: 0.55 },
        ...(showLabel
          ? {
              label: "첨부",
              labelStyle: { fontSize: 9, fontFamily: "ui-monospace, monospace", fill: "#57534E" },
              labelBgStyle: { fill: "#FFFCF6", fillOpacity: 0.9 },
              labelBgPadding: [3, 1] as [number, number],
            }
          : {}),
      });
    }
  }
  // 일정 ↔ 너트 (그룹 회의/이벤트) — 점선 emerald
  if (isAlive("schedule") && isAlive("nut")) for (const s of data.schedule) {
    if (s.groupId && data.nuts.some((n) => n.id === s.groupId)) {
      edges.push({
        id: `e-cr-sched-nut-${s.id}`,
        source: `nut-${s.groupId}`,
        target: `sched-${s.id}`,
        type: "bezier",
        style: { stroke: "#10B981", strokeWidth: 1.2, strokeDasharray: "3 3", opacity: 0.55 },
      });
    }
  }
  // 이슈 ↔ 볼트 (마감 지난 task) — 빨간 점선
  if (isAlive("issue") && isAlive("bolt")) for (const i of data.issues) {
    if (i.projectId && data.bolts.some((b) => b.id === i.projectId)) {
      edges.push({
        id: `e-cr-issue-bolt-${i.id}`,
        source: `bolt-${i.projectId}`,
        target: `issue-${i.id}`,
        type: "bezier",
        style: { stroke: "#DC2626", strokeWidth: 1.2, strokeDasharray: "3 3", opacity: 0.55 },
      });
    }
  }
  // 너트 ↔ 볼트 (공유 와셔 ≥1) — 굵은 검정 점선 (강한 협업 신호)
  if (isAlive("nut") && isAlive("bolt")) for (const nut of data.nuts) {
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
  centerSuggestions: string[],
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
      suggestions: centerSuggestions,
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
