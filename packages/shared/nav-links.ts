// 공유 모듈 — 웹 / 모바일(Expo) 양쪽에서 import.
// 기존 lib/nav-links.ts 의 재-export 로 시작 (단일 소스 유지).

export { LANDING_LINKS, APP_LINKS, ADMIN_LINKS, STAFF_LINKS } from "../../lib/nav-links";
export type { NavLink } from "../../lib/nav-links";
