import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export const categoryColors: Record<string, { bg: string; text: string; bar: string; badge: string }> = {
  space: { bg: "bg-nu-blue", text: "text-white", bar: "bg-nu-blue", badge: "bg-nu-blue/10 text-nu-blue" },
  culture: { bg: "bg-nu-amber", text: "text-white", bar: "bg-nu-amber", badge: "bg-nu-amber/10 text-nu-amber" },
  platform: { bg: "bg-nu-ink", text: "text-nu-paper", bar: "bg-nu-ink", badge: "bg-nu-ink/10 text-nu-ink" },
  vibe: { bg: "bg-nu-pink", text: "text-white", bar: "bg-nu-pink", badge: "bg-nu-pink/10 text-nu-pink" },
};

export function getCategoryColor(category: string) {
  return categoryColors[category] ?? categoryColors.platform;
}

const categoryLabelMap: Record<string, string> = {
  space: "공간 (Space)",
  culture: "문화 (Culture)",
  platform: "플랫폼 (Platform)",
  vibe: "바이브 (Vibe)",
};

export function getCategoryLabel(category: string): string {
  return categoryLabelMap[category] ?? category;
}

export function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}
