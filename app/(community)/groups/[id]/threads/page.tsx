import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ThreadsManager } from "@/components/threads/threads-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thread 관리 — 너트 · nutunion" };

export default async function GroupThreadsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/groups/${id}/threads`);

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, host_id")
    .eq("id", id)
    .maybeSingle();
  if (!group) notFound();

  const { data: gm } = await supabase
    .from("group_members")
    .select("role, status")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const isHost = group.host_id === user.id;
  const isModerator = gm?.status === "active" && gm?.role === "moderator";
  const canManage = isHost || isModerator;

  return (
    <div className="reader-shell min-h-screen">
      <div className="max-w-[960px] mx-auto px-4 md:px-6 py-8 space-y-6">
        <Link href={`/groups/${id}`} className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-ink no-underline">
          <ArrowLeft size={11} /> {group.name}
        </Link>

        <header>
          <p className="reader-meta">너트 · Module Lattice</p>
          <h1 className="reader-h1 mt-0.5">🧩 Thread 관리</h1>
          <p className="reader-meta mt-1">
            이 너트에 설치된 Thread 들을 관리해요. 드래그/↑↓ 로 순서를 바꾸고, 제거/추가가 가능합니다.
            {!canManage && " (호스트/모더레이터만 변경 가능)"}
          </p>
        </header>

        <ThreadsManager
          targetType="nut"
          targetId={id}
          currentUserId={user.id}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
