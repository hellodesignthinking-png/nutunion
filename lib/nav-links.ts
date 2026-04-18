// 전역 내비게이션 링크 단일 소스.
// Nav (unauth/landing) + AuthNav (authenticated) 모두 이 파일을 import 해서 사용.
// 변경은 여기서만 — 각 컴포넌트에서 중복 정의 금지.

export interface NavLink {
  label: string;
  href: string;
}

/** 비로그인 / 랜딩 전용 메뉴 */
export const LANDING_LINKS: NavLink[] = [
  { label: "About",  href: "/#about"   },
  { label: "너트",   href: "/groups"   },
  { label: "볼트",   href: "/projects" },
  { label: "Scenes", href: "/#scenes"  },
];

/**
 * 로그인 사용자 메뉴 — (main) / (community) / /dashboard 등 모든 영역 공통.
 *
 * 순서 의미: 왼→오 중요도 / 사용 빈도 기준.
 *   대시보드 → 활동 허브
 *   너트(그룹) → 사람 연합
 *   볼트(프로젝트) → 진행중 작업
 *   탭(위키) → 지식
 *   와셔(멤버) → 사람 검색
 *   의뢰(챌린지) → 외부 요청
 */
export const APP_LINKS: NavLink[] = [
  { label: "대시보드", href: "/dashboard"         },
  { label: "너트",     href: "/groups"            },
  { label: "볼트",     href: "/projects"          },
  { label: "탭",       href: "/wiki"              },
  { label: "와셔",     href: "/members"           },
  { label: "의뢰",     href: "/challenges"        },
  { label: "포트폴리오", href: "/profile/portfolio" },
];

/**
 * admin 전용 드롭다운 항목.
 */
export const ADMIN_LINKS: NavLink[] = [
  { label: "관리자 대시보드", href: "/admin"               },
  { label: "회원 관리",       href: "/admin/users"         },
  { label: "너트 관리",       href: "/admin/groups"        },
  { label: "볼트 관리",       href: "/admin/projects"      },
  { label: "콘텐츠 관리",     href: "/admin/content"       },
  { label: "미디어 관리",     href: "/admin/media"         },
  { label: "디자인 시스템",   href: "/admin/design-system" },
];

/**
 * staff 전용 드롭다운 항목 — /staff/* 영역.
 */
export const STAFF_LINKS: NavLink[] = [
  { label: "스태프 홈",   href: "/staff"           },
  { label: "워크스페이스", href: "/staff/workspace" },
  { label: "할일",         href: "/staff/tasks"     },
  { label: "재무",         href: "/finance"         },
  { label: "파일",         href: "/staff/files"     },
  { label: "캘린더",       href: "/staff/calendar"  },
];
