"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sparkles, FileText, BookOpen, MessageSquare, TrendingUp, Clock, Flame } from "lucide-react";

export function DailyDigest({ groupId }: { groupId: string }) {
  const [digest, setDigest] = useState<{
    posts: number; meetings: number; resources: number; streak: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yISO = yesterday.toISOString();
      const tISO = today.toISOString();

      const [
        { count: postCount },
        { count: meetingCount },
        { count: resourceCount },
      ] = await Promise.all([
        supabase.from("crew_posts").select("id", { count: "exact", head: true })
          .eq("group_id", groupId).gte("created_at", yISO).lt("created_at", tISO),
        supabase.from("meetings").select("id", { count: "exact", head: true })
          .eq("group_id", groupId).gte("scheduled_at", yISO).lt("scheduled_at", tISO),
        supabase.from("file_attachments").select("id", { count: "exact", head: true })
          .eq("target_type", "group").eq("target_id", groupId).gte("created_at", yISO).lt("created_at", tISO),
      ]);

      // Calculate streak (consecutive active days)
      let streak = 0;
      for (let i = 1; i <= 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStart = new Date(d); dStart.setHours(0,0,0,0);
        const dEnd = new Date(d); dEnd.setHours(23,59,59,999);
        const { count: dayActivity } = await supabase.from("crew_posts")
          .select("id", { count: "exact", head: true })
          .eq("group_id", groupId)
          .gte("created_at", dStart.toISOString())
          .lte("created_at", dEnd.toISOString());
        if ((dayActivity || 0) > 0) streak++; else break;
      }

      setDigest({
        posts: postCount || 0,
        meetings: meetingCount || 0,
        resources: resourceCount || 0,
        streak,
      });
    }
    load();
  }, [groupId]);

  if (!digest) return null;
  
  const totalYesterday = digest.posts + digest.meetings + digest.resources;
  if (totalYesterday === 0 && digest.streak === 0) return null;

  return (
    <div className="relative bg-gradient-to-r from-nu-ink via-nu-ink to-nu-ink/95 text-nu-paper border-[2px] border-nu-ink overflow-hidden mb-8">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-nu-pink/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-nu-blue/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative px-6 py-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-nu-pink" />
          <span className="font-mono-nu text-[11px] font-black uppercase tracking-[0.25em] text-nu-pink">
            Daily_Digest · Yesterday
          </span>
          {digest.streak > 0 && (
            <span className="ml-auto flex items-center gap-1 font-mono-nu text-[11px] font-bold text-nu-amber">
              <Flame size={10} /> {digest.streak}일 연속 활동 중
            </span>
          )}
        </div>

        {totalYesterday > 0 ? (
          <>
            <p className="text-sm font-medium leading-relaxed opacity-90 mb-4">
              어제 우리 팀은{" "}
              {digest.posts > 0 && <><span className="text-nu-pink font-bold">{digest.posts}건</span>의 소통을 나누고 </>}
              {digest.meetings > 0 && <><span className="text-nu-blue font-bold">{digest.meetings}회</span>의 미팅을 진행했으며 </>}
              {digest.resources > 0 && <><span className="text-nu-amber font-bold">{digest.resources}건</span>의 자료를 축적</>}
              했습니다.
            </p>
            <div className="flex items-center gap-4">
              {[
                { icon: MessageSquare, count: digest.posts, label: "게시글", color: "text-nu-pink" },
                { icon: BookOpen, count: digest.meetings, label: "미팅", color: "text-nu-blue" },
                { icon: FileText, count: digest.resources, label: "자료", color: "text-nu-amber" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <item.icon size={12} className={item.color} />
                  <span className="font-mono-nu text-[12px] font-bold">{item.count}</span>
                  <span className="font-mono-nu text-[11px] text-nu-paper/50 uppercase tracking-widest">{item.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm opacity-70">
            어제는 조용한 하루였습니다. 오늘 새로운 기록을 시작해볼까요? 🚀
          </p>
        )}
      </div>
    </div>
  );
}
