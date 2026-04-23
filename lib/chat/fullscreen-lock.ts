/**
 * lib/chat/fullscreen-lock — 모바일 채팅 전체화면 body 상태를 ref-counting 으로 안전하게 관리.
 *
 * 문제: `/chat` 페이지와 `ChatDockPanel` 이 동시에 `body.classList.add("nu-chat-fullscreen")`
 *       한쪽이 unmount 되며 remove 하면 다른 쪽이 남아도 nav 가 사라짐.
 *       또는 라우터 이동으로 unmount 가 안 불리면 영구 숨김 상태로 남음.
 *
 * 해결: 카운터로 획득/해제 추적 + 0이 될 때만 실제 class/style 제거.
 *       모든 페이지 전환 시 강제 reset 을 위해 `pagehide`, `visibilitychange` 에서 풀림.
 */

let counter = 0;
let pageListenersBound = false;

function applyState() {
  if (typeof document === "undefined") return;
  if (counter > 0) {
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.body.classList.add("nu-chat-fullscreen");
  } else {
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
    document.body.classList.remove("nu-chat-fullscreen");
  }
}

function bindPageListeners() {
  if (pageListenersBound || typeof window === "undefined") return;
  pageListenersBound = true;
  // 페이지 숨김/언로드 시 강제 해제 (모든 카운터 무효화)
  const hardReset = () => {
    counter = 0;
    applyState();
  };
  window.addEventListener("pagehide", hardReset);
  window.addEventListener("beforeunload", hardReset);
}

/** 전체화면 잠금 획득 — unmount/해제 시 반드시 release() 호출 */
export function acquireFullscreenLock(): () => void {
  if (typeof window === "undefined") return () => {};
  bindPageListeners();
  counter++;
  applyState();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    counter = Math.max(0, counter - 1);
    applyState();
  };
}

/** 강제 리셋 — 디버깅/긴급 복구용 */
export function forceReleaseAll() {
  counter = 0;
  applyState();
}
