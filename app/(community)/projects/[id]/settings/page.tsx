"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  Trash2,
  X,
  UserPlus,
  Users,
  AlertTriangle,
  Layers,
  Check,
  ChevronDown,
  Clock,
  ShieldCheck,
  ShieldOff,
  UserMinus,
  UserCheck,
  Mail,
} from "lucide-react";
import type { Specialty, ProjectStatus } from "@/lib/types";

const categories: { value: Specialty; label: string }[] = [
  { value: "space", label: "Space" },
  { value: "culture", label: "Culture" },
  { value: "platform", label: "Platform" },
  { value: "vibe", label: "Vibe" },
];

const statuses: { value: ProjectStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const roleLabels: Record<string, string> = {
  lead: "리드",
  member: "멤버",
  observer: "옵저버",
};

const catColors: Record<string, string> = {
  space: "bg-nu-blue",
  culture: "bg-nu-amber",
  platform: "bg-nu-ink",
  vibe: "bg-nu-pink",
};

interface MemberItem {
  id: string;
  user_id: string | null;
  crew_id: string | null;
  role: string;
  joined_at?: string;
  profile?: { id: string; nickname: string; avatar_url: string | null };
  crew?: { id: string; name: string; category: string };
}

interface ApplicationItem {
  id: string;
  applicant_id: string;
  message: string | null;
  portfolio_url: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  created_at: string;
  applicant?: { id: string; nickname: string; avatar_url: string | null; specialty: string | null };
}

export default function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Specialty>("space");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [kakaoUrl, setKakaoUrl]   = useState("");
  const [driveUrl, setDriveUrl]   = useState("");
  const [slackUrl, setSlackUrl]   = useState("");
  const [notionUrl, setNotionUrl] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("KRW");
  const [dashUrl, setDashUrl]           = useState("");

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [crews, setCrews] = useState<{ id: string; name: string; category: string }[]>([]);
  const [searchNickname, setSearchNickname] = useState("");
  const [selectedCrewId, setSelectedCrewId] = useState("");
  const [processingApp, setProcessingApp] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // Check permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    // Load project
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (!project) {
      toast.error("볼트를 찾을 수 없습니다");
      router.push("/projects");
      return;
    }

    // Check if user is lead
    const { data: membership } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!isAdmin && membership?.role !== "lead" && membership?.role !== "manager") {
      toast.error("설정 접근 권한이 없습니다");
      router.push(`/projects/${projectId}`);
      return;
    }

    setTitle(project.title);
    setDescription(project.description || "");
    setCategory(project.category || "space");
    setStatus(project.status);
    setStartDate(project.start_date || "");
    setEndDate(project.end_date || "");
    setImageUrl(project.image_url);
    setImagePreview(project.image_url);
    setKakaoUrl(project.kakao_chat_url || project.tool_kakao || "");
    setDriveUrl(project.google_drive_url || project.tool_drive || "");
    setSlackUrl(project.tool_slack || "");
    setNotionUrl(project.tool_notion || "");
    setTotalBudget(project.total_budget ? String(project.total_budget) : "");
    setBudgetCurrency(project.budget_currency || "KRW");
    setDashUrl(project.milestone_dashboard_url || "");

    // Load members
    const { data: membersData } = await supabase
      .from("project_members")
      .select(
        "*, profile:profiles!project_members_user_id_fkey(id, nickname, avatar_url), crew:groups!project_members_crew_id_fkey(id, name, category)"
      )
      .eq("project_id", projectId)
      .order("joined_at");

    setMembers(membersData || []);

    // Load pending applications
    const { data: appsData } = await supabase
      .from("project_applications")
      .select("id, applicant_id, message, portfolio_url, status, created_at, applicant:profiles!project_applications_applicant_id_fkey(id, nickname, avatar_url, specialty)")
      .eq("project_id", projectId)
      .in("status", ["pending"])
      .order("created_at", { ascending: false });

    setApplications((appsData || []) as ApplicationItem[]);

    // Load all crews for dropdown
    const { data: crewsData } = await supabase
      .from("groups")
      .select("id, name, category")
      .eq("is_active", true)
      .order("name");

    setCrews(crewsData || []);
    setLoading(false);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  // ── Application management ───────────────────────────────────
  async function approveApplication(app: ApplicationItem) {
    setProcessingApp(app.id);
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // 1. Update application status
      const { error: appErr } = await supabase
        .from("project_applications")
        .update({ status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", app.id);
      if (appErr) throw appErr;

      // 2. Create member record
      const { data: newMember, error: memErr } = await supabase
        .from("project_members")
        .insert({ project_id: projectId, user_id: app.applicant_id, role: "member" })
        .select("*, profile:profiles!project_members_user_id_fkey(id, nickname, avatar_url)")
        .single();
      if (memErr && memErr.code !== "23505") throw memErr; // ignore duplicate

      // 3. Notify applicant
      await supabase.from("notifications").insert({
        user_id: app.applicant_id,
        type: "application_approved",
        title: "볼트 지원 승낙",
        body: `'${title}' 볼트에 합류하셨습니다! 환영합니다.`,
        metadata: { project_id: projectId },
        is_read: false,
      });

      setApplications(prev => prev.filter(a => a.id !== app.id));
      if (newMember) setMembers(prev => [...prev, newMember]);
      toast.success(`${app.applicant?.nickname}님을 승낙했습니다`);
    } catch (err: any) {
      toast.error(err.message || "승낙 실패");
    } finally {
      setProcessingApp(null);
    }
  }

  async function rejectApplication(app: ApplicationItem) {
    if (!confirm(`${app.applicant?.nickname}님의 지원을 거절하시겠습니까?`)) return;
    setProcessingApp(app.id);
    const supabase = createClient();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("project_applications")
        .update({ status: "rejected", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", app.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: app.applicant_id,
        type: "application_rejected",
        title: "볼트 지원 결과",
        body: `'${title}' 볼트 지원이 검토 후 보류되었습니다.`,
        metadata: { project_id: projectId },
        is_read: false,
      });

      setApplications(prev => prev.filter(a => a.id !== app.id));
      toast.success("지원을 거절했습니다");
    } catch (err: any) {
      toast.error(err.message || "거절 실패");
    } finally {
      setProcessingApp(null);
    }
  }

  // ── Role change ──────────────────────────────────────────────
  async function changeRole(memberId: string, userId: string | null, newRole: string) {
    setChangingRole(memberId);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("project_members")
        .update({ role: newRole })
        .eq("id", memberId);
      if (error) throw error;

      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      if (userId) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "role_changed",
          title: "볼트 역할 변경",
          body: `볼트에서 역할이 '${roleLabels[newRole] || newRole}'(으)로 변경되었습니다.`,
          metadata: { project_id: projectId },
          is_read: false,
        });
      }
      toast.success("역할이 변경되었습니다");
    } catch (err: any) {
      toast.error(err.message || "역할 변경 실패");
    } finally {
      setChangingRole(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("제목을 입력해주세요");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      let finalImageUrl = imageUrl;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `projects/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(path, imageFile);
        if (uploadError) throw uploadError;
        const {
          data: { publicUrl },
        } = supabase.storage.from("media").getPublicUrl(path);
        finalImageUrl = publicUrl;
      }

      // Core fields (always exist)
      const { error } = await supabase
        .from("projects")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          category,
          status,
          start_date: startDate || null,
          end_date: endDate || null,
          image_url: finalImageUrl,
          kakao_chat_url: kakaoUrl.trim() || null,
          google_drive_url: driveUrl.trim() || null,
        })
        .eq("id", projectId);

      if (error) throw error;

      // Extended fields (migration 034/010 — best-effort, ignore if columns missing)
      await supabase.from("projects").update({
        tool_slack: slackUrl.trim() || null,
        tool_notion: notionUrl.trim() || null,
        tool_drive: driveUrl.trim() || null,
        tool_kakao: kakaoUrl.trim() || null,
        total_budget: totalBudget ? parseInt(totalBudget) : null,
        budget_currency: budgetCurrency || "KRW",
        milestone_dashboard_url: dashUrl.trim() || null,
      }).eq("id", projectId);
      toast.success("볼트가 업데이트되었습니다");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "업데이트 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handlePromoteManager(memberId: string, userId: string, isCurrentlyManager: boolean) {
    const supabase = createClient();
    const newRole = isCurrentlyManager ? "member" : "manager";
    const { error } = await supabase
      .from("project_members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (error) { toast.error("역할 변경에 실패했습니다"); return; }

    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));

    await supabase.from("notifications").insert({
      user_id: userId,
      type: "role_changed",
      title: isCurrentlyManager ? "매니저 권한 해제" : "볼트 매니저로 임명",
      body: isCurrentlyManager
        ? "볼트 매니저 권한이 해제되었습니다."
        : "볼트 매니저로 임명되었습니다. 와셔 관리와 볼트 설정 일부를 제어할 수 있습니다.",
      metadata: { project_id: projectId },
      is_read: false,
    });

    toast.success(isCurrentlyManager ? "일반 멤버로 변경되었습니다" : "매니저로 임명되었습니다");
  }

  async function removeMember(memberId: string) {
    if (!confirm("이 멤버를 정말 제거하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("멤버가 제거되었습니다");
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  }

  async function addUserMember() {
    if (!searchNickname.trim()) return;
    const supabase = createClient();

    const { data: foundUser } = await supabase
      .from("profiles")
      .select("id, nickname")
      .eq("nickname", searchNickname.trim())
      .single();

    if (!foundUser) {
      toast.error("해당 닉네임의 사용자를 찾을 수 없습니다");
      return;
    }

    // Check if already a member
    if (members.some((m) => m.user_id === foundUser.id)) {
      toast.error("이미 이 볼트의 와셔입니다");
      return;
    }

    const { data: newMember, error } = await supabase
      .from("project_members")
      .insert({
        project_id: projectId,
        user_id: foundUser.id,
        role: "member",
      })
      .select(
        "*, profile:profiles!project_members_user_id_fkey(id, nickname, avatar_url)"
      )
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setMembers((prev) => [...prev, newMember]);
    setSearchNickname("");
    toast.success(`${foundUser.nickname}님이 추가되었습니다`);
  }

  async function addCrewMember() {
    if (!selectedCrewId) return;
    const supabase = createClient();

    if (members.some((m) => m.crew_id === selectedCrewId)) {
      toast.error("이미 참여 중인 너트입니다");
      return;
    }

    const { data: newMember, error } = await supabase
      .from("project_members")
      .insert({
        project_id: projectId,
        crew_id: selectedCrewId,
        role: "member",
      })
      .select(
        "*, crew:groups!project_members_crew_id_fkey(id, name, category)"
      )
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setMembers((prev) => [...prev, newMember]);
    setSelectedCrewId("");
    toast.success("너트가 추가되었습니다");
  }

  async function handleSnapshot() {
    if (!confirm("현재 볼트 상태를 스냅샷으로 박제하시겠습니까? 외부 링크가 사라져도 넛유니온 내에서 영구히 조회 가능해집니다.")) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const snapshot = `
# Project Snapshot: ${title}
- Status: ${status}
- Category: ${category}
- Duration: ${startDate} ~ ${endDate}

## Description
${description}

## Team Members
${members.map(m => `- ${m.profile?.nickname || m.crew?.name} (${m.role})`).join('\n')}

## Tool Hub Links
- Slack: ${slackUrl}
- Notion: ${notionUrl}
- Drive: ${driveUrl}

Generated at: ${new Date().toLocaleString()}
      `;

      const { error } = await supabase.from("projects").update({ snapshot_content: snapshot }).eq("id", projectId);
      if (error) throw error;
      toast.success("볼트 스냅샷이 서버에 보관되었습니다");
    } catch (err: any) {
      toast.error("스냅샷 생성 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!confirm("볼트를 보관하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ status: "archived" })
      .eq("id", projectId);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("볼트가 보관되었습니다");
    router.push("/projects");
  }

  async function handleDelete() {
    if (
      !confirm(
        "정말로 이 볼트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    )
      return;
    const supabase = createClient();

    // Delete in order: tasks, milestones, updates, members, project
    await supabase
      .from("project_tasks")
      .delete()
      .eq("project_id", projectId);
    await supabase
      .from("project_milestones")
      .delete()
      .eq("project_id", projectId);
    await supabase
      .from("project_updates")
      .delete()
      .eq("project_id", projectId);
    await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId);

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("볼트가 삭제되었습니다");
    router.push("/projects");
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-20 flex justify-center">
        <Loader2 size={24} className="animate-spin text-nu-muted" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        볼트 설정
      </h1>
      <p className="text-nu-gray text-sm mb-8">{title}</p>

      {/* Edit form */}
      <form onSubmit={handleSave} className="space-y-6 mb-12">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6 space-y-5">
          <h2 className="font-head text-lg font-extrabold">기본 정보</h2>

          <div>
            <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
              제목 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
              required
            />
          </div>

          <div>
            <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
                카테고리
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Specialty)}
                className="w-full px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
                상태
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
              >
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
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
                className="w-full px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
              />
            </div>
          </div>

          {/* Image */}
          <div>
            <label className="block font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-2">
              커버 이미지
            </label>
            <div className="border border-dashed border-nu-ink/20 p-4 text-center">
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="미리보기"
                    className="max-h-40 mx-auto object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      setImageUrl(null);
                    }}
                    className="mt-2 font-mono-nu text-[12px] text-nu-red uppercase tracking-widest"
                  >
                    삭제
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2">
                  <Upload size={20} className="text-nu-muted" />
                  <span className="text-xs text-nu-gray">이미지 업로드</span>
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
        </div>

        {/* External integrations - Tool Hub */}
        <div className="border-t border-nu-ink/[0.06] pt-5 mt-2">
          <span className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink block mb-4">️ 툴 허브 (외부 연동)</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray block mb-1.5">Slack 채널 URL</label>
              <input value={slackUrl} onChange={(e) => setSlackUrl(e.target.value)} placeholder="https://app.slack.com/..." className="w-full border border-nu-ink/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-nu-pink" />
            </div>
            <div>
              <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray block mb-1.5">Notion 보드 URL</label>
              <input value={notionUrl} onChange={(e) => setNotionUrl(e.target.value)} placeholder="https://notion.so/..." className="w-full border border-nu-ink/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-nu-pink" />
            </div>
            <div>
              <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray block mb-1.5">Google Drive URL</label>
              <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/..." className="w-full border border-nu-ink/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-nu-pink" />
            </div>
            <div>
              <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray block mb-1.5">카카오톡 오픈채팅 URL</label>
              <input value={kakaoUrl} onChange={(e) => setKakaoUrl(e.target.value)} placeholder="https://open.kakao.com/o/..." className="w-full border border-nu-ink/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-nu-pink" />
            </div>
          </div>
        </div>

        {/* Budget */}
        <div className="border-t border-nu-ink/[0.06] pt-5">
          <span className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink block mb-4"> 예산 & 보상 투명성</span>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray block mb-1.5">총 사업비</label>
              <input type="number" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} placeholder="10000000" className="w-full border border-nu-ink/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-nu-pink" />
            </div>
            <div>
              <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray block mb-1.5">통화</label>
              <select value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value)} className="w-full border border-nu-ink/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-nu-pink">
                <option value="KRW">KRW</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-4 mt-6">
            <div>
              <label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink block mb-1.5 flex items-center gap-2">
                <Layers size={13} /> 실시간 볼트 대시보드 URL (외부)
              </label>
              <input value={dashUrl} onChange={(e) => setDashUrl(e.target.value)} placeholder="https://databox.com/board/..." className="w-full border border-nu-ink/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-nu-pink" />
              <p className="font-mono-nu text-[11px] text-nu-muted mt-1">볼트 대시보드 탭에 대시보드를 연동하여 팀원들과 공유합니다</p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full font-mono-nu text-[13px] font-bold uppercase tracking-[0.1em] py-4 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" /> 저장 중...
            </>
          ) : (
            "변경사항 저장"
          )}
        </button>
      </form>

      {/* Members management */}
      <div className="bg-nu-white border border-nu-ink/[0.08] mb-8">
        <div className="px-6 py-5 border-b border-nu-ink/[0.08] flex items-center justify-between">
          <h2 className="font-head text-lg font-extrabold flex items-center gap-2">
            <Users size={18} /> 멤버 관리
          </h2>
          <span className="font-mono-nu text-[12px] text-nu-muted">{members.length}명 참여 중</span>
        </div>

        {/* ── Pending applications ── */}
        {applications.length > 0 && (
          <div className="border-b border-nu-ink/[0.08]">
            <div className="px-6 py-3 bg-nu-amber/5 flex items-center gap-2">
              <Clock size={13} className="text-nu-amber" />
              <span className="font-mono-nu text-[12px] font-bold uppercase tracking-widest text-nu-amber">
                지원 대기 {applications.length}건
              </span>
            </div>
            <div className="divide-y divide-nu-ink/[0.06]">
              {applications.map((app) => (
                <div key={app.id} className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-nu-amber/10 flex items-center justify-center font-head text-sm font-bold text-nu-amber shrink-0">
                      {app.applicant?.nickname?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-nu-ink">{app.applicant?.nickname}</p>
                        {app.applicant?.specialty && (
                          <span className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 bg-nu-cream text-nu-muted border border-nu-ink/10">
                            {app.applicant.specialty}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-nu-muted">
                        {new Date(app.created_at).toLocaleDateString("ko", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} 지원
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                        className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1.5 border border-nu-ink/10 text-nu-muted hover:border-nu-ink/30 transition-colors"
                      >
                        <Mail size={11} />
                      </button>
                      <button
                        type="button"
                        disabled={processingApp === app.id}
                        onClick={() => rejectApplication(app)}
                        className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-40"
                      >
                        {processingApp === app.id ? <Loader2 size={10} className="animate-spin" /> : <X size={11} />}
                        거절
                      </button>
                      <button
                        type="button"
                        disabled={processingApp === app.id}
                        onClick={() => approveApplication(app)}
                        className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-1 disabled:opacity-40"
                      >
                        {processingApp === app.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={11} />}
                        승낙
                      </button>
                    </div>
                  </div>
                  {/* Expandable: message + portfolio */}
                  {expandedApp === app.id && (app.message || app.portfolio_url) && (
                    <div className="mt-3 ml-12 space-y-2 animate-in slide-in-from-top-2 duration-150">
                      {app.message && (
                        <div className="bg-nu-cream/50 border border-nu-ink/[0.08] px-4 py-3">
                          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">지원 메시지</p>
                          <p className="text-sm text-nu-graphite leading-relaxed">{app.message}</p>
                        </div>
                      )}
                      {app.portfolio_url && (
                        <a
                          href={app.portfolio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-mono-nu text-[11px] text-nu-blue hover:underline no-underline"
                        >
                          포트폴리오 링크 →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Current members ── */}
        <div className="divide-y divide-nu-ink/[0.06]">
          {members.length === 0 ? (
            <div className="px-6 py-8 text-center text-nu-muted text-sm">
              아직 멤버가 없습니다
            </div>
          ) : members.map((m) => (
            <div key={m.id} className="px-6 py-4 flex items-center gap-3">
              {/* Avatar */}
              {m.user_id && m.profile ? (
                <div className="w-9 h-9 rounded-full bg-nu-cream flex items-center justify-center font-head text-sm font-bold text-nu-ink shrink-0">
                  {m.profile.nickname.charAt(0).toUpperCase()}
                </div>
              ) : m.crew_id && m.crew ? (
                <div className={`w-9 h-9 flex items-center justify-center font-head text-sm font-bold text-white shrink-0 ${catColors[m.crew.category] || "bg-nu-gray"}`}>
                  {m.crew.name.charAt(0)}
                </div>
              ) : null}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-nu-ink">
                    {m.profile?.nickname || m.crew?.name || "—"}
                  </p>
                  <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5 ${
                    m.role === "lead" ? "bg-nu-pink text-white" :
                    m.role === "manager" ? "bg-nu-blue/10 text-nu-blue" :
                    m.role === "observer" ? "bg-nu-cream text-nu-muted" :
                    "bg-nu-ink/5 text-nu-graphite"
                  }`}>
                    {roleLabels[m.role] || m.role}
                  </span>
                </div>
                <p className="text-[11px] text-nu-muted">
                  {m.crew ? `너트 · ${m.crew.category}` : "개인 참여"}
                </p>
              </div>

              {/* Actions — lead 본인 제외 */}
              {m.role !== "lead" && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Role selector */}
                  {m.user_id && (
                    <div className="relative">
                      <select
                        value={m.role}
                        disabled={changingRole === m.id}
                        onChange={(e) => changeRole(m.id, m.user_id, e.target.value)}
                        className="appearance-none font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 pr-6 border border-nu-ink/10 text-nu-muted bg-transparent hover:border-nu-ink/30 focus:outline-none focus:border-nu-blue transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <option value="member">멤버</option>
                        <option value="manager">매니저</option>
                        <option value="observer">옵저버</option>
                        <option value="lead">리드로 이전</option>
                      </select>
                      {changingRole === m.id ? (
                        <Loader2 size={10} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-nu-muted pointer-events-none" />
                      ) : (
                        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-nu-muted pointer-events-none" />
                      )}
                    </div>
                  )}
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeMember(m.id)}
                    className="p-1.5 text-nu-muted/40 hover:text-red-500 hover:bg-red-50 transition-colors rounded"
                    title="멤버 제외"
                  >
                    <UserMinus size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Add member ── */}
        <div className="border-t border-nu-ink/[0.08] px-6 py-5 space-y-4">
          <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted font-bold">멤버 직접 추가</p>
          {/* Add user member */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchNickname}
              onChange={(e) => setSearchNickname(e.target.value)}
              placeholder="닉네임으로 검색"
              className="flex-1 px-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addUserMember(); }
              }}
            />
            <button
              type="button"
              onClick={addUserMember}
              className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 bg-nu-blue text-white hover:bg-nu-blue/90 transition-colors flex items-center gap-1"
            >
              <UserPlus size={12} /> 추가
            </button>
          </div>

          {/* Add crew */}
          <div className="flex gap-2">
            <select
              value={selectedCrewId}
              onChange={(e) => setSelectedCrewId(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
            >
              <option value="">너트(그룹) 추가...</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>[{c.category}] {c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addCrewMember}
              className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2.5 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors flex items-center gap-1"
            >
              <UserPlus size={12} /> 추가
            </button>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-nu-white border border-nu-red/20 p-6">
        <h2 className="font-head text-lg font-extrabold text-nu-red mb-4 flex items-center gap-2">
          <AlertTriangle size={18} /> 위험 영역
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSnapshot}
            disabled={saving}
            className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-5 py-3 border border-nu-ink text-nu-ink hover:bg-nu-ink hover:text-white transition-colors"
          >
            스냅샷 박제 (Snapshot)
          </button>
          <button
            onClick={handleArchive}
            className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-5 py-3 border border-nu-amber text-nu-amber hover:bg-nu-amber hover:text-white transition-colors"
          >
            볼트 보관
          </button>
          <button
            onClick={handleDelete}
            className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-5 py-3 border border-nu-red text-nu-red hover:bg-nu-red hover:text-white transition-colors flex items-center justify-center gap-1"
          >
            <Trash2 size={12} /> 볼트 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
