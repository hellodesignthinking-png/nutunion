"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { Trash2, UserPlus, Loader2, Upload, X } from "lucide-react";

interface GroupData {
  id: string;
  name: string;
  category: string;
  description: string;
  max_members: number;
  host_id: string;
  kakao_chat_url: string | null;
  google_drive_url: string | null;
  image_url: string | null;
}

interface MemberData {
  user_id: string;
  role: string;
  status: string;
  profile: { nickname: string; email: string } | null;
}

export default function GroupSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data: g } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();

      if (!g || g.host_id !== user.id) {
        toast.error("접근 권한이 없습니다");
        router.push(`/groups/${groupId}`);
        return;
      }

      setGroup(g);
      setImagePreview(g.image_url);

      const { data: m } = await supabase
        .from("group_members")
        .select("user_id, role, status, profile:profiles(nickname, email)")
        .eq("group_id", groupId)
        .order("joined_at");
      const members = (m || []).map((item: any) => ({
        user_id: item.user_id,
        role: item.role,
        status: item.status,
        profile: Array.isArray(item.profile) ? item.profile[0] || null : item.profile,
      }));
      setMembers(members);
      setPageLoading(false);
    }
    load();
  }, [groupId, router]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!group) return;
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const supabase = createClient();

    let finalImageUrl = group.image_url;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `crews/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(path, imageFile, {
          contentType: imageFile.type,
          upsert: true
        });
      if (uploadError) {
        toast.error("업로드 실패: " + uploadError.message);
        setLoading(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      finalImageUrl = publicUrl;
    }

    const { error } = await supabase
      .from("groups")
      .update({
        name: fd.get("name") as string,
        category: group.category,
        description: fd.get("description") as string,
        max_members: Math.max(2, Math.min(200, parseInt(fd.get("maxMembers") as string) || 20)),
        kakao_chat_url: (fd.get("kakao_chat_url") as string) || null,
        google_drive_url: (fd.get("google_drive_url") as string) || null,
        image_url: finalImageUrl,
      })
      .eq("id", groupId);

    if (error) toast.error(error.message);
    else {
      toast.success("소모임 정보가 업데이트되었습니다");
      setGroup({ ...group, image_url: finalImageUrl });
    }
    setLoading(false);
  }

  async function handleRemoveMember(targetUserId: string) {
    if (!confirm("이 멤버를 제거하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", targetUserId);

    if (error) {
      toast.error("멤버 제거에 실패했습니다");
      return;
    }
    setMembers(members.filter((m) => m.user_id !== targetUserId));
    toast.success("멤버가 제거되었습니다");
  }

  async function handleApproveMember(targetUserId: string, targetNickname: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("group_members")
      .update({ status: "active" })
      .eq("group_id", groupId)
      .eq("user_id", targetUserId);

    if (error) { toast.error("승인에 실패했습니다"); return; }
    setMembers(prev => prev.map(m => m.user_id === targetUserId ? { ...m, status: "active" } : m));

    await supabase.from("notifications").insert({
      user_id: targetUserId,
      type: "group_accepted",
      title: "소모임 가입 승인",
      body: `${group?.name} 소모임에 가입이 승인되었습니다.`,
      metadata: { group_id: groupId },
      is_read: false,
    });
    toast.success(`${targetNickname}님이 승인되었습니다`);
  }

  async function handlePromoteManager(targetUserId: string, isCurrentlyModerator: boolean) {
    const newRole = isCurrentlyModerator ? "member" : "moderator";
    const supabase = createClient();
    const { error } = await supabase
      .from("group_members")
      .update({ role: newRole })
      .eq("group_id", groupId)
      .eq("user_id", targetUserId);

    if (error) { toast.error("역할 변경에 실패했습니다: " + error.message); return; }

    setMembers(prev => prev.map(m =>
      m.user_id === targetUserId ? { ...m, role: newRole } : m
    ));

    // 알림 발송
    await supabase.from("notifications").insert({
      user_id: targetUserId,
      type: "role_changed",
      title: isCurrentlyModerator ? "매니저 권한 해제" : "매니저로 임명되었습니다",
      body: isCurrentlyModerator
        ? `${group?.name} 소모임의 매니저 권한이 해제되었습니다.`
        : `${group?.name} 소모임의 매니저로 임명되었습니다. 소모임의 일정, 파일, 멤버 관리를 할 수 있습니다.`,
      metadata: { group_id: groupId },
      is_read: false,
    });

    toast.success(isCurrentlyModerator ? "일반 멤버로 변경되었습니다" : "매니저로 임명되었습니다");
  }

  async function handleRejectMember(targetUserId: string, targetNickname: string) {
    const reason = window.prompt(`${targetNickname}님의 가입 신청을 거절하시겠습니까? 거절 사유를 입력해주세요 (공백 시 기본 메시지 발송):`, "소모임 성격에 맞지 않아 거절되었습니다.");
    if (reason === null) return; // Cancelled

    const supabase = createClient();
    // Update status to rejected instead of deleting, so we can show it or just notify.
    // For now, let's keep the existing logic of deleting if status check doesn't allow 'rejected',
    // but try to update if it does.
    const { error: updateError } = await supabase
      .from("group_members")
      .update({ status: "rejected", rejection_reason: reason })
      .eq("group_id", groupId)
      .eq("user_id", targetUserId);

    if (updateError) {
      toast.error("거절 처리에 실패했습니다: " + updateError.message);
      return;
    }

    setMembers(prev => prev.filter(m => m.user_id !== targetUserId));

    await supabase.from("notifications").insert({
      user_id: targetUserId,
      type: "group_rejected",
      title: "소모임 가입 거절",
      body: `${group?.name} 소모임 가입 신청이 거절되었습니다.\n사유: ${reason}`,
      metadata: { group_id: groupId, reason },
      is_read: false,
    });
    toast.success("거절되었습니다");
  }


  async function handleDelete() {
    if (!confirm("정말로 이 소모임을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("groups").update({ is_active: false }).eq("id", groupId);
    if (error) {
      toast.error("삭제에 실패했습니다");
      return;
    }
    toast.success("소모임이 삭제되었습니다");
    router.push("/groups");
  }

  if (pageLoading) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-12">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-nu-muted" size={24} />
        </div>
      </div>
    );
  }

  if (!group) return null;

  const activeMembers  = members.filter(m => m.status === "active");
  const pendingMembers = members.filter(m => m.status === "pending" || m.status === "waitlist");

  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-8">
        소모임 설정
      </h1>

      {/* Basic info */}
      <div className="bg-nu-white border border-nu-ink/[0.08] p-8 mb-8">
        <h2 className="font-head text-lg font-extrabold mb-4">기본 정보</h2>
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">썸네일 이미지</Label>
            <div className="mt-2 border border-dashed border-nu-ink/20 p-4 text-center">
              {imagePreview ? (
                <div className="relative inline-block">
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
                    }}
                    className="absolute -top-2 -right-2 bg-nu-red text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2 py-4">
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

          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">이름</Label>
            <Input name="name" defaultValue={group.name} required className="mt-1.5 border-nu-ink/15 bg-transparent" />
          </div>
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">카테고리</Label>
            <Select value={group.category} onValueChange={(v) => v && setGroup({ ...group, category: v })}>
              <SelectTrigger className="mt-1.5 border-nu-ink/15 bg-transparent">
                <SelectValue />
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
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">소개</Label>
            <Textarea name="description" defaultValue={group.description} rows={4} className="mt-1.5 border-nu-ink/15 bg-transparent resize-none" />
          </div>
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">최대 인원 (2~200)</Label>
            <Input name="maxMembers" type="number" defaultValue={group.max_members} min={2} max={200} className="mt-1.5 border-nu-ink/15 bg-transparent w-32" />
          </div>

          {/* External integrations */}
          <div className="border-t border-nu-ink/[0.06] pt-5 mt-2">
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink block mb-4">외부 연동</span>
            <div className="flex flex-col gap-4">
              <div>
                <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">카카오톡 오픈채팅 URL</Label>
                <Input name="kakao_chat_url" defaultValue={group.kakao_chat_url || ""} placeholder="https://open.kakao.com/o/..." className="mt-1.5 border-nu-ink/15 bg-transparent" />
              </div>
              <div>
                <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">Google Drive URL</Label>
                <Input name="google_drive_url" defaultValue={group.google_drive_url || ""} placeholder="https://drive.google.com/drive/folders/..." className="mt-1.5 border-nu-ink/15 bg-transparent" />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="self-start bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest">
            {loading ? "저장 중..." : "저장"}
          </Button>
        </form>
      </div>

      {/* Active members */}
      <div className="bg-nu-white border border-nu-ink/[0.08] p-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-head text-lg font-extrabold">멤버 ({activeMembers.length})</h2>
          <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">매니저는 일정·파일·멤버 관리 가능</p>
        </div>
        <div className="flex flex-col divide-y divide-nu-ink/5">
          {activeMembers.map((m) => {
            const isModerator = m.role === "moderator";
            const isCurrentHost = m.role === "host";
            return (
              <div key={m.user_id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-nu-cream flex items-center justify-center font-head text-xs font-bold">
                    {(m.profile?.nickname || "U").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{m.profile?.nickname}</p>
                      {isCurrentHost && (
                        <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-nu-pink text-white px-1.5 py-0.5">호스트</span>
                      )}
                      {isModerator && (
                        <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-nu-blue/10 text-nu-blue px-1.5 py-0.5">매니저</span>
                      )}
                    </div>
                    <p className="text-[10px] text-nu-muted">
                      {isCurrentHost ? "소모임 호스트" : isModerator ? "소모임 매니저 · 일정/파일/멤버 관리 가능" : "일반 멤버"}
                      {m.profile?.email && ` · ${m.profile.email}`}
                    </p>
                  </div>
                </div>
                {!isCurrentHost && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePromoteManager(m.user_id, isModerator)}
                      className={`font-mono-nu text-[9px] uppercase tracking-widest px-2.5 py-1.5 border transition-colors ${
                        isModerator
                          ? "border-nu-muted/30 text-nu-muted hover:border-nu-red/40 hover:text-nu-red"
                          : "border-nu-blue/30 text-nu-blue hover:bg-nu-blue hover:text-white"
                      }`}
                    >
                      {isModerator ? "매니저 해제" : "매니저 임명"}
                    </button>
                    <button
                      onClick={() => handleRemoveMember(m.user_id)}
                      className="p-2 text-nu-muted hover:text-nu-red transition-colors"
                      aria-label={`${m.profile?.nickname} 제거`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending / join requests */}
      {pendingMembers.length > 0 && (
        <div className="bg-nu-white border-[2px] border-nu-amber/30 p-8 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-nu-amber animate-pulse" />
            <h2 className="font-head text-lg font-extrabold">
              가입 신청 대기 ({pendingMembers.length})
            </h2>
          </div>
          <div className="flex flex-col divide-y divide-nu-ink/5">
            {pendingMembers.map(m => (
              <div key={m.user_id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-nu-amber/20 flex items-center justify-center font-head text-xs font-bold text-nu-amber">
                    {(m.profile?.nickname || "U").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.profile?.nickname || "Unknown"}</p>
                    <p className="text-[10px] text-nu-amber">가입 신청 대기중</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveMember(m.user_id, m.profile?.nickname || "멤버")}
                    className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 bg-nu-blue text-white hover:bg-nu-blue/90 transition-colors flex items-center gap-1"
                    id={`approve-${m.user_id}`}
                  >
                    <UserPlus size={12} /> 승인
                  </button>
                  <button
                    onClick={() => handleRejectMember(m.user_id, m.profile?.nickname || "멤버")}
                    className="p-1.5 text-nu-muted hover:text-nu-red transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div className="border border-nu-red/30 p-8">
        <h2 className="font-head text-xl font-extrabold text-nu-red mb-2">위험 구역</h2>
        <p className="text-sm text-nu-gray mb-4">소모임을 삭제하면 모든 일정과 멤버 데이터가 함께 삭제됩니다.</p>
        <button
          onClick={handleDelete}
          className="font-mono-nu text-[11px] uppercase tracking-widest px-6 py-3 border border-nu-red text-nu-red hover:bg-nu-red hover:text-white transition-colors"
        >
          소모임 삭제
        </button>
      </div>
    </div>
  );
}
