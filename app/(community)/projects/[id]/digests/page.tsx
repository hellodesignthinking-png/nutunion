import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatDigestCreateModal } from "@/components/chat-digest/chat-digest-create-modal";
import { ChatDigestList, type ChatDigest } from "@/components/chat-digest/chat-digest-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "볼트 회의록" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDigestsPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/projects/${id}/digests`);

  // 프로젝트 존재 + 이름
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, description")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  // 권한: admin/staff 또는 프로젝트 멤버만 열람
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";

  let isMember = isAdminStaff;
  if (!isMember) {
    const { data: m } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    isMember = !!m;
  }

  if (!isMember) {
    redirect(`/projects/${id}`);
  }

  // 디지스트 조회 (RLS 가 걸러줌)
  const { data: digests } = await supabase
    .from("chat_digests")
    .select("*")
    .eq("entity_type", "project")
    .eq("entity_id", id)
    .order("created_at", { ascending: false });

  const items = (digests as ChatDigest[]) ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4">
        <Link
          href={`/projects/${id}`}
          className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline"
        >
          ← 볼트로
        </Link>
      </div>

      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-1">
            Bolt · Discussion Digests
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink truncate">
            {project.title}
          </h1>
          <p className="text-[12px] text-nu-graphite mt-1">
            오픈카톡 / Slack 대화 기록을 AI 로 회의록·토론 정리로 변환.
          </p>
        </div>
        <ChatDigestCreateModal
          entityType="project"
          entityId={id}
          entityName={project.title}
        />
      </div>

      <ChatDigestList digests={items} canDelete={true} />
    </div>
  );
}
