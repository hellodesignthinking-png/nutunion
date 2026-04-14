"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Menu, LogOut, Bell, Shield, Search, Command } from "lucide-react";
import { getGrade, GRADE_CONFIG } from "@/lib/constants";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import { NotificationCenter } from "@/components/shared/notification-center";

// ── 랜딩 전용 링크 (비로그인) ──────────────────────────────────────
const landingLinks = [
  { label: "About",    href: "/#about"   },
  { label: "너트",     href: "/groups"   },
  { label: "볼트",     href: "/projects" },
  { label: "Scenes",   href: "/#scenes"  },
];

const appLinks = [
  { label: "대시보드",  href: "/dashboard"    },
  { label: "너트",      href: "/groups"       },
  { label: "볼트",      href: "/projects"     },
  { label: "탭",        href: "/wiki"         },
  { label: "와셔",      href: "/members"      },
  { label: "의뢰",      href: "/challenges"   },
];

export function Nav() {
  const [user,       setUser]       = useState<any>(null);
  const [profile,    setProfile]    = useState<any>(null);
  const [notifCount, setNotifCount] = useState(0);
  const [open,       setOpen]       = useState(false);
  const [scrolled,   setScrolled]   = useState(false);
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });

    const supabase = createClient();
    let notifChannel: any = null;

    // auth 상태 + 프로필 로드
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      setUser(u);
      if (u) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, nickname, email, role, grade, can_create_crew")
          .eq("id", u.id)
          .single();
        setProfile(p);

        // 미읽은 알림 수 (초기 로드)
        const fetchNotifCount = async () => {
          const { count } = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", u.id)
            .eq("is_read", false);
          setNotifCount(count || 0);
        };
        await fetchNotifCount();

        // Realtime 구독으로 알림 수 갱신
        const channel = supabase
          .channel(`nav-notifs-${u.id}`)
          .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${u.id}`,
          }, () => { fetchNotifCount(); })
          .subscribe();

        notifChannel = channel;
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
      if (!session?.user) { setProfile(null); setNotifCount(0); }
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      subscription.unsubscribe();
      if (notifChannel) supabase.removeChannel(notifChannel);
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const links      = user ? appLinks : landingLinks;
  const isAdmin    = profile?.role === "admin";
  const grade      = profile ? getGrade(profile) : GRADE_CONFIG.bronze;
  const GIcon      = grade.icon;
  const initial    = (profile?.nickname || "U").charAt(0).toUpperCase();

  function getHref(href: string) {
    if (pathname === "/" && href.startsWith("/#")) return href.replace("/", "");
    return href;
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[500] h-[60px] flex items-center justify-between px-8 bg-nu-paper/95 backdrop-blur-sm border-b-[3px] border-nu-ink transition-shadow`}>
      {/* Brand */}
      <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 no-underline relative group">
        <span className="font-head text-[17px] font-extrabold text-nu-ink tracking-tight uppercase">
          nutunion
        </span>
        <span className="absolute inset-0 font-head text-[17px] font-extrabold text-nu-pink tracking-tight uppercase opacity-0 group-hover:opacity-30 translate-x-[2px] -translate-y-[1px] transition-opacity pointer-events-none select-none mix-blend-multiply" aria-hidden>
          nutunion
        </span>
      </Link>

      {/* Desktop links */}
      <div className="hidden md:flex gap-6 items-center">
        {links.map((l) => (
          <Link
            key={l.label}
            href={getHref(l.href)}
            prefetch={true}
            className={`font-mono-nu text-[11px] no-underline tracking-[0.1em] uppercase transition-all relative ${
              pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href) && l.href.length > 1)
                ? "text-nu-ink font-bold"
                : "text-nu-graphite opacity-70 hover:opacity-100"
            }`}
          >
            {l.label}
            {(pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href) && l.href.length > 1)) && (
              <span className="absolute -bottom-[20px] left-0 right-0 h-[3px] bg-nu-pink" />
            )}
          </Link>
        ))}
        {isAdmin && (
          <Link
            href="/admin"
            prefetch={true}
            className={`font-mono-nu text-[11px] no-underline tracking-[0.08em] uppercase transition-colors inline-flex items-center gap-1.5 px-3 py-1.5 ${
              pathname.startsWith("/admin") ? "bg-nu-pink text-white" : "text-nu-pink hover:bg-nu-pink/10"
            }`}
          >
            <Shield size={12} /> 관리자
          </Link>
        )}
      </div>

      {/* Desktop right */}
      <div className="hidden md:flex gap-2 items-center">
        {user ? (
          <>
            {/* ⌘K 검색 */}
            <button
              onClick={() => { const e = new KeyboardEvent('keydown', { key: 'k', metaKey: true }); window.dispatchEvent(e); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-nu-muted hover:text-nu-ink bg-nu-cream/30 border border-nu-ink/10 transition-colors"
              title="검색 (⌘K)"
              aria-label="검색"
            >
              <Search size={13} />
              <kbd className="font-mono-nu text-[8px] text-nu-muted">⌘K</kbd>
            </button>
            {/* 알림 센터 (드롭다운) */}
            <NotificationCenter />
            {/* 아바타 드롭다운 대신 간단 버튼 */}
            <Link
              href="/profile"
              prefetch={true}
              className="w-8 h-8 rounded-full bg-nu-pink text-white flex items-center justify-center font-head text-sm font-bold cursor-pointer hover:bg-nu-pink/80 transition-colors no-underline"
              title={profile?.nickname}
              aria-label="내 프로필"
            >
              {initial}
            </Link>
            <button
              onClick={handleLogout}
              className="p-2.5 border-[2px] border-transparent text-nu-graphite hover:border-nu-graphite transition-all"
              aria-label="Logout"
            >
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 border-[2px] border-nu-graphite text-nu-graphite bg-transparent hover:bg-nu-graphite hover:text-nu-paper transition-all no-underline"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="font-mono-nu text-[11px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 border-[2px] border-nu-pink bg-nu-pink text-nu-paper hover:bg-nu-ink hover:border-nu-ink transition-all no-underline"
            >
              Join
            </Link>
          </>
        )}
      </div>

      {/* Mobile menu */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="p-2 border-[2px] border-nu-ink" aria-label="메뉴 열기">
            <Menu size={20} />
          </SheetTrigger>
          <SheetContent side="right" className="bg-nu-paper w-[280px] border-l-[3px] border-nu-ink">
            <div className="flex flex-col gap-6 pt-8">
              {user && profile ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-nu-pink text-white flex items-center justify-center font-head font-bold">
                    {initial}
                  </div>
                  <div>
                    <p className="font-head text-sm font-bold">{profile.nickname}</p>
                    <span className={`inline-flex items-center gap-1 font-mono-nu text-[8px] uppercase tracking-widest px-1.5 py-0.5 ${grade.cls}`}>
                      <GIcon size={8} /> {grade.label}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="font-head text-xl font-extrabold uppercase tracking-tight">nutunion</span>
              )}

              <div className="border-t border-nu-ink/10 pt-4 flex flex-col gap-4">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={getHref(l.href)}
                    onClick={() => setOpen(false)}
                    prefetch={true}
                    className={`font-mono-nu text-[12px] uppercase tracking-widest no-underline border-b border-nu-ink/10 pb-2 ${
                      pathname === l.href ? "text-nu-ink font-bold" : "text-nu-graphite"
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
                {user && (
                  <>
                    <Link
                      key="notifications"
                      href="/notifications"
                      onClick={() => setOpen(false)}
                      prefetch={true}
                      className={`font-mono-nu text-[12px] uppercase tracking-widest no-underline border-b border-nu-ink/10 pb-2 text-nu-graphite flex items-center justify-between`}
                    >
                      알림
                      {notifCount > 0 && (
                        <span className="w-5 h-5 bg-nu-pink text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                          {notifCount > 9 ? "9+" : notifCount}
                        </span>
                      )}
                    </Link>
                    <Link href="/profile" onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-graphite no-underline border-b border-nu-ink/10 pb-2">
                      프로필
                    </Link>
                  </>
                )}
              </div>

              {isAdmin && (
                <div className="border-t border-nu-pink/20 pt-4 flex flex-col gap-3">
                  <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink font-bold">관리자</span>
                  {[
                    { href: "/admin", label: "관리자 대시보드" },
                    { href: "/admin/users", label: "회원 관리" },
                    { href: "/admin/groups", label: "너트 관리" },
                    { href: "/admin/projects", label: "볼트 관리" },
                    { href: "/admin/content", label: "콘텐츠 관리" },
                  ].map(a => (
                    <Link key={a.href} href={a.href} onClick={() => setOpen(false)} prefetch={true} className="font-mono-nu text-[11px] text-nu-graphite no-underline">
                      {a.label}
                    </Link>
                  ))}
                </div>
              )}

              <div className="border-t border-nu-ink/10 pt-4 flex flex-col gap-3">
                {user ? (
                  <button onClick={() => { handleLogout(); setOpen(false); }} className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-red text-left">
                    로그아웃
                  </button>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setOpen(false)} className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-center py-3 border-[2px] border-nu-graphite text-nu-graphite no-underline">
                      Login
                    </Link>
                    <Link href="/signup" onClick={() => setOpen(false)} className="font-mono-nu text-[11px] font-bold uppercase tracking-widest text-center py-3 bg-nu-pink text-nu-paper border-[2px] border-nu-pink no-underline">
                      Join
                    </Link>
                  </>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
