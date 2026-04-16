"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  X,
  Rocket,
  BookOpen,
  Zap,
  Sparkles,
  Users,
  Clock,
  Check,
} from "lucide-react";

/* ── Icon Registry ──────────────────────────────────────────────── */
const iconMap: Record<string, React.ReactNode> = {
  rocket: <Rocket size={20} />,
  "book-open": <BookOpen size={20} />,
  zap: <Zap size={20} />,
};

const iconMapLarge: Record<string, React.ReactNode> = {
  rocket: <Rocket size={28} />,
  "book-open": <BookOpen size={28} />,
  zap: <Zap size={28} />,
};

/* ── Color Themes ───────────────────────────────────────────────── */
const colorThemes: Record<
  string,
  { gradient: string; accent: string; glow: string; iconBg: string; badge: string }
> = {
  blue: {
    gradient: "from-[#0047FF] via-[#0033CC] to-[#001A66]",
    accent: "text-[#4D8AFF]",
    glow: "shadow-[0_0_60px_rgba(0,71,255,0.15)]",
    iconBg: "bg-[#0047FF]/10",
    badge: "bg-[#0047FF]/10 text-[#0047FF] border-[#0047FF]/20",
  },
  pink: {
    gradient: "from-[#FF2E97] via-[#CC0066] to-[#660033]",
    accent: "text-[#FF6DB6]",
    glow: "shadow-[0_0_60px_rgba(255,46,151,0.15)]",
    iconBg: "bg-[#FF2E97]/10",
    badge: "bg-[#FF2E97]/10 text-[#FF2E97] border-[#FF2E97]/20",
  },
  amber: {
    gradient: "from-[#FF8C00] via-[#CC6600] to-[#663300]",
    accent: "text-[#FFB347]",
    glow: "shadow-[0_0_60px_rgba(255,140,0,0.15)]",
    iconBg: "bg-[#FF8C00]/10",
    badge: "bg-[#FF8C00]/10 text-[#FF8C00] border-[#FF8C00]/20",
  },
};

/* ── Props ──────────────────────────────────────────────────────── */
interface TemplateCardProps {
  title: string;
  description: string;
  iconName: string;
  color: string; // kept for backwards compat, but we derive theme from colorKey
  colorKey?: "blue" | "pink" | "amber";
  tag: string;
  templateId: string;
  basePath?: string; // e.g., "/groups/create" or "/projects/create", defaults to "/groups/create"
  details: {
    longDescription: string;
    features: string[];
    groupSize: string;
    duration: string;
  };
}

/* ── Component ──────────────────────────────────────────────────── */
export function TemplateCard({
  title,
  description,
  iconName,
  color,
  colorKey = "blue",
  tag,
  templateId,
  basePath = "/groups/create",
  details,
}: TemplateCardProps) {
  const icon = iconMap[iconName] || <Rocket size={20} />;
  const iconLg = iconMapLarge[iconName] || <Rocket size={28} />;
  const theme = colorThemes[colorKey] || colorThemes.blue;
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  const handleStartTemplate = () => {
    setIsOpen(false);
    router.push(`${basePath}?template=${templateId}`);
  };

  return (
    <>
      {/* ── Card ──────────────────────────────────────────────────── */}
      <div
        onClick={() => setIsOpen(true)}
        className={`group relative cursor-pointer overflow-hidden bg-nu-ink border-2 border-nu-ink/80 transition-all duration-500 hover:-translate-y-1.5 ${theme.glow} hover:border-white/20`}
      >
        {/* Gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-90`} />

        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Floating icon decoration */}
        <div className="absolute -top-4 -right-4 w-32 h-32 opacity-[0.06] transition-transform duration-700 group-hover:rotate-12 group-hover:scale-110">
          <div className="w-full h-full flex items-center justify-center text-white scale-[4]">
            {icon}
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 p-6">
          {/* Tag badge */}
          <div className="flex items-center gap-2 mb-5">
            <span className="font-mono-nu text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 bg-white/10 text-white/90 border border-white/10 backdrop-blur-sm">
              <Sparkles size={8} className="inline -mt-0.5 mr-1 opacity-70" />
              {tag}
            </span>
          </div>

          {/* Icon + Title */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 text-white/80 border border-white/10">
              {icon}
            </div>
            <h3 className="font-head text-xl font-black text-white leading-tight tracking-tight">
              {title}
            </h3>
          </div>

          {/* Description */}
          <p className="text-[13px] leading-relaxed text-white/55 mb-6 pl-[52px]">
            {description}
          </p>

          {/* Meta info */}
          <div className="flex items-center gap-4 mb-5 pl-[52px]">
            <span className="flex items-center gap-1.5 font-mono-nu text-[11px] text-white/40">
              <Users size={10} /> {details.groupSize}
            </span>
            <span className="flex items-center gap-1.5 font-mono-nu text-[11px] text-white/40">
              <Clock size={10} /> {details.duration}
            </span>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-2 pl-[52px] font-mono-nu text-[12px] font-black uppercase tracking-widest text-white/80 group-hover:text-white transition-colors">
            템플릿 상세보기
            <ArrowRight
              size={12}
              className="group-hover:translate-x-1.5 transition-transform duration-300"
            />
          </div>
        </div>

        {/* Bottom accent line */}
        <div className={`h-[2px] bg-gradient-to-r ${theme.gradient} opacity-60`} />
      </div>

      {/* ── Modal ─────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Panel */}
          <div
            className="relative bg-nu-paper border-2 border-nu-ink max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Modal Header ──────────────────────────────────── */}
            <div className={`relative overflow-hidden`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-95`} />
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />

              <div className="relative z-10 p-8">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex-1">
                    <span className="font-mono-nu text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 bg-white/15 text-white/90 border border-white/15 inline-block mb-5">
                      <Sparkles size={8} className="inline -mt-0.5 mr-1 opacity-70" />
                      {tag}
                    </span>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-white/10 backdrop-blur-sm flex items-center justify-center text-white border border-white/10">
                        {iconLg}
                      </div>
                      <h2 className="font-head text-3xl font-black text-white tracking-tight">
                        {title}
                      </h2>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close modal"
                  >
                    <X size={22} />
                  </button>
                </div>
                <p className="text-[13px] text-white/65 leading-relaxed max-w-lg">
                  {details.longDescription}
                </p>

                {/* Quick Stats */}
                <div className="flex items-center gap-6 mt-6 pt-5 border-t border-white/10">
                  <div>
                    <p className="font-mono-nu text-[10px] uppercase tracking-[0.15em] text-white/35 mb-1">
                      권장 규모
                    </p>
                    <p className="font-head text-lg font-bold text-white flex items-center gap-2">
                      <Users size={14} className="opacity-50" />
                      {details.groupSize}
                    </p>
                  </div>
                  <div className="w-px h-10 bg-white/10" />
                  <div>
                    <p className="font-mono-nu text-[10px] uppercase tracking-[0.15em] text-white/35 mb-1">
                      예상 기간
                    </p>
                    <p className="font-head text-lg font-bold text-white flex items-center gap-2">
                      <Clock size={14} className="opacity-50" />
                      {details.duration}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Modal Body ────────────────────────────────────── */}
            <div className="p-8">
              {/* Features */}
              <div className="mb-8">
                <h3 className="font-mono-nu text-[12px] font-bold uppercase tracking-[0.15em] text-nu-muted mb-5">
                  포함된 기능
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {details.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-3 border border-nu-ink/5 bg-nu-cream/20`}
                    >
                      <div
                        className={`w-5 h-5 shrink-0 flex items-center justify-center mt-0.5 ${theme.badge} border`}
                      >
                        <Check size={10} />
                      </div>
                      <span className="text-[12px] text-nu-graphite leading-snug">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handleStartTemplate}
                className={`w-full relative overflow-hidden font-mono-nu text-[13px] font-bold tracking-[0.08em] uppercase px-6 py-4 text-white border-0 transition-all duration-300 hover:shadow-lg`}
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient}`} />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  이 템플릿으로 시작하기
                  <ArrowRight size={14} />
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
