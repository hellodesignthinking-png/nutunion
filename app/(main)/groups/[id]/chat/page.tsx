"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ChatRoom } from "@/components/chat/chat-room";
import { ExternalLinks } from "@/components/integrations/external-links";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function CrewChatPage() {
  const params = useParams();
  const groupId = params.id as string;
  const [group, setGroup] = useState<any>(null);
  const [userId, setUserId] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("nickname").eq("id", user.id).single();
      setNickname(profile?.nickname || "user");

      const { data: grp } = await supabase.from("groups").select("name, kakao_chat_url, google_drive_url").eq("id", groupId).single();
      setGroup(grp);
      setLoading(false);
    }
    load();
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-nu-muted" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      <Link href={`/groups/${groupId}`} className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted no-underline hover:text-nu-ink mb-6">
        <ArrowLeft size={14} /> {group?.name || "크루"}
      </Link>

      <h1 className="font-head text-2xl font-extrabold text-nu-ink mb-6">
        {group?.name} — 채팅
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <ChatRoom roomType="crew" roomId={groupId} userId={userId} userNickname={nickname} />
        </div>
        <div>
          <ExternalLinks
            kakaoUrl={group?.kakao_chat_url}
            driveUrl={group?.google_drive_url}
            label="외부 연동"
          />
        </div>
      </div>
    </div>
  );
}
