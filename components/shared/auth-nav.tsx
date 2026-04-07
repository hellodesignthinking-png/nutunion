"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, LogOut, User, Shield, Menu, Settings, Star, Crown, Award } from "lucide-react";
import { GlobalSearch } from "@/components/shared/global-search";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "소모임", href: "/groups" },
  { label: "프로젝트", href: "/projects" },
  { label: "멤버", href: "/members" },
  { label: "알림", href: "/notifications" },
];

export function AuthNav({ profile }: { profile: Profile }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [open, setOpen]       = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const isAdmin = profile.role === "admin";

  // 실시간 알림 카운트
  useEffect(() => {
    const supabase = createClient();
    supabase.from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false)
      .then(({ count }) => setNotifCount(count || 0));

    const channel = supabase
      .channel("notif-nav")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        () => {
          supabase.from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", profile.id)
            .eq("is_read", false)
            .then(({ count }) => setNotifCount(count || 0));
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile.id]);

  // 등급 정보
  const p = profile as any;
  const gradeRaw = p.grade || (isAdmin ? "vip" : p.can_create_crew ? "silver" : "bronze");
  const GRADE_BADGE: Record<string, { label: string; cls: string; Icon: any }> = {
    admin:  { label: "관리자", cls: "bg-nu-pink text-white",             Icon: Shield },
    vip:    { label: "VIP",   cls: "bg-nu-pink/10 text-nu-pink",        Icon: Crown  },
    gold:   { label: "골드",  cls: "bg-yellow-50 text-yellow-600",      Icon: Star   },
    silver: { label: "실버",  cls: "bg-slate-100 text-slate-500",       Icon: Star   },
    bronze: { label: "브론즈",cls: "bg-amber-50 text-amber-600",        Icon: Award  },
  };
  const grade = GRADE_BADGE[isAdmin ? "admin" : gradeRaw] || GRADE_BADGE.bronze;
  const GIcon = grade.Icon;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initial = (profile.nickname || profile.name || "U").charAt(0).toUpperCase();

  return (
    <nav className="fixed top-0 left-0 right-0 z-[500] h-[60px] flex items-center justify-between px-8 glass border-b border-nu-ink/[0.12]">
      <Link href="/" className="no-underline">
        <span className="font-head text-[15px] font-extrabold text-nu-ink tracking-tight">
          nutunion
        </span>
      </Link>

      {/* Desktop links */}
      <div className="hidden md:flex gap-6 items-center">
        {navLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`font-mono-nu text-[11px] text-nu-graphite no-underline tracking-[0.08em] uppercase transition-opacity ${
              pathname === l.href ? "opacity-100 font-bold" : "opacity-70 hover:opacity-100"
            }`}
          >
            {l.label}
          </Link>
        ))}
        {/* Admin link - always visible for admin users */}
        {isAdmin && (
          <Link
            href="/admin"
            className={`font-mono-nu text-[11px] no-underline tracking-[0.08em] uppercase transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 ${
              pathname.startsWith("/admin")
                ? "bg-nu-pink text-white"
                : "text-nu-pink hover:bg-nu-pink/10"
            }`}
          >
            <Shield size={12} /> 관리자
          </Link>
        )}
      </div>

      {/* Right side */}
      <div className="hidden md:flex gap-2 items-center">
        <GlobalSearch />
        <Link href="/notifications" className="relative p-2 text-nu-graphite hover:text-nu-ink transition-colors">
          <Bell size={18} />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-nu-pink text-white text-[8px] font-bold rounded-full flex items-center justify-center">
              {notifCount > 9 ? "9+" : notifCount}
            </span>
          )}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="w-8 h-8 rounded-full bg-nu-pink text-white flex items-center justify-center font-head text-sm font-bold cursor-pointer">
            {initial}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              <p className="font-head text-sm font-bold">{profile.nickname}</p>
              <p className="text-xs text-nu-muted truncate">{profile.email}</p>
              <div className="mt-1.5">
                <span className={`inline-flex items-center gap-1 font-mono-nu text-[8px] uppercase tracking-widest px-1.5 py-0.5 ${grade.cls}`}>
                  <GIcon size={8} /> {grade.label}
                </span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex items-center gap-2" onClick={() => router.push("/profile")}>
              <User size={14} /> 프로필
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-2" onClick={() => router.push("/dashboard")}>
              <Settings size={14} /> 대시보드
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex items-center gap-2 text-nu-pink" onClick={() => router.push("/admin")}>
                  <Shield size={14} /> 관리자 페이지
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2" onClick={() => router.push("/admin/content")}>
                  콘텐츠 관리
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2" onClick={() => router.push("/admin/media")}>
                  미디어 관리
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2" onClick={() => router.push("/admin/users")}>
                  회원 관리
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-nu-red">
              <LogOut size={14} /> 로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="p-2">
            <Menu size={20} />
          </SheetTrigger>
          <SheetContent side="right" className="bg-nu-paper w-[280px]">
            <div className="flex flex-col gap-6 pt-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-nu-pink text-white flex items-center justify-center font-head font-bold">
                  {initial}
                </div>
                <div>
                  <p className="font-head text-sm font-bold">{profile.nickname}</p>
                  <p className="text-xs text-nu-muted">{profile.email}</p>
                </div>
              </div>
              <div className="border-t border-nu-ink/10 pt-4 flex flex-col gap-4">
                {navLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-graphite no-underline"
                  >
                    {l.label}
                  </Link>
                ))}
                <Link href="/profile" onClick={() => setOpen(false)} className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-graphite no-underline">
                  프로필
                </Link>
              </div>
              {isAdmin && (
                <div className="border-t border-nu-pink/20 pt-4 flex flex-col gap-3">
                  <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink font-bold">관리자</span>
                  <Link href="/admin" onClick={() => setOpen(false)} className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink no-underline">
                    관리자 대시보드
                  </Link>
                  <Link href="/admin/content" onClick={() => setOpen(false)} className="font-mono-nu text-[11px] text-nu-graphite no-underline">
                    콘텐츠 관리
                  </Link>
                  <Link href="/admin/media" onClick={() => setOpen(false)} className="font-mono-nu text-[11px] text-nu-graphite no-underline">
                    미디어 관리
                  </Link>
                  <Link href="/admin/users" onClick={() => setOpen(false)} className="font-mono-nu text-[11px] text-nu-graphite no-underline">
                    회원 관리
                  </Link>
                  <Link href="/admin/groups" onClick={() => setOpen(false)} className="font-mono-nu text-[11px] text-nu-graphite no-underline">
                    소모임 관리
                  </Link>
                  <Link href="/admin/projects" onClick={() => setOpen(false)} className="font-mono-nu text-[11px] text-nu-graphite no-underline">
                    프로젝트 관리
                  </Link>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-red text-left mt-2"
              >
                로그아웃
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
