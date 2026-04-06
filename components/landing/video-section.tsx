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

  // Extract YouTube embed URL
  function getEmbedUrl(url: string) {
    if (!url) return "";
    // youtube.com/watch?v=xxx
    const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1&rel=0`;
    // already embed url
    if (url.includes("youtube.com/embed")) return url + (url.includes("?") ? "&autoplay=1" : "?autoplay=1");
    // vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    return url;
  }

  return (
    <section ref={ref} className="py-24 px-8 bg-nu-ink">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12 reveal-item">
          <span className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-4 block">
            Watch
          </span>
          <h2 className="font-head text-[clamp(28px,4vw,42px)] font-extrabold text-nu-paper tracking-tight">
            {title}
          </h2>
          <p className="text-nu-paper/50 mt-3 text-sm max-w-md mx-auto">
            {subtitle}
          </p>
        </div>

        {/* Video player area */}
        <div className="reveal-item relative aspect-video bg-nu-graphite overflow-hidden border border-nu-paper/10">
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
              {/* Decorative background */}
              <div className="absolute inset-0">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-nu-pink/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-nu-blue/10 rounded-full blur-[80px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span
                    className="font-head text-[120px] font-extrabold select-none opacity-[0.04]"
                    style={{ WebkitTextStroke: "1px rgba(244,241,234,0.3)", color: "transparent" }}
                  >
                    NU
                  </span>
                </div>
              </div>

              {videoUrl ? (
                <button
                  onClick={() => setPlaying(true)}
                  className="relative z-10 w-20 h-20 rounded-full bg-nu-pink flex items-center justify-center hover:scale-110 transition-transform group"
                  aria-label="영상 재생"
                >
                  <Play size={32} className="text-white ml-1 group-hover:scale-110 transition-transform" />
                </button>
              ) : (
                <div className="relative z-10 text-center">
                  <div className="w-20 h-20 rounded-full border-2 border-nu-paper/20 flex items-center justify-center mx-auto mb-4">
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
      </div>
    </section>
  );
}
