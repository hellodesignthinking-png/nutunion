"use client";

import { useRef, useState, useEffect, useCallback } from "react";

export function SignaturePad({
  title,
  onSave,
  onClose,
}: {
  title: string;
  onSave: (dataUrl: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);

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
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#0D0D0D";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const touch = "touches" in e ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }, []);

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => setDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  };

  const save = async () => {
    if (!hasDrawn || saving) return;
    setSaving(true);
    try {
      const dataUrl = canvasRef.current!.toDataURL("image/png");
      await onSave(dataUrl);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-nu-paper border-[2.5px] border-nu-ink w-full max-w-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-5 py-4 border-b-[2px] border-nu-ink">
          <div className="font-mono-nu text-[13px] uppercase tracking-widest text-nu-ink">
            {title}
          </div>
          <button onClick={onClose} aria-label="닫기" className="text-nu-graphite hover:text-nu-ink text-[20px] leading-none p-1">×</button>
        </div>

        <div className="p-5">
          <div className="relative mb-4 border-[2.5px] border-nu-ink">
            <canvas
              ref={canvasRef}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
              style={{ width: "100%", height: 220, touchAction: "none", background: "#fff" }}
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-nu-graphite text-[14px]">여기에 서명하세요</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={clear}
              className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5"
            >
              지우기
            </button>
            <button
              onClick={onClose}
              className="flex-1 border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink/5"
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={!hasDrawn || saving}
              className="flex-[2] border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-2.5 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
            >
              {saving ? "저장 중..." : "서명 완료"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
