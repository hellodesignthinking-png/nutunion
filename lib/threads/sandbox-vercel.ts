/**
 * @vercel/sandbox 기반 Threads 프리뷰 — Pro 플랜 한정.
 *
 * iframe + esbuild 만으로도 브라우저 sandbox 경계는 충분하지만, 추후 사용자 코드가
 * 노드 모듈을 import 하거나 shell 동작을 시도할 가능성을 위해 microVM 격리 경로를
 * 마련해둔다. 환경 플래그 THREADS_USE_VERCEL_SANDBOX=1 일 때만 활성화.
 *
 * 동작:
 *   1. Sandbox.create({ runtime: "node24", timeout: 5min, ports: [3000] })
 *   2. writeFiles 로 compileTsxToHtml() 결과 HTML 을 index.html 로 드롭
 *   3. http-server 로 정적 서빙 (npx 사용 — npm install 없이 즉시 실행)
 *   4. sandbox.domain 을 클라이언트 iframe URL 로 반환
 *
 * 의도적으로 dynamic import 사용 — Hobby 플랜이거나 패키지 미설치 환경에서도
 * 빌드/타입 체크가 깨지지 않도록.
 */

import { compileTsxToHtml } from "./sandbox-compile";
import { log } from "@/lib/observability/logger";

const SANDBOX_TIMEOUT_MS = 5 * 60_000; // 5분 — 충분한 미리보기 세션
const SANDBOX_PORT = 3000;

interface VercelSandboxResult {
  url: string;
  sandboxId: string;
  expiresAt: number;
}

/** 활성 sandbox 핸들 — 토큰으로 회수해 stop() 호출 가능. */
const ACTIVE = (globalThis as { __threadVercelSandboxes__?: Map<string, { stop: () => Promise<void>; expiresAt: number }> }).__threadVercelSandboxes__
  ?? ((globalThis as { __threadVercelSandboxes__?: Map<string, { stop: () => Promise<void>; expiresAt: number }> }).__threadVercelSandboxes__ = new Map());

// TS 가 모듈 해석을 시도하지 않도록 Function 생성자로 감싼 dynamic import.
// 이렇게 하면 @vercel/sandbox 미설치 환경에서도 컴파일이 통과한다.
const dynImport = new Function("p", "return import(p)") as (p: string) => Promise<unknown>;

export function isVercelSandboxEnabled(): boolean {
  return process.env.THREADS_USE_VERCEL_SANDBOX === "1";
}

export async function createVercelSandboxPreview(
  source: string,
  opts: { token: string; installationId?: string; parentOrigin?: string },
): Promise<VercelSandboxResult> {
  let mod: unknown;
  try {
    mod = await dynImport("@vercel/sandbox");
  } catch (err) {
    throw new Error(
      "@vercel/sandbox not installed — run `npm install @vercel/sandbox` and ensure Pro plan",
    );
  }

  // SDK 형태: export class Sandbox { static create(opts): Promise<Sandbox> }
  const Sandbox = (mod as { Sandbox?: { create: (o: Record<string, unknown>) => Promise<unknown> } }).Sandbox;
  if (!Sandbox || typeof Sandbox.create !== "function") {
    throw new Error("@vercel/sandbox import did not expose Sandbox.create");
  }

  const credentials: Record<string, string> = {};
  if (process.env.VERCEL_TOKEN) credentials.token = process.env.VERCEL_TOKEN;
  if (process.env.VERCEL_TEAM_ID) credentials.teamId = process.env.VERCEL_TEAM_ID;
  if (process.env.VERCEL_PROJECT_ID) credentials.projectId = process.env.VERCEL_PROJECT_ID;

  const html = await compileTsxToHtml(source, {
    installationId: opts.installationId,
    parentOrigin: opts.parentOrigin,
  });

  const sandbox = (await Sandbox.create({
    ...credentials,
    runtime: "node24",
    timeout: SANDBOX_TIMEOUT_MS,
    ports: [SANDBOX_PORT],
  })) as {
    runCommand: (cmd: string, args: string[], opts?: Record<string, unknown>) => Promise<{ stdout: () => Promise<string> }>;
    writeFiles: (files: Array<{ path: string; content: Buffer | string }>) => Promise<void>;
    stop: () => Promise<void>;
    domain?: string;
    sandboxId?: string;
    id?: string;
  };

  try {
    await sandbox.writeFiles([
      { path: "/tmp/preview/index.html", content: html },
    ]);
    // npx 로 zero-install http-server 기동 — daemon 모드 (& 백그라운드)
    // sandbox.runCommand 는 명령 종료까지 블로킹이므로 nohup + & 로 분리.
    await sandbox.runCommand("sh", [
      "-c",
      `cd /tmp/preview && nohup npx -y http-server -p ${SANDBOX_PORT} -s --cors > /tmp/preview/server.log 2>&1 &`,
    ]);
  } catch (err) {
    log.error(err, "threads.vercel-sandbox.boot-failed");
    await sandbox.stop().catch(() => undefined);
    throw err;
  }

  const sandboxId = sandbox.sandboxId ?? sandbox.id ?? opts.token;
  const domain = sandbox.domain;
  if (!domain) {
    await sandbox.stop().catch(() => undefined);
    throw new Error("sandbox did not return domain — check ports config");
  }

  const expiresAt = Date.now() + SANDBOX_TIMEOUT_MS;
  ACTIVE.set(opts.token, {
    stop: () => sandbox.stop(),
    expiresAt,
  });

  // GC — 만료된 핸들 정리
  for (const [k, v] of ACTIVE.entries()) {
    if (v.expiresAt < Date.now()) {
      v.stop().catch(() => undefined);
      ACTIVE.delete(k);
    }
  }

  return {
    url: `https://${domain}/`,
    sandboxId,
    expiresAt,
  };
}

/** 클라이언트가 프리뷰를 닫았을 때 명시적 회수 — 비용 절감. */
export async function releaseVercelSandbox(token: string): Promise<boolean> {
  const handle = ACTIVE.get(token);
  if (!handle) return false;
  ACTIVE.delete(token);
  await handle.stop().catch(() => undefined);
  return true;
}
