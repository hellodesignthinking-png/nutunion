"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  /** 정확히 하나만 제공 */
  projectId?: string;
  groupId?: string;
  userId?: string;
  label?: string;
  className?: string;
  /** 커스텀 렌더링 — 있으면 label/className 무시 */
  children?: React.ReactNode;
}

export function OpenChatButton({ projectId, groupId, userId, label = "채팅방 열기", className, children }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    try {
      const body: any = {};
      if (projectId) body.project_id = projectId;
      else if (groupId) body.group_id = groupId;
      else if (userId) body.dm_target = userId;
      else throw new Error("대상 미지정");

      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.room_id) throw new Error(data.error || "방 열기 실패");
      router.push(`/chat?room=${data.room_id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (children) {
    return (
      <button onClick={open} disabled={loading} className={className} aria-busy={loading}>
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={open}
      disabled={loading}
      className={
        className ||
        "inline-flex items-center gap-1.5 px-3 py-1.5 border-[1.5px] border-nu-ink/15 hover:bg-nu-ink hover:text-white rounded text-[12px] font-mono-nu uppercase tracking-widest transition-colors disabled:opacity-50"
      }
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
      {label}
    </button>
  );
}
