"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import {
  Search, ChevronDown, ChevronUp,
  Shield, Crown, Star, Award, Check,
  Layers, Briefcase, Edit3, X, Plus,
  Key, Trash2, UserPlus, Eye, EyeOff,
  Loader2, Mail, User, Lock,
} from "lucide-react";
import type { Profile } from "@/lib/types";

interface UserWithCrews extends Profile {
  grade?: string;
  can_create_project?: boolean;
  crews?: { group_id: string; group_name: string; role: string }[];
}

// ── 등급 정의 ──────────────────────────────────────────────────────────
const GRADES = [
  { value: "bronze",  label: "브론즈", color: "bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-400",  icon: Award,   desc: "기본 회원",         canCreateCrew: false, canCreateProject: false },
  { value: "silver",  label: "실버",   color: "bg-slate-100 text-slate-600 border-slate-200",  dot: "bg-slate-400",  icon: Star,    desc: "너트 개설 가능",    canCreateCrew: true,  canCreateProject: false },
  { value: "gold",    label: "골드",   color: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-400", icon: Star,    desc: "너트 + 볼트 개설", canCreateCrew: true,  canCreateProject: true  },
  { value: "vip",     label: "VIP",    color: "bg-nu-pink/10 text-nu-pink border-nu-pink/20",   dot: "bg-nu-pink",    icon: Crown,   desc: "VIP 멤버",          canCreateCrew: true,  canCreateProject: true  },
];
const GRADE_MAP = Object.fromEntries(GRADES.map(g => [g.value, g]));

function GradeBadge({ grade, role }: { grade?: string; role?: string }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest bg-nu-pink text-white px-2 py-0.5 border border-nu-pink">
        <Shield size={9} /> 최고관리자
      </span>
    );
  }
  const g = GRADE_MAP[grade || "bronze"] || GRADE_MAP.bronze;
  return (
    <span className={`inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest px-2 py-0.5 border ${g.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${g.dot}`} />
      {g.label}
    </span>
  );
}

// ── Create User Modal ──────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: UserWithCrews) => void }) {
  const [form, setForm] = useState({ email: "", password: "", nickname: "", name: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error("이메일과 비밀번호를 입력하세요"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "생성 실패"); return; }
      toast.success("회원이 생성되었습니다 ✓");
      onCreated({
        id: data.userId, email: form.email,
        nickname: form.nickname || form.email.split("@")[0],
        name: form.name || form.nickname || form.email.split("@")[0],
        role: "member" as any, can_create_crew: false, can_create_project: false,
        grade: "bronze", avatar_url: null, bio: null, specialty: null, crews: [],
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      } as any);
      onClose();
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nu-ink/40 backdrop-blur-sm">
      <div className="bg-white border-[3px] border-nu-ink w-full max-w-md shadow-[8px_8px_0px_0px_rgba(13,13,13,1)]">
        <div className="flex items-center justify-between px-6 py-4 border-b-[2px] border-nu-ink bg-nu-cream/30">
          <h2 className="font-head text-base font-extrabold flex items-center gap-2">
            <UserPlus size={16} className="text-nu-pink" /> 새 회원 등록
          </h2>
          <button onClick={onClose} className="text-nu-muted hover:text-nu-ink"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-1.5">
              <Mail size={10} className="inline mr-1" /> 이메일 *
            </label>
            <input type="email" required value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="user@example.com"
              className="w-full border-[2px] border-nu-ink/20 px-3 py-2.5 text-sm focus:outline-none focus:border-nu-pink transition-colors" />
          </div>
          <div>
            <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-1.5">
              <Lock size={10} className="inline mr-1" /> 비밀번호 * (6자 이상)
            </label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} required value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full border-[2px] border-nu-ink/20 px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-nu-pink transition-colors" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nu-muted hover:text-nu-ink">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-1.5">닉네임</label>
              <input value={form.nickname} onChange={e => setForm(p => ({ ...p, nickname: e.target.value }))}
                placeholder="홍길동"
                className="w-full border-[2px] border-nu-ink/20 px-3 py-2.5 text-sm focus:outline-none focus:border-nu-pink transition-colors" />
            </div>
            <div>
              <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-1.5">이름</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="홍길동"
                className="w-full border-[2px] border-nu-ink/20 px-3 py-2.5 text-sm focus:outline-none focus:border-nu-pink transition-colors" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-nu-ink text-white font-mono-nu text-[12px] uppercase tracking-widest font-bold hover:bg-nu-pink transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {loading ? "생성 중..." : "회원 생성"}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 border-[2px] border-nu-ink/15 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Password Reset Modal ───────────────────────────────────────────────
function PasswordModal({ user, onClose }: { user: UserWithCrews; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) { toast.error("비밀번호는 6자 이상이어야 합니다"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, action: "reset_password", newPassword: pw }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "변경 실패"); return; }
      toast.success(`${user.nickname || user.email}의 비밀번호가 변경되었습니다 ✓`);
      onClose();
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nu-ink/40 backdrop-blur-sm">
      <div className="bg-white border-[3px] border-nu-ink w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(13,13,13,1)]">
        <div className="flex items-center justify-between px-6 py-4 border-b-[2px] border-nu-ink bg-nu-cream/30">
          <h2 className="font-head text-base font-extrabold flex items-center gap-2">
            <Key size={16} className="text-nu-amber" /> 비밀번호 변경
          </h2>
          <button onClick={onClose} className="text-nu-muted hover:text-nu-ink"><X size={18} /></button>
        </div>
        <form onSubmit={handleReset} className="p-6 space-y-4">
          <p className="text-sm text-nu-muted">
            <span className="font-bold text-nu-ink">{user.nickname || user.email}</span>의 새 비밀번호를 입력하세요.
          </p>
          <div className="relative">
            <input type={showPw ? "text" : "password"} value={pw}
              onChange={e => setPw(e.target.value)} required minLength={6}
              placeholder="새 비밀번호 (6자 이상)"
              className="w-full border-[2px] border-nu-ink/20 px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-nu-pink transition-colors" />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-nu-muted hover:text-nu-ink">
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-nu-amber text-nu-ink font-mono-nu text-[12px] uppercase tracking-widest font-bold hover:bg-nu-ink hover:text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
              {loading ? "변경 중..." : "비밀번호 변경"}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 border-[2px] border-nu-ink/15 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Profile Modal ─────────────────────────────────────────────────
function EditProfileModal({ user, onClose, onSaved }: {
  user: UserWithCrews;
  onClose: () => void;
  onSaved: (updated: Partial<UserWithCrews>) => void;
}) {
  const [form, setForm] = useState({
    email: user.email || "",
    nickname: user.nickname || "",
    name: user.name || "",
    bio: user.bio || "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, action: "update_profile", ...form }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "저장 실패"); return; }
      toast.success("프로필이 수정되었습니다 ✓");
      onSaved({ email: form.email, nickname: form.nickname, name: form.name, bio: form.bio });
      onClose();
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nu-ink/40 backdrop-blur-sm">
      <div className="bg-white border-[3px] border-nu-ink w-full max-w-md shadow-[8px_8px_0px_0px_rgba(13,13,13,1)]">
        <div className="flex items-center justify-between px-6 py-4 border-b-[2px] border-nu-ink bg-nu-cream/30">
          <h2 className="font-head text-base font-extrabold flex items-center gap-2">
            <User size={16} className="text-nu-blue" /> 프로필 수정
          </h2>
          <button onClick={onClose} className="text-nu-muted hover:text-nu-ink"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-1.5">이메일</label>
            <input type="email" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full border-[2px] border-nu-ink/20 px-3 py-2.5 text-sm focus:outline-none focus:border-nu-pink transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-1.5">닉네임</label>
              <input value={form.nickname} onChange={e => setForm(p => ({ ...p, nickname: e.target.value }))}
                className="w-full border-[2px] border-nu-ink/20 px-3 py-2.5 text-sm focus:outline-none focus:border-nu-pink transition-colors" />
            </div>
            <div>
              <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-1.5">이름</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border-[2px] border-nu-ink/20 px-3 py-2.5 text-sm focus:outline-none focus:border-nu-pink transition-colors" />
            </div>
          </div>
          <div>
            <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-1.5">한 줄 소개</label>
            <textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
              rows={2} placeholder="자기소개..."
              className="w-full border-[2px] border-nu-ink/20 px-3 py-2.5 text-sm focus:outline-none focus:border-nu-pink resize-none transition-colors" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-nu-ink text-white font-mono-nu text-[12px] uppercase tracking-widest font-bold hover:bg-nu-pink transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {loading ? "저장 중..." : "저장"}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 border-[2px] border-nu-ink/15 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors">
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────
export function AdminUserList({ users, migrationDone = false }: { users: UserWithCrews[]; migrationDone?: boolean }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery]   = useState("");
  const [gradeFilter, setGradeFilter]   = useState("all");
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [savingId, setSavingId]         = useState<string | null>(null);
  const [editGrade, setEditGrade]       = useState("bronze");
  const [editCrewPerm, setEditCrewPerm] = useState(false);
  const [editProjectPerm, setEditProjectPerm] = useState(false);
  const [editRole, setEditRole]         = useState("member");
  const [localUsers, setLocalUsers]     = useState(users);

  // Modals
  const [showCreate, setShowCreate]             = useState(false);
  const [passwordTarget, setPasswordTarget]     = useState<UserWithCrews | null>(null);
  const [editProfileTarget, setEditProfileTarget] = useState<UserWithCrews | null>(null);

  const filtered = useMemo(() => localUsers.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q
      || (u.nickname || "").toLowerCase().includes(q)
      || (u.email || "").toLowerCase().includes(q)
      || (u.name || "").toLowerCase().includes(q);
    const matchGrade = gradeFilter === "all"
      || (gradeFilter === "admin" ? u.role === "admin" : u.grade === gradeFilter);
    return matchQ && matchGrade;
  }), [localUsers, searchQuery, gradeFilter]);

  function openEdit(u: UserWithCrews) {
    setEditingId(u.id);
    setEditGrade(u.grade || "bronze");
    setEditCrewPerm(u.can_create_crew ?? false);
    setEditProjectPerm(u.can_create_project ?? false);
    setEditRole(u.role || "member");
    setExpandedId(u.id);
  }

  async function saveUser(userId: string) {
    setSavingId(userId);
    const gradeConfig      = GRADE_MAP[editGrade];
    const finalCrewPerm    = editCrewPerm    || gradeConfig?.canCreateCrew    || editRole === "admin";
    const finalProjectPerm = editProjectPerm || gradeConfig?.canCreateProject || editRole === "admin";

    try {
      const res = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, grade: editGrade, role: editRole, can_create_crew: finalCrewPerm, can_create_project: finalProjectPerm }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error("저장 실패: " + (data.error || res.status)); return; }

      setLocalUsers(prev => prev.map(u => u.id === userId ? {
        ...u, role: editRole as any, can_create_crew: finalCrewPerm,
        grade: editGrade, can_create_project: finalProjectPerm,
      } : u));

      toast.success(data.gradeSaved ? "회원 정보가 저장되었습니다 ✓" : "역할/너트 권한이 저장되었습니다");
    } catch (e: unknown) {
    const __e = e as { message?: string; code?: number; name?: string };
      toast.error("네트워크 오류: " + __e.message);
    }
    setEditingId(null);
    setSavingId(null);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("ko", { year: "numeric", month: "short", day: "numeric" });
  }

  const gradeCounts = useMemo(() => {
    const c: Record<string, number> = { bronze: 0, silver: 0, gold: 0, vip: 0, admin: 0 };
    localUsers.forEach(u => { if (u.role === "admin") c.admin++; else c[u.grade || "bronze"] = (c[u.grade || "bronze"] || 0) + 1; });
    return c;
  }, [localUsers]);

  return (
    <div>
      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={u => { setLocalUsers(p => [u, ...p]); router.refresh(); }}
        />
      )}
      {passwordTarget && (
        <PasswordModal user={passwordTarget} onClose={() => setPasswordTarget(null)} />
      )}
      {editProfileTarget && (
        <EditProfileModal
          user={editProfileTarget}
          onClose={() => setEditProfileTarget(null)}
          onSaved={updated => {
            setLocalUsers(p => p.map(u => u.id === editProfileTarget.id ? { ...u, ...updated } : u));
            setEditProfileTarget(null);
          }}
        />
      )}

      {/* Grade Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[...GRADES, { value: "admin", label: "관리자", color: "bg-nu-pink/10 text-nu-pink border-nu-pink/20", dot: "bg-nu-pink", icon: Shield }].map(g => (
          <button key={g.value}
            onClick={() => setGradeFilter(gradeFilter === g.value ? "all" : g.value)}
            className={`p-3 border-[2px] text-left transition-all ${gradeFilter === g.value ? "border-nu-ink" : "border-nu-ink/[0.08] hover:border-nu-ink/20"} bg-nu-white`}>
            <div className={`inline-flex items-center gap-1 font-mono-nu text-[11px] uppercase tracking-widest px-1.5 py-0.5 border mb-2 ${g.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${g.dot}`} />{g.label}
            </div>
            <p className="font-head text-2xl font-extrabold text-nu-ink">{gradeCounts[g.value] || 0}</p>
          </button>
        ))}
      </div>

      {/* Search + Create */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nu-muted" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="닉네임, 이름, 이메일로 검색..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-nu-ink/[0.08] bg-nu-white focus:outline-none focus:border-nu-blue/40 transition-colors" />
        </div>
        <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted self-center whitespace-nowrap">
          {filtered.length}/{localUsers.length}명
        </p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-nu-ink text-white font-mono-nu text-[12px] uppercase tracking-widest font-bold border-[2px] border-nu-ink shadow-[3px_3px_0px_0px_rgba(13,13,13,0.2)] hover:bg-nu-pink hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(13,13,13,0.2)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all">
          <Plus size={14} /> 회원 추가
        </button>
      </div>

      {/* Table */}
      <div className="bg-nu-white border border-nu-ink/[0.08]">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[2fr_2.5fr_1fr_1fr_1fr_auto] border-b border-nu-ink/[0.08]">
          {["회원", "이메일", "등급", "너트", "볼트", "관리"].map(h => (
            <div key={h} className="px-4 py-3 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted">{h}</div>
          ))}
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-nu-gray text-sm">검색 결과가 없습니다</p>
          </div>
        ) : filtered.map(u => (
          <div key={u.id} className="border-b border-nu-ink/[0.04] last:border-0">
            {/* Desktop row */}
            <div className="hidden md:grid grid-cols-[2fr_2.5fr_1fr_1fr_1fr_auto] items-center hover:bg-nu-ink/[0.02] transition-colors cursor-pointer"
              onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}>
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-nu-cream flex items-center justify-center font-head text-xs font-bold shrink-0 text-nu-ink">
                  {(u.nickname || u.email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.nickname || "unnamed"}</p>
                  {u.name && u.name !== u.nickname && <p className="text-[12px] text-nu-muted truncate">{u.name}</p>}
                </div>
                {expandedId === u.id ? <ChevronUp size={12} className="text-nu-muted ml-auto shrink-0" /> : <ChevronDown size={12} className="text-nu-muted ml-auto shrink-0" />}
              </div>
              <div className="px-4 py-3 text-sm text-nu-muted truncate">{u.email || <span className="text-nu-muted/40 italic text-xs">이메일 없음</span>}</div>
              <div className="px-4 py-3"><GradeBadge grade={u.grade} role={u.role} /></div>
              <div className="px-4 py-3">{u.can_create_crew ? <span className="text-green-600"><Check size={14} /></span> : <span className="text-nu-muted/40 text-xs">—</span>}</div>
              <div className="px-4 py-3">{u.can_create_project ? <span className="text-green-600"><Check size={14} /></span> : <span className="text-nu-muted/40 text-xs">—</span>}</div>
              <div className="px-4 py-3 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setEditProfileTarget(u); }}
                  title="프로필 수정"
                  className="p-1.5 text-nu-muted hover:text-nu-blue hover:bg-nu-blue/10 transition-colors">
                  <Edit3 size={13} />
                </button>
                <button onClick={() => setPasswordTarget(u)}
                  title="비밀번호 변경"
                  className="p-1.5 text-nu-muted hover:text-nu-amber hover:bg-nu-amber/10 transition-colors">
                  <Key size={13} />
                </button>
                <button onClick={() => editingId === u.id ? setEditingId(null) : openEdit(u)}
                  title="권한 편집"
                  className={`font-mono-nu text-[11px] uppercase tracking-widest px-2.5 py-1.5 transition-colors ${editingId === u.id ? "bg-nu-pink text-white" : "bg-nu-ink/5 hover:bg-nu-ink hover:text-white"}`}>
                  권한
                </button>
              </div>
            </div>

            {/* Mobile card */}
            <div className="md:hidden p-4 flex items-center justify-between gap-3 cursor-pointer"
              onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-nu-cream flex items-center justify-center font-head text-xs font-bold shrink-0">
                  {(u.nickname || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{u.nickname || "unnamed"}</p>
                    <GradeBadge grade={u.grade} role={u.role} />
                  </div>
                  <p className="text-xs text-nu-muted truncate">{u.email}</p>
                </div>
              </div>
              {expandedId === u.id ? <ChevronUp size={14} className="shrink-0 text-nu-muted" /> : <ChevronDown size={14} className="shrink-0 text-nu-muted" />}
            </div>

            {/* Expanded panel */}
            {expandedId === u.id && (
              <div className="border-t border-nu-ink/[0.06] bg-nu-cream/20 px-5 py-5">
                <div className="max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Info */}
                  <div className="space-y-2 text-sm">
                    <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-3">기본 정보</p>
                    <div className="flex gap-2"><span className="text-nu-muted w-16 shrink-0">가입일</span><span>{formatDate(u.created_at)}</span></div>
                    <div className="flex gap-2"><span className="text-nu-muted w-16 shrink-0">이메일</span><span className="truncate text-nu-ink">{u.email || "—"}</span></div>
                    <div className="flex gap-2"><span className="text-nu-muted w-16 shrink-0">분야</span><span>{u.specialty || "—"}</span></div>
                    {u.bio && <div className="flex gap-2 items-start"><span className="text-nu-muted w-16 shrink-0">소개</span><span className="text-nu-graphite leading-relaxed">{u.bio}</span></div>}
                    <div className="flex gap-2 items-start">
                      <span className="text-nu-muted w-16 shrink-0">소속</span>
                      <div className="flex flex-wrap gap-1">
                        {(u.crews || []).length === 0
                          ? <span className="text-nu-muted">없음</span>
                          : u.crews!.map(c => (
                            <span key={c.group_id} className="font-mono-nu text-[11px] uppercase bg-nu-pink/10 text-nu-pink px-1.5 py-0.5">{c.group_name}</span>
                          ))}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="pt-3 flex flex-wrap gap-2">
                      <button onClick={() => setEditProfileTarget(u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border-[2px] border-nu-blue/30 text-nu-blue font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-blue hover:text-white transition-colors">
                        <Edit3 size={11} /> 프로필 수정
                      </button>
                      <button onClick={() => setPasswordTarget(u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border-[2px] border-nu-amber/30 text-nu-amber font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-amber hover:text-nu-ink transition-colors">
                        <Key size={11} /> 비번 변경
                      </button>
                    </div>
                  </div>

                  {/* 권한 편집 */}
                  {editingId === u.id ? (
                    <div className="space-y-3">
                      <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-pink mb-3">권한 편집</p>
                      <div>
                        <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-1.5">등급</label>
                        <div className="grid grid-cols-2 gap-2">
                          {GRADES.map(g => (
                            <button key={g.value} type="button"
                              onClick={() => { setEditGrade(g.value); setEditCrewPerm(g.canCreateCrew); setEditProjectPerm(g.canCreateProject); }}
                              className={`px-3 py-2 border-[2px] text-left transition-all ${editGrade === g.value ? "border-nu-ink" : "border-nu-ink/10 hover:border-nu-ink/30"}`}>
                              <div className={`inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 border mb-1 ${g.color}`}>
                                <span className={`w-1 h-1 rounded-full ${g.dot}`} />{g.label}
                              </div>
                              <p className="text-[12px] text-nu-muted">{g.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">개별 권한</label>
                        <button type="button" onClick={() => setEditCrewPerm(!editCrewPerm)}
                          className={`flex items-center gap-2 px-3 py-2 border-[2px] transition-all text-sm ${editCrewPerm ? "border-nu-blue bg-nu-blue/5 text-nu-blue" : "border-nu-ink/10 text-nu-muted"}`}>
                          <Layers size={13} /> 너트 개설 {editCrewPerm ? "허용" : "불가"}
                        </button>
                        <button type="button" onClick={() => setEditProjectPerm(!editProjectPerm)}
                          className={`flex items-center gap-2 px-3 py-2 border-[2px] transition-all text-sm ${editProjectPerm ? "border-green-500 bg-green-50 text-green-700" : "border-nu-ink/10 text-nu-muted"}`}>
                          <Briefcase size={13} /> 볼트 개설 {editProjectPerm ? "허용" : "불가"}
                        </button>
                      </div>
                      <div>
                        <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-1.5">역할</label>
                        <select value={editRole} onChange={e => setEditRole(e.target.value)}
                          className="w-full px-3 py-2 border border-nu-ink/15 bg-nu-white text-sm focus:outline-none focus:border-nu-pink">
                          <option value="member">일반 회원</option>
                          <option value="admin">최고관리자</option>
                        </select>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => saveUser(u.id)} disabled={!!savingId}
                          className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors disabled:opacity-50 flex-1 flex items-center justify-center gap-1.5">
                          {savingId === u.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          {savingId === u.id ? "저장 중..." : "저장"}
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="font-mono-nu text-[12px] uppercase tracking-widest px-3 py-2 border border-nu-ink/15 hover:bg-nu-cream transition-colors flex items-center gap-1">
                          <X size={11} /> 취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted mb-3">현재 권한</p>
                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex items-center gap-2">
                          <Layers size={13} className={u.can_create_crew ? "text-nu-blue" : "text-nu-muted/40"} />
                          <span className={u.can_create_crew ? "text-nu-blue" : "text-nu-muted"}>너트 개설 {u.can_create_crew ? "가능" : "불가"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Briefcase size={13} className={u.can_create_project ? "text-green-600" : "text-nu-muted/40"} />
                          <span className={u.can_create_project ? "text-green-600" : "text-nu-muted"}>볼트 개설 {u.can_create_project ? "가능" : "불가"}</span>
                        </div>
                      </div>
                      <button onClick={() => openEdit(u)}
                        className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors flex items-center gap-1.5">
                        <Edit3 size={11} /> 권한 편집
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
