"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

/** base64 url-safe → Uint8Array (Web Push 구독에 필요) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array;
}

export function PushSubscribeToggle() {
  const [status, setStatus] = useState<"idle" | "unsupported" | "denied" | "subscribed" | "unsubscribed">("idle");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "subscribed" : "unsubscribed");
      } catch {
        setStatus("unsubscribed");
      }
    })();
  }, []);

  const subscribe = async () => {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("알림 권한이 거부되었습니다");
        setStatus("denied");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        toast.error("VAPID 공개키 미설정");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const keyBytes = urlBase64ToUint8Array(publicKey);
      // 새 ArrayBuffer 에 복사 (TS 엄격 타입 호환)
      const keyBuffer = new ArrayBuffer(keyBytes.byteLength);
      new Uint8Array(keyBuffer).set(keyBytes);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBuffer,
      });

      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          user_agent: navigator.userAgent,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "등록 실패");
      toast.success("푸시 알림 구독 완료");
      setStatus("subscribed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "구독 실패");
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setStatus("unsubscribed");
        return;
      }
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      toast.success("구독이 해제되었습니다");
      setStatus("unsubscribed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "해제 실패");
    } finally {
      setLoading(false);
    }
  };

  const sendTest = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "self",
          title: "nutunion 테스트",
          body: "푸시 알림이 정상 동작합니다 🎉",
          url: "/profile",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "발송 실패");
      toast.success(`${data.sent}건 발송됨`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "발송 실패");
    } finally {
      setLoading(false);
    }
  };

  if (status === "unsupported") {
    return (
      <div className="border-[2px] border-nu-ink/30 bg-nu-paper p-3 text-[12px] text-nu-graphite">
        이 브라우저는 푸시 알림을 지원하지 않습니다.
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="border-[2px] border-red-500 bg-red-50 p-3 text-[12px] text-red-700">
        알림이 차단됨 — 브라우저 설정에서 권한을 허용해주세요.
      </div>
    );
  }

  return (
    <div className="border-[2.5px] border-nu-ink bg-nu-paper p-4 flex flex-col gap-3">
      <div>
        <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1">
          푸시 알림
        </div>
        <div className="text-[13px] text-nu-ink">
          {status === "subscribed"
            ? "이 기기에서 알림을 받고 있습니다"
            : "아직 구독하지 않음"}
        </div>
      </div>

      <div className="flex gap-2">
        {status === "subscribed" ? (
          <>
            <button
              type="button"
              onClick={sendTest}
              disabled={loading}
              className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper disabled:opacity-50"
            >
              테스트 발송
            </button>
            <button
              type="button"
              onClick={unsubscribe}
              disabled={loading}
              className="border-[2.5px] border-red-500 text-red-600 px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white disabled:opacity-50"
            >
              구독 해제
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={subscribe}
            disabled={loading}
            className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
          >
            {loading ? "등록 중..." : "알림 구독"}
          </button>
        )}
      </div>
    </div>
  );
}
