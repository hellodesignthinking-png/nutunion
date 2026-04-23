"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Rocket,
  BookOpen,
  Search,
  Target,
  Shield,
  Briefcase,
  DollarSign,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { APP_LINKS, STAFF_LINKS, ADMIN_LINKS } from "@/lib/nav-links";
import { useSidebar } from "@/components/shared/sidebar-provider";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";

interface Props {
  role?: string;
  isStaff?: boolean;
  isAdmin?: boolean;
}

const ICON: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  대시보드: LayoutDashboard,
  너트: Users,
  볼트: Rocket,
  탭: BookOpen,
  와셔: Search,
  의뢰: Target,
  포트폴리오: LayoutDashboard,
  재무: DollarSign,
  스태프: Briefcase,
  "관리자 대시보드": Shield,
};

/**
 * 브루탈리스트 사이드바 — lg 이상에서 좌측 고정.
 * collapsed 상태 시 폭 60px (아이콘만), 펼친 상태 220px.
 * SidebarProvider (루트 레이아웃) 의 context 와 localStorage 로 상태 보존.
 */
export function AppSidebar({ isStaff, isAdmin }: Props) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  const width = collapsed ? "lg:w-[60px]" : "lg:w-[220px]";

  return (
    <aside
      aria-label="주 내비게이션"
      data-collapsed={collapsed ? "1" : "0"}
      className={`hidden lg:flex fixed left-0 top-[60px] bottom-0 ${width} z-[400] border-r-[2.5px] border-nu-ink bg-nu-paper/95 backdrop-blur-sm flex-col overflow-y-auto overflow-x-hidden transition-[width] duration-200`}
    >
      <nav className="flex flex-col py-3">
        {APP_LINKS.map((l) => {
          const Icon = ICON[l.label] ?? LayoutDashboard;
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              prefetch
              aria-current={active ? "page" : undefined}
              title={collapsed ? l.label : undefined}
              className={`group flex items-center gap-3 px-5 py-2.5 font-mono-nu text-[12px] uppercase tracking-[0.1em] no-underline border-l-[4px] transition-colors ${
                active
                  ? "border-nu-pink bg-nu-ink/5 text-nu-ink font-bold"
                  : "border-transparent text-nu-graphite hover:border-nu-ink/30 hover:bg-nu-ink/5 hover:text-nu-ink"
              } ${collapsed ? "justify-center px-0" : ""}`}
            >
              <Icon size={16} className={active ? "text-nu-pink" : ""} />
              {!collapsed && <span>{l.label}</span>}
            </Link>
          );
        })}

        {isStaff && (
          <>
            {!collapsed && <Divider label="스태프" />}
            {collapsed && <div className="mt-3 border-t-[2px] border-nu-ink/10" />}
            {STAFF_LINKS.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  prefetch
                  title={collapsed ? l.label : undefined}
                  className={`flex items-center gap-3 px-5 py-1.5 font-mono-nu text-[11px] uppercase tracking-[0.08em] no-underline border-l-[4px] transition-colors ${
                    active
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold"
                      : "border-transparent text-nu-graphite hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <Briefcase size={collapsed ? 14 : 12} />
                  {!collapsed && <span>{l.label}</span>}
                </Link>
              );
            })}
          </>
        )}

        {isAdmin && (
          <>
            {!collapsed && <Divider label="관리자" icon={<Shield size={10} />} accent />}
            {collapsed && <div className="mt-3 border-t-[2px] border-nu-ink/10" />}
            {ADMIN_LINKS.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  prefetch
                  title={collapsed ? l.label : undefined}
                  className={`flex items-center gap-3 px-5 py-1.5 font-mono-nu text-[11px] uppercase tracking-[0.08em] no-underline border-l-[4px] transition-colors ${
                    active
                      ? "border-nu-pink bg-nu-pink/5 text-nu-pink font-bold"
                      : "border-transparent text-nu-graphite hover:border-nu-pink/30 hover:bg-nu-pink/5 hover:text-nu-pink"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <Shield size={collapsed ? 14 : 12} />
                  {!collapsed && <span>{l.label}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* 하단: 토글 버튼 */}
      <div className="mt-auto border-t-[2px] border-nu-ink/10">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          className="w-full flex items-center gap-2 px-5 py-3 font-mono-nu text-[10px] uppercase tracking-[0.15em] text-nu-graphite hover:text-nu-ink hover:bg-nu-ink/5 transition-colors"
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          {!collapsed && <span>사이드바 접기</span>}
        </button>
        {!collapsed && (
          <div className="px-5 pb-3 flex items-center justify-between gap-2">
            <span className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-nu-graphite">
              nutunion
            </span>
            <LocaleSwitcher />
          </div>
        )}
      </div>
    </aside>
  );
}

function Divider({ label, icon, accent }: { label: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="mt-4 px-5 py-1.5 border-t-[2px] border-nu-ink/10 flex items-center gap-1.5">
      {icon}
      <span className={`font-mono-nu text-[9px] uppercase tracking-[0.3em] ${accent ? "text-nu-pink" : "text-nu-graphite"}`}>
        {label}
      </span>
    </div>
  );
}

/** 컨텐츠 영역에 적용할 padding 를 reactive 로 제공하는 래퍼 */
export function AppSidebarGutter({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-[60px]" : "lg:pl-[220px]"}`}>
      {children}
    </div>
  );
}
