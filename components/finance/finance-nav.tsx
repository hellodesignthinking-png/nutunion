"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEGACY_SYSTEM_URL } from "@/lib/finance/config";

const NAV_ITEMS = [
  { label: "볼트", href: "/finance", icon: "🔩", exact: true },
  { label: "법인", href: "/finance/companies", icon: "🏛" },
  { label: "거래", href: "/finance/transactions", icon: "💳" },
  { label: "HR", href: "/finance/hr", icon: "👥" },
  { label: "AI 마케팅", href: "/finance/marketing", icon: "✨", accent: true },
  { label: "규정", href: "/finance/docs", icon: "📋" },
];

export function FinanceNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href || /^\/finance\/[^/]+$/.test(pathname) && !pathname.match(/\/(companies|transactions|hr|marketing|docs)/);
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="sticky top-[60px] z-30 bg-nu-paper/90 backdrop-blur-sm border-b-[2px] border-nu-ink">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <nav className="flex items-center gap-1 overflow-x-auto py-2 -mx-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 font-mono-nu text-[11px] uppercase tracking-widest no-underline transition-all border-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nu-ink ${
                  active
                    ? item.accent
                      ? "bg-nu-pink text-nu-paper border-nu-pink"
                      : "bg-nu-ink text-nu-paper border-nu-ink"
                    : item.accent
                    ? "bg-nu-paper text-nu-pink border-nu-pink hover:bg-nu-pink hover:text-nu-paper"
                    : "bg-nu-paper text-nu-graphite border-nu-ink/30 hover:bg-nu-ink/5 hover:border-nu-ink hover:text-nu-ink"
                }`}
              >
                <span className="text-[14px]" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* 구 시스템 링크 */}
          <a
            href={LEGACY_SYSTEM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="구 재무시스템 (새 탭에서 열림)"
            className="flex-shrink-0 ml-auto px-3 py-2 font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline whitespace-nowrap"
          >
            구 시스템 ↗
          </a>
        </nav>
      </div>
    </div>
  );
}
