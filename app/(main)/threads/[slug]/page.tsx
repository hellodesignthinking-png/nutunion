import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ThreadDetailClient } from "@/components/threads/thread-detail-client";

export const dynamic = "force-dynamic";

export default async function ThreadDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: thread, error } = await supabase
    .from("threads")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error && /relation .* does not exist/i.test(error.message)) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="border-[3px] border-amber-500 bg-amber-50 p-4 font-mono text-sm">migration 115 미적용</div>
      </div>
    );
  }
  if (!thread) notFound();

  // Reviews
  const { data: reviews } = await supabase
    .from("thread_reviews")
    .select("id, user_id, rating, comment, created_at, profile:profiles(id, nickname, avatar_url)")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const myReview = (reviews || []).find((r: any) => r.user_id === user.id) || null;

  // Public installations preview (target name, type only — no PII)
  const { data: insts } = await supabase
    .from("thread_installations")
    .select("id, target_type, target_id")
    .eq("thread_id", thread.id)
    .limit(10);

  const nutIds = (insts || []).filter((i: any) => i.target_type === "nut").map((i: any) => i.target_id);
  const boltIds = (insts || []).filter((i: any) => i.target_type === "bolt").map((i: any) => i.target_id);
  const { data: nuts } = nutIds.length
    ? await supabase.from("groups").select("id, name").in("id", nutIds)
    : { data: [] };
  const { data: bolts } = boltIds.length
    ? await supabase.from("projects").select("id, title").in("id", boltIds)
    : { data: [] };

  // Eligible targets (for install)
  const { data: gms } = await supabase
    .from("group_members")
    .select("group_id, role, groups:groups(id, name)")
    .eq("user_id", user.id)
    .eq("status", "active");
  const { data: pms } = await supabase
    .from("project_members")
    .select("project_id, role, projects:projects(id, title)")
    .eq("user_id", user.id);
  const userNuts = (gms || []).filter((m: any) => ["host", "moderator"].includes(m.role) && m.groups)
    .map((m: any) => ({ id: m.groups.id, name: m.groups.name }));
  const userBolts = (pms || []).filter((m: any) => m.role === "lead" && m.projects)
    .map((m: any) => ({ id: m.projects.id, name: m.projects.title }));

  // creator
  let creatorName = "nutunion 공식";
  if (thread.created_by) {
    const { data: prof } = await supabase.from("profiles").select("nickname").eq("id", thread.created_by).maybeSingle();
    if (prof?.nickname) creatorName = prof.nickname;
  }

  return (
    <div className="min-h-screen bg-nu-cream/20 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/threads" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink">
          ← Thread Store
        </Link>

        <header className="border-[3px] border-nu-ink bg-white p-6 shadow-[6px_6px_0_0_#0D0F14]">
          <div className="flex items-start gap-4">
            <div className="text-5xl">{thread.icon}</div>
            <div className="flex-1">
              <h1 className="font-head text-2xl font-extrabold text-nu-ink">{thread.name}</h1>
              <p className="text-sm font-mono text-nu-muted mt-1">{thread.description}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="border-[2px] border-nu-ink bg-nu-cream/40 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5">v{thread.version || "1.0.0"}</span>
                <span className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5">{thread.category}</span>
                {(thread.scope || []).map((s: string) => (
                  <span key={s} className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5">{s}</span>
                ))}
                {thread.is_core && <span className="border-[2px] border-nu-pink bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest font-bold px-2 py-0.5">core</span>}
              </div>
              <div className="text-xs font-mono text-nu-muted mt-3">
                제작자: {creatorName} · 📥 {thread.install_count} 설치 · ⭐ {thread.avg_rating ? Number(thread.avg_rating).toFixed(1) : "—"}
              </div>
            </div>
          </div>
        </header>

        <ThreadDetailClient
          thread={thread as any}
          reviews={(reviews as any) || []}
          myReview={myReview as any}
          currentUserId={user.id}
          installPreview={{
            nuts: (nuts as any) || [],
            bolts: ((bolts as any) || []).map((b: any) => ({ id: b.id, name: b.title })),
          }}
          userNuts={userNuts}
          userBolts={userBolts}
        />
      </div>
    </div>
  );
}
