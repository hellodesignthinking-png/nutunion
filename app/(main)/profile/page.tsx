"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Camera, Loader2, Users, Briefcase, Archive,
  BookOpen, ExternalLink, Edit3, Check, X,
  Star, Crown, Award, Shield, Link2, ChevronRight,
  Layers, FileText, MessageSquare, Calendar, Zap, DollarSign, Plus,
} from "lucide-react";
import Link from "next/link";
import type { Profile } from "@/lib/types";

// ─── 등급 helper ──────────────────────────────────────────────────────
const GRADE_MAP: Record<string, { label: string; color: string; icon: any }> = {
  bronze: { label: "브론즈", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Award },
  silver: { label: "실버",  color: "bg-slate-100 text-slate-600 border-slate-200", icon: Star },
  gold:   { label: "골드",  color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Star },
  vip:    { label: "VIP",   color: "bg-nu-pink/10 text-nu-pink border-nu-pink/20", icon: Crown },
};

const CAT_COLORS: Record<string, string> = {
  space: "bg-nu-blue text-white",
  culture: "bg-nu-amber text-white",
  platform: "bg-nu-ink text-white",
  vibe: "bg-nu-pink text-white",
};
const CAT_DOTS: Record<string, string> = {
  space: "bg-nu-blue", culture: "bg-nu-amber", platform: "bg-nu-ink", vibe: "bg-nu-pink",
};
const CAT_LABELS: Record<string, string> = {
  space: "공간", culture: "문화", platform: "플랫폼", vibe: "바이브",
};

function GradeBadge({ profile }: { profile: any }) {
  if (profile.role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest bg-nu-pink text-white px-2 py-0.5 border border-nu-pink">
        <Shield size={9} /> MASTER
      </span>
    );
  }
  const tier = profile.tier || "bronze";
  const g = GRADE_MAP[tier] || GRADE_MAP.bronze;
  return (
    <span className={`inline-flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 border ${g.color}`}>
      <g.icon size={9} /> {g.label}
    </span>
  );
}

// ─── 스킬 히트맵 (활동 카테고리 비중) ─────────────────────────────────
function SkillHeatmap({ crews }: { crews: any[] }) {
  const counts: Record<string, number> = {};
  crews.forEach((c: any) => {
    const cat = (Array.isArray(c.groups) ? c.groups[0] : c.groups)?.category;
    if (cat) counts[cat] = (counts[cat] || 0) + 1;
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

  if (Object.keys(counts).length === 0) return (
    <p className="text-sm text-nu-muted">아직 소모임 활동 데이터가 없습니다</p>
  );

  return (
    <div className="space-y-2">
      {Object.entries(counts).map(([cat, cnt]) => (
        <div key={cat} className="flex items-center gap-3">
          <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 shrink-0 ${CAT_COLORS[cat] || "bg-nu-gray text-white"}`}>
            {CAT_LABELS[cat] || cat}
          </span>
          <div className="flex-1 h-2 bg-nu-ink/5 overflow-hidden">
            <div
              className={`h-full transition-all duration-700 ${CAT_DOTS[cat] || "bg-nu-muted"}`}
              style={{ width: `${(cnt / total) * 100}%` }}
            />
          </div>
          <span className="font-mono-nu text-[10px] text-nu-muted shrink-0">{cnt}개</span>
        </div>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", nickname: "", specialty: "", bio: "", phone: "", skill_tags: [] as string[] });
  const [links, setLinks] = useState({ notion: "", github: "", drive: "", website: "", instagram: "", facebook: "" });
  const [newSkill, setNewSkill] = useState("");
  const [editLinks, setEditLinks] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [crews, setCrews]   = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [pointLogs, setPointLogs] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<"archive"|"crews"|"projects"|"portfolios"|"history">("archive");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data);
        setForm({ 
          name: data.name||"", 
          nickname: data.nickname||"", 
          specialty: data.specialty||"", 
          bio: data.bio||"", 
          phone: data.phone||"",
          skill_tags: data.skill_tags || []
        });
        setLinks({ 
          notion: data.link_notion||"", 
          github: data.link_github||"", 
          drive: data.link_drive||"", 
          website: data.link_website||"",
          instagram: data.link_instagram||"",
          facebook: data.link_facebook||""
        });
      }

      const [
        { data: memberData },
        { data: projData },
        { data: portData },
        { data: pointData },
        { data: posts },
        { data: resources }
      ] = await Promise.all([
        supabase.from("group_members").select("role, status, groups(id, name, category, description, image_url)").eq("user_id", user.id).eq("status", "active"),
        supabase.from("project_members").select("role, projects(id, title, status, category, image_url)").eq("user_id", user.id),
        supabase.from("project_portfolios").select("*, project:projects(title, category, image_url)").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("point_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("crew_posts").select("id, content, type, created_at, group:groups!crew_posts_group_id_fkey(name, id)").eq("author_id", user.id).order("created_at", { ascending: false }).limit(8),
        supabase.from("crew_resources").select("id, title, url, created_at, group:groups!crew_resources_group_id_fkey(name, id)").eq("author_id", user.id).order("created_at", { ascending: false }).limit(5)
      ]);

      setCrews(memberData || []);
      setProjects(projData || []);
      setPortfolios(portData || []);
      setPointLogs(pointData || []);

      const combined = [
        ...(posts||[]).map((p: any) => ({ ...p, _type: "post" })),
        ...(resources||[]).map((r: any) => ({ ...r, _type: "resource" })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
      setRecentActivity(combined);
    }
    load();
  }, []);

  async function handleSave() {
    if (!profile) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({
      name: form.name, 
      nickname: form.nickname,
      specialty: form.specialty || null,
      bio: form.bio || null, 
      phone: form.phone || null,
      skill_tags: form.skill_tags
    }).eq("id", profile.id);
    if (error) toast.error(error.code === "23505" ? "이미 사용 중인 닉네임입니다" : error.message);
    else { setProfile({ ...profile, ...form }); setEditing(false); toast.success("프로필이 업데이트되었습니다"); }
    setLoading(false);
  }

  async function handleSaveLinks() {
    if (!profile) return;
    setSavingLinks(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({
      link_notion:    links.notion    || null,
      link_github:    links.github    || null,
      link_drive:     links.drive     || null,
      link_website:   links.website   || null,
      link_instagram: links.instagram || null,
      link_facebook:  links.facebook  || null,
    }).eq("id", profile.id);

    if (error) {
      // DB 컬럼이 없는 경우 (SQL 마이그레이션 미실행)
      const isColumnMissing = error.message?.includes("link_") || error.code === "42703" || error.code === "PGRST204";
      if (isColumnMissing) {
        toast.error("포트폴리오 링크 저장을 위해 Supabase SQL 마이그레이션이 필요합니다");
      } else {
        toast.error(error.message);
      }
    } else {
      setProfile({ 
        ...profile, 
        link_notion: links.notion, 
        link_github: links.github, 
        link_drive: links.drive, 
        link_website: links.website,
        link_instagram: links.instagram,
        link_facebook: links.facebook
      });
      setEditLinks(false);
      toast.success("외부 링크가 저장되었습니다");
    }
    setSavingLinks(false);
  }


  async function handleAvatarUpload(file: File) {
    if (!profile) return;
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const fileName = `avatar_${profile.id}_${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("media").upload(fileName, file, { upsert: false });
    if (uploadErr) { toast.error("업로드 실패"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("media").getPublicUrl(fileName);
    await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", profile.id);
    setProfile({ ...profile, avatar_url: urlData.publicUrl });
    toast.success("프로필 사진이 변경되었습니다");
    setUploading(false);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("ko", { month: "short", day: "numeric" });
  }

  if (!profile) return (
    <div className="max-w-5xl mx-auto px-8 py-12 flex justify-center">
      <Loader2 className="animate-spin text-nu-muted" size={24} />
    </div>
  );

  const initial = (profile.nickname || "U").charAt(0).toUpperCase();
  const totalActivity = crews.length + projects.length + recentActivity.length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">

      {/* ── Hero card ───────────────────────────────────────────── */}
      <div className="bg-nu-white border border-nu-ink/[0.08] mb-6">
        {/* Cover gradient */}
        <div className="h-20 bg-gradient-to-r from-nu-ink via-nu-pink/60 to-nu-blue/60" />
        <div className="px-8 pb-6">
          <div className="flex items-end justify-between -mt-10 mb-4">
            {/* Avatar */}
            <div className="relative group">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover border-4 border-nu-white" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-nu-pink text-white flex items-center justify-center font-head text-3xl font-bold border-4 border-nu-white">
                  {initial}
                </div>
              )}
              <label className="absolute inset-0 rounded-full bg-nu-ink/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer border-4 border-nu-white">
                {uploading ? <Loader2 size={18} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
              </label>
            </div>
            <button onClick={() => setEditing(!editing)}
              className="flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2 border border-nu-ink/15 hover:border-nu-pink hover:text-nu-pink transition-colors">
              <Edit3 size={11} /> {editing ? "취소" : "프로필 수정"}
            </button>
          </div>

          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-head text-2xl font-extrabold text-nu-ink">{profile.nickname || "이름 없음"}</h1>
            <GradeBadge profile={profile} />
            {profile.specialty && (
              <span className={`font-mono-nu text-[9px] uppercase tracking-widest px-2 py-0.5 ${CAT_COLORS[profile.specialty] || "bg-nu-gray text-white"}`}>
                {CAT_LABELS[profile.specialty] || profile.specialty}
              </span>
            )}
          </div>
          <p className="text-sm text-nu-muted mb-2">{profile.email}</p>
          {profile.bio && <p className="text-sm text-nu-gray max-w-xl">{profile.bio}</p>}

          {/* 활동 요약 pills */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <span className="flex items-center gap-1.5 font-mono-nu text-[10px] bg-nu-cream/50 px-3 py-1.5 border border-nu-ink/5">
              <Layers size={12} className="text-nu-pink" /> <b>{crews.length}</b> 소모임
            </span>
            <span className="flex items-center gap-1.5 font-mono-nu text-[10px] bg-nu-cream/50 px-3 py-1.5 border border-nu-ink/5">
              <Briefcase size={12} className="text-nu-blue" /> <b>{projects.length}</b> 프로젝트
            </span>
            <span className="flex items-center gap-1.5 font-mono-nu text-[10px] bg-nu-ink text-nu-paper px-3 py-1.5">
              <Award size={12} className="text-nu-pink" /> <b>{profile.points || 0}</b> NUT Pts
            </span>
            <span className="flex items-center gap-1.5 font-mono-nu text-[10px] bg-nu-pink text-white px-3 py-1.5">
              <Zap size={12} /> <b>{profile.activity_score || 0}%</b> Activity
            </span>
          </div>

          {/* Skill tags list */}
          {profile.skill_tags && profile.skill_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {profile.skill_tags.map((tag: string) => (
                <span key={tag} className="text-[10px] font-bold text-nu-muted border border-nu-ink/10 px-2 py-0.5 bg-nu-white">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── 왼쪽 사이드바 ─────────────────────────────────────── */}
        <div className="space-y-5">

          {/* 기본 정보 / 편집 */}
          <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
            <h3 className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-4">기본 정보</h3>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <Label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">이름</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="mt-1 border-nu-ink/15 bg-transparent text-sm" />
                </div>
                <div>
                  <Label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">닉네임</Label>
                  <Input value={form.nickname} onChange={e => setForm({...form, nickname: e.target.value})} className="mt-1 border-nu-ink/15 bg-transparent text-sm" />
                </div>
                <div>
                  <Label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">전화번호</Label>
                  <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="010-0000-0000" className="mt-1 border-nu-ink/15 bg-transparent text-sm" />
                </div>
                <div>
                  <Label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">전문분야</Label>
                  <Select value={form.specialty} onValueChange={v => v && setForm({...form, specialty: v})}>
                    <SelectTrigger className="mt-1 border-nu-ink/15 bg-transparent text-sm"><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="space">공간 (Space)</SelectItem>
                      <SelectItem value="culture">문화 (Culture)</SelectItem>
                      <SelectItem value="platform">플랫폼 (Platform)</SelectItem>
                      <SelectItem value="vibe">바이브 (Vibe)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">자기소개</Label>
                  <Textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} rows={3} className="mt-1 border-nu-ink/15 bg-transparent resize-none text-sm" />
                </div>
                <div>
                  <Label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">스킬 태그</Label>
                  <div className="flex flex-wrap gap-1 mb-2 mt-1">
                    {form.skill_tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 text-[10px] bg-nu-ink text-nu-paper px-2 py-0.5">
                        {tag} <X size={10} className="cursor-pointer" onClick={() => setForm({...form, skill_tags: form.skill_tags.filter(t => t !== tag)})} />
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      value={newSkill} 
                      onChange={e => setNewSkill(e.target.value)} 
                      placeholder="스킬 추가 (엔터)" 
                      className="h-8 text-[11px] border-nu-ink/10 bg-transparent"
                      onKeyDown={e => {
                        if (e.key === "Enter" && newSkill.trim()) {
                          e.preventDefault();
                          if (!form.skill_tags.includes(newSkill.trim())) {
                            setForm({...form, skill_tags: [...form.skill_tags, newSkill.trim()]});
                          }
                          setNewSkill("");
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSave} disabled={loading}
                    className="flex-1 font-mono-nu text-[10px] uppercase tracking-widest py-2 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                    <Check size={11} /> {loading ? "저장 중..." : "저장"}
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="px-3 py-2 border border-nu-ink/15 hover:bg-nu-cream transition-colors">
                    <X size={11} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex gap-2"><span className="text-nu-muted w-14 shrink-0">이름</span><span>{profile.name || "-"}</span></div>
                <div className="flex gap-2"><span className="text-nu-muted w-14 shrink-0">전화</span><span>{profile.phone || "-"}</span></div>
                <div className="flex gap-2"><span className="text-nu-muted w-14 shrink-0">분야</span><span>{CAT_LABELS[profile.specialty] || profile.specialty || "-"}</span></div>
              </div>
            )}
          </div>

          {/* Skill Heatmap */}
          <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
            <h3 className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-4">역량 분포</h3>
            <SkillHeatmap crews={crews} />
          </div>

          {/* 외부 링크 */}
          <div className="bg-nu-white border border-nu-ink/[0.08] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">포트폴리오 링크</h3>
              <button onClick={() => setEditLinks(!editLinks)}
                className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-blue hover:underline flex items-center gap-1">
                <Edit3 size={10} /> {editLinks ? "취소" : "편집"}
              </button>
            </div>
            {editLinks ? (
              <div className="space-y-2.5">
                {[
                  { key: "notion", label: "Notion", placeholder: "https://notion.so/..." },
                  { key: "github", label: "GitHub", placeholder: "https://github.com/..." },
                  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
                  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
                  { key: "drive",  label: "Google Drive", placeholder: "https://drive.google.com/..." },
                  { key: "website", label: "Website", placeholder: "https://..." },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-0.5">{label}</label>
                    <input value={(links as any)[key]} placeholder={placeholder}
                      onChange={e => setLinks({ ...links, [key]: e.target.value })}
                      className="w-full px-2 py-1.5 border border-nu-ink/10 bg-transparent text-[11px] focus:outline-none focus:border-nu-pink" />
                  </div>
                ))}
                <button onClick={handleSaveLinks} disabled={savingLinks}
                  className="w-full font-mono-nu text-[10px] uppercase tracking-widest py-2 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors mt-1 disabled:opacity-50">
                  {savingLinks ? "저장 중..." : "저장"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { key: "link_notion",    label: "Notion",    icon: BookOpen },
                  { key: "link_github",    label: "GitHub",    icon: Link2 },
                  { key: "link_instagram", label: "Instagram", icon: Camera },
                  { key: "link_facebook",  label: "Facebook",  icon: MessageSquare },
                  { key: "link_drive",     label: "Drive",     icon: FileText },
                  { key: "link_website",   label: "Website",   icon: ExternalLink },
                ].map(({ key, label, icon: Icon }) => (
                  profile[key] ? (
                    <a key={key} href={profile[key]} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-nu-blue hover:underline">
                      <Icon size={13} className="shrink-0" /> {label}
                    </a>
                  ) : (
                    <p key={key} className="flex items-center gap-2 text-sm text-nu-muted/40">
                      <Icon size={13} className="shrink-0" /> {label}
                    </p>
                  )
                ))}
                {!profile.link_notion && !profile.link_github && !profile.link_drive && !profile.link_website && (
                  <p className="text-xs text-nu-muted">링크를 등록하면 PM이 내 포트폴리오를 볼 수 있습니다</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── 오른쪽 메인: 아카이브 + 크루 + 프로젝트 ──────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* 탭 */}
          <div className="flex border-b border-nu-ink/[0.08]">
            {[
              { key: "archive",  label: "활동 아카이브", icon: Archive },
              { key: "crews",    label: `소모임 (${crews.length})`,   icon: Users },
              { key: "projects", label: `프로젝트 (${projects.length})`, icon: Briefcase },
              { key: "portfolios", label: `포트폴리오 (${portfolios.length})`, icon: Layers },
              { key: "history",  label: "포인트 내역", icon: DollarSign },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as any)}
                className={`flex items-center gap-1.5 px-4 py-3 font-mono-nu text-[10px] uppercase tracking-widest border-b-2 transition-colors ${tab === t.key ? "border-nu-pink text-nu-pink" : "border-transparent text-nu-muted hover:text-nu-ink"}`}>
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          {/* ── 활동 아카이브 탭 ──────────────────────────────── */}
          {tab === "archive" && (
            <div>
              {recentActivity.length === 0 ? (
                <div className="bg-nu-white border border-nu-ink/[0.08] p-10 text-center">
                  <Archive size={32} className="text-nu-muted/30 mx-auto mb-3" />
                  <p className="text-nu-gray text-sm">아직 활동 기록이 없습니다</p>
                  <p className="text-nu-muted text-xs mt-1">소모임에서 글을 쓰거나 자료를 등록하면 여기에 쌓입니다</p>
                </div>
              ) : (
                <div className="bg-nu-white border border-nu-ink/[0.08]">
                  <div className="px-5 py-4 border-b border-nu-ink/[0.06] flex items-center justify-between">
                    <h3 className="font-head text-sm font-bold text-nu-ink">최근 활동</h3>
                    <span className="font-mono-nu text-[10px] text-nu-muted">{recentActivity.length}개</span>
                  </div>
                  <div className="divide-y divide-nu-ink/[0.04]">
                    {recentActivity.map((item: any, i) => {
                      const group = Array.isArray(item.group) ? item.group[0] : item.group;
                      return (
                        <div key={i} className="flex items-start gap-3 px-5 py-3">
                          <div className={`w-7 h-7 flex items-center justify-center shrink-0 mt-0.5 ${item._type === "resource" ? "bg-nu-blue/10" : "bg-nu-pink/10"}`}>
                            {item._type === "resource"
                              ? <FileText size={13} className="text-nu-blue" />
                              : <MessageSquare size={13} className="text-nu-pink" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
                                {item._type === "resource" ? "자료 등록" : "게시글"}
                              </span>
                              {group && (
                                <Link href={`/groups/${group.id}`}
                                  className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-blue hover:underline truncate max-w-[120px]">
                                  {group.name}
                                </Link>
                              )}
                            </div>
                            <p className="text-sm text-nu-graphite truncate">
                              {item.title || item.content || "-"}
                            </p>
                          </div>
                          <span className="font-mono-nu text-[10px] text-nu-muted shrink-0">{formatDate(item.created_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 소모임 탭 ─────────────────────────────────────── */}
          {tab === "crews" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {crews.length === 0 ? (
                <div className="col-span-2 bg-nu-white border border-nu-ink/[0.08] p-10 text-center">
                  <Users size={32} className="text-nu-muted/30 mx-auto mb-3" />
                  <p className="text-nu-gray text-sm">참여 중인 소모임이 없습니다</p>
                  <Link href="/groups" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:underline mt-2 block">
                    소모임 찾아보기
                  </Link>
                </div>
              ) : crews.map((c: any, i) => {
                const g = Array.isArray(c.groups) ? c.groups[0] : c.groups;
                if (!g) return null;
                return (
                  <Link key={i} href={`/groups/${g.id}`}
                    className="bg-nu-white border border-nu-ink/[0.08] p-4 hover:border-nu-pink transition-colors no-underline group">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`font-mono-nu text-[8px] uppercase tracking-widest px-1.5 py-0.5 font-bold ${CAT_COLORS[g.category] || "bg-nu-gray text-white"}`}>
                        {CAT_LABELS[g.category] || g.category}
                      </span>
                      {c.role === "host" && (
                        <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-nu-pink/10 text-nu-pink px-1.5 py-0.5">Host</span>
                      )}
                    </div>
                    <h4 className="font-head text-sm font-bold text-nu-ink mb-1 group-hover:text-nu-pink transition-colors">{g.name}</h4>
                    {g.description && <p className="text-[11px] text-nu-muted truncate">{g.description}</p>}
                    <div className="flex items-center justify-end mt-2">
                      <ChevronRight size={13} className="text-nu-muted group-hover:text-nu-pink transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── 프로젝트 탭 ───────────────────────────────────── */}
          {tab === "projects" && (
            <div className="space-y-3">
              {projects.length === 0 ? (
                <div className="bg-nu-white border border-nu-ink/[0.08] p-10 text-center">
                  <Briefcase size={32} className="text-nu-muted/30 mx-auto mb-3" />
                  <p className="text-nu-gray text-sm">참여 중인 프로젝트가 없습니다</p>
                  <Link href="/projects" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue hover:underline mt-2 block">
                    프로젝트 찾아보기
                  </Link>
                </div>
              ) : projects.map((p: any, i) => {
                const proj = Array.isArray(p.projects) ? p.projects[0] : p.projects;
                if (!proj) return null;
                return (
                  <Link key={i} href={`/projects/${proj.id}`}
                    className="bg-nu-white border border-nu-ink/[0.08] p-4 flex items-center gap-4 hover:border-nu-pink transition-colors no-underline group">
                    <div className={`w-2 h-10 shrink-0 ${proj.status === "active" ? "bg-green-500" : "bg-nu-muted/20"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-head text-sm font-bold text-nu-ink group-hover:text-nu-pink transition-colors truncate">{proj.title}</h4>
                        {p.role === "lead" && (
                          <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-green-50 text-green-600 px-1.5 py-0.5 shrink-0">PM</span>
                        )}
                      </div>
                      <span className={`font-mono-nu text-[9px] uppercase tracking-widest ${proj.status === "active" ? "text-green-600" : "text-nu-muted"}`}>
                        {proj.status === "active" ? "진행중" : proj.status === "completed" ? "완료" : proj.status}
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-nu-muted group-hover:text-nu-pink transition-colors shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
          {/* ── 포트폴리오 탭 ─────────────────────────────────── */}
          {tab === "portfolios" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {portfolios.length === 0 ? (
                 <div className="col-span-2 bg-nu-white border border-nu-ink/[0.08] p-10 text-center">
                    <Layers size={32} className="text-nu-muted/30 mx-auto mb-3" />
                    <p className="text-nu-gray text-sm">등록된 포트폴리오가 없습니다</p>
                    <p className="text-xs text-nu-muted mt-1">프로젝트를 완료하고 성과를 증명해보세요</p>
                 </div>
               ) : portfolios.map(p => (
                 <div key={p.id} className="bg-nu-white border border-nu-ink/[0.08] overflow-hidden group">
                    <div className="h-32 bg-nu-cream relative overflow-hidden">
                       {p.project?.image_url ? (
                         <img src={p.project.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center font-head text-4xl font-black text-nu-ink/5 uppercase">{p.project?.category}</div>
                       )}
                       <div className="absolute top-2 right-2 flex gap-1">
                          <span className="bg-nu-ink text-white text-[8px] px-1.5 py-0.5 font-bold uppercase tracking-widest">{p.project?.category}</span>
                       </div>
                    </div>
                    <div className="p-4">
                       <h4 className="font-head text-sm font-bold text-nu-ink mb-1">{p.title}</h4>
                       <p className="text-[10px] text-nu-muted mb-3 line-clamp-2">{p.description}</p>
                       <div className="flex items-center justify-between mt-auto">
                          <span className="font-mono-nu text-[9px] text-nu-muted flex items-center gap-1"><Calendar size={10} /> {formatDate(p.created_at)}</span>
                          {p.url && (
                             <a href={p.url} target="_blank" rel="noreferrer" className="text-nu-blue flex items-center gap-1 font-mono-nu text-[9px] uppercase tracking-widest hover:underline whitespace-nowrap">VIEW WORK <ExternalLink size={10} /></a>
                          )}
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          )}
          {/* ── 포인트 내역 탭 ─────────────────────────────────── */}
          {tab === "history" && (
            <div className="bg-nu-white border border-nu-ink/[0.08] overflow-hidden">
               <div className="flex flex-col divide-y divide-nu-ink/5">
                  {pointLogs.length === 0 ? (
                    <div className="p-12 text-center text-nu-muted text-sm italic">
                      아직 포인트 활동 내역이 없습니다.
                    </div>
                  ) : pointLogs.map(log => (
                    <div key={log.id} className="flex items-center justify-between p-5 hover:bg-nu-cream/5 transition-colors">
                       <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 flex items-center justify-center ${log.amount > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-nu-red"}`}>
                             {log.amount > 0 ? <Plus size={18} /> : <X size={18} />}
                          </div>
                          <div>
                             <p className="text-sm font-bold text-nu-ink">{log.reason}</p>
                             <p className="text-[10px] text-nu-muted font-mono-nu mt-1">{formatDate(log.created_at)} · {log.type?.toUpperCase()}</p>
                          </div>
                       </div>
                       <div className={`font-mono-nu text-base font-extrabold ${log.amount > 0 ? "text-green-600" : "text-nu-red"}`}>
                          {log.amount > 0 ? "+" : ""}{log.amount} <span className="text-[10px] text-nu-muted font-normal ml-0.5">pts</span>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
