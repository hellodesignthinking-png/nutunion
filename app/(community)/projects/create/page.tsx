"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { seedProjectTemplate } from "@/lib/project-template-seeder";
import { toast } from "sonner";
import { Upload, Loader2, ArrowLeft, ChevronRight, Sparkles, Users, Clock, Check, Copy, Share2, UserPlus, Search, CheckCircle2 } from "lucide-react";
import type { Specialty } from "@/lib/types";

/* ── Invite user result ────────────────────────────────────────── */
interface UserSearchResult {
  id: string;
  nickname: string;
  avatar_url: string | null;
  grade: string | null;
}

/* ── Project Invite Panel ─────────────────────────────────────── */
function ProjectInvitePanel({
  projectId,
  projectTitle,
  onDone,
}: {
  projectId: string;
  projectTitle: string;
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
      ? `${window.location.origin}/projects/${projectId}`
      : `https://nutunion.co.kr/projects/${projectId}`;

  const shareText = `너트유니온 볼트 "${projectTitle}"에 참여해보세요! 🚀`;

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim() || query.length < 1) { setResults([]); return; }
      setSearching(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url, grade")
          .ilike("nickname", `%${query}%`)
          .limit(8);
        setResults((data || []) as UserSearchResult[]);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function inviteUser(userId: string) {
    setInviting(userId);
    try {
      const supabase = createClient();
      // Create a project application with approved status (direct invite)
      const { error } = await supabase.from("project_applications").upsert(
        { project_id: projectId, user_id: userId, status: "invited", message: "리더가 직접 초대했습니다." },
        { onConflict: "project_id,user_id" }
      );
      if (error) {
        // Fallback: create member directly
        await supabase.from("project_members").upsert(
          { project_id: projectId, user_id: userId, role: "member" },
          { onConflict: "project_id,user_id" }
        );
      }
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "project_invite",
        content: `"${projectTitle}" 볼트에 초대받았습니다!`,
        link: `/projects/${projectId}`,
      });
      setInvited((prev) => new Set([...prev, userId]));
      toast.success("초대를 보냈습니다");
    } catch (err: any) {
      toast.error(err.message || "초대 실패");
    } finally { setInviting(null); }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("링크가 복사되었습니다");
    } catch { toast.error("복사 실패"); }
  }

  async function nativeShare() {
    if (navigator.share) {
      try { await navigator.share({ title: projectTitle, text: shareText, url: shareUrl }); } catch {}
    } else { copyLink(); }
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-nu-green/10 border-2 border-nu-green flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-nu-green" />
        </div>
        <h1 className="font-head text-2xl font-extrabold text-nu-ink mb-2">볼트가 생성되었습니다!</h1>
        <p className="text-nu-gray text-sm">팀원을 초대해서 함께 시작해보세요</p>
      </div>

      {/* Share link */}
      <div className="bg-nu-white border-2 border-nu-ink/[0.08] p-6 mb-6">
        <h2 className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray mb-4">링크로 초대</h2>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 bg-nu-paper border border-nu-ink/15 px-3 py-2 font-mono text-[12px] text-nu-muted truncate">{shareUrl}</div>
          <button onClick={copyLink} className="flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={nativeShare} className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border border-nu-ink/15 hover:bg-nu-paper transition-colors text-nu-gray">
            <Share2 size={12} /> 공유
          </button>
          <button onClick={nativeShare} className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border border-[#FEE500]/50 bg-[#FEE500]/10 hover:bg-[#FEE500]/20 transition-colors text-nu-ink">
            💬 카카오톡
          </button>
          <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + " " + shareUrl)}`, "_blank")} className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 border border-[#1DA1F2]/30 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 transition-colors text-nu-ink">
            𝕏 트위터
          </button>
        </div>
        <p className="mt-3 text-[12px] text-nu-muted">링크를 받은 누구나 너트유니온에 가입하고 볼트에 지원할 수 있습니다.</p>
      </div>

      {/* Search existing members */}
      <div className="bg-nu-white border-2 border-nu-ink/[0.08] p-6 mb-6">
        <h2 className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray mb-4">기존 회원 초대</h2>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="닉네임으로 검색..."
            className="w-full pl-9 pr-4 py-2.5 border border-nu-ink/15 bg-transparent text-[14px] focus:outline-none focus:border-nu-blue"
          />
          {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-nu-muted animate-spin" />}
        </div>
        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 px-3 bg-nu-paper border border-nu-ink/05">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-nu-ink/10 flex items-center justify-center font-bold text-[12px] text-nu-ink overflow-hidden">
                    {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : u.nickname?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-nu-ink">{u.nickname}</p>
                    {u.grade && <p className="text-[11px] text-nu-muted uppercase">{u.grade}</p>}
                  </div>
                </div>
                {invited.has(u.id) ? (
                  <span className="flex items-center gap-1 font-mono-nu text-[11px] text-nu-green"><Check size={11} /> 초대됨</span>
                ) : (
                  <button onClick={() => inviteUser(u.id)} disabled={inviting === u.id} className="flex items-center gap-1.5 font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-50">
                    {inviting === u.id ? <Loader2 size={10} className="animate-spin" /> : <UserPlus size={10} />}
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
        <button onClick={onDone} className="font-mono-nu text-[13px] uppercase tracking-widest px-8 py-3 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors">
          볼트 페이지로 이동 →
        </button>
      </div>
    </div>
  );
}

const categories: { value: Specialty; label: string }[] = [
  { value: "space", label: "Space" },
  { value: "culture", label: "Culture" },
  { value: "platform", label: "Platform" },
  { value: "vibe", label: "Vibe" },
];

/* ── Template definitions ──────────────────────────────────────── */
interface ProjectTemplateInfo {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  gradient: string;
  accent: string;
  defaultCategory: Specialty;
  duration: string;
  features: string[];
}

/* ── Project Template content info ────────────────────────── */
interface ProjectTemplateContents {
  milestones: number;
  resources: number;
}

const PROJECT_TEMPLATE_CONTENTS: Record<string, ProjectTemplateContents> = {
  "local-branding": { milestones: 4, resources: 2 },
  "platform-mvp": { milestones: 4, resources: 2 },
  "popup-store": { milestones: 4, resources: 2 },
};

const PROJECT_TEMPLATES: Record<string, ProjectTemplateInfo> = {
  "local-branding": {
    id: "local-branding",
    title: "Local Branding",
    subtitle: "로컬 브랜딩 / 로컬 브랜딩",
    description:
      "시장조사부터 런칭까지 로컬 비즈니스의 브랜드 아이덴티티를 개발하는 볼트 템플릿입니다. 시장조사, 로고 및 아이덴티티 디자인, 공간 연출 및 제작, 런칭 및 홍보까지 전체 브랜딩 프로세스를 체계적으로 관리할 수 있습니다.",
    gradient: "from-[#0047FF] via-[#0033CC] to-[#001A66]",
    accent: "#0047FF",
    defaultCategory: "space",
    duration: "3-4개월",
    features: [
      "시장조사 및 컨셉 기획",
      "로고 & 아이덴티티 설계",
      "공간 연출 및 제작 관리",
      "런칭 및 홍보 일정",
      "브랜드 가이드라인 템플릿",
    ],
  },
  "platform-mvp": {
    id: "platform-mvp",
    title: "Platform MVP",
    subtitle: "플랫폼 개발 / 플랫폼 개발",
    description:
      "요구사항 정의부터 QA까지 플랫폼 개발의 전 과정을 관리하는 통합 템플릿입니다. 기술 팀이 MVP 개발에 필요한 모든 단계를 포함하며, 요구사항 정의, DB 설계, API 개발, 프론트엔드 개발부터 QA와 런칭까지 전체 개발 사이클을 관리합니다.",
    gradient: "from-[#FF2E97] via-[#CC0066] to-[#660033]",
    accent: "#FF2E97",
    defaultCategory: "platform",
    duration: "2-3개월",
    features: [
      "요구사항 정의 및 기획",
      "데이터베이스 설계",
      "API 개발 로드맵",
      "프론트엔드 개발 추적",
      "QA 및 테스트 관리",
    ],
  },
  "popup-store": {
    id: "popup-store",
    title: "Pop-up Store",
    subtitle: "팝업스토어 / 팝업스토어",
    description:
      "공간 섭외부터 정산까지 팝업스토어 볼트의 전 과정을 관리하는 템플릿입니다. 임시 공간 기반 비즈니스 운영에 필요한 모든 요소를 포함하며, 공간 섭외, 비주얼 가이드 제작, 스태프 교육부터 운영 및 정산까지 관리합니다.",
    gradient: "from-[#FF8C00] via-[#CC6600] to-[#663300]",
    accent: "#FF8C00",
    defaultCategory: "space",
    duration: "1-2개월",
    features: [
      "공간 섭외 및 기획",
      "비주얼 가이드 제작",
      "스태프 교육 및 준비",
      "운영 일정 관리",
      "비용 정산 시트",
    ],
  },
};

export default function ProjectCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateKey = searchParams.get("template");
  const template = templateKey ? PROJECT_TEMPLATES[templateKey] : null;

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Specialty>(template?.defaultCategory || "space");
  const [description, setDescription] = useState(template?.description || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // After creation invite step
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [createdProjectTitle, setCreatedProjectTitle] = useState<string>("");

  useEffect(() => {
    async function checkPermission() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, can_create_crew, can_create_project, grade")
        .eq("id", user.id)
        .single();

      const canCreate =
        profile?.role === "admin" ||
        profile?.can_create_project === true ||
        profile?.can_create_crew === true ||
        profile?.grade === "gold" ||
        profile?.grade === "vip";

      if (!canCreate) {
        toast.error("볼트를 개설하려면 골드 등급 이상이 필요합니다");
        router.push("/projects");
        return;
      }
      setChecking(false);
    }
    checkPermission();
  }, [router]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("볼트 제목을 입력해주세요");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다");

      let imageUrl: string | null = null;

      // Upload image if selected
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `projects/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(path, imageFile, {
            contentType: imageFile.type,
            upsert: true
          });

        if (uploadError) {
          toast.error("이미지 업로드 실패: " + uploadError.message);
          setLoading(false);
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("media").getPublicUrl(path);
        imageUrl = publicUrl;
      }

      // Insert project
      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          category,
          status: "active",
          start_date: startDate || null,
          end_date: endDate || null,
          image_url: imageUrl,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Add creator as lead member
      await supabase.from("project_members").insert({
        project_id: project.id,
        user_id: user.id,
        role: "lead",
      });

      // Seed template if one was selected
      if (template && templateKey) {
        try {
          await seedProjectTemplate(project.id, templateKey as any, user.id);
        } catch (error) {
          console.error("Template seeding error:", error);
          toast.error("템플릿 데이터 일부 생성에 실패했지만 볼트는 생성되었습니다.");
        }
      }

      toast.success(
        template
          ? `${template.title} 템플릿으로 볼트가 생성되었습니다!`
          : "볼트가 생성되었습니다!"
      );
      // Go to invite step
      setCreatedProjectId(project.id);
      setCreatedProjectTitle(title.trim());
    } catch (err: any) {
      toast.error(err.message || "볼트 생성 실패");
    } finally {
      setLoading(false);
    }
  }

  if (createdProjectId) {
    return (
      <ProjectInvitePanel
        projectId={createdProjectId}
        projectTitle={createdProjectTitle}
        onDone={() => router.push(`/projects/${createdProjectId}`)}
      />
    );
  }

  if (checking) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-20 flex justify-center">
        <Loader2 size={24} className="animate-spin text-nu-muted" />
      </div>
    );
  }

  /* ── Template-based creation UI ──────────────────────────── */
  if (template) {
    return (
      <div className="min-h-screen bg-nu-paper">
        {/* ── Hero Banner ────────────────────────────────────── */}
        <div className="relative overflow-hidden">
          <div
            className={`absolute inset-0 bg-gradient-to-br ${template.gradient} opacity-95`}
          />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative z-10 max-w-3xl mx-auto px-8 py-12">
            {/* Back link */}
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 font-mono-nu text-[12px] uppercase tracking-widest text-white/50 hover:text-white/80 transition-colors no-underline mb-8"
            >
              <ArrowLeft size={12} />
              볼트 탐색
            </Link>

            <div className="flex items-center gap-2 mb-5">
              <span className="font-mono-nu text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 bg-white/10 text-white/90 border border-white/10">
                <Sparkles size={8} className="inline -mt-0.5 mr-1 opacity-70" />
                TEMPLATE
              </span>
              <ChevronRight size={12} className="text-white/30" />
              <span className="font-mono-nu text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
                새 볼트 만들기
              </span>
            </div>

            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-sm flex items-center justify-center text-white border border-white/10" style={{ fontSize: "28px" }}>
                ✨
              </div>
              <div>
                <h1 className="font-head text-3xl font-black text-white tracking-tight">
                  {template.title}
                </h1>
                <p className="font-mono-nu text-[12px] text-white/40 uppercase tracking-[0.15em] mt-1">
                  {template.subtitle}
                </p>
              </div>
            </div>

            <p className="text-[13px] text-white/55 leading-relaxed max-w-xl ml-[72px]">
              {template.description}
            </p>

            {/* Quick stats */}
            <div className="flex items-center gap-6 mt-6 ml-[72px]">
              <span className="flex items-center gap-1.5 font-mono-nu text-[11px] text-white/40">
                <Clock size={11} /> {template.duration}
              </span>
            </div>
          </div>
        </div>

        {/* ── Form Area ──────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto px-8 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left — Form */}
            <div className="lg:col-span-3">
              <div className="bg-nu-white border-2 border-nu-ink/[0.06] p-8">
                <h2 className="font-head text-lg font-bold text-nu-ink mb-1">
                  볼트 정보 입력
                </h2>
                <p className="text-[13px] text-nu-muted mb-6">
                  템플릿 구조가 자동 적용됩니다. 기본 정보만 입력하세요.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div>
                    <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray mb-1.5">
                      볼트 제목 *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={`예: ${template.title} - Season 1`}
                      className="w-full px-4 py-3 border border-nu-ink/15 bg-transparent text-sm focus:outline-none focus:border-nu-pink transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray mb-1.5">
                      카테고리
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as Specialty)}
                      className="w-full px-4 py-3 border border-nu-ink/15 bg-transparent text-sm focus:outline-none focus:border-nu-pink transition-colors"
                    >
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray mb-1.5">
                      설명
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="볼트에 대해 소개해주세요"
                      rows={4}
                      defaultValue={template.description}
                      className="w-full px-4 py-3 border border-nu-ink/15 bg-transparent text-sm focus:outline-none focus:border-nu-pink transition-colors resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray mb-1.5">
                        시작일
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-4 py-3 border border-nu-ink/15 bg-transparent text-sm focus:outline-none focus:border-nu-pink transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray mb-1.5">
                        종료일
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-4 py-3 border border-nu-ink/15 bg-transparent text-sm focus:outline-none focus:border-nu-pink transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray mb-1.5">
                      커버 이미지
                    </label>
                    <div className="border border-dashed border-nu-ink/20 p-6 text-center">
                      {imagePreview ? (
                        <div className="relative">
                          <img
                            src={imagePreview}
                            alt="미리보기"
                            className="max-h-48 mx-auto object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview(null);
                            }}
                            className="mt-2 font-mono-nu text-[12px] text-nu-red uppercase tracking-widest"
                          >
                            삭제
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-2">
                          <Upload size={24} className="text-nu-muted" />
                          <span className="text-sm text-nu-gray">
                            클릭하여 이미지 업로드
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="relative overflow-hidden font-mono-nu text-[13px] font-bold uppercase tracking-widest px-8 py-3 text-white border-0 transition-all hover:shadow-lg disabled:opacity-60"
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-r ${template.gradient}`}
                      />
                      <span className="relative z-10">
                        {loading
                          ? "생성 중..."
                          : "템플릿으로 볼트 만들기"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="font-mono-nu text-[13px] uppercase tracking-widest px-8 py-3 border border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-nu-paper transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right — Template features sidebar */}
            <div className="lg:col-span-2">
              <div className="bg-nu-ink border-2 border-nu-ink p-6 sticky top-8">
                <div
                  className="absolute inset-0 opacity-[0.03]"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, #fff 1px, transparent 1px)",
                    backgroundSize: "16px 16px",
                  }}
                />
                <div className="relative z-10">
                  <h3 className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.15em] text-white/40 mb-4">
                    자동 적용되는 기능
                  </h3>
                  <ul className="space-y-3">
                    {template.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div
                          className="w-5 h-5 shrink-0 flex items-center justify-center mt-0.5 border"
                          style={{
                            backgroundColor: `${template.accent}15`,
                            borderColor: `${template.accent}30`,
                            color: template.accent,
                          }}
                        >
                          <Check size={10} />
                        </div>
                        <span className="text-[13px] text-white/60 leading-snug">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 pt-5 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles
                        size={12}
                        style={{ color: template.accent }}
                      />
                      <span className="font-mono-nu text-[11px] font-bold uppercase tracking-[0.15em] text-white/50">
                        템플릿 혜택
                      </span>
                    </div>
                    <div
                      className="p-3 mb-4 rounded border"
                      style={{
                        backgroundColor: `${template.accent}10`,
                        borderColor: `${template.accent}40`,
                      }}
                    >
                      <p className="text-[12px] text-white/70 leading-relaxed">
                        이 템플릿에는 <strong>{PROJECT_TEMPLATE_CONTENTS[template.id]?.milestones || 0}개의 마일스톤</strong>과{" "}
                        <strong>{PROJECT_TEMPLATE_CONTENTS[template.id]?.resources || 0}개의 기본 자료</strong>가 포함되어 있습니다.
                      </p>
                    </div>
                    <p className="text-[12px] text-white/35 leading-relaxed">
                      볼트 생성 시 위 기능들이 자동으로 구성됩니다.
                      별도의 설정 없이 바로 운영을 시작할 수 있습니다.
                    </p>
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
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        새 볼트 만들기
      </h1>
      <p className="text-nu-gray text-sm mb-8">
        너트들이 함께할 볼트를 시작하세요
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
            볼트 제목 *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="볼트 이름을 입력하세요"
            className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
            required
          />
        </div>

        {/* Category */}
        <div>
          <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
            카테고리 *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Specialty)}
            className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
            설명
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="볼트에 대한 설명을 입력하세요"
            rows={4}
            className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors resize-none"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
              시작일
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
            />
          </div>
          <div>
            <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
              종료일
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 bg-nu-white border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
            />
          </div>
        </div>

        {/* Image upload */}
        <div>
          <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
            커버 이미지
          </label>
          <div className="border border-dashed border-nu-ink/20 p-6 text-center">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="미리보기"
                  className="max-h-48 mx-auto object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="mt-2 font-mono-nu text-[12px] text-nu-red uppercase tracking-widest"
                >
                  삭제
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-2">
                <Upload size={24} className="text-nu-muted" />
                <span className="text-sm text-nu-gray">
                  클릭하여 이미지 업로드
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full font-mono-nu text-[13px] font-bold uppercase tracking-[0.1em] py-4 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> 생성 중...
            </>
          ) : (
            "볼트 만들기"
          )}
        </button>
      </form>
    </div>
  );
}
