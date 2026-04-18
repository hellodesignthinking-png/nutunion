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
} from "lucide-react";
import { APP_LINKS, STAFF_LINKS, ADMIN_LINKS } from "@/lib/nav-links";

interface Props {
  role?: string;
  /** 로그인 사용자의 role 이 staff/admin 이면 스태프/관리자 섹션 노출 */
  isStaff?: boolean;
  isAdmin?: boolean;
}

// lucide 아이콘 맵 (라벨 기반)
const ICON: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  대시보드: LayoutDashboard,
  너트: Users,
  볼트: Rocket,
  탭: BookOpen,
  와셔: Search,
  의뢰: Target,
  재무: DollarSign,
  스태프: Briefcase,
};

/**
 * 브루탈리스트 사이드바 — lg 이상에서 고정 좌측 240px.
 *
 * 디자인 DNA 유지:
 *   · 2.5px nu-ink 우측 경계선
 *   · font-mono-nu 업퍼케이스 라벨
 *   · 활성 시 nu-pink / nu-ink 강한 대비
 *
 * 실용성:
 *   · 고정 사이드바로 메뉴 위치 학습 0
 *   · 아이콘 + 라벨로 스캔 속도 향상
 */
export function AppSidebar({ isStaff, isAdmin }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  return (
    <aside
      aria-label="주 내비게이션"
      className="hidden lg:flex fixed left-0 top-[60px] bottom-0 w-[220px] z-[400] border-r-[2.5px] border-nu-ink bg-nu-paper/95 backdrop-blur-sm flex-col overflow-y-auto"
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
              className={`group flex items-center gap-3 px-5 py-2.5 font-mono-nu text-[12px] uppercase tracking-[0.1em] no-underline border-l-[4px] transition-colors ${
                active
                  ? "border-nu-pink bg-nu-ink/5 text-nu-ink font-bold"
                  : "border-transparent text-nu-graphite hover:border-nu-ink/30 hover:bg-nu-ink/5 hover:text-nu-ink"
              }`}
            >
              <Icon size={16} className={active ? "text-nu-pink" : ""} />
              <span>{l.label}</span>
            </Link>
          );
        })}

        {/* 스태프 섹션 */}
        {isStaff && (
          <>
            <Divider label="스태프" />
            {STAFF_LINKS.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  prefetch
                  className={`flex items-center gap-3 px-5 py-1.5 font-mono-nu text-[11px] uppercase tracking-[0.08em] no-underline border-l-[4px] transition-colors ${
                    active
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold"
                      : "border-transparent text-nu-graphite hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700"
                  }`}
                >
                  <span className="w-4" aria-hidden />
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </>
        )}

        {/* 관리자 섹션 */}
        {isAdmin && (
          <>
            <Divider label="관리자" icon={<Shield size={10} />} accent />
            {ADMIN_LINKS.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  prefetch
                  className={`flex items-center gap-3 px-5 py-1.5 font-mono-nu text-[11px] uppercase tracking-[0.08em] no-underline border-l-[4px] transition-colors ${
                    active
                      ? "border-nu-pink bg-nu-pink/5 text-nu-pink font-bold"
                      : "border-transparent text-nu-graphite hover:border-nu-pink/30 hover:bg-nu-pink/5 hover:text-nu-pink"
                  }`}
                >
                  <span className="w-4" aria-hidden />
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer 영역 — 간단 브랜드 뱃지 */}
      <div className="mt-auto px-5 py-3 border-t-[2px] border-nu-ink/10">
        <div className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-nu-graphite">
          nutunion
        </div>
        <div className="font-mono-nu text-[9px] text-nu-graphite mt-0.5">
          Protocol Collective
        </div>
      </div>
    </aside>
  );
}

function Divider({
  label,
  icon,
  accent,
}: {
  label: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="mt-4 px-5 py-1.5 border-t-[2px] border-nu-ink/10 flex items-center gap-1.5">
      {icon}
      <span
        className={`font-mono-nu text-[9px] uppercase tracking-[0.3em] ${
          accent ? "text-nu-pink" : "text-nu-graphite"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
