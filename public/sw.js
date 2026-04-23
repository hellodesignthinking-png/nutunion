// nutunion PWA 서비스 워커 v5 — 최소주의 / 안전한 전략
//
// v5 철학 (v3/v4 의 OFFLINE 오표시 버그 최종 해결):
//   - navigation 에 절대 offline fallback 안 함 (navigator.onLine 믿지 않음)
//   - fetch 실패 시 캐시에 있으면 캐시, 없으면 그냥 throw → 브라우저 네이티브 에러
//   - SW 는 네트워크 빠르게 만드는 역할만 (정적 에셋 캐시)
//   - OFFLINE 페이지는 유저가 직접 /offline 방문할 때만 표시 (SW 개입 없음)
//
// 전략:
//   1) /_next/static — Cache First
//   2) 이미지/폰트 — Stale-While-Revalidate
//   3) 네비게이션 — pure network pass-through (SW 개입 최소화)
//   4) API — 통과
//
// 업데이트:
//   VERSION 변경 → install 시 구 캐시 싹 삭제 + skipWaiting 즉시 적용

const VERSION = "nutunion-sw-v6";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const STATIC_ASSETS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

// ── install ──────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      try {
        await cache.addAll(STATIC_ASSETS);
      } catch {}
      await self.skipWaiting();
    })()
  );
});

// ── activate ─────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 구 버전 캐시 전부 삭제 (v1~v4 잔상 + 잘못 캐시된 offline 페이지)
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))
      );
      // navigationPreload 비활성화 — fetch 핸들러가 navigation 에 개입하지 않으므로
      // preload 응답이 소비되지 않아 "cancelled before 'preloadResponse' settled" 경고가
      // 발생. 명시적으로 disable 해서 경고 제거.
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.disable();
        } catch {}
      }
      await self.clients.claim();
      // 현재 열린 클라이언트들에게 알림 — 자동 새로고침
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.postMessage({ type: "SW_UPDATED", version: VERSION });
      }
    })()
  );
});

// ── fetch ────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 외부 도메인 / non-GET — 통과
  if (url.origin !== self.location.origin) return;
  if (req.method !== "GET") return;

  // API / _next/data — 통과 (SW 개입 X)
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/")) {
    return;
  }

  // /sw.js 자체 — 통과 (업데이트 항상 네트워크에서)
  if (url.pathname === "/sw.js") return;

  // 정적 _next 에셋 — Cache First
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // 이미지 / 폰트 — Stale-While-Revalidate
  if (
    url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|woff2?)$/i) ||
    url.pathname.startsWith("/icon-")
  ) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // 네비게이션 — SW 개입 안 함, 브라우저에 맡김
  // (fetch 에러 시 브라우저 네이티브 에러 페이지 → 유저가 정상 판단 가능)
  return;
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return new Response("", { status: 504 });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || networkPromise;
}

// ── Web Push ─────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "nutunion", body: event.data.text() };
  }

  const title = payload.title || "nutunion";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag,
    data: { url: payload.url || "/", ...(payload.data || {}) },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(targetUrl); } catch {}
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});

// ── message (긴급 캐시 초기화 + 재등록) ──────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_CACHES") {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        await self.registration.unregister();
      })()
    );
  }
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
