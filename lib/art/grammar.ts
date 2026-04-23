import type { PRNG } from "./prng";
import { randInt, pick, chance } from "./prng";

/**
 * 카테고리별 형태 문법 — 순수 함수, SVG 요소 배열 반환.
 *
 *   space    — 기하학적 격자·정면 건축
 *   culture  — 유기적 파동·리듬
 *   platform — 노드·엣지·네트워크
 *   vibe     — 그라디언트·안개·빛
 */

export type Category = "space" | "culture" | "platform" | "vibe";
export type SvgChild = { tag: string; attrs: Record<string, string | number>; children?: SvgChild[] };
export interface Palette { primary: string; secondary: string; surface: string; ink: string; }

export function drawGrammar(cat: Category, rng: PRNG, size: number, palette: Palette): SvgChild[] {
  switch (cat) {
    case "space":    return drawSpace(rng, size, palette);
    case "culture":  return drawCulture(rng, size, palette);
    case "platform": return drawPlatform(rng, size, palette);
    case "vibe":     return drawVibe(rng, size, palette);
  }
}

/* ────────────────────────────────────────────────
   Space — 격자·정면·건축적
   ──────────────────────────────────────────────── */
function drawSpace(rng: PRNG, size: number, p: Palette): SvgChild[] {
  const cells = randInt(rng, 4, 7);
  const step = size / cells;
  const out: SvgChild[] = [
    { tag: "rect", attrs: { x: 0, y: 0, width: size, height: size, fill: p.surface } },
  ];
  // grid lines
  for (let i = 1; i < cells; i++) {
    out.push({ tag: "line", attrs: { x1: i * step, y1: 0, x2: i * step, y2: size, stroke: p.ink, "stroke-width": 0.4, opacity: 0.2 } });
    out.push({ tag: "line", attrs: { x1: 0, y1: i * step, x2: size, y2: i * step, stroke: p.ink, "stroke-width": 0.4, opacity: 0.2 } });
  }
  // filled blocks
  const count = randInt(rng, 2, 5);
  for (let i = 0; i < count; i++) {
    const cx = randInt(rng, 0, cells - 1);
    const cy = randInt(rng, 0, cells - 1);
    const w = randInt(rng, 1, 2);
    const h = randInt(rng, 1, 2);
    out.push({
      tag: "rect",
      attrs: {
        x: cx * step, y: cy * step, width: w * step, height: h * step,
        fill: i % 2 === 0 ? p.primary : p.secondary,
        opacity: chance(rng, 0.3) ? 0.6 : 0.9,
      },
    });
  }
  // window grid overlay
  if (chance(rng, 0.5)) {
    const miniStep = step / 3;
    const startX = randInt(rng, 0, cells - 2) * step;
    const startY = randInt(rng, 0, cells - 2) * step;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        out.push({
          tag: "rect",
          attrs: {
            x: startX + i * miniStep + 2, y: startY + j * miniStep + 2,
            width: miniStep - 4, height: miniStep - 4,
            fill: "none", stroke: p.ink, "stroke-width": 0.6, opacity: 0.4,
          },
        });
      }
    }
  }
  return out;
}

/* ────────────────────────────────────────────────
   Culture — 곡선·파동·리듬
   ──────────────────────────────────────────────── */
function drawCulture(rng: PRNG, size: number, p: Palette): SvgChild[] {
  const out: SvgChild[] = [
    { tag: "rect", attrs: { x: 0, y: 0, width: size, height: size, fill: p.surface } },
  ];
  const waves = randInt(rng, 3, 6);
  for (let i = 0; i < waves; i++) {
    const y = (size / (waves + 1)) * (i + 1);
    const amp = randInt(rng, 8, 24);
    const period = randInt(rng, 2, 5);
    let d = `M 0 ${y}`;
    for (let x = 0; x <= size; x += 4) {
      const offset = Math.sin((x / size) * Math.PI * period + rng() * 6.28) * amp;
      d += ` L ${x} ${y + offset}`;
    }
    out.push({
      tag: "path",
      attrs: {
        d, fill: "none",
        stroke: i % 2 === 0 ? p.primary : p.secondary,
        "stroke-width": chance(rng, 0.4) ? 2 : 1,
        opacity: 0.5 + rng() * 0.4,
      },
    });
  }
  // dots rhythm
  const dots = randInt(rng, 8, 16);
  for (let i = 0; i < dots; i++) {
    out.push({
      tag: "circle",
      attrs: {
        cx: rng() * size, cy: rng() * size,
        r: rng() * 3 + 1,
        fill: chance(rng, 0.5) ? p.primary : p.ink,
        opacity: 0.4 + rng() * 0.4,
      },
    });
  }
  return out;
}

/* ────────────────────────────────────────────────
   Platform — 노드·엣지·네트워크
   ──────────────────────────────────────────────── */
function drawPlatform(rng: PRNG, size: number, p: Palette): SvgChild[] {
  const out: SvgChild[] = [
    { tag: "rect", attrs: { x: 0, y: 0, width: size, height: size, fill: p.surface } },
  ];
  const nodeCount = randInt(rng, 5, 9);
  const nodes: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      x: randInt(rng, size * 0.1, size * 0.9),
      y: randInt(rng, size * 0.1, size * 0.9),
      r: randInt(rng, 3, 7),
    });
  }
  // edges (각 노드에서 가까운 2~3개 연결)
  for (let i = 0; i < nodes.length; i++) {
    const dists = nodes.map((n, j) => ({ j, d: Math.hypot(n.x - nodes[i].x, n.y - nodes[i].y) }))
      .filter((x) => x.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, randInt(rng, 1, 3));
    for (const { j } of dists) {
      out.push({
        tag: "line",
        attrs: {
          x1: nodes[i].x, y1: nodes[i].y, x2: nodes[j].x, y2: nodes[j].y,
          stroke: p.ink, "stroke-width": 0.6, opacity: 0.3,
        },
      });
    }
  }
  // nodes
  nodes.forEach((n, i) => {
    out.push({
      tag: "circle",
      attrs: {
        cx: n.x, cy: n.y, r: n.r,
        fill: i === 0 ? p.primary : chance(rng, 0.4) ? p.secondary : p.ink,
        opacity: 0.9,
      },
    });
    if (i === 0) {
      out.push({
        tag: "circle",
        attrs: { cx: n.x, cy: n.y, r: n.r + 4, fill: "none", stroke: p.primary, "stroke-width": 0.8, opacity: 0.5 },
      });
    }
  });
  return out;
}

/* ────────────────────────────────────────────────
   Vibe — 그라디언트·안개·빛
   ──────────────────────────────────────────────── */
function drawVibe(rng: PRNG, size: number, p: Palette): SvgChild[] {
  const out: SvgChild[] = [
    { tag: "rect", attrs: { x: 0, y: 0, width: size, height: size, fill: p.surface } },
  ];
  // 방사형 블롭 3~5개
  const blobs = randInt(rng, 3, 5);
  for (let i = 0; i < blobs; i++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const r = randInt(rng, size * 0.2, size * 0.55);
    const color = pick(rng, [p.primary, p.secondary, p.primary]);
    const opacity = 0.2 + rng() * 0.4;
    out.push({
      tag: "circle",
      attrs: {
        cx, cy, r, fill: color, opacity,
        filter: "url(#blur-lg)",
      },
    });
  }
  // 작은 sparks
  for (let i = 0; i < randInt(rng, 6, 12); i++) {
    out.push({
      tag: "circle",
      attrs: {
        cx: rng() * size, cy: rng() * size,
        r: rng() * 1.2 + 0.4,
        fill: p.ink, opacity: 0.4 + rng() * 0.5,
      },
    });
  }
  return out;
}
