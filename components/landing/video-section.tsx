"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

interface VideoSectionProps {
  content?: Record<string, string>;
}

export function VideoSection({ content }: VideoSectionProps) {
  const [playing, setPlaying] = useState(false);
  const ref = useRevealOnScroll(0.1);

  const videoUrl = content?.video_url || "";
  const title = content?.video_title || "nutunion이 만드는 Scene";
  const subtitle = content?.video_subtitle || "공간, 문화, 플랫폼, 바이브가 만나는 순간을 영상으로 만나보세요.";

  function getEmbedUrl(url: string) {
    if (!url) return "";
    const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1&rel=0`;
    if (url.includes("youtube.com/embed")) return url + (url.includes("?") ? "&autoplay=1" : "?autoplay=1");
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    return url;
  }

  return (
    <section ref={ref} className="py-24 px-8 bg-nu-ink relative overflow-hidden">
      {/* Halftone background */}
      <div className="absolute inset-0 halftone-pink opacity-[0.02]" aria-hidden="true" />

      {/* Overprint accents */}
      <div className="absolute top-0 left-[20%] w-[30%] h-[40%] bg-nu-pink/[0.03] mix-blend-screen" aria-hidden="true" />
      <div className="absolute bottom-0 right-[15%] w-[25%] h-[35%] bg-nu-blue/[0.03] mix-blend-screen" aria-hidden="true" />

      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-12 reveal-item">
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-4 block">
            Watch
          </span>
          <h2 className="font-head text-[clamp(32px,4.5vw,48px)] font-extrabold text-nu-paper tracking-tighter leading-[0.9]">
            {title}
          </h2>
          <p className="text-nu-paper/50 mt-4 text-sm max-w-md mx-auto">
            {subtitle}
          </p>
        </div>

        {/* Video player — brutalist frame */}
        <div className="reveal-item relative aspect-video bg-nu-graphite overflow-hidden border-[3px] border-nu-paper/15">
          {/* Registration marks */}
          <div className="absolute top-2 left-2 font-mono-nu text-[10px] text-nu-paper/10 z-20" aria-hidden="true">⊕</div>
          <div className="absolute top-2 right-2 font-mono-nu text-[10px] text-nu-paper/10 z-20" aria-hidden="true">⊕</div>

          {playing && videoUrl ? (
            <iframe
              src={getEmbedUrl(videoUrl)}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={title}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {/* Risograph decorative background */}
              <div className="absolute inset-0">
                <div className="absolute inset-0 halftone-pink opacity-[0.04]" />
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-nu-pink/10 mix-blend-screen" />
                <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-nu-blue/8 mix-blend-screen" />

                {/* Grid lines */}
                <div className="absolute top-0 left-1/3 w-[2px] h-full bg-nu-paper/[0.03]" />
                <div className="absolute top-0 left-2/3 w-[2px] h-full bg-nu-paper/[0.03]" />
                <div className="absolute top-1/3 left-0 w-full h-[2px] bg-nu-paper/[0.03]" />

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span
                    className="font-head text-[120px] font-extrabold select-none opacity-[0.04]"
                    style={{ WebkitTextStroke: "2px rgba(244,241,234,0.3)", color: "transparent" }}
                  >
                    NU
                  </span>
                </div>
              </div>

              {videoUrl ? (
                <button
                  onClick={() => setPlaying(true)}
                  className="relative z-10 w-20 h-20 bg-nu-pink flex items-center justify-center hover:scale-110 transition-transform group border-[3px] border-nu-paper/30"
                  aria-label="영상 재생"
                >
                  <Play size={32} className="text-white ml-1 group-hover:scale-110 transition-transform" />
                </button>
              ) : (
                <div className="relative z-10 text-center">
                  <div className="w-20 h-20 border-[3px] border-nu-paper/20 flex items-center justify-center mx-auto mb-4">
                    <Play size={32} className="text-nu-paper/30 ml-1" />
                  </div>
                  <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-paper/30">
                    Coming Soon
                  </p>
                </div>
              )}

              {videoUrl && (
                <p className="relative z-10 font-mono-nu text-[10px] uppercase tracking-widest text-nu-paper/40 mt-6">
                  Click to play
                </p>
              )}
            </div>
          )}
        </div>

        {/* Controls bar */}
        <div className="flex items-center justify-between mt-3">
          <span className="font-mono-nu text-[9px] text-nu-paper/20 tracking-widest uppercase">
            RISO BROADCAST — NU EDITION
          </span>
          <span className="font-mono-nu text-[9px] text-nu-paper/15">⊕</span>
        </div>
      </div>
    </section>
  );
}
