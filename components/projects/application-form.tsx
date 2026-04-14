"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Link as LinkIcon, Users } from "lucide-react";
import type { Group } from "@/lib/types";

interface ApplicationFormProps {
  projectId: string;
  userId: string;
  onSuccess?: () => void;
}

export default function ApplicationForm({
  projectId,
  userId,
  onSuccess,
}: ApplicationFormProps) {
  const [message, setMessage] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [crewId, setCrewId] = useState("");
  const [crews, setCrews] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCrews, setLoadingCrews] = useState(true);

  useEffect(() => {
    async function fetchCrews() {
      const supabase = createClient();

      // Fetch groups the user belongs to (as active member)
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id, groups:group_id(id, name)")
        .eq("user_id", userId)
        .eq("status", "active");

      if (memberships) {
        const userCrews = memberships
          .map((m: any) => m.groups)
          .filter(Boolean) as Group[];
        setCrews(userCrews);
      }

      setLoadingCrews(false);
    }

    fetchCrews();
  }, [userId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!message.trim()) {
      toast.error("지원 메시지를 작성해주세요");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.from("project_applications").insert({
        project_id: projectId,
        applicant_id: userId,
        crew_id: crewId || null,
        message: message.trim(),
        portfolio_url: portfolioUrl.trim() || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success("지원이 완료되었습니다!");
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "지원 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Message */}
      <div>
        <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
          지원 메시지 *
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="이 프로젝트에 참여하고 싶은 이유와 기여할 수 있는 점을 알려주세요"
          rows={6}
          className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors resize-none"
          required
        />
        <p className="mt-1 text-[11px] text-nu-muted">
          프로젝트 리드에게 전달됩니다
        </p>
      </div>

      {/* Portfolio URL */}
      <div>
        <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
          <LinkIcon size={12} className="inline mr-1" />
          포트폴리오 URL
        </label>
        <input
          type="url"
          value={portfolioUrl}
          onChange={(e) => setPortfolioUrl(e.target.value)}
          placeholder="https://your-portfolio.com"
          className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
        />
      </div>

      {/* Crew Select */}
      <div>
        <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
          <Users size={12} className="inline mr-1" />
          소속 너트 (선택)
        </label>
        {loadingCrews ? (
          <div className="flex items-center gap-2 text-sm text-nu-muted py-3">
            <Loader2 size={14} className="animate-spin" />
            너트 목록 불러오는 중...
          </div>
        ) : crews.length === 0 ? (
          <p className="text-sm text-nu-gray py-3">
            소속된 너트가 없습니다
          </p>
        ) : (
          <select
            value={crewId}
            onChange={(e) => setCrewId(e.target.value)}
            className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
          >
            <option value="">너트를 선택하지 않음</option>
            {crews.map((crew) => (
              <option key={crew.id} value={crew.id}>
                {crew.name}
              </option>
            ))}
          </select>
        )}
        <p className="mt-1 text-[11px] text-nu-muted">
          어떤 너트를 대표하여 참여하는지 알려주세요
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full font-mono-nu text-[11px] font-bold uppercase tracking-[0.1em] py-4 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" /> 지원 중...
          </>
        ) : (
          <>
            <Send size={14} /> 지원하기
          </>
        )}
      </button>
    </form>
  );
}
