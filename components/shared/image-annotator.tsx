"use client";

/**
 * ImageAnnotator — 이미지 위에 펜/사각형/화살표/텍스트 주석을 덧입혀 저장.
 *
 *  • Canvas overlay 로 실시간 스트로크 렌더
 *  • stroke stack + 되돌리기
 *  • 저장 → canvas.toBlob PNG → uploadFile() → onSaved(newUrl) 호출
 *    (부모가 새 파일로 등록할지 덮어쓸지 결정)
 */

import { useEffect, useRef, useState } from "react";
import { Pencil, Square, ArrowRight, Type, Undo2, Save, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadFile } from "@/lib/storage/upload-client";

type Tool = "pen" | "rect" | "arrow" | "text";

interface Stroke {
  tool: Tool;
  color: string;
  width: number;
  // pen: series of points; rect/arrow: start + end; text: x,y,text
  points?: { x: number; y: number }[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  text?: string;
}

export interface ImageAnnotatorProps {
  imageUrl: string;
  originalName: string;
  onSaved: (newUrl: string, meta: { storage: "r2" | "supabase"; key: string; size: number; mime: string; name: string }) => void;
  onClose?: () => void;
  scopeId?: string;
}

export function ImageAnnotator({ imageUrl, originalName, onSaved, onClose, scopeId }: ImageAnnotatorProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [tempStroke, setTempStroke] = useState<Stroke | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const COLOR = "#E11D48"; // red
  const WIDTH = 3;

  // Sync canvas size to image natural size
  useEffect(() => {
    if (!imgLoaded || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const c = canvasRef.current;
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgLoaded]);

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, tempStroke]);

  function redraw() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const all = tempStroke ? [...strokes, tempStroke] : strokes;
    for (const s of all) drawStroke(ctx, s);
  }

  function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (s.tool === "pen" && s.points && s.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    } else if (s.tool === "rect" && s.start && s.end) {
      ctx.strokeRect(s.start.x, s.start.y, s.end.x - s.start.x, s.end.y - s.start.y);
    } else if (s.tool === "arrow" && s.start && s.end) {
      const { x: x1, y: y1 } = s.start;
      const { x: x2, y: y2 } = s.end;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      // arrowhead
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const head = 14;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    } else if (s.tool === "text" && s.start && s.text) {
      ctx.font = `bold ${Math.max(16, s.width * 6)}px sans-serif`;
      ctx.fillText(s.text, s.start.x, s.start.y);
    }
  }

  function getCanvasPoint(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (saving) return;
    const pt = getCanvasPoint(e);
    if (tool === "text") {
      const txt = window.prompt("텍스트를 입력하세요:");
      if (!txt) return;
      setStrokes((s) => [...s, { tool: "text", color: COLOR, width: WIDTH, start: pt, text: txt }]);
      return;
    }
    setDrawing(true);
    if (tool === "pen") {
      setTempStroke({ tool: "pen", color: COLOR, width: WIDTH, points: [pt] });
    } else {
      setTempStroke({ tool, color: COLOR, width: WIDTH, start: pt, end: pt });
    }
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing || !tempStroke) return;
    const pt = getCanvasPoint(e);
    if (tempStroke.tool === "pen") {
      setTempStroke({ ...tempStroke, points: [...(tempStroke.points || []), pt] });
    } else {
      setTempStroke({ ...tempStroke, end: pt });
    }
  }

  function onMouseUp() {
    if (!drawing || !tempStroke) return;
    setStrokes((s) => [...s, tempStroke]);
    setTempStroke(null);
    setDrawing(false);
  }

  function undo() {
    setStrokes((s) => s.slice(0, -1));
  }

  async function save() {
    if (!imgRef.current || !canvasRef.current) return;
    setSaving(true);
    try {
      // Composite: draw image + overlay into a new offscreen canvas
      const img = imgRef.current;
      const overlay = canvasRef.current;
      const out = document.createElement("canvas");
      out.width = img.naturalWidth;
      out.height = img.naturalHeight;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("canvas 2d context unavailable");
      ctx.drawImage(img, 0, 0);
      ctx.drawImage(overlay, 0, 0);

      const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/png", 0.95));
      if (!blob) throw new Error("PNG 생성 실패");

      // Derive annotated file name
      const dot = originalName.lastIndexOf(".");
      const base = dot > 0 ? originalName.slice(0, dot) : originalName;
      const annotatedName = `${base}_주석_${Date.now()}.png`;
      const file = new File([blob], annotatedName, { type: "image/png" });

      const result = await uploadFile(file, { prefix: "resources", scopeId });
      toast.success("주석 이미지가 저장되었습니다");
      onSaved(result.url, {
        storage: result.storage,
        key: result.key,
        size: result.size,
        mime: result.mime,
        name: result.name,
      });
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  const ToolBtn = ({ t, label, Icon }: { t: Tool; label: string; Icon: typeof Pencil }) => (
    <button
      onClick={() => setTool(t)}
      className={`font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink transition-all flex items-center gap-1.5 ${
        tool === t ? "bg-nu-ink text-nu-paper" : "bg-nu-paper text-nu-ink hover:bg-nu-cream/40"
      }`}
      title={label}
    >
      <Icon size={13} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-nu-ink/90 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-nu-paper border-b-[3px] border-nu-ink shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <ToolBtn t="pen" label="펜" Icon={Pencil} />
          <ToolBtn t="rect" label="사각형" Icon={Square} />
          <ToolBtn t="arrow" label="화살표" Icon={ArrowRight} />
          <ToolBtn t="text" label="텍스트" Icon={Type} />
          <span className="w-px h-6 bg-nu-ink/20 mx-1" />
          <button
            onClick={undo}
            disabled={strokes.length === 0}
            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink bg-nu-paper text-nu-ink hover:bg-nu-cream/40 transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            <Undo2 size={13} />
            <span className="hidden sm:inline">되돌리기</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving || strokes.length === 0}
            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 border-[2px] border-nu-ink bg-nu-pink text-white hover:bg-nu-pink/90 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            저장
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 border-[2px] border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-all"
              aria-label="닫기"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt={originalName}
            crossOrigin="anonymous"
            onLoad={() => setImgLoaded(true)}
            className="block max-w-full max-h-[calc(100vh-120px)] select-none pointer-events-none"
            draggable={false}
          />
          <canvas
            ref={canvasRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            style={{ touchAction: "none" }}
          />
        </div>
      </div>

      <p className="text-center text-[11px] text-nu-paper/70 py-2 font-mono-nu uppercase tracking-widest shrink-0">
        {strokes.length}개 주석 · 기본 색상 빨강 · CORS 제약 시 저장 실패할 수 있어요
      </p>
    </div>
  );
}
