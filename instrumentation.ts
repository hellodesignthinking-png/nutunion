import { registerOTel } from "@vercel/otel";

export function register() {
  // Edge runtime 에서는 @vercel/otel 일부 기능이 제한적 — node 런타임에서만 등록
  if (process.env.NEXT_RUNTIME === "nodejs") {
    registerOTel({
      serviceName: "nutunion-web",
    });
  }
}

/**
 * Next.js 15+ instrumentation — 서버 에러를 OTel/Vercel Observability 로 전송.
 * 라우트 핸들러/서버 컴포넌트에서 throw 된 에러가 여기로 모임.
 */
export async function onRequestError(
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
    renderSource?: string;
    revalidateReason?: string;
    renderType?: string;
  }
) {
  // 구조화된 로그 — Vercel Logs / OTel 둘 다 파싱
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      source: "instrumentation.onRequestError",
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      message,
      stack: stack?.split("\n").slice(0, 6).join("\n"),
    })
  );
}
