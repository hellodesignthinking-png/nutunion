"use client";

import { useState } from "react";
import { GenerativeArt } from "./generative-art";
import { GENRES } from "@/tokens/liquid";
import { Shuffle, RotateCcw, Download, Copy, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * Grammar Playground — 방문자가 seed/category/genre 를 바꿔보며 놀 수 있는 인터랙티브.
 * Protocol 페이지 하단에 삽입.
 */
export function GrammarPlayground() {
  const [seed, setSeed] = useState("nutunion-protocol-001");
  const [category, setCategory] = useState<"space" | "culture" | "platform" | "vibe">("culture");
  const [genreIdx, setGenreIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const genre = GENRES[genreIdx];

  function shuffle() {
    setSeed(Math.random().toString(36).slice(2, 14));
    setCategory((["space", "culture", "platform", "vibe"] as const)[Math.floor(Math.random() * 4)]);
    setGenreIdx(Math.floor(Math.random() * GENRES.length));
  }

  function reset() {
    setSeed("nutunion-protocol-001");
    setCategory("culture");
    setGenreIdx(0);
  }

  async function copyCode() {
    const code = `<GenerativeArt\n  seed="${seed}"\n  category="${category}"\n  variant="hero"\n/>`;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("코드 복사됨");
    setTimeout(() => setCopied(false), 1500);
  }

  async function downloadSvg() {
    const svgEl = document.querySelector<SVGElement>("#playground-art svg");
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const str = serializer.serializeToString(svgEl);
    const blob = new Blob([str], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nutunion-${category}-${seed.slice(0, 8)}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper overflow-hidden my-10">
      <header className="px-5 py-3 border-b-[2px] border-nu-ink bg-nu-cream/30 flex items-center justify-between">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite font-bold">
            Grammar Playground
          </div>
          <p className="font-mono-nu text-[10px] text-nu-muted mt-0.5">
            seed · category · 오늘의 장르 를 바꿔 같은 엔진을 시험해보세요
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={shuffle} className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2.5 py-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors">
            <Shuffle size={10} /> 무작위
          </button>
          <button onClick={reset} className="inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2.5 py-1.5 border-[2px] border-nu-ink/20 hover:border-nu-ink transition-colors">
            <RotateCcw size={10} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,320px] gap-0">
        {/* Canvas */}
        <div id="playground-art" className="aspect-square md:aspect-auto md:min-h-[420px] border-r border-b md:border-b-0 border-nu-ink/10 relative" style={{ background: genre.surface }}>
          <GenerativeArt seed={seed} category={category} genre={genre} size={640} variant="hero" className="w-full h-full" />
        </div>

        {/* Controls */}
        <div className="p-4 space-y-4">
          {/* Seed */}
          <div>
            <label className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-graphite block mb-1.5">Seed</label>
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="w-full px-2 py-1.5 border-[2px] border-nu-ink/20 font-mono text-[12px] focus:border-nu-pink outline-none bg-nu-paper"
              placeholder="문자열 아무거나..."
            />
          </div>

          {/* Category */}
          <div>
            <label className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-graphite block mb-1.5">Category (grammar)</label>
            <div className="grid grid-cols-2 gap-1">
              {(["space", "culture", "platform", "vibe"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-2 py-1.5 border-[2px] font-mono-nu text-[10px] uppercase tracking-widest transition-colors ${
                    category === c ? "border-nu-ink bg-nu-ink text-nu-paper" : "border-nu-ink/20 text-nu-graphite hover:border-nu-ink/40"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Genre */}
          <div>
            <label className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-graphite block mb-1.5">
              Liquid Genre · {genre.label}
            </label>
            <div className="grid grid-cols-4 gap-1">
              {GENRES.map((g, i) => (
                <button
                  key={g.key}
                  onClick={() => setGenreIdx(i)}
                  title={g.label}
                  className={`h-8 border-[2px] transition-all ${genreIdx === i ? "border-nu-ink scale-110" : "border-nu-ink/10 hover:border-nu-ink/40"}`}
                  style={{ background: `linear-gradient(135deg, ${g.primary} 0%, ${g.secondary} 100%)` }}
                >
                  <span className="sr-only">{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Palette swatches */}
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-graphite mb-1.5">Palette</div>
            <div className="flex items-center gap-1">
              {[genre.primary, genre.secondary, genre.surface].map((c) => (
                <div key={c} className="flex-1 flex flex-col items-center">
                  <div className="w-full h-8 border border-nu-ink/15" style={{ background: c }} />
                  <span className="font-mono text-[9px] text-nu-graphite mt-1">{c}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1 pt-2 border-t border-nu-ink/10">
            <button onClick={copyCode} className="flex-1 inline-flex items-center justify-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors">
              {copied ? <Check size={10} /> : <Copy size={10} />} JSX
            </button>
            <button onClick={downloadSvg} className="flex-1 inline-flex items-center justify-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors">
              <Download size={10} /> SVG
            </button>
          </div>

          {/* Code preview */}
          <pre className="bg-nu-cream/30 border border-nu-ink/10 p-2 font-mono text-[10px] leading-relaxed text-nu-graphite overflow-x-auto">
{`<GenerativeArt
  seed="${seed}"
  category="${category}"
  variant="hero"
/>`}
          </pre>
        </div>
      </div>
    </section>
  );
}
