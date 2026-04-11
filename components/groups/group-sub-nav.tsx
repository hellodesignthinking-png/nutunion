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
} from "lucide-react";

interface GroupSubNavProps {
  groupId: string;
  groupName: string;
  isHost?: boolean;
  isManager?: boolean;
}

const NAV_ITEMS = [
  { key: "home", label: "홈", href: "", icon: Home },
  { key: "meetings", label: "미팅", href: "/meetings", icon: BookOpen },
  { key: "wiki", label: "위키", href: "/wiki", icon: Sparkles },
  { key: "resources", label: "자료실", href: "/resources", icon: FolderOpen },
  { key: "finance", label: "정산", href: "/finance", icon: CreditCard },
  { key: "best-practices", label: "베스트", href: "/best-practices", icon: Trophy },
];

export function GroupSubNav({ groupId, groupName, isHost = false, isManager = false }: GroupSubNavProps) {
  const pathname = usePathname();
  const basePath = `/groups/${groupId}`;

  function isActive(href: string) {
    if (href === "") {
      // Home: exact match only
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname.startsWith(`${basePath}${href}`);
  }

  return (
    <nav className="bg-nu-white border-b border-nu-ink/[0.08] sticky top-[60px] z-30">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {/* Group name */}
          <Link
            href={basePath}
            className="shrink-0 font-head text-sm font-bold text-nu-ink no-underline mr-3 py-3 hover:text-nu-pink transition-colors"
          >
            {groupName}
          </Link>

          <div className="w-px h-5 bg-nu-ink/10 mr-1" />

          {/* Nav items */}
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={`${basePath}${item.href}`}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-3 font-mono-nu text-[10px] uppercase tracking-widest no-underline transition-all border-b-2 ${
                  active
                    ? "text-nu-pink border-nu-pink font-bold"
                    : "text-nu-muted border-transparent hover:text-nu-ink hover:border-nu-ink/20"
                }`}
              >
                <Icon size={12} />
                {item.label}
              </Link>
            );
          })}

          {/* Settings (host/manager only) */}
          {(isHost || isManager) && (
            <Link
              href={`${basePath}/settings`}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-3 font-mono-nu text-[10px] uppercase tracking-widest no-underline transition-all border-b-2 ${
                isActive("/settings")
                  ? "text-nu-pink border-nu-pink font-bold"
                  : "text-nu-muted border-transparent hover:text-nu-ink hover:border-nu-ink/20"
              }`}
            >
              <Settings size={12} />
              설정
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
