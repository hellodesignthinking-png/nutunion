import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatDigestCreateModal } from "@/components/chat-digest/chat-digest-create-modal";
import { ChatDigestList, type ChatDigest } from "@/components/chat-digest/chat-digest-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 회의록" };

export default async function ProfileDigestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/profile/digests");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();

  const { data: digests } = await supabase
    .from("chat_digests")
    .select("*")
    .eq("entity_type", "member")
    .eq("entity_id", user.id)
    .order("created_at", { ascending: false });

  const items = (digests as ChatDigest[]) ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-4">
        <Link
          href="/profile"
          className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:text-nu-ink no-underline"
        >
          ← 프로필로
        </Link>
      </div>

      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-1">
            Nut · Personal Digests
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-nu-ink">
            내 회의록
          </h1>
          <p className="text-[12px] text-nu-graphite mt-1">
            본인에게 귀속된 대화 정리. 1:1 면담, 멘토링, 개인 프로젝트 회의 등.
          </p>
        </div>
        <ChatDigestCreateModal
          entityType="member"
          entityId={user.id}
          entityName={profile?.nickname ?? user.email ?? undefined}
        />
      </div>

      <ChatDigestList digests={items} canDelete={true} />
    </div>
  );
}
