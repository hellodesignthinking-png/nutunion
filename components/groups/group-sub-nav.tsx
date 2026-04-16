"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FolderOpen,
  CreditCard,
  Sparkles,
  Trophy,
  Settings,
  Home,
  Calendar,
} from "lucide-react";

interface GroupSubNavProps {
  groupId: string;
  groupName: string;
  isHost?: boolean;
  isManager?: boolean;
}

const NAV_ITEMS = [
  { key: "home", label: "홈", href: "", icon: Home },
  { key: "schedule", label: "일정", href: "/schedule", icon: Calendar },
  { key: "wiki", label: "탭", href: "/wiki", icon: Sparkles },
  { key: "resources", label: "자료실", href: "/resources", icon: FolderOpen },
  { key: "finance", label: "정산", href: "/finance", icon: CreditCard },
  { key: "best-practices", label: "베스트", href: "/best-practices", icon: Trophy },
];

export function GroupSubNav({ groupId, groupName, isHost = false, isManager = false }: GroupSubNavProps) {
  const pathname = usePathname();
  const basePath = `/groups/${groupId}`;

  function isActive(href: string) {
    if (href === "") {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    // "일정" tab also covers meetings routes
    if (href === "/schedule") {
      return pathname.startsWith(`${basePath}/schedule`) || pathname.startsWith(`${basePath}/meetings`);
    }
    return pathname.startsWith(`${basePath}${href}`);
  }

  return (
    <nav className="bg-white border-b-[3px] border-nu-ink/15 sticky top-[60px] z-[100] shadow-md">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide -mb-[2px]">
          {/* Group name */}
          <Link
            href={basePath}
            className="shrink-0 font-head text-sm font-bold text-nu-ink no-underline mr-2 py-3.5 hover:text-nu-pink transition-colors truncate max-w-[120px] sm:max-w-[200px]"
            title={groupName}
          >
            {groupName}
          </Link>

          <div className="w-px h-6 bg-nu-ink/15 mr-1 shrink-0" />

          {/* Nav items */}
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={`${basePath}${item.href}`}
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

          {/* Settings (host/manager only) */}
          {(isHost || isManager) && (
            <Link
              href={`${basePath}/settings`}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-4 sm:py-3.5 font-mono-nu text-[12px] uppercase tracking-widest no-underline transition-all border-b-[3px] ${
                isActive("/settings")
                  ? "text-nu-pink border-nu-pink font-bold bg-nu-pink/5"
                  : "text-nu-muted border-transparent hover:text-nu-ink hover:border-nu-ink/20 hover:bg-nu-cream/30"
              }`}
            >
              <Settings size={13} />
              설정
            </Link>
          )}

          {/* Mobile scroll fade indicator */}
          <div className="md:hidden shrink-0 w-4 h-full bg-gradient-to-l from-white to-transparent pointer-events-none" />
        </div>
      </div>
    </nav>
  );
}
