"use client";

import { useEffect, useRef } from "react";

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    dot.style.display = "block";
    ring.style.display = "block";

    const onMove = (e: MouseEvent) => {
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
      ring.style.left = `${e.clientX}px`;
      ring.style.top = `${e.clientY}px`;
    };

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, .group-card, [role=button]")) {
        dot.style.width = "60px";
        dot.style.height = "60px";
        dot.style.background = "var(--color-nu-yellow)";
        dot.style.mixBlendMode = "multiply";
      }
    };

    const onOut = () => {
      dot.style.width = "10px";
      dot.style.height = "10px";
      dot.style.background = "var(--color-nu-pink)";
      dot.style.mixBlendMode = "difference";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);
    window.addEventListener("mouseout", onOut);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mouseout", onOut);
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="nu-cursor-dot hidden" aria-hidden="true" />
      <div ref={ringRef} className="nu-cursor-ring hidden" aria-hidden="true" />
    </>
  );
}
