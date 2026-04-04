import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const navItems = [
    { label: "대시보드", href: "/admin" },
    { label: "콘텐츠 관리", href: "/admin/content" },
    { label: "회원 관리", href: "/admin/users" },
    { label: "소모임 관리", href: "/admin/groups" },
  ];

  return (
    <div className="min-h-screen bg-nu-paper">
      <nav className="fixed top-0 left-0 right-0 z-[500] h-[60px] flex items-center justify-between px-8 glass border-b border-nu-ink/[0.12]">
        <div className="flex items-center gap-6">
          <Link href="/" className="no-underline">
            <span className="font-head text-[15px] font-extrabold text-nu-ink tracking-tight">
              nutunion
            </span>
          </Link>
          <span className="font-mono-nu text-[10px] uppercase tracking-widest bg-nu-pink text-white px-2.5 py-1">
            Admin
          </span>
        </div>
        <div className="flex gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-mono-nu text-[11px] text-nu-graphite no-underline tracking-[0.08em] uppercase opacity-70 hover:opacity-100 transition-opacity"
            >
              {item.label}
            </Link>
          ))}
        </div>
        <Link
          href="/dashboard"
          className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray no-underline hover:text-nu-ink"
        >
          ← 사이트로
        </Link>
      </nav>
      <div className="pt-[60px]">{children}</div>
    </div>
  );
}
