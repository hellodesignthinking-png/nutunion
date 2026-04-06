"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const links = [
  { label: "About", href: "/#about" },
  { label: "Crews", href: "/crews" },
  { label: "Projects", href: "/projects" },
  { label: "Scenes", href: "/#scenes" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function getHref(href: string) {
    if (isHome && href.startsWith("/#")) return href.replace("/", "");
    return href;
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[500] h-[60px] flex items-center justify-between px-8 bg-nu-paper/95 backdrop-blur-sm border-b-[3px] border-nu-ink transition-shadow ${
        scrolled ? "" : ""
      }`}
    >
      {/* Brand — bold brutalist */}
      <Link href="/" className="flex items-center gap-2 no-underline relative group">
        <span className="font-head text-[17px] font-extrabold text-nu-ink tracking-tight uppercase">
          nutunion
        </span>
        {/* Overprint ghost on hover */}
        <span className="absolute inset-0 font-head text-[17px] font-extrabold text-nu-pink tracking-tight uppercase opacity-0 group-hover:opacity-30 translate-x-[2px] -translate-y-[1px] transition-opacity pointer-events-none select-none mix-blend-multiply" aria-hidden="true">
          nutunion
        </span>
      </Link>

      {/* Desktop center links */}
      <div className="hidden md:flex gap-6 items-center">
        {links.map((l) => (
          <Link
            key={l.label}
            href={getHref(l.href)}
            className={`font-mono-nu text-[11px] text-nu-graphite no-underline tracking-[0.1em] uppercase transition-all relative ${
              pathname === l.href ? "font-bold" : "opacity-70 hover:opacity-100"
            }`}
          >
            {l.label}
            {/* Active indicator — thick bottom bar */}
            {pathname === l.href && (
              <span className="absolute -bottom-[20px] left-0 right-0 h-[3px] bg-nu-pink" />
            )}
          </Link>
        ))}
      </div>

      {/* Desktop right pills — brutalist buttons */}
      <div className="hidden md:flex gap-2 items-center">
        <Link
          href="/login"
          className="font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 border-[2px] border-nu-graphite text-nu-graphite bg-transparent hover:bg-nu-graphite hover:text-nu-paper transition-all no-underline"
        >
          Login
        </Link>
        <Link
          href="/signup"
          className="font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 border-[2px] border-nu-pink bg-nu-pink text-nu-paper hover:bg-nu-ink hover:border-nu-ink transition-all no-underline hover:translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[-2px_2px_0_#FF48B0]"
        >
          Join
        </Link>
      </div>

      {/* Mobile menu */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="p-2 border-[2px] border-nu-ink">
            <Menu size={20} />
          </SheetTrigger>
          <SheetContent side="right" className="bg-nu-paper w-[280px] border-l-[3px] border-nu-ink">
            <div className="flex flex-col gap-6 pt-8">
              <span className="font-head text-xl font-extrabold uppercase tracking-tight">nutunion</span>
              {links.map((l) => (
                <Link
                  key={l.label}
                  href={getHref(l.href)}
                  onClick={() => setOpen(false)}
                  className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-graphite no-underline border-b-[2px] border-nu-ink/10 pb-2"
                >
                  {l.label}
                </Link>
              ))}
              <div className="border-t-[3px] border-nu-ink pt-4 flex flex-col gap-3">
                <Link href="/login" onClick={() => setOpen(false)} className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-center py-3 border-[2px] border-nu-graphite text-nu-graphite no-underline">
                  Login
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)} className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-center py-3 bg-nu-pink text-nu-paper border-[2px] border-nu-pink no-underline">
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
