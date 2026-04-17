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
import { Bell, LogOut, User, Shield, Menu, Settings, Briefcase, DollarSign } from "lucide-react";
import { getGrade } from "@/lib/constants";
import { GlobalSearch } from "@/components/shared/global-search";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// Unified with Nav component appLinks
const appLinks = [
  { label: "대시보드", href: "/dashboard" },
  { label: "너트", href: "/groups" },
  { label: "볼트", href: "/projects" },
  { label: "탭", href: "/wiki" },
  { label: "와셔", href: "/members" },
  { label: "의뢰", href: "/challenges" },
];

export function AuthNav({ profile }: { profile: Profile }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [open, setOpen]       = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const isAdmin = profile.role === "admin";
  const isStaff = profile.role === "staff" || isAdmin;

  // 알림 카운트 (Realtime 구독)
  useEffect(() => {
    const supabase = createClient();

    const fetchCount = () => {
      supabase.from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("is_read", false)
        .then(({ count }) => setNotifCount(count || 0));
    };
    fetchCount();

    const channel = supabase
      .channel(`auth-nav-notifs-${profile.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${profile.id}`,
      }, () => { fetchCount(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile.id]);

  // 등급 정보
  const grade = getGrade(profile as any);
  const GIcon = grade.icon;

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
        {appLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            prefetch={true}
            className={`font-mono-nu text-[13px] text-nu-graphite no-underline tracking-[0.08em] uppercase transition-opacity relative ${
              (pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href) && l.href.length > 1)) ? "text-nu-ink font-bold" : "opacity-70 hover:opacity-100"
            }`}
          >
            {l.label}
            {(pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href) && l.href.length > 1)) && (
              <span className="absolute -bottom-[20px] left-0 right-0 h-[3px] bg-nu-pink" />
            )}
          </Link>
        ))}
        {/* 재무 — 관리자/스태프 전용 */}
        {isStaff && (
          <Link
            href="/finance"
            prefetch={true}
            className={`font-mono-nu text-[13px] no-underline tracking-[0.08em] uppercase transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 ${
              pathname.startsWith("/finance")
                ? "bg-green-700 text-white"
                : "text-green-700 hover:bg-green-50"
            }`}
          >
            <DollarSign size={12} /> 재무
          </Link>
        )}
        {/* Admin link - always visible for admin users */}
        {isStaff && (
          <Link
            href="/staff"
            prefetch={true}
            className={`font-mono-nu text-[13px] no-underline tracking-[0.08em] uppercase transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 ${
              pathname.startsWith("/staff")
                ? "bg-indigo-600 text-white"
                : "text-indigo-600 hover:bg-indigo-50"
            }`}
          >
            <Briefcase size={12} /> 스태프
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin"
            prefetch={true}
            className={`font-mono-nu text-[13px] no-underline tracking-[0.08em] uppercase transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 ${
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
        <Link href="/notifications" prefetch={true} className="relative p-2 text-nu-graphite hover:text-nu-ink transition-colors" aria-label="알림">
          <Bell size={18} />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-nu-pink text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {notifCount > 9 ? "9+" : notifCount}
            </span>
          )}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="w-8 h-8 rounded-full bg-nu-pink text-white flex items-center justify-center font-head text-sm font-bold cursor-pointer" aria-label="내 메뉴">
            {initial}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              <p className="font-head text-sm font-bold">{profile.nickname}</p>
              <p className="text-xs text-nu-muted truncate">{profile.email}</p>
              <div className="mt-1.5">
                <span className={`inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 ${grade.cls}`}>
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
            {isStaff && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex items-center gap-2 text-indigo-600" onClick={() => router.push("/staff")}>
                  <Briefcase size={14} /> 스태프 워크스페이스
                </DropdownMenuItem>
              </>
            )}
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
          <SheetTrigger className="p-2" aria-label="메뉴 열기">
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
                {appLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    prefetch={true}
                    className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-graphite no-underline"
                  >
                    {l.label}
                  </Link>
                ))}
                <Link href="/notifications" onClick={() => setOpen(false)} prefetch={true}
                  className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-graphite no-underline flex items-center justify-between">
                  알림
                  {notifCount > 0 && (
                    <span className="w-5 h-5 bg-nu-pink text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                      {notifCount > 9 ? "9+" : notifCount}
                    </span>
                  )}
                </Link>
                <Link href="/profile" onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-graphite no-underline">
                  프로필
                </Link>
              </div>
              {isStaff && (
                <div className="border-t border-indigo-200 pt-4 flex flex-col gap-3">
                  <span className="font-mono-nu text-[11px] uppercase tracking-widest text-indigo-600 font-bold">스태프</span>
                  <Link href="/staff" onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[12px] uppercase tracking-widest text-indigo-600 no-underline">
                    스태프 대시보드
                  </Link>
                  <Link href="/staff/workspace" onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[13px] text-nu-graphite no-underline">
                    프로젝트
                  </Link>
                  <Link href="/staff/tasks" onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[13px] text-nu-graphite no-underline">
                    할일
                  </Link>
                  <Link href="/staff/files" onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[13px] text-nu-graphite no-underline">
                    파일
                  </Link>
                  <Link href="/staff/calendar" onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[13px] text-nu-graphite no-underline">
                    캘린더
                  </Link>
                </div>
              )}
              {isAdmin && (
                <div className="border-t border-nu-pink/20 pt-4 flex flex-col gap-3">
                  <span className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink font-bold">관리자</span>
                  <Link href="/admin" onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink no-underline">
                    관리자 대시보드
                  </Link>
                  <Link href="/admin/content" onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[13px] text-nu-graphite no-underline">
                    콘텐츠 관리
                  </Link>
                  <Link href="/admin/media" onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[13px] text-nu-graphite no-underline">
                    미디어 관리
                  </Link>
                  <Link href="/admin/users" onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[13px] text-nu-graphite no-underline">
                    회원 관리
                  </Link>
                  <Link href="/admin/groups" onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[13px] text-nu-graphite no-underline">
                    너트 관리
                  </Link>
                  <Link href="/admin/projects" onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[13px] text-nu-graphite no-underline">
                    볼트 관리
                  </Link>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="font-mono-nu text-[13px] uppercase tracking-widest text-nu-red text-left mt-2"
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
