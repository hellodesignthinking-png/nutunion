// nutunion PWA 서비스 워커 — 정적 에셋 캐싱 + 오프라인 폴백
//
// 전략:
//   1) 정적 에셋 (_next/static, icons, manifest) — Cache First
//   2) 이미지 / 폰트 — Stale-While-Revalidate
//   3) 네비게이션 (HTML) — Network First with /offline fallback
//   4) API / 동적 데이터 — Network Only (캐싱 금지)
//
// 업데이트:
//   VERSION 문자열 변경 시 구 캐시 자동 삭제됨.

const VERSION = "nutunion-sw-v3";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const OFFLINE_URL = "/offline";
const STATIC_ASSETS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

// ── install ──────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(STATIC_ASSETS);
      // 오프라인 페이지도 프리캐시
      try {
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch {}
      await self.skipWaiting();
    })()
  );
});

// ── activate (구 버전 캐시 정리) ───────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => !n.startsWith(VERSION))
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

// ── fetch ────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 외부 도메인 / WebSocket / SSE 등은 통과
  if (url.origin !== self.location.origin) return;
  if (req.method !== "GET") return;

  // API / 동적 라우트 — Network Only (캐싱 안 함)
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/")) {
    return;
  }

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

  // HTML 네비게이션 — Network First with offline fallback
  if (req.mode === "navigate") {
    event.respondWith(networkFirstWithOffline(req));
    return;
  }
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

async function networkFirstWithOffline(req) {
  try {
    const res = await fetch(req);
    return res;
  } catch (err) {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ||
      new Response(
        "<h1>오프라인 상태입니다</h1><p>네트워크 연결 후 다시 시도해주세요.</p>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      )
    );
  }
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
      // 이미 열린 탭에 포커스 + 해당 URL 로 이동
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(targetUrl); } catch {}
          }
          return;
        }
      }
      // 없으면 새 창
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
