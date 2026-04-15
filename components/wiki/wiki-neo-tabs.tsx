"use client";

import { useState, useEffect, useRef } from "react";

interface WikiTab {
  id: string;
  label: string;
  /** nu-* color class for active state, e.g. "bg-nu-pink" */
  color: string;
  icon?: string;
  count?: number;
}

interface WikiNeoTabsProps {
  tabs: WikiTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  /** Compact mode for tight spaces */
  compact?: boolean;
}

/**
 * Neo-brutalism tab bar for wiki navigation.
 * Combines bold borders, offset shadows, and nu-* tokens.
 */
export function WikiNeoTabs({ tabs, activeTab, onTabChange, compact }: WikiNeoTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active tab into view on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const active = scrollRef.current.querySelector(`[data-tab-active="true"]`);
    if (active) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);

  return (
    <div
      ref={scrollRef}
      className="flex flex-wrap gap-2 sm:gap-3 mb-8 overflow-x-auto scrollbar-hide py-1"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            data-tab-active={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`
              font-head font-extrabold uppercase tracking-wider
              border-[3px] border-nu-ink transition-all duration-150 select-none whitespace-nowrap
              flex items-center gap-1.5
              ${compact ? "px-3 py-1.5 text-[11px]" : "px-5 py-2.5 text-xs"}
              ${isActive
                ? `${tab.color} text-white translate-x-[3px] translate-y-[3px] shadow-none`
                : "bg-white text-nu-ink shadow-[3px_3px_0px_0px_rgba(13,13,13,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(13,13,13,1)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
              }
            `}
          >
            {tab.icon && <span className="text-sm">{tab.icon}</span>}
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={`
                font-mono-nu text-[10px] font-bold px-1.5 py-0.5 ml-0.5
                ${isActive
                  ? "bg-white/25 text-white"
                  : "bg-nu-ink/5 text-nu-muted"
                }
              `}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
