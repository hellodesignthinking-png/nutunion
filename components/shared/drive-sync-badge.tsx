"use client";

/**
 * DriveSyncBadge — 자료실 행에 Drive 편집 사본 연결 상태를 표시하는 작은 배지.
 *
 * - Drive 사본 없음 → 렌더링 안 함 (null)
 * - Drive 사본 있음, 동기화 안 됨 → 노란 점
 * - Drive 사본 있음, 동기화됨 (synced_at 존재) → 초록 점 + 상대 시각
 * - 본인 사본이 아니면 사본 만든 사람 표시
 */

import { Cloud } from "lucide-react";

interface DriveSyncBadgeProps {
  driveFileId?: string | null;
  syncedAt?: string | null;
  ownerUserId?: string | null;
  currentUserId?: string | null;
  ownerNickname?: string | null;
  className?: string;
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return d.toLocaleDateString("ko");
}

export function DriveSyncBadge({
  driveFileId,
  syncedAt,
  ownerUserId,
  currentUserId,
  ownerNickname,
  className = "",
}: DriveSyncBadgeProps) {
  if (!driveFileId) return null;

  const isMine = ownerUserId && currentUserId && ownerUserId === currentUserId;
  const dotColor = syncedAt ? "bg-green-500" : "bg-yellow-500";

  let text: string;
  if (!isMine && ownerNickname) {
    text = `${ownerNickname} Drive 사본`;
  } else if (syncedAt) {
    text = `Drive · ${relTime(syncedAt)} 동기화`;
  } else {
    text = "Drive 사본 (미동기화)";
  }

  const title = syncedAt
    ? `마지막 R2 동기화: ${new Date(syncedAt).toLocaleString("ko-KR")}`
    : "Drive 에서 편집 후 [R2 로 동기화] 누르면 원본 갱신";

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted ${className}`}
      title={title}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <Cloud size={10} />
      {text}
    </span>
  );
}
