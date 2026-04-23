/**
 * BoltTypeBadge — 볼트 유형을 시각화하는 작은 배지.
 *
 * 사용:
 *   <BoltTypeBadge type="anchor" />          // emoji + label
 *   <BoltTypeBadge type="hex" size="sm" />   // 작은 버전
 *   <BoltTypeBadge type="carriage" iconOnly /> // 이모지만
 */

"use client";

import { Building2, Globe, Layers, Megaphone, Target, GraduationCap } from "lucide-react";
import type { BoltType } from "@/lib/bolt/types";
import { BOLT_TYPE_META } from "@/lib/bolt/labels";

const ICON_MAP = {
  Target,
  Building2,
  Globe,
  Layers,
  Megaphone,
  GraduationCap,
} as const;

interface Props {
  type: BoltType;
  size?: "sm" | "md";
  iconOnly?: boolean;
  showEn?: boolean;
  className?: string;
}

export function BoltTypeBadge({
  type,
  size = "md",
  iconOnly = false,
  showEn = false,
  className = "",
}: Props) {
  const meta = BOLT_TYPE_META[type];
  const Icon = ICON_MAP[meta.icon as keyof typeof ICON_MAP] ?? Target;

  const sizeClass =
    size === "sm"
      ? "text-[10px] px-1.5 py-0.5 gap-1"
      : "text-[11px] px-2 py-1 gap-1.5";

  if (iconOnly) {
    return (
      <span
        className={`inline-flex items-center justify-center ${meta.color} ${meta.accentColor} ${sizeClass} rounded-sm ${className}`}
        title={meta.label}
        aria-label={meta.label}
      >
        <Icon size={size === "sm" ? 10 : 12} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-mono-nu uppercase tracking-wider font-bold rounded-sm ${meta.color} ${meta.accentColor} border ${meta.borderColor}/30 ${sizeClass} ${className}`}
    >
      <Icon size={size === "sm" ? 10 : 12} />
      <span>{showEn ? meta.labelEn : meta.label}</span>
    </span>
  );
}
