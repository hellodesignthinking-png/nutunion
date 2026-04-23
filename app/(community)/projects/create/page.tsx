"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { seedProjectTemplate } from "@/lib/project-template-seeder";
import { toast } from "sonner";
import { Upload, Loader2, ArrowLeft, ChevronRight, Sparkles, Users, Clock, Check, Copy, Share2, UserPlus, Search, CheckCircle2 } from "lucide-react";
import type { Specialty } from "@/lib/types";
import { RoleSlotsEditor, type RoleSlot } from "@/components/projects/role-slots-editor";
import { BoltScopingSuggest } from "@/components/ai/bolt-scoping-suggest";
import { BoltTypeSelector } from "@/components/bolt/bolt-type-selector";
import { BoltTypeFields, type TypeFieldsPayload } from "@/components/bolt/bolt-type-fields";
import type { BoltType } from "@/lib/bolt/types";
import { GenesisFlow } from "@/components/genesis/GenesisFlow";

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
  "platform-mvp":   { milestones: 4, resources: 2 },
  "popup-store":     { milestones: 4, resources: 2 },
  "consulting-brand":    { milestones: 5, resources: 3 },
  "consulting-strategy": { milestones: 4, resources: 3 },
  "consulting-retainer": { milestones: 3, resources: 2 },
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
  // ── Torque 컨설팅 템플릿 3종 ──
  "consulting-brand": {
    id: "consulting-brand",
    title: "Brand Consulting",
    subtitle: "컨설팅 / 브랜드 콘설팅",
    description:
      "외부 브랜딩 컨설턴트와 함께 아이덴티티 재정립·시각화·론칭을 진행하는 Torque Bolt 템플릿. 세션 스케줄부터 산출물 관리까지 컨설팅 프로세스의 모든 단계가 자동으로 설치됩니다.",
    gradient: "from-teal-900 via-teal-700 to-teal-500",
    accent: "#0d9488",
    defaultCategory: "culture",
    duration: "2-3개월",
    features: [
      "팀 미팅 + 컨설턴트 세션 이중 트랙",
      "요청 큐 자동 설치",
      "산출물 라이브러리 (제안서/보고서)",
      "리스크 레지스터 + 의사결정 로그",
      "Consulting Kit (11개 Thread) 자동 설치",
    ],
  },
  "consulting-strategy": {
    id: "consulting-strategy",
    title: "Strategy Consulting",
    subtitle: "컨설팅 / 전략 컨설팅",
    description:
      "일회성 전략 컨설팅 프로젝트. 리서치 → 진단 → 제안 → 평가 단계의 명확한 픈널을 제공합니다. 리테이너 계약이 아닌 미로 하나의 컨설팅 업무를 명확한 종료일과 함께 체계적으로 관리합니다.",
    gradient: "from-teal-800 via-cyan-700 to-blue-600",
    accent: "#0891b2",
    defaultCategory: "culture",
    duration: "1-2개월",
    features: [
      "컨설팅 5단계 진행 트래커",
      "컨설턴트 세션 (Discovery→진단→제안→평가)",
      "리스크 매트릭스 + 의사결정 로그",
      "최종 보고서 + 실행 로드맵",
      "긴급 요청 코스 자동 파악",
    ],
  },
  "consulting-retainer": {
    id: "consulting-retainer",
    title: "Retainer Contract",
    subtitle: "컨설팅 / 리테이너 컨설팅",
    description:
      "월 계약 명태로 지속되는 리테이너 컨설팅 볼트. 시간 소진과 월별 안건, 요청 큐 관리, 월간 컴잠 리포트 구조가 자동으로 설정됩니다. 장기 파트너쓭 관리에 최적화되어 있습니다.",
    gradient: "from-teal-900 via-teal-800 to-emerald-700",
    accent: "#059669",
    defaultCategory: "culture",
    duration: "월 계약 (무기한)",
    features: [
      "월 계약 시간 + 시간당 단가 관리",
      "리테이너 소진률 실시간 미터",
      "월별 안건 자동 생성 (AI)",
      "지속적 요청 큐 관리",
      "리스크 이슬레이션 알림",
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
  // 템플릿 description 을 기본값으로 자동 채우지 않음 — 똑같은 복붙 글을 만드는 원인.
  // 대신 placeholder / 하단 힌트로만 제공.
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [roleSlots, setRoleSlots] = useState<RoleSlot[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // 볼트 유형 + 유형별 필드 (migration 084 이후)
  // 컨설팅 템플릿 선택 시 torque 자동 설정
  const isConsultingTemplate = templateKey?.startsWith("consulting-") ?? false;
  const [boltType, setBoltType] = useState<BoltType>(
    isConsultingTemplate ? "torque" : "hex"
  );
  const todayStr = new Date().toISOString().slice(0, 10);
  const [typeFields, setTypeFields] = useState<TypeFieldsPayload>(
    isConsultingTemplate
      ? {
          engagement_type:
            templateKey === "consulting-retainer" ? "retainer"
            : templateKey === "consulting-strategy" ? "one_time"
            : "hybrid",
          started_at: todayStr,
        }
      : {}
  );

  // Torque 볼트 선택 시 started_at 오늘로 자동 초기화
  function handleBoltTypeChange(t: BoltType) {
    setBoltType(t);
    if (t === "torque") {
      setTypeFields((prev: any) => ({
        engagement_type: "one_time",
        started_at: todayStr,
        ...prev,
        // 다른 타입에서 전환 시 기존 값 초기화
        ...(boltType !== "torque" ? {
          engagement_type: "one_time",
          started_at: todayStr,
          ended_at: undefined,
          scope_summary: undefined,
          retainer_monthly_hours: undefined,
          retainer_hourly_rate_krw: undefined,
        } : {}),
      }));
    } else {
      setTypeFields({});
    }
  }
  // After creation invite step
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [createdProjectTitle, setCreatedProjectTitle] = useState<string>("");
  // Genesis AI mode toggle (default for non-template)
  const [mode, setMode] = useState<"genesis" | "manual">(template ? "manual" : "genesis");

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

      // Upload image if selected — 통합 업로더 (R2 우선)
      if (imageFile) {
        try {
          const { uploadFile } = await import("@/lib/storage/upload-client");
          const up = await uploadFile(imageFile, { prefix: "uploads", scopeId: user.id });
          imageUrl = up.url;
        } catch (uploadError: any) {
          toast.error("이미지 업로드 실패: " + (uploadError?.message || String(uploadError)));
          setLoading(false);
          return;
        }
      }

      // Insert project (role_slots / type 누락 스키마 graceful fallback)
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        category,
        status: "active",
        start_date: startDate || null,
        end_date: endDate || null,
        image_url: imageUrl,
        created_by: user.id,
        type: boltType,
      };
      if (roleSlots.length > 0) payload.role_slots = roleSlots;

      let projectRes = await supabase.from("projects").insert(payload).select("id").single();
      // migration 084 미적용 환경 (type 컬럼 없음) — type 제거하고 재시도
      if (projectRes.error && /\btype\b/i.test(projectRes.error.message || "")) {
        delete payload.type;
        projectRes = await supabase.from("projects").insert(payload).select("id").single();
      }
      if (projectRes.error && /role_slots/.test(projectRes.error.message || "")) {
        delete payload.role_slots;
        projectRes = await supabase.from("projects").insert(payload).select("id").single();
      }
      const { data: project, error } = projectRes;
      if (error) throw error;

      // 유형별 서브타입 insert (best-effort — 실패해도 볼트는 생성된 상태)
      if (boltType !== "hex") {
        const subPayload: any = { project_id: project.id, ...typeFields };
        // Torque: started_at 미입력 시 오늘 날짜 기본값
        if (boltType === "torque" && !subPayload.started_at) {
          subPayload.started_at = new Date().toISOString().slice(0, 10);
        }
        // Torque: engagement_type 미입력 시 기본값
        if (boltType === "torque" && !subPayload.engagement_type) {
          subPayload.engagement_type = "one_time";
        }
        const tableMap: Record<BoltType, string | null> = {
          hex: null,
          anchor: "project_anchor",
          carriage: "project_carriage",
          eye: "project_eye",
          wing: "project_wing",
          torque: "project_torque",
        };
        const table = tableMap[boltType];
        if (table) {
          const { error: subErr } = await supabase.from(table).insert(subPayload);
          if (subErr) {
            console.error("[subtype insert]", subErr);
            toast.error(
              `볼트는 생성됐지만 ${boltType} 서브타입 정보 저장에 실패했어요: ${subErr.message}`,
            );
          }
        }
      }

      // Torque 볼트: 생성자를 bolt_memberships에 owner로 자동 등록
      if (boltType === "torque") {
        await supabase.from("bolt_memberships").upsert(
          { project_id: project.id, user_id: user.id, role: "owner" },
          { onConflict: "project_id,user_id" }
        ).then(({ error }) => {
          if (error) console.warn("[bolt_memberships owner]", error);
        });
      }

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

      // Torque 볼트 / 컨설팅 템플릿: Consulting Kit (11개 Thread) 자동 설치
      if (boltType === "torque" || isConsultingTemplate) {
        try {
          const { installConsultingKit } = await import("@/lib/kits/consulting-kit");
          const kitResult = await installConsultingKit(supabase, project.id);
          if (kitResult.installed > 0) {
            toast.success(`🎓 Consulting Kit ${kitResult.installed}개 Thread 설치 완료`);
          }
        } catch (kitErr) {
          console.warn("[consulting-kit] 설치 실패 (볼트는 정상 생성):", kitErr);
        }
      }

      toast.success(
        template
          ? `${template.title} 템플릿으로 볼트가 생성되었습니다!`
          : boltType === "torque"
          ? "🎓 Torque 볼트가 생성되었습니다!"
          : "볼트가 생성되었습니다!"
      );

      // [Drive migration Phase A] 자동 Google Drive 폴더 생성 비활성화 — 신규 볼트 자료는 Cloudflare R2 에 저장됩니다
      toast.info("자료는 Cloudflare R2 에 저장됩니다");


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
                      placeholder={`이 볼트가 해결하는 고유한 문제 / 차별점을 1~2문장으로 설명해주세요.\n(예: "강남 소상공인 10명과 함께 로컬 브랜드 가이드를 만드는 8주 프로젝트")`}
                      rows={4}
                      className="w-full px-4 py-3 border border-nu-ink/15 bg-transparent text-sm focus:outline-none focus:border-nu-pink transition-colors resize-none"
                    />
                    <div className="mt-1 flex items-center justify-between text-[11px] text-nu-muted">
                      <span>{description.trim().length}자 · 최소 40자 권장</span>
                      <button
                        type="button"
                        onClick={() => setDescription(template.description)}
                        className="text-nu-pink hover:underline font-mono-nu text-[10px] uppercase tracking-widest"
                        title="템플릿 기본 설명으로 채우기 (직접 수정 권장)"
                      >
                        템플릿 예시 불러오기 ↓
                      </button>
                    </div>
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
      <p className="text-nu-gray text-sm mb-6">
        너트들이 함께할 볼트를 시작하세요
      </p>

      {/* ── 템플릿 빠른 선택 섹션 ── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite font-bold flex items-center gap-1.5">
            <Sparkles size={11} /> 템플릿으로 시작하기
          </h2>
          <span className="font-mono-nu text-[10px] text-nu-muted">6개 템플릿 · 직접 설정보다 빠름</span>
        </div>

        {/* 일반 템플릿 */}
        <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">일반 볼트</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {["local-branding","platform-mvp","popup-store"].map(key => {
            const t = PROJECT_TEMPLATES[key];
            return (
              <a
                key={key}
                href={`/projects/create?template=${key}`}
                className={`relative overflow-hidden p-3 text-left transition-all hover:scale-[1.02] hover:shadow-md no-underline block border border-white/10`}
                style={{ background: `linear-gradient(135deg, ${t.gradient.replace("from-","").replace("via-","").replace("to-","")})` }}
              >
                <div className="absolute inset-0 opacity-90" style={{ background: `linear-gradient(135deg, #0f172a, #1e293b)` }} />
                <div className="relative z-10">
                  <p className="font-mono-nu text-[9px] uppercase tracking-widest text-white/50 mb-1">{t.duration}</p>
                  <p className="font-head text-[13px] font-extrabold text-white leading-tight">{t.title}</p>
                  <p className="font-mono-nu text-[10px] text-white/50 mt-1">{t.features.length}개 기능</p>
                </div>
              </a>
            );
          })}
        </div>

        {/* 컨설팅 템플릿 */}
        <p className="font-mono-nu text-[10px] uppercase tracking-widest text-teal-700 mb-2 flex items-center gap-1">
          🎓 Torque 컨설팅 볼트
        </p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {["consulting-brand","consulting-strategy","consulting-retainer"].map(key => {
            const t = PROJECT_TEMPLATES[key];
            return (
              <a
                key={key}
                href={`/projects/create?template=${key}`}
                className="relative overflow-hidden p-3 text-left transition-all hover:scale-[1.02] hover:shadow-md no-underline block"
                style={{ background: "linear-gradient(135deg, #0f2520, #0d3330)" }}
              >
                <div className="absolute top-0 right-0 w-0 h-0 border-t-[20px] border-r-[20px] border-teal-500/40 border-b-transparent border-l-transparent" />
                <div className="relative z-10">
                  <p className="font-mono-nu text-[9px] uppercase tracking-widest text-teal-400 mb-1">{t.duration}</p>
                  <p className="font-head text-[13px] font-extrabold text-white leading-tight">{t.title}</p>
                  <p className="font-mono-nu text-[10px] text-teal-300/60 mt-1">Kit {t.features.length}개 자동 설치</p>
                </div>
              </a>
            );
          })}
        </div>
        <div className="border-b-[2px] border-nu-ink/[0.06] pb-6 mb-6" />
      </div>

      {/* Mode toggle — Genesis AI vs 직접 입력 */}
      <div className="inline-flex items-center gap-0 mb-5 border-2 border-nu-ink/15 bg-nu-white p-1">
        <button
          type="button"
          onClick={() => setMode("genesis")}
          className={`font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 transition-colors ${
            mode === "genesis" ? "bg-nu-ink text-nu-paper" : "text-nu-gray hover:text-nu-ink"
          }`}
        >
          ✨ Genesis AI
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 transition-colors ${
            mode === "manual" ? "bg-nu-ink text-nu-paper" : "text-nu-gray hover:text-nu-ink"
          }`}
        >
          📝 직접 입력
        </button>
      </div>

      {mode === "genesis" ? (
        <GenesisFlow kind="project" />
      ) : (
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bolt Type Selector — 6가지 유형 중 선택 */}
        <BoltTypeSelector value={boltType} onChange={handleBoltTypeChange} />

        {/* Torque 선택 시 컨설팅 안내 배너 */}
        {boltType === "torque" && (
          <div className="p-4 bg-teal-50 border-[2px] border-teal-300 space-y-2">
            <p className="font-mono-nu text-[11px] uppercase tracking-widest text-teal-700 font-bold flex items-center gap-1.5">
              🎓 컨설팅형 볼트 (Torque) 안내
            </p>
            <ul className="text-[12px] text-teal-800 space-y-1 leading-relaxed">
              <li>• 팀 미팅 + 컨설턴트 세션 <strong>이중 트랙</strong>이 자동 설치됩니다</li>
              <li>• 요청 큐, 산출물 라이브러리, 리스크 레지스터 등 <strong>11개 Thread</strong> 자동 구성</li>
              <li>• 생성 후 멤버 관리에서 <strong>컨설턴트를 초대</strong>할 수 있습니다</li>
              <li>• 리테이너 계약 시 월 계약 시간과 단가를 입력하면 <strong>소진율</strong>을 실시간 추적합니다</li>
            </ul>
          </div>
        )}

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

        {/* Bolt Type Fields — 유형별 전용 필드 (Torque 시 컨설팅 계약 정보) */}
        <BoltTypeFields type={boltType} value={typeFields} onChange={setTypeFields} />


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

        {/* AI Scoping 제안 */}
        <div className="border-t border-nu-ink/[0.08] pt-6">
          <BoltScopingSuggest
            title={title}
            description={description}
            category={category}
            onAccept={(slots, milestonesText) => {
              setRoleSlots(slots);
              // 마일스톤 텍스트를 description 하단에 추가 (편집 가능)
              setDescription((prev) => prev.trim() ? `${prev}\n\n--- AI 제안 마일스톤 ---\n${milestonesText}` : milestonesText);
            }}
          />
        </div>

        {/* Role Slots */}
        <div>
          <RoleSlotsEditor value={roleSlots} onChange={setRoleSlots} />
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
      )}
    </div>
  );
}
