"use client";

import { useState, useEffect, useMemo } from "react";
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

/* ── Template content info ────────────────────────────────── */
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
    subtitle: "지식 기반 소모임",
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

/* ── Main Component ────────────────────────────────────────────── */
export default function CreateGroupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateKey = searchParams.get("template");
  const template = templateKey ? TEMPLATES[templateKey] : null;

  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(template?.defaultCategory || "");
  const [permitted, setPermitted] = useState<boolean | null>(null);

  // Permission check
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setPermitted(false);
        return;
      }
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

  /* ── Permission walls ─────────────────────────────────────── */
  if (permitted === null) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-12 text-center">
        <p className="text-nu-gray">권한을 확인하는 중...</p>
      </div>
    );
  }

  if (permitted === false) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-12 text-center">
        <h1 className="font-head text-2xl font-extrabold text-nu-ink mb-4">
          소모임 개설 권한이 없습니다
        </h1>
        <p className="text-nu-gray mb-2">
          소모임을 개설하려면 <strong>실버 등급 이상</strong>이 필요합니다.
        </p>
        <p className="text-nu-muted text-sm mb-6">
          현재 등급이 부족하다면 관리자에게 등급 상향을 요청하세요.
        </p>
        <Link
          href="/groups"
          className="font-mono-nu text-[11px] uppercase tracking-widest bg-nu-ink text-nu-paper px-6 py-3 no-underline hover:bg-nu-pink transition-colors inline-block"
        >
          소모임 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  /* ── Submit handler ───────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const maxMembers = parseInt(formData.get("maxMembers") as string) || 20;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("로그인이 필요합니다");
      setLoading(false);
      return;
    }

    const { data: group, error } = await supabase
      .from("groups")
      .insert({
        name,
        category,
        description,
        host_id: user.id,
        max_members: maxMembers,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Add creator as host member
    const { error: memberError } = await supabase.from("group_members").insert({
      group_id: group.id,
      user_id: user.id,
      role: "host",
      status: "active",
    });

    if (memberError) {
      toast.error("소모임은 생성되었으나 호스트 등록에 실패했습니다.");
      setLoading(false);
      return;
    }

    // Seed template if one was selected (non-blocking — group is already created)
    if (template && templateKey) {
      try {
        await seedGroupTemplate(group.id, templateKey as any, user.id);
      } catch (error) {
        console.error("Template seeding error:", error);
        // Don't block group creation — just warn user
        toast.error("템플릿 일부 데이터 생성이 실패했습니다. 수동으로 추가해주세요.");
      }
    }

    toast.success(
      template
        ? `${template.title} 템플릿으로 소모임이 생성되었습니다!`
        : "소모임이 생성되었습니다!"
    );
    router.push(`/groups/${group.id}`);
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
              href="/groups"
              className="inline-flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-white/50 hover:text-white/80 transition-colors no-underline mb-8"
            >
              <ArrowLeft size={12} />
              소모임 탐색
            </Link>

            <div className="flex items-center gap-2 mb-5">
              <span className="font-mono-nu text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1 bg-white/10 text-white/90 border border-white/10">
                <Sparkles size={8} className="inline -mt-0.5 mr-1 opacity-70" />
                TEMPLATE
              </span>
              <ChevronRight size={12} className="text-white/30" />
              <span className="font-mono-nu text-[8px] font-black uppercase tracking-[0.2em] text-white/50">
                새 소모임 만들기
              </span>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-sm flex items-center justify-center text-white border border-white/10">
                {template.icon}
              </div>
              <div>
                <h1 className="font-head text-3xl font-black text-white tracking-tight">
                  {template.title}
                </h1>
                <p className="font-mono-nu text-[10px] text-white/40 uppercase tracking-[0.15em] mt-1">
                  {template.subtitle}
                </p>
              </div>
            </div>

            <p className="text-[13px] text-white/55 leading-relaxed max-w-xl ml-[72px]">
              {template.description}
            </p>

            {/* Quick stats */}
            <div className="flex items-center gap-6 mt-6 ml-[72px]">
              <span className="flex items-center gap-1.5 font-mono-nu text-[9px] text-white/40">
                <Users size={11} /> 최대 {template.defaultMaxMembers}명
              </span>
              <span className="flex items-center gap-1.5 font-mono-nu text-[9px] text-white/40">
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
                  소모임 정보 입력
                </h2>
                <p className="text-[11px] text-nu-muted mb-6">
                  템플릿 구조가 자동 적용됩니다. 기본 정보만 입력하세요.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div>
                    <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
                      소모임 이름 *
                    </Label>
                    <Input
                      name="name"
                      required
                      placeholder={`예: ${template.title} - 시즌 1`}
                      className="mt-1.5 border-nu-ink/15 bg-transparent"
                    />
                  </div>

                  <div>
                    <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
                      카테고리
                    </Label>
                    <Select
                      value={category}
                      onValueChange={(v) => v && setCategory(v)}
                      required
                    >
                      <SelectTrigger className="mt-1.5 border-nu-ink/15 bg-transparent">
                        <SelectValue placeholder="카테고리 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="space">공간 (Space)</SelectItem>
                        <SelectItem value="culture">문화 (Culture)</SelectItem>
                        <SelectItem value="platform">
                          플랫폼 (Platform)
                        </SelectItem>
                        <SelectItem value="vibe">바이브 (Vibe)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
                      소개
                    </Label>
                    <Textarea
                      name="description"
                      rows={4}
                      defaultValue={template.description}
                      placeholder="소모임에 대해 소개해주세요"
                      className="mt-1.5 border-nu-ink/15 bg-transparent resize-none"
                    />
                  </div>

                  <div>
                    <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
                      최대 인원
                    </Label>
                    <Input
                      name="maxMembers"
                      type="number"
                      defaultValue={template.defaultMaxMembers}
                      min={2}
                      max={200}
                      className="mt-1.5 border-nu-ink/15 bg-transparent w-32"
                    />
                    <p className="text-[10px] text-nu-muted mt-1">
                      권장: {template.defaultMaxMembers}명
                    </p>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="relative overflow-hidden font-mono-nu text-[11px] font-bold uppercase tracking-widest px-8 py-3 text-white border-0 transition-all hover:shadow-lg disabled:opacity-60"
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-r ${template.gradient}`}
                      />
                      <span className="relative z-10">
                        {loading
                          ? "생성 중..."
                          : "템플릿으로 소모임 만들기"}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.back()}
                      className="font-mono-nu text-[11px] uppercase tracking-widest"
                    >
                      취소
                    </Button>
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
                  <h3 className="font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] text-white/40 mb-4">
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
                        <span className="text-[11px] text-white/60 leading-snug">
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
                      <span className="font-mono-nu text-[9px] font-bold uppercase tracking-[0.15em] text-white/50">
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
                      <p className="text-[10px] text-white/70 leading-relaxed">
                        이 템플릿에는 <strong>{TEMPLATE_CONTENTS[template.id]?.meetings || 0}개의 미팅</strong>과{" "}
                        <strong>{TEMPLATE_CONTENTS[template.id]?.phases || 0}개의 기본 자료</strong>가 포함되어 있습니다.
                      </p>
                    </div>
                    <p className="text-[10px] text-white/35 leading-relaxed">
                      소모임 생성 시 위 기능들이 자동으로 구성됩니다.
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
      <Link
        href="/groups"
        className="inline-flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors no-underline mb-6"
      >
        <ArrowLeft size={12} />
        소모임 탐색
      </Link>

      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        새 소모임 만들기
      </h1>
      <p className="text-nu-gray text-sm mb-8">새로운 Scene을 시작하세요</p>

      <div className="bg-nu-white border border-nu-ink/[0.08] p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              소모임 이름
            </Label>
            <Input
              name="name"
              required
              placeholder="Space Architects Seoul"
              className="mt-1.5 border-nu-ink/15 bg-transparent"
            />
          </div>

          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              카테고리
            </Label>
            <Select
              value={category}
              onValueChange={(v) => v && setCategory(v)}
              required
            >
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
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              소개
            </Label>
            <Textarea
              name="description"
              rows={4}
              placeholder="소모임에 대해 소개해주세요"
              className="mt-1.5 border-nu-ink/15 bg-transparent resize-none"
            />
          </div>

          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">
              최대 인원
            </Label>
            <Input
              name="maxMembers"
              type="number"
              defaultValue={20}
              min={2}
              max={200}
              className="mt-1.5 border-nu-ink/15 bg-transparent w-32"
            />
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              type="submit"
              disabled={loading}
              className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest px-8"
            >
              {loading ? "생성 중..." : "소모임 만들기"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="font-mono-nu text-[11px] uppercase tracking-widest"
            >
              취소
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
