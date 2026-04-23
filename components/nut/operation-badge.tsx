"use client";

/**
 * OperationNutBadge — Operation Nut(운영팀형) 너트임을 표시.
 * Interest Nut 에는 배지 없음 (기본).
 */

import { Lock, Link2 } from "lucide-react";

interface Props {
  linkedBoltTitle?: string | null;
  visibility?: "public" | "unlisted" | "private";
  size?: "sm" | "md";
}

export function OperationNutBadge({ linkedBoltTitle, visibility = "private", size = "md" }: Props) {
  const sizeClass = size === "sm" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-1";
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono-nu uppercase tracking-widest font-bold bg-orange-50 text-orange-700 border border-orange-200 rounded-sm ${sizeClass}`}
      title={linkedBoltTitle ? `연결된 볼트: ${linkedBoltTitle}` : "Operation Nut"}
    >
      {visibility === "private" && <Lock size={size === "sm" ? 8 : 10} />}
      <Link2 size={size === "sm" ? 8 : 10} /> Operation
      {linkedBoltTitle && size === "md" && (
        <span className="opacity-70 font-normal normal-case ml-0.5">· {linkedBoltTitle}</span>
      )}
    </span>
  );
}
