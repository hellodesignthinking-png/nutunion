"use client";

import { useEffect, useState } from "react";
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
import { Upload, Camera, Users, Briefcase, Loader2 } from "lucide-react";
import Link from "next/link";
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", nickname: "", specialty: "", bio: "", phone: "" });
  const [crews, setCrews] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data);
        setForm({
          name: data.name || "",
          nickname: data.nickname || "",
          specialty: data.specialty || "",
          bio: data.bio || "",
          phone: data.phone || "",
        });
      }

      // Fetch crews
      const { data: memberData } = await supabase
        .from("group_members")
        .select("role, groups(id, name, category)")
        .eq("user_id", user.id)
        .eq("status", "active");
      setCrews(memberData || []);

      // Fetch projects
      const { data: projData } = await supabase
        .from("project_members")
        .select("role, projects(id, title, status)")
        .eq("user_id", user.id);
      setProjects(projData || []);
    }
    load();
  }, []);

  async function handleSave() {
    if (!profile) return;
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        name: form.name,
        nickname: form.nickname,
        specialty: form.specialty || null,
        bio: form.bio || null,
        phone: form.phone || null,
      })
      .eq("id", profile.id);

    if (error) {
      if (error.code === "23505") toast.error("이미 사용 중인 닉네임입니다");
      else toast.error(error.message);
    } else {
      setProfile({ ...profile, name: form.name, nickname: form.nickname, specialty: (form.specialty || null) as Profile["specialty"], bio: form.bio || null });
      setEditing(false);
      toast.success("프로필이 업데이트되었습니다");
    }
    setLoading(false);
  }

  async function handleAvatarUpload(file: File) {
    if (!profile) return;
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const fileName = `avatar_${profile.id}_${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("media").upload(fileName, file, { cacheControl: "3600", upsert: false });
    if (uploadErr) { toast.error("업로드 실패"); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
    const { error } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", profile.id);
    if (error) { toast.error("저장 실패"); } else {
      setProfile({ ...profile, avatar_url: urlData.publicUrl });
      toast.success("프로필 사진이 변경되었습니다");
    }
    setUploading(false);
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-12 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-nu-muted" size={24} />
      </div>
    );
  }

  const initial = (profile.nickname || "U").charAt(0).toUpperCase();
  const catColors: Record<string, string> = { space: "bg-nu-blue", culture: "bg-nu-amber", platform: "bg-nu-ink", vibe: "bg-nu-pink" };
  const gradeLabel = profile.role === "admin" ? "관리자" : profile.can_create_crew ? "크루 생성자" : "일반 멤버";
  const gradeColor = profile.role === "admin" ? "bg-nu-pink text-white" : profile.can_create_crew ? "bg-green-100 text-green-700" : "bg-nu-cream text-nu-muted";

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-8">프로필</h1>

      {/* Profile header */}
      <div className="bg-nu-white border border-nu-ink/[0.08] p-8 mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar with upload */}
          <div className="relative group">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-nu-pink text-white flex items-center justify-center font-head text-3xl font-bold">
                {initial}
              </div>
            )}
            <label className="absolute inset-0 rounded-full bg-nu-ink/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              {uploading ? <Loader2 size={20} className="text-white animate-spin" /> : <Camera size={20} className="text-white" />}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
            </label>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-head text-xl font-bold">{profile.nickname}</h2>
              <span className={`font-mono-nu text-[8px] uppercase tracking-widest px-2 py-0.5 ${gradeColor}`}>{gradeLabel}</span>
            </div>
            <p className="text-sm text-nu-muted">{profile.email}</p>
            {profile.bio && <p className="text-sm text-nu-gray mt-2">{profile.bio}</p>}
            {profile.specialty && (
              <span className={`inline-block font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 text-white mt-2 ${catColors[profile.specialty] || "bg-nu-gray"}`}>
                {profile.specialty}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="bg-nu-white border border-nu-ink/[0.08] p-8 mb-6">
        <h3 className="font-head text-lg font-bold mb-4">{editing ? "프로필 수정" : "기본 정보"}</h3>
        <div className="flex flex-col gap-4">
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">이름</Label>
            {editing ? <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 border-nu-ink/15 bg-transparent" />
              : <p className="mt-1.5 text-nu-ink">{profile.name || "-"}</p>}
          </div>
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">닉네임</Label>
            {editing ? <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className="mt-1.5 border-nu-ink/15 bg-transparent" />
              : <p className="mt-1.5 text-nu-ink">{profile.nickname}</p>}
          </div>
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">이메일</Label>
            <p className="mt-1.5 text-nu-muted">{profile.email}</p>
          </div>
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">전화번호</Label>
            {editing ? <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} type="tel" placeholder="010-0000-0000" className="mt-1.5 border-nu-ink/15 bg-transparent" />
              : <p className="mt-1.5 text-nu-ink">{(profile as any).phone || "-"}</p>}
          </div>
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">전문분야</Label>
            {editing ? (
              <Select value={form.specialty} onValueChange={(v) => v && setForm({ ...form, specialty: v })}>
                <SelectTrigger className="mt-1.5 border-nu-ink/15 bg-transparent"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="space">공간 (Space)</SelectItem>
                  <SelectItem value="culture">문화 (Culture)</SelectItem>
                  <SelectItem value="platform">플랫폼 (Platform)</SelectItem>
                  <SelectItem value="vibe">바이브 (Vibe)</SelectItem>
                </SelectContent>
              </Select>
            ) : <p className="mt-1.5 text-nu-ink capitalize">{profile.specialty || "-"}</p>}
          </div>
          <div>
            <Label className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-gray">자기소개</Label>
            {editing ? <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} placeholder="자신을 소개해주세요" className="mt-1.5 border-nu-ink/15 bg-transparent resize-none" />
              : <p className="mt-1.5 text-nu-ink">{profile.bio || "-"}</p>}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          {editing ? (
            <>
              <Button onClick={handleSave} disabled={loading} className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest">
                {loading ? "저장 중..." : "저장"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(false)} className="font-mono-nu text-[11px] uppercase tracking-widest">취소</Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)} className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[11px] uppercase tracking-widest">프로필 수정</Button>
          )}
        </div>
      </div>

      {/* Activity overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My Crews */}
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
          <h3 className="font-head text-lg font-bold mb-4 flex items-center gap-2">
            <Users size={16} /> 내 크루 ({crews.length})
          </h3>
          {crews.length === 0 ? (
            <p className="text-sm text-nu-muted">참여 중인 크루가 없습니다</p>
          ) : (
            <div className="flex flex-col gap-2">
              {crews.map((c: any, i: number) => {
                const g = Array.isArray(c.groups) ? c.groups[0] : c.groups;
                if (!g) return null;
                return (
                  <Link key={i} href={`/groups/${g.id}`} className="flex items-center gap-3 p-2 hover:bg-nu-cream/30 transition-colors no-underline">
                    <span className={`w-2 h-2 rounded-full ${catColors[g.category] || "bg-nu-gray"}`} />
                    <span className="text-sm font-medium text-nu-ink flex-1 truncate">{g.name}</span>
                    <span className="font-mono-nu text-[9px] text-nu-muted">{c.role === "host" ? "호스트" : "멤버"}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* My Projects */}
        <div className="bg-nu-white border border-nu-ink/[0.08] p-6">
          <h3 className="font-head text-lg font-bold mb-4 flex items-center gap-2">
            <Briefcase size={16} /> 내 프로젝트 ({projects.length})
          </h3>
          {projects.length === 0 ? (
            <p className="text-sm text-nu-muted">참여 중인 프로젝트가 없습니다</p>
          ) : (
            <div className="flex flex-col gap-2">
              {projects.map((p: any, i: number) => {
                const proj = Array.isArray(p.projects) ? p.projects[0] : p.projects;
                if (!proj) return null;
                return (
                  <Link key={i} href={`/projects/${proj.id}`} className="flex items-center gap-3 p-2 hover:bg-nu-cream/30 transition-colors no-underline">
                    <Briefcase size={12} className="text-green-600 shrink-0" />
                    <span className="text-sm font-medium text-nu-ink flex-1 truncate">{proj.title}</span>
                    <span className={`font-mono-nu text-[9px] px-1.5 py-0.5 ${proj.status === "active" ? "bg-green-50 text-green-600" : "bg-nu-cream text-nu-muted"}`}>
                      {proj.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
