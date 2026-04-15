"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GitBranch, ZoomIn, ZoomOut, Maximize2, ExternalLink } from "lucide-react";

interface Node {
  id: string;
  label: string;
  type: "topic" | "page" | "resource";
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  pageCount?: number;
  topicId?: string;
  url?: string;
  resourceType?: string;
}

interface Edge {
  source: string;
  target: string;
  type: string;
}

const TOPIC_COLORS = ["#e91e63", "#2196f3", "#ff9800", "#4caf50", "#9c27b0", "#00bcd4"];
const RESOURCE_COLOR = "#ff6f00";
const LINK_COLORS: Record<string, string> = {
  reference: "rgba(100,100,100,0.25)",
  extends: "rgba(33,150,243,0.4)",
  contradicts: "rgba(233,30,99,0.4)",
  prerequisite: "rgba(255,152,0,0.4)",
  resource_link: "rgba(255,111,0,0.3)",
};
const RESOURCE_TYPE_ICONS: Record<string, string> = {
  youtube: "▶", pdf: "📄", article: "📰", notion: "N", drive: "G",
  docs: "D", sheet: "S", slide: "P", link: "🔗", other: "·",
};

export function KnowledgeGraph({ groupId }: { groupId: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [stats, setStats] = useState({ topics: 0, pages: 0, links: 0, resources: 0 });
  const animFrameRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: topics } = await supabase
        .from("wiki_topics")
        .select("id, name")
        .eq("group_id", groupId);

      const topicIds = (topics || []).map(t => t.id);
      if (topicIds.length === 0) return;

      const { data: pages } = await supabase
        .from("wiki_pages")
        .select("id, title, topic_id")
        .in("topic_id", topicIds);

      const pageIds = (pages || []).map(p => p.id);

      // Only fetch links where source belongs to this group's pages
      let links: any[] = [];
      if (pageIds.length > 0) {
        const { data } = await supabase
          .from("wiki_page_links")
          .select("source_page_id, target_page_id, link_type")
          .in("source_page_id", pageIds);
        links = (data || []).filter(l => pageIds.includes(l.target_page_id));
      }

      // Fetch weekly resources for this group
      const { data: resources } = await supabase
        .from("wiki_weekly_resources")
        .select("id, title, url, resource_type, linked_wiki_page_id")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(30);

      // Count pages per topic
      const pageCountByTopic: Record<string, number> = {};
      (pages || []).forEach(p => {
        pageCountByTopic[p.topic_id] = (pageCountByTopic[p.topic_id] || 0) + 1;
      });

      // Build nodes
      const centerX = 400;
      const centerY = 300;
      const newNodes: Node[] = [];

      (topics || []).forEach((t, i) => {
        const angle = (Math.PI * 2 * i) / (topics?.length || 1);
        const pageCount = pageCountByTopic[t.id] || 0;
        newNodes.push({
          id: t.id,
          label: t.name,
          type: "topic",
          x: centerX + Math.cos(angle) * 180 + (Math.random() - 0.5) * 40,
          y: centerY + Math.sin(angle) * 180 + (Math.random() - 0.5) * 40,
          vx: 0, vy: 0,
          color: TOPIC_COLORS[i % TOPIC_COLORS.length],
          radius: Math.max(24, Math.min(36, 20 + pageCount * 4)),
          pageCount,
        });
      });

      (pages || []).forEach((p) => {
        const parent = newNodes.find(n => n.id === p.topic_id);
        const px = parent ? parent.x : centerX;
        const py = parent ? parent.y : centerY;
        newNodes.push({
          id: p.id,
          label: p.title.length > 16 ? p.title.slice(0, 14) + "…" : p.title,
          type: "page",
          x: px + (Math.random() - 0.5) * 160,
          y: py + (Math.random() - 0.5) * 160,
          vx: 0, vy: 0,
          color: parent?.color || "#999",
          radius: 16,
          topicId: p.topic_id,
        });
      });

      // Add resource nodes — positioned around the edge of the graph
      const resourceList = resources || [];
      resourceList.forEach((r, i) => {
        const angle = (Math.PI * 2 * i) / Math.max(resourceList.length, 1);
        const rLabel = r.title.length > 14 ? r.title.slice(0, 12) + "…" : r.title;
        newNodes.push({
          id: `res-${r.id}`,
          label: rLabel,
          type: "resource",
          x: centerX + Math.cos(angle) * 280 + (Math.random() - 0.5) * 60,
          y: centerY + Math.sin(angle) * 280 + (Math.random() - 0.5) * 60,
          vx: 0, vy: 0,
          color: RESOURCE_COLOR,
          radius: 12,
          url: r.url,
          resourceType: r.resource_type,
        });
      });

      // Build edges
      const newEdges: Edge[] = [];
      (pages || []).forEach(p => {
        newEdges.push({ source: p.topic_id, target: p.id, type: "reference" });
      });
      (links || []).forEach(l => {
        newEdges.push({
          source: l.source_page_id,
          target: l.target_page_id,
          type: l.link_type || "reference",
        });
      });

      // Resource → linked wiki page edges
      resourceList.forEach(r => {
        if (r.linked_wiki_page_id && pageIds.includes(r.linked_wiki_page_id)) {
          newEdges.push({
            source: `res-${r.id}`,
            target: r.linked_wiki_page_id,
            type: "resource_link",
          });
        }
      });

      setStats({
        topics: (topics || []).length,
        pages: (pages || []).length,
        links: (links || []).length + resourceList.filter(r => r.linked_wiki_page_id).length,
        resources: resourceList.length,
      });
      setNodes(newNodes);
      nodesRef.current = newNodes;
      setEdges(newEdges);
    }
    load();
  }, [groupId]);

  // Force-directed simulation
  const simulate = useCallback(() => {
    const ns = nodesRef.current;
    if (ns.length === 0) return;

    const REPULSION = 3000;
    const SPRING = 0.008;
    const DAMPING = 0.85;
    const REST_LENGTH = 120;

    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[j].x - ns[i].x;
        const dy = ns[j].y - ns[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        ns[i].vx -= fx;
        ns[i].vy -= fy;
        ns[j].vx += fx;
        ns[j].vy += fy;
      }
    }

    // Build node lookup map for O(1) edge resolution
    const nodeMap = new Map(ns.map(n => [n.id, n]));
    edges.forEach(e => {
      const s = nodeMap.get(e.source);
      const t = nodeMap.get(e.target);
      if (!s || !t) return;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - REST_LENGTH) * SPRING;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx += fx;
      s.vy += fy;
      t.vx -= fx;
      t.vy -= fy;
    });

    let totalMotion = 0;
    ns.forEach(n => {
      if (n.id === dragging) return;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
      totalMotion += Math.abs(n.vx) + Math.abs(n.vy);
    });

    nodesRef.current = [...ns];
    // Only trigger re-render if there's meaningful motion
    if (totalMotion > 0.1) {
      setNodes([...ns]);
    }
  }, [edges, dragging]);

  useEffect(() => {
    let running = true;
    function tick() {
      if (!running) return;
      simulate();
      animFrameRef.current = requestAnimationFrame(tick);
    }
    tick();
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [simulate]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    edges.forEach(e => {
      const s = nodes.find(n => n.id === e.source);
      const t = nodes.find(n => n.id === e.target);
      if (!s || !t) return;

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      const cx = (s.x + t.x) / 2 + (s.y - t.y) * 0.15;
      const cy = (s.y + t.y) / 2 + (t.x - s.x) * 0.15;
      ctx.quadraticCurveTo(cx, cy, t.x, t.y);

      ctx.strokeStyle = LINK_COLORS[e.type] || LINK_COLORS.reference;
      ctx.lineWidth = e.type === "extends" ? 2.5 : 1.5;
      if (e.type === "contradicts") ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach(n => {
      const isHovered = hoveredNode?.id === n.id;

      if (isHovered || n.type === "topic") {
        ctx.shadowColor = n.color;
        ctx.shadowBlur = isHovered ? 20 : 8;
      }

      if (n.type === "resource") {
        // Draw diamond shape for resources
        const r = n.radius + (isHovered ? 3 : 0);
        ctx.beginPath();
        ctx.moveTo(n.x, n.y - r);
        ctx.lineTo(n.x + r, n.y);
        ctx.lineTo(n.x, n.y + r);
        ctx.lineTo(n.x - r, n.y);
        ctx.closePath();
        ctx.fillStyle = isHovered ? RESOURCE_COLOR : RESOURCE_COLOR + "20";
        ctx.fill();
        ctx.strokeStyle = RESOURCE_COLOR;
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Resource type icon
        const icon = RESOURCE_TYPE_ICONS[n.resourceType || "other"] || "·";
        ctx.fillStyle = isHovered ? "#fff" : RESOURCE_COLOR;
        ctx.font = "bold 8px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(icon, n.x, n.y);

        // Label below diamond
        if (isHovered) {
          ctx.fillStyle = "#333";
          ctx.font = "600 7px 'Inter', sans-serif";
          ctx.fillText(n.label, n.x, n.y + r + 10);
        }
      } else {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + (isHovered ? 4 : 0), 0, Math.PI * 2);

        if (n.type === "topic") {
          const grad = ctx.createRadialGradient(n.x - 4, n.y - 4, 0, n.x, n.y, n.radius);
          grad.addColorStop(0, n.color);
          grad.addColorStop(1, n.color + "99");
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = isHovered ? n.color : "#ffffff";
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = n.type === "topic" ? n.color : (isHovered ? n.color : n.color + "44");
        ctx.lineWidth = n.type === "topic" ? 3 : 2;
        ctx.stroke();

        // Label
        ctx.fillStyle = n.type === "topic" ? "#fff" : (isHovered ? "#fff" : "#333");
        ctx.font = n.type === "topic"
          ? "bold 10px 'Inter', sans-serif"
          : "600 8px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(n.label, n.x, n.y);

        // Page count badge for topics
        if (n.type === "topic" && n.pageCount && n.pageCount > 0) {
          const bx = n.x + n.radius * 0.7;
          const by = n.y - n.radius * 0.7;
          ctx.beginPath();
          ctx.arc(bx, by, 8, 0, Math.PI * 2);
          ctx.fillStyle = "#fff";
          ctx.fill();
          ctx.strokeStyle = n.color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = n.color;
          ctx.font = "bold 8px 'Inter', sans-serif";
          ctx.fillText(String(n.pageCount), bx, by);
        }
      }
    });

    ctx.restore();
  }, [nodes, edges, zoom, pan, hoveredNode]);

  // Mouse interaction — click navigation
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;
    const hit = nodes.find(n => Math.hypot(n.x - mx, n.y - my) < n.radius + 4);

    if (hit) {
      setDragging(hit.id);
      dragStartPos.current = { x: mx, y: my };
    } else {
      // Start panning
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;

    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (dragging) {
      const node = nodesRef.current.find(n => n.id === dragging);
      if (node) { node.x = mx; node.y = my; node.vx = 0; node.vy = 0; }
    }

    const hovered = nodes.find(n => Math.hypot(n.x - mx, n.y - my) < n.radius + 4);
    setHoveredNode(hovered || null);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Check if this was a click (not drag)
    if (dragging && dragStartPos.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = (e.clientX - rect.left - pan.x) / zoom;
        const my = (e.clientY - rect.top - pan.y) / zoom;
        const dist = Math.hypot(mx - dragStartPos.current.x, my - dragStartPos.current.y);

        if (dist < 5) {
          // This was a click — navigate
          const clickedNode = nodes.find(n => n.id === dragging);
          if (clickedNode) {
            if (clickedNode.type === "topic") {
              router.push(`/groups/${groupId}/wiki/topics/${clickedNode.id}`);
            } else if (clickedNode.type === "resource" && clickedNode.url) {
              window.open(clickedNode.url, "_blank", "noopener");
            } else if (clickedNode.type === "page") {
              router.push(`/groups/${groupId}/wiki/pages/${clickedNode.id}`);
            }
          }
        }
      }
    }
    setDragging(null);
    dragStartPos.current = null;
  };

  // Scroll to zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.max(0.3, Math.min(3, z + delta)));
  };

  // Touch support for mobile
  const lastTouchDist = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = (t.clientX - rect.left - pan.x) / zoom;
      const my = (t.clientY - rect.top - pan.y) / zoom;
      const hit = nodes.find(n => Math.hypot(n.x - mx, n.y - my) < n.radius + 8);
      if (hit) {
        setDragging(hit.id);
        dragStartPos.current = { x: mx, y: my };
      } else {
        setIsPanning(true);
        setPanStart({ x: t.clientX - pan.x, y: t.clientY - pan.y });
      }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.hypot(dx, dy);
      lastTouchCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (isPanning) {
        setPan({ x: t.clientX - panStart.x, y: t.clientY - panStart.y });
      } else if (dragging) {
        const mx = (t.clientX - rect.left - pan.x) / zoom;
        const my = (t.clientY - rect.top - pan.y) / zoom;
        const node = nodesRef.current.find(n => n.id === dragging);
        if (node) { node.x = mx; node.y = my; node.vx = 0; node.vy = 0; }
      }
    } else if (e.touches.length === 2 && lastTouchDist.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / lastTouchDist.current;
      setZoom(z => Math.max(0.3, Math.min(3, z * scale)));
      lastTouchDist.current = dist;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragging && dragStartPos.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        const mx = (t.clientX - rect.left - pan.x) / zoom;
        const my = (t.clientY - rect.top - pan.y) / zoom;
        const dist = Math.hypot(mx - dragStartPos.current.x, my - dragStartPos.current.y);
        if (dist < 8) {
          const clickedNode = nodes.find(n => n.id === dragging);
          if (clickedNode) {
            if (clickedNode.type === "topic") router.push(`/groups/${groupId}/wiki/topics/${clickedNode.id}`);
            else if (clickedNode.type === "resource" && clickedNode.url) window.open(clickedNode.url, "_blank", "noopener");
            else if (clickedNode.type === "page") router.push(`/groups/${groupId}/wiki/pages/${clickedNode.id}`);
          }
        }
      }
    }
    setDragging(null);
    setIsPanning(false);
    dragStartPos.current = null;
    lastTouchDist.current = null;
    lastTouchCenter.current = null;
  };

  if (nodes.length === 0) {
    return (
      <div className="border-[2px] border-dashed border-nu-ink/15 p-12 text-center bg-white/50">
        <GitBranch size={32} className="mx-auto mb-4 text-nu-ink/20" />
        <p className="text-nu-muted text-sm font-medium">지식 그래프를 생성하려면 먼저 주제와 문서를 등록하세요.</p>
      </div>
    );
  }

  return (
    <div className="relative bg-white border-[2px] border-nu-ink overflow-hidden">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button onClick={() => setZoom(z => Math.min(z + 0.2, 3))}
          className="w-8 h-8 bg-nu-paper border border-nu-ink/20 flex items-center justify-center hover:bg-nu-cream transition-colors">
          <ZoomIn size={14} />
        </button>
        <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}
          className="w-8 h-8 bg-nu-paper border border-nu-ink/20 flex items-center justify-center hover:bg-nu-cream transition-colors">
          <ZoomOut size={14} />
        </button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="w-8 h-8 bg-nu-paper border border-nu-ink/20 flex items-center justify-center hover:bg-nu-cream transition-colors">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Stats */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <span className="bg-nu-ink/80 text-white px-2 py-1 font-mono-nu text-[8px] uppercase tracking-widest">
          {stats.topics} topics
        </span>
        <span className="bg-nu-pink/80 text-white px-2 py-1 font-mono-nu text-[8px] uppercase tracking-widest">
          {stats.pages} pages
        </span>
        <span className="bg-[#ff6f00]/80 text-white px-2 py-1 font-mono-nu text-[8px] uppercase tracking-widest">
          {stats.resources} resources
        </span>
        <span className="bg-nu-blue/80 text-white px-2 py-1 font-mono-nu text-[8px] uppercase tracking-widest">
          {stats.links} links
        </span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm border border-nu-ink/10 p-3 space-y-1.5">
        <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted font-bold mb-2">Nodes</p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-nu-pink" />
          <span className="font-mono-nu text-[7px] text-nu-muted uppercase">Topic (주제)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white border border-nu-ink/30" />
          <span className="font-mono-nu text-[7px] text-nu-muted uppercase">Page (페이지)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rotate-45 border border-[#ff6f00]" style={{ backgroundColor: "#ff6f0020" }} />
          <span className="font-mono-nu text-[7px] text-nu-muted uppercase">Resource (자료)</span>
        </div>
        <p className="font-mono-nu text-[8px] uppercase tracking-widest text-nu-muted font-bold mt-2 mb-1">Links</p>
        {Object.entries(LINK_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <div className="w-8 h-0.5" style={{ backgroundColor: color }} />
            <span className="font-mono-nu text-[7px] text-nu-muted uppercase">
              {type === "resource_link" ? "resource → page" : type}
            </span>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredNode && (
        <div className="absolute top-14 left-4 z-10 bg-nu-ink text-white p-3 max-w-[220px] shadow-lg">
          <p className="font-head text-xs font-bold">{hoveredNode.label}</p>
          <p className="font-mono-nu text-[8px] text-white/50 uppercase mt-1 flex items-center gap-1">
            {hoveredNode.type === "resource" ? `📦 ${hoveredNode.resourceType || "resource"}` : hoveredNode.type}
            {hoveredNode.pageCount !== undefined && ` · ${hoveredNode.pageCount} pages`}
          </p>
          <p className="font-mono-nu text-[7px] text-nu-pink mt-1.5 flex items-center gap-1">
            <ExternalLink size={8} />
            {hoveredNode.type === "resource" ? "클릭하여 자료 열기" : "클릭하여 이동"}
          </p>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className={`w-full touch-none ${hoveredNode ? "cursor-pointer" : isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ height: 500 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setDragging(null); setIsPanning(false); }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}
