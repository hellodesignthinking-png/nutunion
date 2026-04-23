"use client";

/**
 * DriveLinkBanner — 너트/볼트 자료실 상단에 표시되는 Drive 연결 상태 + 유도 배너.
 *
 * 3가지 상태:
 *  1) 공유 폴더 있음 + 내 계정 연결됨 → 초록 배너 "Drive 자동 동기화 활성"
 *  2) 공유 폴더 있음 + 내 계정 미연결 → 노란 배너 "Google 계정 연결하기"
 *  3) 공유 폴더 없음 (Drive 폴더 자체가 미생성) → 회색 배너 "공유 폴더 만들기" (호스트/리더만)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, FolderOpen, Check, AlertCircle } from "lucide-react";

interface Props {
  targetType: "group" | "project";
  targetId: string;
  /** 호스트/리더만 "공유 폴더 만들기" 버튼 가능 */
  canManage: boolean;
  /** 이미 연결된 Drive URL (DB 에서 넘기거나 null) */
  driveUrl?: string | null;
  driveFolderId?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DriveLinkBanner({ targetType: _t, targetId: _id, canManage: _m, driveUrl, driveFolderId: _f }: Props) {
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [localDriveUrl, setLocalDriveUrl] = useState<string | null>(driveUrl || null);

  useEffect(() => {
    setLocalDriveUrl(driveUrl || null);
  }, [driveUrl]);

  // 내 Google 계정 연결 여부 확인
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/google/auth/status", { cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          setGoogleConnected(!!j.connected);
        } else {
          setGoogleConnected(false);
        }
      } catch {
        setGoogleConnected(false);
      }
    })();
  }, []);

  // 로딩 중엔 표시 안 함
  if (googleConnected === null) return null;

  // 상태 1: 폴더 있음 + 연결됨
  if (localDriveUrl && googleConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 mb-3 border border-green-600/30 bg-green-50 rounded-lg text-[12px]">
        <Check size={14} className="text-green-700 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-bold text-green-800">Google Drive 링크 연결됨 (가져오기용)</span>
          <span className="text-green-700/80 ml-1 hidden sm:inline">
            · 새 자료는 서버(R2)에 저장됩니다 — 과거 Drive 자료는 &quot;Drive 에서 가져오기&quot; 로 이전
          </span>
        </div>
        <a
          href={localDriveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-green-600/30 text-green-800 rounded text-[11px] font-semibold no-underline hover:bg-green-100"
        >
          <FolderOpen size={11} /> Drive 열기 <ExternalLink size={9} />
        </a>
      </div>
    );
  }

  // 상태 2: 폴더 있음 + 내 계정 미연결
  if (localDriveUrl && !googleConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 mb-3 border border-yellow-500/40 bg-yellow-50 rounded-lg text-[12px]">
        <AlertCircle size={14} className="text-yellow-700 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-bold text-yellow-900">Google 계정 연결 필요</span>
          <span className="text-yellow-800/80 ml-1 hidden sm:inline">
            · 연결하면 과거 Drive 자료를 가져올 수 있어요 (새 자료는 서버에 저장됩니다)
          </span>
        </div>
        <Link
          href="/settings/integrations"
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-600 text-white rounded text-[11px] font-semibold no-underline hover:bg-yellow-700"
        >
          연결하기
        </Link>
      </div>
    );
  }

  // 상태 3: 폴더 없음 — Phase 6 이후 신규 Drive 폴더 생성은 중단됨. 배너 숨김.
  // (새 자료는 Cloudflare R2 에 저장됩니다. 과거 Drive 자료 가져오기는 자료실 상단의 "Google Drive 에서 가져오기" 버튼 참고.)
  return null;
}
