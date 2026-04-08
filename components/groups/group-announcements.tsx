import { createClient } from "@/lib/supabase/server";
import { Megaphone } from "lucide-react";
import Link from "next/link";

interface Announcement {
  id: string;
  content: string;
  author: {
    id: string;
    nickname: string;
    avatar_url: string | null;
  } | null;
  created_at: string;
}

export async function GroupAnnouncements({ groupId }: { groupId: string }) {
  try {
    const supabase = await createClient();

    const { data: announcements, error } = await supabase
      .from("crew_posts")
      .select("id, content, created_at, author:profiles!crew_posts_author_id_fkey(id, nickname, avatar_url)")
      .eq("group_id", groupId)
      .eq("type", "announcement")
      .order("created_at", { ascending: false })
      .limit(3);

    if (error || !announcements || announcements.length === 0) {
      return null;
    }

    return (
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone size={18} className="text-nu-amber" />
          <h2 className="font-head text-lg font-extrabold text-nu-ink">
            공지사항
          </h2>
        </div>

        <div className="space-y-3">
          {announcements.map((announcement: any) => (
            <div
              key={announcement.id}
              className="bg-nu-amber/5 border-l-4 border-nu-amber p-4"
            >
              <p className="text-sm text-nu-ink leading-relaxed mb-2">
                {announcement.content}
              </p>
              <div className="flex items-center gap-2 text-xs text-nu-muted">
                <span className="font-medium">
                  {announcement.author?.nickname || "—"}
                </span>
                <span>
                  {new Date(announcement.created_at).toLocaleDateString("ko", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  } catch (err) {
    console.error("GroupAnnouncements error:", err);
    return null;
  }
}
