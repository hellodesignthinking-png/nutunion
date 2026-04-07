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
  profile?: { id: string; nickname: string; avatar_url: string | null };
  crew?: { id: string; name: string; category: string };
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

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [crews, setCrews] = useState<{ id: string; name: string; category: string }[]>([]);
  const [searchNickname, setSearchNickname] = useState("");
  const [selectedCrewId, setSelectedCrewId] = useState("");

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
      toast.error("프로젝트를 찾을 수 없습니다");
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

    // Load members
    const { data: membersData } = await supabase
      .from("project_members")
      .select(
        "*, profile:profiles!project_members_user_id_fkey(id, nickname, avatar_url), crew:groups!project_members_crew_id_fkey(id, name, category)"
      )
      .eq("project_id", projectId)
      .order("joined_at");

    setMembers(membersData || []);

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
          tool_slack: slackUrl.trim() || null,
          tool_notion: notionUrl.trim() || null,
          tool_drive: driveUrl.trim() || null,
          tool_kakao: kakaoUrl.trim() || null,
          total_budget: totalBudget ? parseInt(totalBudget) : null,
          budget_currency: budgetCurrency || "KRW",
        })
        .eq("id", projectId);

      if (error) throw error;
      toast.success("프로젝트가 업데이트되었습니다");
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
      title: isCurrentlyManager ? "매니저 권한 해제" : "프로젝트 매니저로 임명",
      body: isCurrentlyManager
        ? "프로젝트 매니저 권한이 해제되었습니다."
        : "프로젝트 매니저로 임명되었습니다. 멤버 관리와 프로젝트 설정 일부를 제어할 수 있습니다.",
      metadata: { project_id: projectId },
      is_read: false,
    });

    toast.success(isCurrentlyManager ? "일반 멤버로 변경되었습니다" : "매니저로 임명되었습니다");
  }

  async function removeMember(memberId: string) {
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
      toast.error("이미 프로젝트 멤버입니다");
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
      toast.error("이미 참여 중인 크루입니다");
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
    toast.success("크루가 추가되었습니다");
  }

  async function handleArchive() {
    if (!confirm("프로젝트를 보관하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ status: "archived" })
      .eq("id", projectId);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("프로젝트가 보관되었습니다");
    router.push("/projects");
  }

  async function handleDelete() {
    if (
      !confirm(
        "정말로 이 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
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
    toast.success("프로젝트가 삭제되었습니다");
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
        프로젝트 설정
      </h1>
      <p className="text-nu-gray text-sm mb-8">{title}</p>

      {/* Edit form */}
      <form onSubmit={handleSave} className="space-y-6 mb-12">
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6 space-y-5">
          <h2 className="font-head text-lg font-extrabold">기본 정보</h2>

          <div>
            <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
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
            <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
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
              <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
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
              <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
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
              <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
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
              <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
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
            <label className="block font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-2">
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
                    className="mt-2 font-mono-nu text-[10px] text-nu-red uppercase tracking-widest"
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
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink block mb-4">️ 툴 허브 (외부 연동)</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray block mb-1.5">Slack 채널 URL</label>
              <input value={slackUrl} onChange={(e) => setSlackUrl(e.target.value)} placeholder="https://app.slack.com/..." className="w-full border border-nu-ink/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-nu-pink" />
            </div>
            <div>
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray block mb-1.5">Notion 보드 URL</label>
              <input value={notionUrl} onChange={(e) => setNotionUrl(e.target.value)} placeholder="https://notion.so/..." className="w-full border border-nu-ink/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-nu-pink" />
            </div>
            <div>
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray block mb-1.5">Google Drive URL</label>
              <input value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} placeholder="https://drive.google.com/..." className="w-full border border-nu-ink/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-nu-pink" />
            </div>
            <div>
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray block mb-1.5">카카오톡 오픈채팅 URL</label>
              <input value={kakaoUrl} onChange={(e) => setKakaoUrl(e.target.value)} placeholder="https://open.kakao.com/o/..." className="w-full border border-nu-ink/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-nu-pink" />
            </div>
          </div>
        </div>

        {/* Budget */}
        <div className="border-t border-nu-ink/[0.06] pt-5">
          <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink block mb-4"> 예산 & 보상 투명성</span>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray block mb-1.5">총 사업비</label>
              <input type="number" value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} placeholder="10000000" className="w-full border border-nu-ink/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-nu-pink" />
            </div>
            <div>
              <label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray block mb-1.5">통화</label>
              <select value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value)} className="w-full border border-nu-ink/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-nu-pink">
                <option value="KRW">KRW</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <p className="font-mono-nu text-[10px] text-nu-muted mt-2">설정하면 프로젝트 상세 페이지의 [예산 & 보상] 패널에 공개됩니다</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full font-mono-nu text-[11px] font-bold uppercase tracking-[0.1em] py-4 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
      <div className="bg-nu-white border border-nu-ink/[0.08] p-6 mb-8">
        <h2 className="font-head text-lg font-extrabold mb-6 flex items-center gap-2">
          <Users size={18} /> 멤버 관리
        </h2>

        {/* Current members */}
        <div className="space-y-3 mb-6">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 p-3 bg-nu-cream/30"
            >
              {m.user_id && m.profile ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-nu-cream flex items-center justify-center font-head text-xs font-bold text-nu-ink">
                    {m.profile.nickname.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{m.profile.nickname}</p>
                      {m.role === "lead" && (
                        <span className="font-mono-nu text-[7px] uppercase tracking-widest bg-nu-pink text-white px-1.5 py-0.5 shrink-0">PM</span>
                      )}
                      {m.role === "manager" && (
                        <span className="font-mono-nu text-[7px] uppercase tracking-widest bg-nu-blue/10 text-nu-blue px-1.5 py-0.5 shrink-0">매니저</span>
                      )}
                    </div>
                    <p className="text-[10px] text-nu-muted">
                      {m.role === "manager" ? "멤버 관리·파일업로드·일정관리 가능" : (roleLabels[m.role] || m.role)}
                    </p>
                  </div>
                </>
              ) : m.crew_id && m.crew ? (
                <>
                  <div className={`w-8 h-8 flex items-center justify-center font-head text-xs font-bold text-white ${catColors[m.crew.category] || "bg-nu-gray"}`}>
                    {m.crew.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.crew.name}</p>
                    <p className="text-[10px] text-nu-muted capitalize">크루 · {m.crew.category}</p>
                  </div>
                </>
              ) : null}
              {m.role !== "lead" && m.user_id && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePromoteManager(m.id, m.user_id!, m.role === "manager")}
                    className={`font-mono-nu text-[8px] uppercase tracking-widest px-2 py-1 border transition-colors ${
                      m.role === "manager"
                        ? "border-nu-muted/30 text-nu-muted hover:border-nu-red/40 hover:text-nu-red"
                        : "border-nu-blue/30 text-nu-blue hover:bg-nu-blue hover:text-white"
                    }`}
                  >
                    {m.role === "manager" ? "해제" : "매니저"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMember(m.id)}
                    className="text-nu-red hover:text-red-700 transition-colors p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add user member */}
        <div className="border-t border-nu-ink/[0.06] pt-4 mb-4">
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-3">
            사용자 추가
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchNickname}
              onChange={(e) => setSearchNickname(e.target.value)}
              placeholder="닉네임으로 검색"
              className="flex-1 px-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUserMember();
                }
              }}
            />
            <button
              type="button"
              onClick={addUserMember}
              className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 bg-nu-blue text-white hover:bg-nu-blue/90 transition-colors flex items-center gap-1"
            >
              <UserPlus size={12} /> 추가
            </button>
          </div>
        </div>

        {/* Add crew */}
        <div className="border-t border-nu-ink/[0.06] pt-4">
          <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-3">
            크루 추가
          </p>
          <div className="flex gap-2">
            <select
              value={selectedCrewId}
              onChange={(e) => setSelectedCrewId(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink transition-colors"
            >
              <option value="">크루 선택...</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.category}] {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addCrewMember}
              className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 bg-nu-blue text-white hover:bg-nu-blue/90 transition-colors flex items-center gap-1"
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
            onClick={handleArchive}
            className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-3 border border-nu-amber text-nu-amber hover:bg-nu-amber hover:text-white transition-colors"
          >
            프로젝트 보관
          </button>
          <button
            onClick={handleDelete}
            className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-3 border border-nu-red text-nu-red hover:bg-nu-red hover:text-white transition-colors flex items-center justify-center gap-1"
          >
            <Trash2 size={12} /> 프로젝트 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
