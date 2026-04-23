"use client";

/**
 * ChatDockPanelClient — ChatDockPanel 을 SSR 에서 완전히 제외하는 래퍼.
 *
 * Server Component 에서 `dynamic({ssr:false})` 를 직접 못 쓰므로
 * 이 파일이 'use client' 이고 내부에서 dynamic 로딩.
 * 효과: 서버 HTML 에는 빈 공간만, 클라이언트에서만 실제 렌더 → hydration mismatch 원천 차단.
 */

import dynamic from "next/dynamic";

export const ChatDockPanel = dynamic(
  () => import("./chat-dock-panel").then((m) => m.ChatDockPanel),
  { ssr: false, loading: () => null },
);
