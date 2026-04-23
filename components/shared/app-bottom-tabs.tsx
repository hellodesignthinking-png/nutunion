"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Rocket,
  BookOpen,
  Bell,
  MessageSquare,
  User as UserIcon,
} from "lucide-react";

/**
 * 모바일 전용 하단 탭 바 — md 미만에서만 표시.
 *
 * 디자인:
 *   · 브루탈리스트 2.5px 상단 경계선 + nu-paper 배경
 *   · 큰 터치 영역 (44px+ Apple HIG 준수)
 *   · 활성 탭 nu-pink 인디케이터
 *
 * safe-area-inset-bottom 고려 (노치 대응).
 */

const TABS = [
  { label: "홈", href: "/dashboard", icon: LayoutDashboard },
  { label: "채팅", href: "/chat", icon: MessageSquare },
  { label: "너트", href: "/groups", icon: Users },
  { label: "볼트", href: "/projects", icon: Rocket },
  { label: "알림", href: "/notifications", icon: Bell },
];

export function AppBottomTabs({ notifCount = 0 }: { notifCount?: number }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  return (
    <nav
      aria-label="하단 빠른 이동"
      className="md:hidden fixed bottom-0 left-0 right-0 z-[450] border-t-[2.5px] border-nu-ink bg-nu-paper/95 backdrop-blur-sm print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = isActive(t.href);
          const Icon = t.icon;
          const showBadge = t.href === "/notifications" && notifCount > 0;
          return (
            <Link
              key={t.href}
              href={t.href}
              prefetch
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] no-underline transition-colors ${
                active ? "text-nu-pink" : "text-nu-graphite hover:text-nu-ink"
              }`}
            >
              {active && (
                <span
                  className="absolute top-0 left-2 right-2 h-[3px] bg-nu-pink"
                  aria-hidden
                />
              )}
              <div className="relative">
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-nu-pink text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </div>
              <span className={`font-mono-nu text-[9px] uppercase tracking-[0.08em] ${active ? "font-bold" : ""}`}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** 프로필 탭만 포함한 변형 — 필요 시 별도 배치 */
export function ProfileBottomHint() {
  const pathname = usePathname();
  const active = pathname === "/profile" || pathname.startsWith("/profile/");
  return (
    <Link
      href="/profile"
      aria-current={active ? "page" : undefined}
      className={`md:hidden fixed right-3 bottom-[72px] z-[440] w-12 h-12 rounded-full flex items-center justify-center border-[2.5px] ${
        active ? "bg-nu-pink text-nu-paper border-nu-pink" : "bg-nu-paper text-nu-ink border-nu-ink"
      }`}
      aria-label="내 프로필"
      style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
    >
      <UserIcon size={18} />
    </Link>
  );
}
