"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

interface PageHeroProps {
  category?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
    icon?: any;
  };
  className?: string;
}

export function PageHero({ category, title, description, action, className = "" }: PageHeroProps) {
  const Icon = action?.icon || Plus;

  return (
    <div className={`relative bg-nu-ink overflow-hidden border-b border-nu-paper/10 ${className}`}>
      {/* Premium Gradients & Blurs */}
      <div className="absolute inset-0 bg-gradient-to-br from-nu-blue/15 via-nu-ink to-nu-pink/10" />
      <div className="absolute top-1/3 left-1/4 w-[250px] h-[250px] bg-nu-blue/20 rounded-full blur-[100px] opacity-60" />
      <div className="absolute bottom-1/4 right-1/3 w-[180px] h-[180px] bg-nu-pink/15 rounded-full blur-[70px] opacity-50" />
      
      <div className="relative max-w-7xl mx-auto px-8 pt-20 pb-12 md:pt-28 md:pb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="flex-1">
          {category && (
            <span className="font-mono-nu text-[10px] uppercase tracking-[0.4em] text-nu-blue font-bold block mb-4 animate-fade-in-down">
              {category}
            </span>
          )}
          <h1 className="font-head text-[clamp(40px,6vw,68px)] font-extrabold text-nu-paper leading-none tracking-tighter mb-5 animate-slide-up-fade">
             {title}
          </h1>
          <p className="text-nu-paper/50 max-w-xl text-[13px] md:text-sm leading-relaxed animate-fade-in">
             {description}
          </p>
        </div>
        
        {action && (
          <div className="animate-fade-in-scale">
            <Link
              href={action.href}
              className="font-mono-nu text-[11px] font-bold tracking-[0.1em] uppercase px-8 py-4 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-all no-underline inline-flex items-center gap-2.5 shadow-xl shadow-nu-pink/10 active:scale-95"
            >
              <Icon size={15} /> {action.label}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
