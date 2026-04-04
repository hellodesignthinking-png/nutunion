"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const links = [
  { label: "About", href: "#about" },
  { label: "Groups", href: "#groups" },
  { label: "Join", href: "#join" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[500] h-[60px] flex items-center justify-between px-8 glass border-b border-nu-ink/[0.12] transition-shadow ${
        scrolled ? "shadow-sm" : ""
      }`}
    >
      <Link href="/" className="flex items-center gap-2 no-underline">
        <span className="font-head text-[15px] font-extrabold text-nu-ink tracking-tight">
          nutunion
        </span>
      </Link>

      {/* Desktop center links */}
      <div className="hidden md:flex gap-8 items-center">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="font-mono-nu text-[11px] text-nu-graphite no-underline tracking-[0.08em] uppercase opacity-70 hover:opacity-100 transition-opacity"
          >
            {l.label}
          </a>
        ))}
      </div>

      {/* Desktop right pills */}
      <div className="hidden md:flex gap-2 items-center">
        <Link
          href="/login"
          className="font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 border-[1.5px] border-nu-graphite text-nu-graphite bg-transparent hover:bg-nu-graphite hover:text-nu-paper transition-colors no-underline"
        >
          Login
        </Link>
        <Link
          href="/signup"
          className="font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 border-[1.5px] border-nu-pink bg-nu-pink text-nu-paper hover:bg-nu-graphite hover:border-nu-graphite transition-colors no-underline"
        >
          Join
        </Link>
      </div>

      {/* Mobile menu */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="p-2">
            <Menu size={20} />
          </SheetTrigger>
          <SheetContent side="right" className="bg-nu-paper w-[280px]">
            <div className="flex flex-col gap-6 pt-8">
              <span className="font-head text-xl font-extrabold">
                nutunion
              </span>
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-graphite no-underline"
                >
                  {l.label}
                </a>
              ))}
              <div className="border-t border-nu-ink/10 pt-4 flex flex-col gap-3">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-center py-3 border border-nu-graphite text-nu-graphite no-underline"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-center py-3 bg-nu-pink text-nu-paper no-underline"
                >
                  Join
                </Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
