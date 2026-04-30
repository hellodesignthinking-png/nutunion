import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ThreadsManager } from "@/components/threads/threads-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thread 관리 — 볼트 · nutunion" };

export default async function ProjectThreadsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/projects/${id}/threads`);

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: pm } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isLead = pm?.role === "lead";
  const isAdmin = prof?.role === "admin";
  const canManage = isLead || isAdmin;

  return (
    <div className="reader-shell min-h-screen">
      <div className="max-w-[960px] mx-auto px-4 md:px-6 py-8 space-y-6">
        <Link href={`/projects/${id}`} className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-ink no-underline">
          <ArrowLeft size={11} /> {project.title}
        </Link>

        <header>
          <p className="reader-meta">볼트 · Module Lattice</p>
          <h1 className="reader-h1 mt-0.5">🧩 Thread 관리</h1>
          <p className="reader-meta mt-1">
            이 볼트에 설치된 Thread 들을 관리해요. 드래그/↑↓ 로 순서를 바꾸고, 제거/추가가 가능합니다.
            {!canManage && " (리드 또는 관리자만 변경 가능)"}
          </p>
        </header>

        <ThreadsManager
          targetType="bolt"
          targetId={id}
          currentUserId={user.id}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
