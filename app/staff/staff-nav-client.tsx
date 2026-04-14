"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, Home, FolderOpen, CheckSquare, FileText, Calendar } from "lucide-react";

interface StaffNavClientProps {
  navItems: { label: string; href: string }[];
  staffName: string;
}

const navIcons: Record<string, React.ReactNode> = {
  "/staff": <Home size={14} />,
  "/staff/workspace": <FolderOpen size={14} />,
  "/staff/tasks": <CheckSquare size={14} />,
  "/staff/files": <FileText size={14} />,
  "/staff/calendar": <Calendar size={14} />,
};

export function StaffNavClient({ navItems, staffName }: StaffNavClientProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // 라우트 변경 시 모바일 메뉴 자동 닫기
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/staff") return pathname === "/staff";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-[500] glass border-b border-nu-ink/[0.12]">
      <div className="h-[60px] flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-4">
          <Link href="/staff" className="no-underline flex items-center gap-2.5">
            <span className="font-head text-[15px] font-extrabold text-nu-ink tracking-tight">
              nutunion
            </span>
            <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-indigo-600 text-white px-2 py-0.5">
              Staff
            </span>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`font-mono-nu text-[11px] no-underline tracking-[0.08em] uppercase transition-all px-3 py-2 flex items-center gap-1.5 ${
                isActive(item.href)
                  ? "text-indigo-600 font-bold bg-indigo-50"
                  : "text-nu-graphite opacity-70 hover:opacity-100 hover:bg-nu-ink/[0.03]"
              }`}
            >
              {navIcons[item.href]}
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <span className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">
            {staffName}
          </span>
          <Link
            href="/dashboard"
            className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border border-nu-ink/15 text-nu-gray no-underline hover:text-nu-ink hover:border-nu-ink/30 transition-colors"
          >
            &larr; 사이트로
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-nu-ink bg-transparent border-none cursor-pointer"
          aria-label="메뉴 토글"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-nu-ink/[0.08] bg-nu-paper/95 backdrop-blur-lg px-6 py-3 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`font-mono-nu text-[12px] no-underline tracking-[0.08em] uppercase py-2.5 px-3 flex items-center gap-2 transition-all ${
                isActive(item.href)
                  ? "text-indigo-600 font-bold bg-indigo-50"
                  : "text-nu-graphite opacity-70"
              }`}
            >
              {navIcons[item.href]}
              {item.label}
            </Link>
          ))}
          <div className="border-t border-nu-ink/[0.06] pt-3 mt-2 flex items-center justify-between px-3">
            <span className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">
              {staffName}
            </span>
            <Link
              href="/dashboard"
              className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border border-nu-ink/15 text-nu-gray no-underline hover:text-nu-ink transition-colors"
            >
              &larr; 사이트로
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
