"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home,
  CheckSquare,
  Target,
  Calendar,
  FolderOpen,
  CreditCard,
  Activity,
  Settings,
} from "lucide-react";

/**
 * ProjectTopNav — 볼트 상단 가로 sticky 네비게이션 (너트의 GroupSubNav 와 동일 패턴).
 *
 * 동작: ?tab= 쿼리스트링으로 TabsInner 의 activeTab 동기화.
 *  - tabs-inner.tsx 가 useSearchParams().get("tab") 으로 이미 읽고 있음.
 *  - 페이지 새로고침 없이 탭 전환 (next/link prefetch + URL 갱신).
 *
 * 풀-페이지 사용 가능 — 사이드 그리드 X, 탭바 + 본문만.
 */
interface Props {
  projectId: string;
  projectTitle: string;
  isAdmin?: boolean;
}

// 핵심 메뉴 — "탭" 은 폐지 (페이지는 홈에 통합).
// 너트의 탭/위키 은 별개 시스템이라 너트는 그대로, 볼트 탭바에서만 wiki 제거.
const NAV_ITEMS = [
  { key: "overview", label: "홈", icon: Home },
  { key: "meetings", label: "일정", icon: Calendar },
  { key: "resources", label: "자료실", icon: FolderOpen },
  { key: "finance", label: "정산", icon: CreditCard },
  // 볼트 전용 — 작업 관리 (key 는 TabsInner 의 activeTab 과 정확히 일치해야 함)
  { key: "activity", label: "활동", icon: Activity },
  { key: "kanban", label: "할 일", icon: CheckSquare },
  { key: "milestones", label: "마일스톤", icon: Target },
];

export function ProjectTopNav({ projectId, projectTitle, isAdmin = false }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = `/projects/${projectId}`;
  const currentTab = searchParams.get("tab") || "overview";

  function isActive(key: string): boolean {
    return pathname === basePath && currentTab === key;
  }

  return (
    <nav className="bg-white border-b-[3px] border-nu-ink/15 sticky top-[60px] z-[100] shadow-md">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide -mb-[2px]">
          {/* Project title */}
          <Link
            href={basePath}
            className="shrink-0 font-head text-sm font-bold text-nu-ink no-underline mr-2 py-3.5 hover:text-nu-pink transition-colors truncate max-w-[120px] sm:max-w-[200px]"
            title={projectTitle}
          >
            {projectTitle}
          </Link>

          <div className="w-px h-6 bg-nu-ink/15 mr-1 shrink-0" />

          {/* Nav items */}
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.key);
            const Icon = item.icon;
            const href = item.key === "overview" ? basePath : `${basePath}?tab=${item.key}`;
            return (
              <Link
                key={item.key}
                href={href}
                scroll={false}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-4 sm:py-3.5 font-mono-nu text-[12px] uppercase tracking-widest no-underline transition-all border-b-[3px] ${
                  active
                    ? "text-nu-pink border-nu-pink font-bold bg-nu-pink/5"
                    : "text-nu-muted border-transparent hover:text-nu-ink hover:border-nu-ink/20 hover:bg-nu-cream/30"
                }`}
              >
                <Icon size={13} />
                {item.label}
              </Link>
            );
          })}

          {/* Settings (admin only) */}
          {isAdmin && (
            <Link
              href={`${basePath}?tab=settings`}
              scroll={false}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-4 sm:py-3.5 font-mono-nu text-[12px] uppercase tracking-widest no-underline transition-all border-b-[3px] ${
                isActive("settings")
                  ? "text-nu-pink border-nu-pink font-bold bg-nu-pink/5"
                  : "text-nu-muted border-transparent hover:text-nu-ink hover:border-nu-ink/20 hover:bg-nu-cream/30"
              }`}
            >
              <Settings size={13} />
              설정
            </Link>
          )}

          <div className="md:hidden shrink-0 w-4 h-full bg-gradient-to-l from-white to-transparent pointer-events-none" />
        </div>
      </div>
    </nav>
  );
}
