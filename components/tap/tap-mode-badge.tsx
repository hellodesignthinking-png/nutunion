"use client";

/**
 * TapModeBadge — Tap 의 mode (archive / living / dashboard) 를 시각화.
 */

import { Archive, FileEdit, LayoutDashboard } from "lucide-react";

type Mode = "archive" | "living" | "dashboard";

interface Props {
  mode: Mode;
  size?: "sm" | "md";
}

const META: Record<Mode, { label: string; emoji: string; cls: string; Icon: typeof Archive }> = {
  archive: {
    label: "아카이브",
    emoji: "📄",
    cls: "bg-nu-cream text-nu-graphite border-nu-ink/20",
    Icon: Archive,
  },
  living: {
    label: "위키",
    emoji: "📝",
    cls: "bg-nu-blue/10 text-nu-blue border-nu-blue/30",
    Icon: FileEdit,
  },
  dashboard: {
    label: "대시보드",
    emoji: "📊",
    cls: "bg-nu-pink/10 text-nu-pink border-nu-pink/30",
    Icon: LayoutDashboard,
  },
};

export function TapModeBadge({ mode, size = "md" }: Props) {
  const m = META[mode];
  const sizeClass = size === "sm" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-1";
  const Icon = m.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono-nu uppercase tracking-widest font-bold border rounded-sm ${m.cls} ${sizeClass}`}
      title={`Tap mode: ${m.label}`}
    >
      <Icon size={size === "sm" ? 9 : 11} />
      <span>{m.label}</span>
    </span>
  );
}
