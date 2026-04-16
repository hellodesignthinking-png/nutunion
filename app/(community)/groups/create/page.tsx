"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { seedGroupTemplate } from "@/lib/template-seeder";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Rocket,
  BookOpen,
  Zap,
  Sparkles,
  Users,
  Clock,
  Check,
  ArrowLeft,
  ChevronRight,
  Loader2,
  X,
  Search,
  Copy,
  Share2,
  UserPlus,
  CheckCircle2,
} from "lucide-react";

/* ── Template definitions ──────────────────────────────────────── */
interface TemplateInfo {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  accent: string;
  defaultCategory: string;
  defaultMaxMembers: number;
  duration: string;
  features: string[];
}

interface TemplateContents {
  meetings: number;
  phases: number;
  resources: number;
}

const TEMPLATE_CONTENTS: Record<string, TemplateContents> = {
  sprint: { meetings: 6, phases: 3, resources: 2 },
  "paper-review": { meetings: 4, phases: 2, resources: 1 },
  venture: { meetings: 4, phases: 3, resources: 2 },
};

const TEMPLATES: Record<string, TemplateInfo> = {
  sprint: {
    id: "sprint",
    title: "Project Sprint - Standard",
    subtitle: "고밀도 실행 스프린트",
    description:
      "6주 단위의 고밀도 실행을 위해 설계된 템플릿입니다. 목표 설정, 주간 체크인, 미팅 아카이브, 결과 리뷰 등 전체 스프린트 사이클을 관리할 수 있는 구조를 제공합니다.",
    icon: <Rocket size={22} />,
    gradient: "from-[#0047FF] via-[#0033CC] to-[#001A66]",
    accent: "#0047FF",
    defaultCategory: "platform",
    defaultMaxMembers: 12,
    duration: "6주 사이클",
    features: [
      "주간 체크인 및 진행상황 추적",
      "미팅 노트 아카이브 시스템",
      "결과 리뷰 및 피드백",
      "스프린트 평가 템플릿",
      "자동화된 주간 리포트",
    ],
  },
  "paper-review": {
    id: "paper-review",
    title: "Weekly Paper Review",
    subtitle: "지식 기반 너트",
    description:
      "매주 선정된 논문이나 보고서를 함께 읽고, 핵심 내용을 정리하고, 인사이트를 나누는 정기적인 모임을 운영할 수 있습니다.",
    icon: <BookOpen size={22} />,
    gradient: "from-[#FF2E97] via-[#CC0066] to-[#660033]",
    accent: "#FF2E97",
    defaultCategory: "culture",
    defaultMaxMembers: 15,
    duration: "지속적 운영",
    features: [
      "주간 논문 선정 및 공지",
      "읽기 진행도 추적",
      "토론 노트 및 요약",
      "인사이트 공유 게시판",
      "논문 아카이브 라이브러리",
    ],
  },
  venture: {
    id: "venture",
    title: "Venture Building 101",
    subtitle: "비즈니스 빌딩 통합 관리",
    description:
      "초기 스타트업이나 사이드 프로젝트를 함께 검증하고 개발하는 팀을 위한 템플릿입니다. 아이디어 검증부터 MVP 개발, 테스트, 정산까지 전체 빌딩 사이클을 체계적으로 관리합니다.",
    icon: <Zap size={22} />,
    gradient: "from-[#FF8C00] via-[#CC6600] to-[#663300]",
    accent: "#FF8C00",
    defaultCategory: "platform",
    defaultMaxMembers: 8,
    duration: "12주 사이클",
    features: [
      "아이디어 검증 프레임워크",
      "고객 인터뷰 관리",
      "MVP 개발 로드맵",
      "테스트 및 피드백 수집",
      "재정 관리 및 정산 도구",
    ],
  },
};

/* ── AI Plan types ─────────────────────────────────────────────── */
interface WikiTopicSuggestion {
  name: string;
  description: string;
  emoji: string;
}
interface MeetingTypeSuggestion {
  name: string;
  frequency: string;
  purpose: string;
}
interface AIPlan {
  wikiTopics: WikiTopicSuggestion[];
  meetingTypes: MeetingTypeSuggestion[];
  contentPlan: string;
  suggestedTags: string[];
}

/* ── Invite user result ────────────────────────────────────────── */
interface UserSearchResult {
  id: string;
  nickname: string;
  avatar_url: string | null;
  grade: string | null;
}

/* ── Invite panel ─────────────────────────────────────────────── */
function InvitePanel({
  groupId,
  groupName,
  onDone,
}: {
  groupId: string;
  groupName: string;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/groups/${groupId}`
      : `https://nutunion.co.kr/groups/${groupId}`;

  const shareText = `너트유니온 소모임 "${groupName}"에 초대합니다! 함께해요 🎉`;

  async function searchUsers(q: string) {
    if (!q.trim() || q.length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url, grade")
        .ilike("nickname", `%${q}%`)
        .limit(8);
      setResults((data || []) as UserSearchResult[]);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function inviteUser(userId: string) {
    setInviting(userId);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("group_members").upsert(
        { group_id: groupId, user_id: userId, role: "member", status: "pending" },
        { onConflict: "group_id,user_id" }
      );
      if (error) throw error;
      // Send notification
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "group_invite",
        content: `"${groupName}" 너트에 초대받았습니다!`,
        link: `/groups/${groupId}`,
      });
      setInvited((prev) => new Set([...prev, userId]));
      toast.success("초대를 보냈습니다");
    } catch (err: any) {
      toast.error(err.message || "초대 실패");
    } finally {
      setInviting(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("링크가 복사되었습니다");
    } catch {
      toast.error("복사 실패");
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: groupName, text: shareText, url: shareUrl });
      } catch {
        // User cancelled
      }
    } else {
      copyLink();
    }
  }

  function shareKakao() {
    // Deep link: kakaotalk://send?text=... fallback to copy
    const kakaoUrl = `https://sharer.kakao.com/talk/friends/picker/link?app_key=KAKAO_KEY&link_ver=4.0&template_id=default&template_args[title]=${encodeURIComponent(groupName)}&template_args[description]=${encodeURIComponent(shareText)}&template_args[link]=${encodeURIComponent(shareUrl)}`;
    // Simple fallback: open web share or copy
    nativeShare();
  }

  function shareTwitter() {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
      "_blank"
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      {/* Success header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-nu-green/10 border-2 border-nu-green flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-nu-green" />
        </div>
        <h1 className="font-head text-2xl font-extrabold text-nu-ink mb-2">
          너트가 생성되었습니다!
        </h1>
        <p className="text-nu-gray text-sm">멤버를 초대해서 함께 시작해보세요</p>
      </div>

      {/* Share link section */}
      <div className="bg-nu-white border-2 border-nu-ink/[0.08] p-6 mb-6">
        <h2 className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray mb-4">
          링크로 초대
        </h2>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 bg-nu-paper border border-nu-ink/15 px-3 py-2 font-mono text-[12px] text-nu-muted truncate">
            {shareUrl}
          </div>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={nativeShare}
            className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border border-nu-ink/15 hover:bg-nu-paper transition-colors text-nu-gray"
          >
            <Share2 size={12} />
            공유
          </button>
          <button
            onClick={shareKakao}
            className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border border-[#FEE500]/50 bg-[#FEE500]/10 hover:bg-[#FEE500]/20 transition-colors text-nu-ink"
          >
            💬 카카오톡
          </button>
          <button
            onClick={shareTwitter}
            className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border border-[#1DA1F2]/30 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 transition-colors text-nu-ink"
          >
            𝕏 트위터
          </button>
        </div>
        <p className="mt-3 text-[12px] text-nu-muted">
          링크를 받은 누구나 너트유니온에 가입하고 소모임에 참여할 수 있습니다.
        </p>
      </div>

      {/* Search existing members */}
      <div className="bg-nu-white border-2 border-nu-ink/[0.08] p-6 mb-6">
        <h2 className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray mb-4">
          기존 회원 초대
        </h2>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="닉네임으로 검색..."
            className="w-full pl-9 pr-4 py-2.5 border border-nu-ink/15 bg-transparent text-[14px] focus:outline-none focus:border-nu-blue"
          />
          {searching && (
            <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-nu-muted animate-spin" />
          )}
        </div>
        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between py-2 px-3 bg-nu-paper border border-nu-ink/05"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-nu-ink/10 flex items-center justify-center font-bold text-[12px] text-nu-ink overflow-hidden">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      u.nickname?.[0]?.toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-nu-ink">{u.nickname}</p>
                    {u.grade && (
                      <p className="text-[11px] text-nu-muted uppercase">{u.grade}</p>
                    )}
                  </div>
                </div>
                {invited.has(u.id) ? (
                  <span className="flex items-center gap-1 font-mono-nu text-[11px] text-nu-green">
                    <Check size={11} /> 초대됨
                  </span>
                ) : (
                  <button
                    onClick={() => inviteUser(u.id)}
                    disabled={inviting === u.id}
                    className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-50"
                  >
                    {inviting === u.id ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <UserPlus size={10} />
                    )}
                    초대
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {query.length > 0 && results.length === 0 && !searching && (
          <p className="text-[13px] text-nu-muted text-center py-4">검색 결과가 없습니다</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onDone}
          className="font-mono-nu text-[13px] uppercase tracking-widest px-8 py-3 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors"
        >
          너트 페이지로 이동 →
        </button>
      </div>
    </div>
  );
}

/* ── AI Suggestion Panel ──────────────────────────────────────── */
function AISuggestionPanel({
  plan,
  approvedTopics,
  setApprovedTopics,
  approvedMeetings,
  setApprovedMeetings,
}: {
  plan: AIPlan;
  approvedTopics: Set<number>;
  setApprovedTopics: (s: Set<number>) => void;
  approvedMeetings: Set<number>;
  setApprovedMeetings: (s: Set<number>) => void;
}) {
  function toggleTopic(i: number) {
    const s = new Set(approvedTopics);
    if (s.has(i)) s.delete(i);
    else s.add(i);
    setApprovedTopics(s);
  }
  function toggleMeeting(i: number) {
    const s = new Set(approvedMeetings);
    if (s.has(i)) s.delete(i);
    else s.add(i);
    setApprovedMeetings(s);
  }

  return (
    <div className="mt-6 border-2 border-nu-blue/30 bg-nu-blue/[0.02] p-6 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 mb-5">
        <Sparkles size={14} className="text-nu-blue" />
        <span className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-blue font-bold">
          AI 기획 제안
        </span>
        <span className="ml-auto text-[11px] text-nu-muted">원하는 항목을 선택하세요</span>
      </div>

      {/* Content plan summary */}
      {plan.contentPlan && (
        <div className="bg-nu-blue/[0.06] border border-nu-blue/20 p-3 mb-5 text-[13px] text-nu-gray leading-relaxed">
          {plan.contentPlan}
        </div>
      )}

      {/* Wiki topics */}
      <div className="mb-5">
        <h4 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray mb-3">
          📚 추천 위키 탭 ({approvedTopics.size}/{plan.wikiTopics.length} 선택)
        </h4>
        <div className="space-y-2">
          {plan.wikiTopics.map((topic, i) => (
            <button
              key={i}
              onClick={() => toggleTopic(i)}
              className={`w-full text-left flex items-start gap-3 p-3 border transition-colors ${
                approvedTopics.has(i)
                  ? "border-nu-blue bg-nu-blue/[0.05]"
                  : "border-nu-ink/10 bg-nu-white hover:border-nu-ink/25"
              }`}
            >
              <div
                className={`w-5 h-5 shrink-0 mt-0.5 border flex items-center justify-center ${
                  approvedTopics.has(i)
                    ? "bg-nu-blue border-nu-blue text-white"
                    : "border-nu-ink/20 text-transparent"
                }`}
              >
                <Check size={10} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{topic.emoji}</span>
                  <span className="text-[13px] font-semibold text-nu-ink">{topic.name}</span>
                </div>
                <p className="text-[12px] text-nu-muted mt-1 leading-snug">{topic.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Meeting types */}
      <div className="mb-4">
        <h4 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-gray mb-3">
          🗓 추천 회의 유형 ({approvedMeetings.size}/{plan.meetingTypes.length} 선택)
        </h4>
        <div className="space-y-2">
          {plan.meetingTypes.map((meeting, i) => (
            <button
              key={i}
              onClick={() => toggleMeeting(i)}
              className={`w-full text-left flex items-start gap-3 p-3 border transition-colors ${
                approvedMeetings.has(i)
                  ? "border-nu-pink bg-nu-pink/[0.04]"
                  : "border-nu-ink/10 bg-nu-white hover:border-nu-ink/25"
              }`}
            >
              <div
                className={`w-5 h-5 shrink-0 mt-0.5 border flex items-center justify-center ${
                  approvedMeetings.has(i)
                    ? "bg-nu-pink border-nu-pink text-white"
                    : "border-nu-ink/20 text-transparent"
                }`}
              >
                <Check size={10} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-nu-ink">{meeting.name}</span>
                  <span className="font-mono-nu text-[10px] px-1.5 py-0.5 bg-nu-ink/[0.06] text-nu-gray uppercase tracking-wide">
                    {meeting.frequency}
                  </span>
                </div>
                <p className="text-[12px] text-nu-muted mt-1 leading-snug">{meeting.purpose}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      {plan.suggestedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {plan.suggestedTags.map((tag, i) => (
            <span
              key={i}
              className="font-mono-nu text-[10px] uppercase tracking-wide px-2 py-1 bg-nu-ink/[0.05] text-nu-gray border border-nu-ink/10"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────── */
export default function CreateGroupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateKey = searchParams.get("template");
  const template = templateKey ? TEMPLATES[templateKey] : null;

  const [permitted, setPermitted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(template?.defaultCategory || "");

  // Form values (for AI to read before submit)
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState(template?.description || "");

  // AI plan state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState<AIPlan | null>(null);
  const [approvedTopics, setApprovedTopics] = useState<Set<number>>(new Set());
  const [approvedMeetings, setApprovedMeetings] = useState<Set<number>>(new Set());

  // After creation: invite step
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [createdGroupName, setCreatedGroupName] = useState<string>("");

  // Permission check
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPermitted(false); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("can_create_crew, role, grade")
        .eq("id", user.id)
        .single();
      const canCreate =
        profile?.role === "admin" ||
        profile?.can_create_crew === true ||
        profile?.grade === "silver" ||
        profile?.grade === "gold" ||
        profile?.grade === "vip";
      setPermitted(canCreate ? true : false);
    })();
  }, []);

  async function getAIPlan() {
    if (!formName.trim()) {
      toast.error("너트 이름을 먼저 입력해주세요");
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/group-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, description: formDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 오류");
      setAiPlan(data);
      // Auto-select all suggestions
      setApprovedTopics(new Set(data.wikiTopics.map((_: any, i: number) => i)));
      setApprovedMeetings(new Set(data.meetingTypes.map((_: any, i: number) => i)));
    } catch (err: any) {
      toast.error(err.message || "AI 기획 생성 실패");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const maxMembers = parseInt(formData.get("maxMembers") as string) || 20;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("로그인이 필요합니다");
      setLoading(false);
      return;
    }

    const { data: group, error } = await supabase
      .from("groups")
      .insert({ name, category, description, host_id: user.id, max_members: maxMembers })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Add creator as host member
    await supabase.from("group_members").insert({
      group_id: group.id,
      user_id: user.id,
      role: "host",
      status: "active",
    });

    // Seed template if selected
    if (template && templateKey) {
      try {
        await seedGroupTemplate(group.id, templateKey as any, user.id);
      } catch {
        toast.error("템플릿 일부 데이터 생성이 실패했습니다.");
      }
    }

    // Seed AI-approved wiki topics
    if (aiPlan && approvedTopics.size > 0) {
      try {
        const topicsToSeed = aiPlan.wikiTopics.filter((_, i) => approvedTopics.has(i));
        for (const topic of topicsToSeed) {
          const { data: wikiTopic } = await supabase
            .from("wiki_topics")
            .insert({ group_id: group.id, name: topic.name, description: topic.description })
            .select("id")
            .single();
          // Create an initial empty page for each topic
          if (wikiTopic) {
            await supabase.from("wiki_pages").insert({
              topic_id: wikiTopic.id,
              title: topic.name,
              content: `<h2>${topic.emoji} ${topic.name}</h2><p>${topic.description}</p>`,
              created_by: user.id,
              last_updated_by: user.id,
            });
          }
        }
      } catch (err) {
        console.error("Wiki seeding error:", err);
      }
    }

    // Seed AI-approved meeting types as meeting templates
    if (aiPlan && approvedMeetings.size > 0) {
      try {
        const meetingsToSeed = aiPlan.meetingTypes.filter((_, i) => approvedMeetings.has(i));
        for (const meeting of meetingsToSeed) {
          // Insert as a future meeting placeholder
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + 7);
          await supabase.from("meetings").insert({
            group_id: group.id,
            title: meeting.name,
            description: `${meeting.purpose}\n\n📅 빈도: ${meeting.frequency}`,
            scheduled_at: nextDate.toISOString(),
            created_by: user.id,
            status: "planned",
          });
        }
      } catch (err) {
        console.error("Meeting seeding error:", err);
      }
    }

    toast.success(
      template
        ? `${template.title} 템플릿으로 너트가 생성되었습니다!`
        : "너트가 생성되었습니다!"
    );

    // Go to invite step
    setCreatedGroupId(group.id);
    setCreatedGroupName(name);
    setLoading(false);
  }

  /* ── Invite step ─────────────────────────────────────────────── */
  if (createdGroupId) {
    return (
      <InvitePanel
        groupId={createdGroupId}
        groupName={createdGroupName}
        onDone={() => router.push(`/groups/${createdGroupId}`)}
      />
    );
  }

  /* ── Permission walls ─────────────────────────────────────────── */
  if (permitted === null) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-12 text-center">
        <Loader2 size={20} className="animate-spin text-nu-muted mx-auto" />
      </div>
    );
  }

  if (permitted === false) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-12 text-center">
        <h1 className="font-head text-2xl font-extrabold text-nu-ink mb-4">너트 개설 권한이 없습니다</h1>
        <p className="text-nu-gray mb-2">너트를 개설하려면 <strong>실버 등급 이상</strong>이 필요합니다.</p>
        <p className="text-nu-muted text-sm mb-6">현재 등급이 부족하다면 관리자에게 등급 상향을 요청하세요.</p>
        <Link
          href="/groups"
          className="font-mono-nu text-[13px] uppercase tracking-widest bg-nu-ink text-nu-paper px-6 py-3 no-underline hover:bg-nu-pink transition-colors inline-block"
        >
          너트 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  /* ── Shared form section ─────────────────────────────────────── */
  const formSection = (isTemplate: boolean) => (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
          너트 이름 *
        </Label>
        <Input
          name="name"
          required
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder={isTemplate ? `예: ${template?.title} - 시즌 1` : "Space Architects Seoul"}
          className="mt-1.5 border-nu-ink/15 bg-transparent"
        />
      </div>

      <div>
        <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">카테고리</Label>
        <Select value={category} onValueChange={(v) => v && setCategory(v)} required>
          <SelectTrigger className="mt-1.5 border-nu-ink/15 bg-transparent">
            <SelectValue placeholder="카테고리 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="space">공간 (Space)</SelectItem>
            <SelectItem value="culture">문화 (Culture)</SelectItem>
            <SelectItem value="platform">플랫폼 (Platform)</SelectItem>
            <SelectItem value="vibe">바이브 (Vibe)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">소개</Label>
        <Textarea
          name="description"
          rows={4}
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          placeholder="너트에 대해 소개해주세요"
          className="mt-1.5 border-nu-ink/15 bg-transparent resize-none"
        />
      </div>

      <div>
        <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">최대 인원</Label>
        <Input
          name="maxMembers"
          type="number"
          defaultValue={template?.defaultMaxMembers || 20}
          min={2}
          max={200}
          className="mt-1.5 border-nu-ink/15 bg-transparent w-32"
        />
        {isTemplate && (
          <p className="text-[12px] text-nu-muted mt-1">권장: {template?.defaultMaxMembers}명</p>
        )}
      </div>

      {/* AI Plan button */}
      <div className="border-t border-nu-ink/[0.06] pt-4">
        <button
          type="button"
          onClick={getAIPlan}
          disabled={aiLoading || !formName.trim()}
          className="w-full flex items-center justify-center gap-2 font-mono-nu text-[12px] uppercase tracking-widest py-2.5 border-2 border-dashed border-nu-blue/40 text-nu-blue hover:bg-nu-blue/[0.04] transition-colors disabled:opacity-40"
        >
          {aiLoading ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              AI가 기획 중입니다...
            </>
          ) : (
            <>
              <Sparkles size={13} />
              {aiPlan ? "AI 기획 다시 받기" : "AI 탭 기획 받기 (선택사항)"}
            </>
          )}
        </button>
      </div>

      {/* AI Suggestions */}
      {aiPlan && (
        <AISuggestionPanel
          plan={aiPlan}
          approvedTopics={approvedTopics}
          setApprovedTopics={setApprovedTopics}
          approvedMeetings={approvedMeetings}
          setApprovedMeetings={setApprovedMeetings}
        />
      )}

      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={loading}
          className={`relative overflow-hidden font-mono-nu text-[13px] font-bold uppercase tracking-widest px-8 py-3 text-white border-0 transition-all hover:shadow-lg disabled:opacity-60 ${
            isTemplate ? "" : "bg-nu-ink hover:bg-nu-pink"
          }`}
        >
          {isTemplate && (
            <div className={`absolute inset-0 bg-gradient-to-r ${template?.gradient}`} />
          )}
          <span className="relative z-10">
            {loading ? "생성 중..." : isTemplate ? "템플릿으로 너트 만들기" : "너트 만들기"}
          </span>
        </button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="font-mono-nu text-[13px] uppercase tracking-widest"
        >
          취소
        </Button>
      </div>
    </form>
  );

  /* ── Template-based creation UI ──────────────────────────── */
  if (template) {
    return (
      <div className="min-h-screen bg-nu-paper">
        {/* Hero Banner */}
        <div className="relative overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${template.gradient} opacity-95`} />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          />
          <div className="relative z-10 max-w-3xl mx-auto px-8 py-12">
            <Link
              href="/groups"
              className="inline-flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest text-white/50 hover:text-white/80 transition-colors no-underline mb-8"
            >
              <ArrowLeft size={12} /> 너트 탐색
            </Link>
            <div className="flex items-center gap-2 mb-5">
              <span className="font-mono-nu text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 bg-white/10 text-white/90 border border-white/10">
                <Sparkles size={8} className="inline -mt-0.5 mr-1 opacity-70" />TEMPLATE
              </span>
              <ChevronRight size={12} className="text-white/30" />
              <span className="font-mono-nu text-[10px] font-black uppercase tracking-[0.2em] text-white/50">새 너트 만들기</span>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-sm flex items-center justify-center text-white border border-white/10">
                {template.icon}
              </div>
              <div>
                <h1 className="font-head text-3xl font-black text-white tracking-tight">{template.title}</h1>
                <p className="font-mono-nu text-[12px] text-white/40 uppercase tracking-[0.15em] mt-1">{template.subtitle}</p>
              </div>
            </div>
            <p className="text-[13px] text-white/55 leading-relaxed max-w-xl ml-[72px]">{template.description}</p>
            <div className="flex items-center gap-6 mt-6 ml-[72px]">
              <span className="flex items-center gap-1.5 font-mono-nu text-[11px] text-white/40">
                <Users size={11} /> 최대 {template.defaultMaxMembers}명
              </span>
              <span className="flex items-center gap-1.5 font-mono-nu text-[11px] text-white/40">
                <Clock size={11} /> {template.duration}
              </span>
            </div>
          </div>
        </div>

        {/* Form Area */}
        <div className="max-w-3xl mx-auto px-8 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3">
              <div className="bg-nu-white border-2 border-nu-ink/[0.06] p-8">
                <h2 className="font-head text-lg font-bold text-nu-ink mb-1">너트 정보 입력</h2>
                <p className="text-[13px] text-nu-muted mb-6">템플릿 구조가 자동 적용됩니다. 기본 정보만 입력하세요.</p>
                {formSection(true)}
              </div>
            </div>

            {/* Right sidebar */}
            <div className="lg:col-span-2">
              <div className="bg-nu-ink border-2 border-nu-ink p-6 sticky top-8">
                <div
                  className="absolute inset-0 opacity-[0.03]"
                  style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "16px 16px" }}
                />
                <div className="relative z-10">
                  <h3 className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.15em] text-white/40 mb-4">자동 적용되는 기능</h3>
                  <ul className="space-y-3">
                    {template.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div
                          className="w-5 h-5 shrink-0 flex items-center justify-center mt-0.5 border"
                          style={{ backgroundColor: `${template.accent}15`, borderColor: `${template.accent}30`, color: template.accent }}
                        >
                          <Check size={10} />
                        </div>
                        <span className="text-[13px] text-white/60 leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 pt-5 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={12} style={{ color: template.accent }} />
                      <span className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">템플릿 혜택</span>
                    </div>
                    <div
                      className="p-3 mb-4 rounded border"
                      style={{ backgroundColor: `${template.accent}10`, borderColor: `${template.accent}40` }}
                    >
                      <p className="text-[12px] text-white/70 leading-relaxed">
                        이 템플릿에는 <strong>{TEMPLATE_CONTENTS[template.id]?.meetings || 0}개의 미팅</strong>과{" "}
                        <strong>{TEMPLATE_CONTENTS[template.id]?.phases || 0}개의 기본 자료</strong>가 포함되어 있습니다.
                      </p>
                    </div>
                    <p className="text-[12px] text-white/35 leading-relaxed">너트 생성 시 위 기능들이 자동으로 구성됩니다.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Default (no template) creation UI ───────────────────── */
  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <Link
        href="/groups"
        className="inline-flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors no-underline mb-6"
      >
        <ArrowLeft size={12} /> 너트 탐색
      </Link>
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">새 너트 만들기</h1>
      <p className="text-nu-gray text-sm mb-8">새로운 Scene을 시작하세요</p>
      <div className="bg-nu-white border border-nu-ink/[0.08] p-8">
        {formSection(false)}
      </div>
    </div>
  );
}
