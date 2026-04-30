/**
 * Supabase service-role(=admin) 클라이언트 — RLS 우회.
 *
 * 두 env 이름(SUPABASE_SERVICE_ROLE / SUPABASE_SERVICE_ROLE_KEY)을 모두 받는다.
 * 기존 코드가 둘을 섞어 써 환경변수 한쪽만 설정하면 일부 라우트가 silent fail
 * 하던 결함을 한 군데서 처리.
 *
 * 호출측은 두 가지 형태로 사용:
 *   - getAdminClient() — 미설정시 throw (필수 컨텍스트, 예: cron/admin 라우트)
 *   - tryAdminClient() — 미설정시 null (옵셔널 컨텍스트, fallback 처리)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readServiceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
}

function readUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function isAdminConfigured(): boolean {
  return !!(readUrl() && readServiceKey());
}

let _cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (_cached) return _cached;
  const url = readUrl();
  const key = readServiceKey();
  if (!url || !key) {
    throw new Error(
      "Supabase admin not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (또는 SUPABASE_SERVICE_ROLE)",
    );
  }
  _cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _cached;
}

export function tryAdminClient(): SupabaseClient | null {
  try {
    return getAdminClient();
  } catch {
    return null;
  }
}
