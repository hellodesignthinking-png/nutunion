import { Shield, Crown, Star, Award } from "lucide-react";

// ── Grade System ────────────────────────────────────
export const GRADE_CONFIG: Record<string, { label: string; cls: string; icon: any; border: string }> = {
  admin:  { label: "관리자", cls: "bg-nu-pink text-white", icon: Shield, border: "border-nu-pink" },
  vip:    { label: "VIP",   cls: "bg-nu-pink/10 text-nu-pink", icon: Crown, border: "border-nu-pink/20" },
  gold:   { label: "골드",  cls: "bg-yellow-50 text-yellow-600", icon: Star, border: "border-yellow-200" },
  silver: { label: "실버",  cls: "bg-slate-100 text-slate-500", icon: Star, border: "border-slate-200" },
  bronze: { label: "브론즈", cls: "bg-amber-50 text-amber-600", icon: Award, border: "border-amber-200" },
};

export function getGradeKey(profile: { role?: string; grade?: string | null; can_create_crew?: boolean }): string {
  if (profile.role === "admin") return "admin";
  return profile.grade || (profile.can_create_crew ? "silver" : "bronze");
}

export function getGrade(profile: { role?: string; grade?: string | null; can_create_crew?: boolean }) {
  return GRADE_CONFIG[getGradeKey(profile)] || GRADE_CONFIG.bronze;
}

// ── Category System ─────────────────────────────────
export const CATEGORY_CONFIG: Record<string, { color: string; dot: string; label: string; text: string; light: string; border: string }> = {
  space:    { color: "bg-nu-blue",  dot: "bg-nu-blue",  label: "공간",   text: "text-nu-blue",  light: "bg-nu-blue/10",  border: "border-nu-blue" },
  culture:  { color: "bg-nu-amber", dot: "bg-nu-amber", label: "문화",   text: "text-nu-amber", light: "bg-nu-amber/10", border: "border-nu-amber" },
  platform: { color: "bg-nu-ink",   dot: "bg-nu-ink",   label: "플랫폼", text: "text-nu-ink",   light: "bg-nu-ink/10",   border: "border-nu-ink" },
  vibe:     { color: "bg-nu-pink",  dot: "bg-nu-pink",  label: "바이브", text: "text-nu-pink",  light: "bg-nu-pink/10",  border: "border-nu-pink" },
};

export function getCategory(category: string) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.vibe;
}

// ── Time Formatting ─────────────────────────────────
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d === 1) return "어제";
  if (d < 30) return `${d}일 전`;
  return `${Math.floor(d / 30)}개월 전`;
}

// ── Status System ────────────────────────────────────
export const PROJECT_STATUS: Record<string, { label: string; cls: string }> = {
  draft:     { label: "준비중", cls: "bg-nu-muted/20 text-nu-muted" },
  active:    { label: "진행중", cls: "bg-green-500 text-white" },
  completed: { label: "완료",   cls: "bg-nu-blue text-white" },
  archived:  { label: "보관",   cls: "bg-nu-muted text-white" },
};
