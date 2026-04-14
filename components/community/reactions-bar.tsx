"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Heart, ThumbsUp, Flame, Star } from "lucide-react";

const emojiList = [
  { emoji: "👍", icon: ThumbsUp, label: "좋아요" },
  { emoji: "❤️", icon: Heart, label: "하트" },
  { emoji: "🔥", icon: Flame, label: "불" },
  { emoji: "⭐", icon: Star, label: "별" },
];

interface ReactionsBarProps {
  targetType: "project_update" | "crew_post" | "comment" | "chat_message";
  targetId: string;
  userId: string;
}

export function ReactionsBar({ targetType, targetId, userId }: ReactionsBarProps) {
  const [reactions, setReactions] = useState<Record<string, { count: number; hasReacted: boolean }>>({});
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    loadReactions();
  }, [targetId, targetType, userId]);

  async function loadReactions() {
    const supabase = createClient();
    const { data } = await supabase
      .from("reactions")
      .select("emoji, user_id")
      .eq("target_type", targetType)
      .eq("target_id", targetId);

    const grouped: Record<string, { count: number; hasReacted: boolean }> = {};
    (data || []).forEach((r) => {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, hasReacted: false };
      grouped[r.emoji].count++;
      if (r.user_id === userId) grouped[r.emoji].hasReacted = true;
    });
    setReactions(grouped);
  }

  async function toggleReaction(emoji: string) {
    const supabase = createClient();
    const current = reactions[emoji];

    if (current?.hasReacted) {
      await supabase
        .from("reactions")
        .delete()
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .eq("user_id", userId)
        .eq("emoji", emoji);
    } else {
      await supabase.from("reactions").insert({
        target_type: targetType,
        target_id: targetId,
        user_id: userId,
        emoji,
      });
    }
    loadReactions();
    setShowPicker(false);
  }

  const activeReactions = Object.entries(reactions).filter(([, v]) => v.count > 0);

  return (
    <div className="flex items-center gap-1.5 mt-2 relative">
      {activeReactions.map(([emoji, data]) => (
        <button
          key={emoji}
          onClick={() => toggleReaction(emoji)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border transition-colors ${
            data.hasReacted
              ? "bg-nu-pink/10 border-nu-pink/30 text-nu-pink"
              : "bg-nu-cream/50 border-nu-ink/10 text-nu-muted hover:border-nu-ink/20"
          }`}
        >
          <span>{emoji}</span>
          <span className="font-mono-nu text-[9px]">{data.count}</span>
        </button>
      ))}

      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="w-6 h-6 flex items-center justify-center text-nu-muted hover:text-nu-pink hover:bg-nu-pink/5 rounded-full transition-colors text-xs"
          aria-label="이모지 추가"
        >
          +
        </button>
        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 bg-nu-white border border-nu-ink/10 shadow-lg p-1.5 flex gap-1 z-10">
            {emojiList.map((e) => (
              <button
                key={e.emoji}
                onClick={() => toggleReaction(e.emoji)}
                className="w-7 h-7 flex items-center justify-center hover:bg-nu-cream rounded transition-colors text-sm"
                title={e.label}
              >
                {e.emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
