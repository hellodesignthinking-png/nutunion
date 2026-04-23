"use client";

/**
 * ProjectSubNav — 볼트 모든 페이지 상단 공통 네비게이션.
 *
 * 역할:
 *  - 볼트 제목 + 현재 페이지 탭 표시
 *  - sticky — 스크롤해도 항상 접근 가능
 *  - 홈(/projects/[id])에서도 표시하여 하위 페이지와 동일한 탐색 경험 제공
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Home, FileText, Settings, Rocket, ClipboardCheck, Sticker, Users, FolderOpen, Target, Calendar, BarChart3 } from "lucide-react";

export interface ProjectSubNavProps {
  projectId: string;
  projectTitle?: string | null;
  /** 현재 방문자가 프로젝트 리더/관리자인 경우 — 설정 탭 노출 */
  isAdmin?: boolean;
}

export function ProjectSubNav({ projectId, projectTitle, isAdmin }: ProjectSubNavProps) {
  const pathname = usePathname();
  const isHome = pathname === `/projects/${projectId}`;

  const tabs = [
    { href: `/projects/${projectId}`,              label: "홈",      Icon: Home,            showAlways: true },
    { href: `/projects/${projectId}/digests`,       label: "회의록",  Icon: FileText,        showAlways: true },
    { href: `/projects/${projectId}/tap`,           label: "탭",      Icon: Sticker,         showAlways: true },
    { href: `/projects/${projectId}/venture`,       label: "벤처",    Icon: Rocket,          showAlways: true },
    { href: `/projects/${projectId}/applications`,  label: "지원자",  Icon: Users,           showAlways: false, adminOnly: true },
    { href: `/projects/${projectId}/apply`,         label: "지원",    Icon: ClipboardCheck,  showAlways: true },
    { href: `/projects/${projectId}/settings`,      label: "설정",    Icon: Settings,        showAlways: false, adminOnly: true },
  ];

  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-nu-ink/10 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3 flex-wrap">
        <Link
          href="/projects"
          className="flex items-center gap-1.5 text-[12px] font-semibold text-nu-ink hover:text-nu-pink no-underline shrink-0"
        >
          <ArrowLeft size={13} />
          <span className="max-w-[180px] truncate">{projectTitle || "볼트"}</span>
        </Link>
        <div className="h-4 w-px bg-nu-ink/15" />
        <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin">
          {tabs.map(({ href, label, Icon, adminOnly }) => {
            if (adminOnly && !isAdmin) return null;
            const active = href === `/projects/${projectId}`
              ? isHome  // 홈 탭은 정확 매칭
              : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] whitespace-nowrap no-underline transition-colors ${
                  active
                    ? "bg-nu-pink text-white font-semibold"
                    : "text-nu-graphite hover:bg-nu-ink/5"
                }`}
              >
                <Icon size={11} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
