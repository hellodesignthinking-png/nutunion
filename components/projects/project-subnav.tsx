"use client";

/**
 * ProjectSubNav — 볼트 모든 페이지 공통 상단 브레드크럼.
 *
 * v2 (2026-04): 메뉴 통일 — 탭 전환은 페이지 내부 탭 바 한 곳에서만.
 *  - 여기는 "뒤로가기 + 볼트 제목"만 표시
 *  - 기존 7개 pill 네비는 제거 (TabsInner 탭바와 중복이었음)
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export interface ProjectSubNavProps {
  projectId: string;
  projectTitle?: string | null;
  /** 호환을 위해 prop 유지 — 더 이상 사용하지 않음 */
  isAdmin?: boolean;
}

export function ProjectSubNav({ projectTitle }: ProjectSubNavProps) {
  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-nu-ink/10 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-[12px] font-semibold text-nu-ink hover:text-nu-pink no-underline shrink-0"
        >
          <ArrowLeft size={13} />
          <span className="max-w-[280px] truncate">{projectTitle || "볼트"}</span>
        </Link>
        <span className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-nu-muted">
          모든 메뉴는 아래 탭바에서
        </span>
      </div>
    </div>
  );
}
