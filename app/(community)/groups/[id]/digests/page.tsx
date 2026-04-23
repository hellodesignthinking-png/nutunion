import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatDigestCreateModal } from "@/components/chat-digest/chat-digest-create-modal";
import { ChatDigestList, type ChatDigest } from "@/components/chat-digest/chat-digest-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "너트 회의록" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupDigestsPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/groups/${id}/digests`);

  // 너트 존재 + 이름
  const { data: group } = await supabase
    .from("groups")
    .select("id, name, description, host_id, kakao_chat_url")
    .eq("id", id)
    .maybeSingle();
  if (!group) notFound();

  // 권한: admin/staff / host / active member
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdminStaff = profile?.role === "admin" || profile?.role === "staff";
  const isHost = (group as { host_id?: string }).host_id === user.id;

  let isMember = isAdminStaff || isHost;
  if (!isMember) {
    const { data: m } = await supabase
      .from("group_members")
      .select("user_id, status")
      .eq("group_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    isMember = !!m && (m as { status?: string }).status === "active";
  }

  if (!isMember) {
    redirect(`/groups/${id}`);
  }

  const { data: digests } = await supabase
    .from("chat_digests")
    .select("*")
    .eq("entity_type", "group")
    .eq("entity_id", id)
    .order("created_at", { ascending: false });

  const items = (digests as ChatDigest[]) ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4">
        <Link
          href={`/groups/${id}`}
          className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline"
        >
          ← 너트로
        </Link>
      </div>

      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-1">
            Nut · Chat Digests
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink truncate">
            {(group as { name: string }).name}
          </h1>
          <p className="text-[12px] text-nu-graphite mt-1">
            오픈카톡 대화 내용을 AI 가 논의 / 결정 / 액션으로 자동 정리합니다.
          </p>
        </div>
        <ChatDigestCreateModal
          entityType="group"
          entityId={id}
          entityName={(group as { name: string }).name}
        />
      </div>

      {/* 빠른 시작 가이드 */}
      {items.length === 0 && (
        <section className="border-[2.5px] border-dashed border-nu-ink/30 bg-nu-cream/20 p-5 mb-6">
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink mb-2">
            💡 3단계 — 카톡 대화를 팀 지식으로
          </div>
          <ol className="text-[12px] text-nu-graphite leading-relaxed list-decimal pl-5 space-y-1">
            <li>오픈카톡방 → 메뉴 → <strong>대화 내용 내보내기</strong> → .txt 복사</li>
            <li>위 <strong>📝 카톡 회의록 정리</strong> 버튼 → 제목 + 대화 붙여넣기</li>
            <li>AI 가 논의 · 결정 · 액션 · 다음 주제 자동 추출 → 영구 기록</li>
          </ol>
          {/* 오픈카톡방 버튼 제거 — 내장 채팅 사용 */}
        </section>
      )}

      <ChatDigestList digests={items} canDelete={true} />
    </div>
  );
}
