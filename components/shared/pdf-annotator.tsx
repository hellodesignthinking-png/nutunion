"use client";

/**
 * PdfAnnotator — pdfjs-dist 로 PDF 페이지 렌더링 + canvas 오버레이로 주석.
 *
 * 도구: 펜(자유 그리기) · 형광펜(반투명) · 직선 · 텍스트 박스
 * 저장: pdf-lib 로 원본 PDF 위에 주석 페이지별로 임베드 → 새 R2 파일로 업로드
 *
 * 주의: 이 컴포넌트는 **브라우저 전용**. SSR 시 렌더링 안 함.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X, Save, Pencil, Highlighter, Type, Minus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Tool = "pen" | "highlighter" | "line" | "text" | "eraser";

interface Stroke {
  page: number;
  tool: Tool;
  color: string;
  size: number;
  // 정규화 좌표 (0..1) — 페이지 크기에 독립적
  points: Array<{ x: number; y: number }>;
  text?: string;
}

interface PdfAnnotatorProps {
  pdfUrl: string;
  fileName: string;
  /** 주석 적용한 새 PDF 를 같은 자료실 카드에 새 버전으로 저장. */
  onSaved: (newUrl: string) => void;
  onClose: () => void;
}

const COLORS = ["#FF2E97", "#0d0d0d", "#2E6FFF", "#10B981", "#FFB800"];

export function PdfAnnotator({ pdfUrl, fileName, onSaved, onClose }: PdfAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const pdfPageCanvasRef = useRef<HTMLCanvasElement>(null);

  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const currentStrokeRef = useRef<Stroke | null>(null);

  const [saving, setSaving] = useState(false);

  // pdfjs 동적 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjsLib: any = await import("pdfjs-dist");
        // worker — Vercel/CDN 호환을 위해 module worker 로
        if (typeof window !== "undefined") {
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        }
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdf(doc);
        setPageCount(doc.numPages);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setRenderError(e?.message || "PDF 로드 실패");
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  // 페이지 렌더링
  const renderPage = useCallback(async () => {
    if (!pdf || !pdfPageCanvasRef.current) return;
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = pdfPageCanvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    // 오버레이 사이즈 동기화
    if (overlayRef.current) {
      overlayRef.current.width = viewport.width;
      overlayRef.current.height = viewport.height;
      drawOverlay();
    }
  }, [pdf, pageNum]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { renderPage(); }, [renderPage]);

  // 오버레이 다시 그리기
  function drawOverlay() {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width, h = canvas.height;
    for (const s of strokes) {
      if (s.page !== pageNum) continue;
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (s.tool === "highlighter") {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = s.size * 4;
      } else {
        ctx.globalAlpha = 1;
        ctx.lineWidth = s.size;
      }
      if (s.tool === "text" && s.text) {
        ctx.globalAlpha = 1;
        ctx.font = `${s.size * 6}px sans-serif`;
        const p = s.points[0];
        ctx.fillText(s.text, p.x * w, p.y * h);
        continue;
      }
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = p.x * w, y = p.y * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (s.tool === "line" && s.points.length > 1) {
        // 직선: 첫점→마지막점
        ctx.beginPath();
        ctx.moveTo(s.points[0].x * w, s.points[0].y * h);
        const last = s.points[s.points.length - 1];
        ctx.lineTo(last.x * w, last.y * h);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  useEffect(() => { drawOverlay(); }, [strokes, pageNum]); // eslint-disable-line

  // 마우스/터치
  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const canvas = overlayRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if ("touches" in e) {
      const t = e.touches[0] || e.changedTouches[0];
      cx = t.clientX; cy = t.clientY;
    } else {
      cx = e.clientX; cy = e.clientY;
    }
    return { x: (cx - rect.left) / rect.width, y: (cy - rect.top) / rect.height };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const p = getPos(e);
    if (!p) return;
    if (tool === "text") {
      const text = window.prompt("텍스트를 입력하세요");
      if (!text || !text.trim()) return;
      setStrokes((prev) => [...prev, { page: pageNum, tool: "text", color, size, points: [p], text: text.trim() }]);
      return;
    }
    if (tool === "eraser") {
      // 클릭 위치 근처 stroke 제거
      const tolerance = 0.02;
      setStrokes((prev) => prev.filter((s) => {
        if (s.page !== pageNum) return true;
        return !s.points.some((pt) => Math.abs(pt.x - p.x) < tolerance && Math.abs(pt.y - p.y) < tolerance);
      }));
      return;
    }
    setDrawing(true);
    currentStrokeRef.current = { page: pageNum, tool, color, size, points: [p] };
  }

  function moveDraw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing || !currentStrokeRef.current) return;
    const p = getPos(e);
    if (!p) return;
    currentStrokeRef.current.points.push(p);
    // 라이브 미리보기 — overlay 에 직접
    drawOverlay();
    const canvas = overlayRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      const s = currentStrokeRef.current;
      ctx.strokeStyle = s.color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = s.tool === "highlighter" ? 0.35 : 1;
      ctx.lineWidth = s.tool === "highlighter" ? s.size * 4 : s.size;
      ctx.beginPath();
      s.points.forEach((pt, i) => {
        const x = pt.x * canvas.width, y = pt.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function endDraw() {
    if (!drawing || !currentStrokeRef.current) return;
    setStrokes((prev) => [...prev, currentStrokeRef.current as Stroke]);
    currentStrokeRef.current = null;
    setDrawing(false);
  }

  async function save() {
    if (strokes.length === 0) {
      toast.error("주석이 없어요");
      return;
    }
    setSaving(true);
    try {
      const { PDFDocument, rgb } = await import("pdf-lib");
      const bytes = await fetch(pdfUrl).then((r) => r.arrayBuffer());
      const doc = await PDFDocument.load(bytes);

      const hexToRgb = (hex: string) => {
        const m = hex.replace("#", "");
        const r = parseInt(m.slice(0, 2), 16) / 255;
        const g = parseInt(m.slice(2, 4), 16) / 255;
        const b = parseInt(m.slice(4, 6), 16) / 255;
        return rgb(r, g, b);
      };

      const pages = doc.getPages();
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        const pageStrokes = strokes.filter((s) => s.page === i + 1);
        for (const s of pageStrokes) {
          const col = hexToRgb(s.color);
          const opacity = s.tool === "highlighter" ? 0.35 : 1;
          const lineWidth = s.tool === "highlighter" ? s.size * 4 : s.size;
          if (s.tool === "text" && s.text) {
            const p = s.points[0];
            page.drawText(s.text, {
              x: p.x * width,
              y: height - p.y * height - s.size * 6,
              size: s.size * 6,
              color: col,
            });
            continue;
          }
          if (s.tool === "line") {
            if (s.points.length < 2) continue;
            const a = s.points[0];
            const b = s.points[s.points.length - 1];
            page.drawLine({
              start: { x: a.x * width, y: height - a.y * height },
              end: { x: b.x * width, y: height - b.y * height },
              thickness: lineWidth,
              color: col,
              opacity,
            });
            continue;
          }
          // pen / highlighter — 점들을 선으로 잇기
          for (let k = 1; k < s.points.length; k++) {
            const a = s.points[k - 1];
            const b = s.points[k];
            page.drawLine({
              start: { x: a.x * width, y: height - a.y * height },
              end: { x: b.x * width, y: height - b.y * height },
              thickness: lineWidth,
              color: col,
              opacity,
            });
          }
        }
      }

      const out = await doc.save();
      // R2 업로드 — 원본 파일명에 .annotated 추가
      const safeName = fileName.replace(/\.pdf$/i, "") + ".annotated.pdf";
      const outBlob = new Blob([new Uint8Array(out)], { type: "application/pdf" });
      const file = new File([outBlob], safeName, { type: "application/pdf" });
      const { uploadFile } = await import("@/lib/storage/upload-client");
      const up = await uploadFile(file, { prefix: "resources" });
      toast.success("주석본이 저장되었어요");
      onSaved(up.url);
    } catch (e: any) {
      console.error("[pdf-annotator] save", e);
      toast.error("저장 실패: " + (e?.message || "unknown"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-nu-ink/85 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] w-full h-full max-w-6xl max-h-[95vh] flex flex-col">
        {/* Toolbar */}
        <div className="px-3 py-2 border-b-[2px] border-nu-ink bg-nu-cream/30 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-nu-ink truncate max-w-[200px]">{fileName}</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {([
              { t: "pen" as Tool, icon: <Pencil size={12} />, label: "펜" },
              { t: "highlighter" as Tool, icon: <Highlighter size={12} />, label: "형광" },
              { t: "line" as Tool, icon: <Minus size={12} />, label: "직선" },
              { t: "text" as Tool, icon: <Type size={12} />, label: "텍스트" },
              { t: "eraser" as Tool, icon: <Trash2 size={12} />, label: "지우개" },
            ]).map((b) => (
              <button
                key={b.t}
                onClick={() => setTool(b.t)}
                className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] flex items-center gap-1 ${tool === b.t ? "border-nu-ink bg-nu-ink text-nu-paper" : "border-nu-ink/15 text-nu-muted hover:border-nu-ink"}`}
              >
                {b.icon} {b.label}
              </button>
            ))}
            <span className="w-px h-4 bg-nu-ink/15 mx-1" />
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ background: c }}
                className={`w-5 h-5 border-[2px] ${color === c ? "border-nu-ink scale-110" : "border-nu-ink/20"}`}
                title={c}
              />
            ))}
            <input
              type="range"
              min={1}
              max={10}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-16 mx-2"
              title={`굵기 ${size}`}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={save}
              disabled={saving || strokes.length === 0}
              className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border-2 border-nu-ink bg-nu-pink text-white hover:bg-nu-ink transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              저장
            </button>
            <button onClick={onClose} className="p-1.5 text-nu-muted hover:text-nu-ink"><X size={18} /></button>
          </div>
        </div>

        {/* Page nav */}
        <div className="px-3 py-1.5 border-b border-nu-ink/10 bg-nu-cream/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPageNum((n) => Math.max(1, n - 1))}
              disabled={pageNum <= 1}
              className="p-1 border border-nu-ink/20 disabled:opacity-30 hover:bg-nu-ink/5"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink">
              {pageNum} / {pageCount}
            </span>
            <button
              onClick={() => setPageNum((n) => Math.min(pageCount, n + 1))}
              disabled={pageNum >= pageCount}
              className="p-1 border border-nu-ink/20 disabled:opacity-30 hover:bg-nu-ink/5"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
            주석 {strokes.filter((s) => s.page === pageNum).length}개 (이 페이지) · 총 {strokes.length}개
          </span>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 overflow-auto bg-nu-cream/30 flex items-start justify-center p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-2 mt-12">
              <Loader2 size={28} className="animate-spin text-nu-muted" />
              <p className="text-[12px] text-nu-muted">PDF 불러오는 중...</p>
            </div>
          ) : renderError ? (
            <div className="border-2 border-red-300 bg-red-50 p-6 max-w-md mt-8">
              <p className="font-bold text-red-700 mb-1">PDF 로드 실패</p>
              <p className="text-[12px] text-red-600">{renderError}</p>
            </div>
          ) : (
            <div className="relative bg-white shadow-2xl">
              <canvas ref={pdfPageCanvasRef} className="block" />
              <canvas
                ref={overlayRef}
                className="absolute inset-0 cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={(e) => { e.preventDefault(); startDraw(e); }}
                onTouchMove={(e) => { e.preventDefault(); moveDraw(e); }}
                onTouchEnd={(e) => { e.preventDefault(); endDraw(); }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
