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
import { Trash2, UserPlus, Loader2 } from "lucide-react";

interface GroupData {
  id: string;
  name: string;
  category: string;
  description: string;
  max_members: number;
  host_id: string;
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

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!group) return;
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const supabase = createClient();

    const { error } = await supabase
      .from("groups")
      .update({
        name: fd.get("name") as string,
        category: group.category,
        description: fd.get("description") as string,
        max_members: Math.max(2, Math.min(200, parseInt(fd.get("maxMembers") as string) || 20)),
      })
      .eq("id", groupId);

    if (error) toast.error(error.message);
    else toast.success("소모임 정보가 업데이트되었습니다");
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

  async function handlePromoteWaitlist(targetUserId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("group_members")
      .update({ status: "active" })
      .eq("group_id", groupId)
      .eq("user_id", targetUserId);

    if (error) {
      toast.error("승격에 실패했습니다");
      return;
    }
    setMembers(members.map((m) =>
      m.user_id === targetUserId ? { ...m, status: "active" } : m
    ));

    await supabase.from("notifications").insert({
      user_id: targetUserId,
      type: "group_accepted",
      title: "소모임 가입 승인",
      body: `${group?.name} 소모임에 가입이 승인되었습니다.`,
      metadata: { group_id: groupId },
    });
    toast.success("멤버로 승격되었습니다");
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

  const activeMembers = members.filter((m) => m.status === "active");
  const waitlistMembers = members.filter((m) => m.status === "waitlist");

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
          <Button type="submit" disabled={loading} className="self-start bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest">
            {loading ? "저장 중..." : "저장"}
          </Button>
        </form>
      </div>

      {/* Active members */}
      <div className="bg-nu-white border border-nu-ink/[0.08] p-8 mb-6">
        <h2 className="font-head text-lg font-extrabold mb-4">
          멤버 ({activeMembers.length})
        </h2>
        <div className="flex flex-col divide-y divide-nu-ink/5">
          {activeMembers.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-nu-cream flex items-center justify-center font-head text-xs font-bold" aria-hidden="true">
                  {(m.profile?.nickname || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{m.profile?.nickname}</p>
                  <p className="text-[10px] text-nu-muted">
                    {m.role === "host" ? "호스트" : "멤버"}
                    {m.profile?.email && ` · ${m.profile.email}`}
                  </p>
                </div>
              </div>
              {m.role !== "host" && (
                <button
                  onClick={() => handleRemoveMember(m.user_id)}
                  className="p-2 text-nu-muted hover:text-nu-red transition-colors"
                  aria-label={`${m.profile?.nickname} 제거`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Waitlist */}
      {waitlistMembers.length > 0 && (
        <div className="bg-nu-white border border-nu-ink/[0.08] p-8 mb-8">
          <h2 className="font-head text-lg font-extrabold mb-4">
            대기자 ({waitlistMembers.length})
          </h2>
          <div className="flex flex-col divide-y divide-nu-ink/5">
            {waitlistMembers.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-nu-yellow/20 flex items-center justify-center font-head text-xs font-bold" aria-hidden="true">
                    {(m.profile?.nickname || "U").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.profile?.nickname}</p>
                    <p className="text-[10px] text-nu-amber">대기 중</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePromoteWaitlist(m.user_id)}
                    className="p-2 text-nu-blue hover:text-nu-blue/80 transition-colors"
                    aria-label={`${m.profile?.nickname} 승인`}
                  >
                    <UserPlus size={14} />
                  </button>
                  <button
                    onClick={() => handleRemoveMember(m.user_id)}
                    className="p-2 text-nu-muted hover:text-nu-red transition-colors"
                    aria-label={`${m.profile?.nickname} 거절`}
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
