"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, Link as LinkIcon, Users, Clock, Target, Tag, X } from "lucide-react";
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
  const [selfIntro, setSelfIntro] = useState("");
  const [motivation, setMotivation] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState(8);
  const [relevantSkills, setRelevantSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [crewId, setCrewId] = useState("");
  const [crews, setCrews] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCrews, setLoadingCrews] = useState(true);
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);

  useEffect(() => {
    async function fetchInit() {
      const supabase = createClient();

      const [{ data: memberships }, { data: profile }] = await Promise.all([
        supabase
          .from("group_members")
          .select("group_id, groups:group_id(id, name)")
          .eq("user_id", userId)
          .eq("status", "active"),
        supabase
          .from("profiles")
          .select("skill_tags, external_links")
          .eq("id", userId)
          .maybeSingle(),
      ]);

      if (memberships) {
        const userCrews = memberships
          .map((m: any) => m.groups)
          .filter(Boolean) as Group[];
        setCrews(userCrews);
      }

      // 프로필 스킬 태그가 있으면 기본 제안으로
      if (profile?.skill_tags && Array.isArray(profile.skill_tags)) {
        setSuggestedSkills(profile.skill_tags);
      }
      // 외부 포트폴리오 자동 프리필
      const links = profile?.external_links as Record<string, string> | null | undefined;
      if (links) {
        const firstLink = links.web || links.behance || links.notion || links.github;
        if (firstLink) setPortfolioUrl(firstLink);
      }

      setLoadingCrews(false);
    }

    fetchInit();
  }, [userId]);

  function addSkill(s: string) {
    const clean = s.trim().replace(/,$/, "");
    if (!clean) return;
    if (relevantSkills.includes(clean)) return;
    if (relevantSkills.length >= 8) {
      toast.error("스킬은 최대 8개까지");
      return;
    }
    setRelevantSkills([...relevantSkills, clean]);
    setSkillInput("");
  }

  function removeSkill(s: string) {
    setRelevantSkills(relevantSkills.filter((x) => x !== s));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selfIntro.trim() || selfIntro.trim().length < 30) {
      toast.error("자기소개를 30자 이상 작성해주세요");
      return;
    }
    if (!motivation.trim() || motivation.trim().length < 20) {
      toast.error("지원 사유를 20자 이상 작성해주세요");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const combinedMessage = `[자기소개]\n${selfIntro.trim()}\n\n[지원 사유]\n${motivation.trim()}\n\n[주당 시간]\n${hoursPerWeek}시간\n\n[관련 스킬]\n${relevantSkills.join(", ") || "—"}`;

      const { error } = await supabase.from("project_applications").insert({
        project_id: projectId,
        applicant_id: userId,
        crew_id: crewId || null,
        message: combinedMessage,         // 기존 호환성
        self_intro: selfIntro.trim(),
        motivation: motivation.trim(),
        hours_per_week: hoursPerWeek,
        relevant_skills: relevantSkills,
        portfolio_url: portfolioUrl.trim() || null,
        status: "pending",
      });

      if (error) {
        // 컬럼 누락 시 fallback — 메시지만 저장
        const { error: fallbackErr } = await supabase.from("project_applications").insert({
          project_id: projectId,
          applicant_id: userId,
          crew_id: crewId || null,
          message: combinedMessage,
          portfolio_url: portfolioUrl.trim() || null,
          status: "pending",
        });
        if (fallbackErr) throw fallbackErr;
      }

      toast.success("지원이 완료되었습니다!");

      // 볼트 채팅방에 시스템 메시지 + 리더 승인 카드 삽입
      try {
        const { data: proj } = await supabase
          .from("projects")
          .select("created_by, title")
          .eq("id", projectId)
          .maybeSingle();
        const { data: me } = await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", userId)
          .maybeSingle();
        const leadId = (proj as any)?.created_by;
        const projTitle = (proj as any)?.title || "볼트";
        const nick = (me as any)?.nickname || "지원자";
        if (leadId) {
          const { encodeAction } = await import("@/lib/chat/chat-actions");
          const content = encodeAction(
            {
              type: "project_application",
              project_id: projectId,
              applicant_id: userId,
              applicant_nick: nick,
              lead_id: leadId,
            },
            `${nick}님이 ${projTitle} 볼트에 지원했어요`,
          );
          await fetch("/api/chat/system-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project_id: projectId, content, ensure_room: true }),
          });
        }
      } catch {}

      onSuccess?.();
    } catch (err: unknown) {
      const __err = err as { message?: string };
      toast.error(__err.message || "지원 실패");
    } finally {
      setLoading(false);
    }
  }

  const selfIntroLen = selfIntro.trim().length;
  const motivationLen = motivation.trim().length;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 안내 배너 */}
      <div className="border-l-[3px] border-nu-pink bg-nu-pink/5 p-3">
        <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink font-bold mb-1">
          지원서 가이드
        </p>
        <p className="text-[12px] text-nu-graphite leading-relaxed">
          자기소개(30자↑), 지원 사유(20자↑), 주당 시간약속, 관련 스킬을 적어주세요. PM이 검토 후 <strong>승인/대기/반려</strong> 결정합니다.
        </p>
      </div>

      {/* Self Intro */}
      <div>
        <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
          자기소개 *
          <span className={`ml-2 font-normal ${selfIntroLen >= 30 ? "text-green-600" : "text-nu-muted"}`}>
            {selfIntroLen} / 30자
          </span>
        </label>
        <textarea
          value={selfIntro}
          onChange={(e) => setSelfIntro(e.target.value)}
          placeholder="예: UX 리서처로 3년째 활동 중입니다. 공공/문화 프로젝트 경험이 있고..."
          rows={3}
          maxLength={500}
          className="w-full px-4 py-3 bg-nu-white border-[2px] border-nu-ink/20 text-sm focus:outline-none focus:border-nu-pink transition-colors resize-none"
          required
        />
      </div>

      {/* Motivation */}
      <div>
        <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
          <Target size={12} className="inline mr-1" />
          지원 사유 — 왜 이 볼트인가 *
          <span className={`ml-2 font-normal ${motivationLen >= 20 ? "text-green-600" : "text-nu-muted"}`}>
            {motivationLen} / 20자
          </span>
        </label>
        <textarea
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          placeholder="이 프로젝트의 어떤 점에 공감했고, 내가 기여할 수 있는 지점은 무엇인지"
          rows={3}
          maxLength={400}
          className="w-full px-4 py-3 bg-nu-white border-[2px] border-nu-ink/20 text-sm focus:outline-none focus:border-nu-pink transition-colors resize-none"
          required
        />
      </div>

      {/* Hours per week */}
      <div>
        <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
          <Clock size={12} className="inline mr-1" />
          주당 투입 가능 시간 *
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={2}
            max={40}
            step={2}
            value={hoursPerWeek}
            onChange={(e) => setHoursPerWeek(Number(e.target.value))}
            className="flex-1 accent-nu-pink"
          />
          <span className="font-head text-lg font-extrabold text-nu-pink tabular-nums min-w-[60px] text-right">
            {hoursPerWeek}h
          </span>
        </div>
        <p className="mt-1 font-mono-nu text-[11px] text-nu-graphite">
          {hoursPerWeek < 5 ? "🌱 가볍게 참여" : hoursPerWeek < 12 ? "💪 적극 참여" : hoursPerWeek < 25 ? "🔥 핵심 멤버" : "⚡ 풀타임급 헌신"}
        </p>
      </div>

      {/* Relevant Skills */}
      <div>
        <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
          <Tag size={12} className="inline mr-1" />
          관련 스킬 (최대 8개)
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {relevantSkills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 font-mono-nu text-[11px] px-2 py-1 bg-nu-pink/10 border border-nu-pink/30 text-nu-pink">
              {s}
              <button type="button" onClick={() => removeSkill(s)} aria-label={`${s} 제거`} className="hover:text-nu-ink">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={skillInput}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",") || v.endsWith(" ")) addSkill(v);
            else setSkillInput(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSkill(skillInput);
            }
          }}
          placeholder="스킬 입력 후 Enter 또는 쉼표 (예: Figma, React, UX Research)"
          className="w-full px-4 py-2.5 bg-nu-white border-[2px] border-nu-ink/20 text-sm focus:outline-none focus:border-nu-pink transition-colors"
        />
        {suggestedSkills.length > 0 && (
          <div className="mt-2">
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">내 프로필 스킬: </span>
            <div className="inline-flex flex-wrap gap-1 mt-1">
              {suggestedSkills.filter((s) => !relevantSkills.includes(s)).slice(0, 8).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSkill(s)}
                  className="font-mono-nu text-[10px] px-1.5 py-0.5 border border-nu-ink/20 text-nu-graphite hover:bg-nu-pink hover:text-nu-paper hover:border-nu-pink transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Portfolio URL */}
      <div>
        <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
          <LinkIcon size={12} className="inline mr-1" />
          포트폴리오 URL
        </label>
        <input
          type="url"
          value={portfolioUrl}
          onChange={(e) => setPortfolioUrl(e.target.value)}
          placeholder="https://your-portfolio.com (프로필 링크 자동 사용됨)"
          className="w-full px-4 py-3 bg-nu-white border-[2px] border-nu-ink/20 text-sm focus:outline-none focus:border-nu-pink transition-colors"
        />
      </div>

      {/* Crew */}
      <div>
        <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
          <Users size={12} className="inline mr-1" />
          소속 너트 (선택)
        </label>
        {loadingCrews ? (
          <div className="flex items-center gap-2 text-sm text-nu-muted py-2"><Loader2 size={14} className="animate-spin" />불러오는 중...</div>
        ) : crews.length === 0 ? (
          <p className="text-sm text-nu-gray py-2">소속된 너트가 없습니다</p>
        ) : (
          <select
            value={crewId}
            onChange={(e) => setCrewId(e.target.value)}
            className="w-full px-4 py-2.5 bg-nu-white border-[2px] border-nu-ink/20 text-sm focus:outline-none focus:border-nu-pink"
          >
            <option value="">개인 자격으로 참여</option>
            {crews.map((c) => (<option key={c.id} value={c.id}>{c.name} 너트 대표</option>))}
          </select>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || selfIntroLen < 30 || motivationLen < 20}
        className="w-full font-mono-nu text-[13px] font-bold uppercase tracking-[0.1em] py-4 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (<><Loader2 size={14} className="animate-spin" /> 지원 중...</>) : (<><Send size={14} /> 지원서 제출</>)}
      </button>
    </form>
  );
}
