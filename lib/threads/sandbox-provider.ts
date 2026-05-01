/**
 * Threads sandbox 디스패처 — 두 가지 격리 전략 사이에서 선택.
 *
 *   1. iframe (기본): esbuild 로 TSX→JS 변환 후 inline HTML 을 token 으로 캐시.
 *      `/api/threads/sandbox-preview/serve` 가 sandbox=allow-scripts 로 서빙.
 *      Hobby/Pro 모두 동작. 브라우저 sandbox 에 의존.
 *
 *   2. @vercel/sandbox (옵트인): Pro 플랜에서 THREADS_USE_VERCEL_SANDBOX=1 시.
 *      Firecracker microVM 안에서 정적 서빙. 노드 모듈 import 가 필요한 미래
 *      thread 컴포넌트를 위해 마련.
 *
 * 실패 시 항상 iframe 으로 fallback — 사용자 경험을 끊지 않는다.
 */

import { compileTsxToHtml } from "./sandbox-compile";
import {
  createVercelSandboxPreview,
  isVercelSandboxEnabled,
  releaseVercelSandbox,
} from "./sandbox-vercel";
import { log } from "@/lib/observability/logger";

export interface PreviewResult {
  /** 클라이언트가 iframe 의 src 로 사용하는 URL. */
  url: string;
  /** 캐시·재사용·회수에 쓰이는 식별자. */
  token: string;
  /** "iframe" 또는 "vercel-sandbox" — 클라이언트가 origin 차이를 알 수 있도록. */
  strategy: "iframe" | "vercel-sandbox";
}

/**
 * 호출자(route 핸들러)가 iframe 캐시에 직접 채워넣는 콜백.
 * 두 전략을 한 함수에 합치기 위해 inversion-of-control.
 */
type IframeCachePut = (token: string, html: string) => void;

export async function preparePreview(
  source: string,
  opts: {
    token: string;
    installationId?: string;
    parentOrigin?: string;
    iframeServePath: string; // 예: "/api/threads/sandbox-preview/serve"
    putIframeCache: IframeCachePut;
  },
): Promise<PreviewResult> {
  // 1) Vercel Sandbox 경로 시도
  if (isVercelSandboxEnabled()) {
    try {
      const result = await createVercelSandboxPreview(source, {
        token: opts.token,
        installationId: opts.installationId,
        parentOrigin: opts.parentOrigin,
      });
      return {
        url: result.url,
        token: opts.token,
        strategy: "vercel-sandbox",
      };
    } catch (err) {
      log.warn("threads.sandbox.vercel-fallback", {
        err: err instanceof Error ? err.message : String(err),
      });
      // fall through → iframe
    }
  }

  // 2) iframe 경로 (기본)
  const html = await compileTsxToHtml(source, {
    installationId: opts.installationId,
    parentOrigin: opts.parentOrigin,
  });
  opts.putIframeCache(opts.token, html);
  return {
    url: `${opts.iframeServePath}?token=${encodeURIComponent(opts.token)}`,
    token: opts.token,
    strategy: "iframe",
  };
}

/** 클라이언트가 프리뷰를 닫을 때 호출 — vercel-sandbox 경로에서만 의미 있음. */
export async function releasePreview(token: string): Promise<void> {
  if (isVercelSandboxEnabled()) {
    await releaseVercelSandbox(token).catch(() => undefined);
  }
}
