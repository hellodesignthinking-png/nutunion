"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { List, ChevronUp, ChevronDown } from "lucide-react";

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface WikiFloatingTOCProps {
  /** CSS selector for the content container to scan for headings */
  contentSelector?: string;
  /** Or pass headings directly */
  headings?: Heading[];
  /** Title override */
  title?: string;
}

/**
 * Floating Table of Contents — neo-brutalism style.
 * Sticks to the right side, highlights the current section via IntersectionObserver,
 * and provides smooth-scroll navigation.
 */
export function WikiFloatingTOC({ contentSelector, headings: propHeadings, title = "목차" }: WikiFloatingTOCProps) {
  const [headings, setHeadings] = useState<Heading[]>(propHeadings || []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Scan for headings if contentSelector is provided
  useEffect(() => {
    if (propHeadings) {
      setHeadings(propHeadings);
      return;
    }
    if (!contentSelector) return;

    const container = document.querySelector(contentSelector);
    if (!container) return;

    const elements = Array.from(container.querySelectorAll("h2, h3")).map((elem) => {
      // Ensure every heading has an id
      if (!elem.id) {
        elem.id = `toc-${elem.textContent?.replace(/\s+/g, "-").toLowerCase().slice(0, 40) || Math.random().toString(36).slice(2)}`;
      }
      return {
        id: elem.id,
        text: elem.textContent || "",
        level: Number(elem.tagName.substring(1)),
      };
    });

    setHeadings(elements);
  }, [contentSelector, propHeadings]);

  // Intersection Observer for active heading tracking
  useEffect(() => {
    if (headings.length === 0) return;

    observerRef.current?.disconnect();

    const callback: IntersectionObserverCallback = (entries) => {
      // Find the topmost visible heading
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0) {
        setActiveId(visible[0].target.id);
      }
    };

    observerRef.current = new IntersectionObserver(callback, {
      rootMargin: "-80px 0px -60% 0px",
      threshold: 0.1,
    });

    headings.forEach(h => {
      const el = document.getElementById(h.id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [headings]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  }, []);

  if (headings.length === 0) return null;

  return (
    <aside className="hidden lg:block sticky top-24 self-start w-56 shrink-0 ml-8">
      <div className="border-[3px] border-nu-ink bg-white shadow-[6px_6px_0px_0px_rgba(13,13,13,1)]">
        {/* Header */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between px-4 py-3 border-b-[2px] border-nu-ink bg-nu-cream/30 hover:bg-nu-cream/60 transition-colors"
        >
          <span className="font-head text-xs font-extrabold uppercase tracking-widest text-nu-ink flex items-center gap-2">
            <List size={13} />
            {title}
          </span>
          {collapsed ? <ChevronDown size={13} className="text-nu-muted" /> : <ChevronUp size={13} className="text-nu-muted" />}
        </button>

        {/* Nav items */}
        {!collapsed && (
          <nav className="px-3 py-3 space-y-0.5 max-h-[60vh] overflow-y-auto scrollbar-hide">
            {headings.map((heading) => {
              const isActive = activeId === heading.id;
              const isH3 = heading.level === 3;

              return (
                <button
                  key={heading.id}
                  onClick={() => scrollTo(heading.id)}
                  className={`
                    w-full text-left block transition-all duration-150 rounded-sm
                    ${isH3 ? "pl-5 pr-2 py-1" : "pl-2 pr-2 py-1.5"}
                    ${isActive
                      ? "bg-nu-pink/10 text-nu-pink font-bold border-l-[3px] border-nu-pink -ml-[1px]"
                      : "text-nu-graphite hover:text-nu-ink hover:bg-nu-cream/40"
                    }
                  `}
                >
                  <span className={`
                    font-head leading-snug block truncate
                    ${isH3 ? "text-[11px]" : "text-xs font-bold"}
                    ${isActive ? "" : isH3 ? "opacity-70" : ""}
                  `}>
                    {heading.text}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Footer: reading progress */}
        {!collapsed && (
          <div className="px-4 py-2 border-t border-nu-ink/10 bg-nu-cream/20">
            <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">
              {headings.length} sections
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
