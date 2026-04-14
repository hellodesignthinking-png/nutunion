"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

interface StaffNavClientProps {
  navItems: { label: string; href: string }[];
  staffName: string;
}

export function StaffNavClient({ navItems, staffName }: StaffNavClientProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/staff") return pathname === "/staff";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-[500] glass border-b border-nu-ink/[0.12]">
      <div className="h-[60px] flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="no-underline">
            <span className="font-head text-[15px] font-extrabold text-nu-ink tracking-tight">
              nutunion
            </span>
          </Link>
          <span className="font-mono-nu text-[10px] uppercase tracking-widest bg-indigo-600 text-white px-2.5 py-1">
            Staff
          </span>
        </div>

        <div className="hidden md:flex gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`font-mono-nu text-[11px] no-underline tracking-[0.08em] uppercase transition-all ${
                isActive(item.href)
                  ? "text-indigo-600 font-bold opacity-100"
                  : "text-nu-graphite opacity-70 hover:opacity-100"
              }`}
            >
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
            className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray no-underline hover:text-nu-ink"
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
        <div className="md:hidden border-t border-nu-ink/[0.08] bg-nu-paper/95 backdrop-blur-lg px-8 py-4 flex flex-col gap-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`font-mono-nu text-[12px] no-underline tracking-[0.08em] uppercase py-2 transition-all ${
                isActive(item.href)
                  ? "text-indigo-600 font-bold"
                  : "text-nu-graphite opacity-70"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <div className="border-t border-nu-ink/[0.06] pt-3 mt-1 flex items-center justify-between">
            <span className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest">
              {staffName}
            </span>
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray no-underline hover:text-nu-ink"
            >
              &larr; 사이트로
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
