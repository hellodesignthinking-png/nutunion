import "server-only";
import { createHash } from "node:crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

/**
 * Personal Access Token 검증.
 *
 * 클라이언트가 Authorization: Bearer nut_xxx 로 호출 시 사용.
 * 1) Bearer 토큰 추출
 * 2) sha256 해시 → personal_access_tokens 테이블 조회
 * 3) 만료 검사
 * 4) last_used_at 갱신 (best-effort, 실패해도 검증은 통과)
 * 5) user_id 반환
 *
 * RLS 우회를 위해 service role key 사용 (env: SUPABASE_SERVICE_ROLE_KEY).
 */

interface PatRecord {
  id: string;
  user_id: string;
  scope: string[];
  expires_at: string | null;
}

const SERVICE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient() {
  return createServiceClient(SERVICE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function verifyPat(req: Request | NextRequest): Promise<{
  user_id: string;
  scope: string[];
  token_id: string;
} | null> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  if (!token.startsWith("nut_") || token.length < 16) return null;

  const hash = createHash("sha256").update(token).digest("hex");
  if (!SERVICE_KEY) {
    console.warn("[pat] SUPABASE_SERVICE_ROLE_KEY missing — PAT verification disabled");
    return null;
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("personal_access_tokens")
    .select("id, user_id, scope, expires_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error || !data) return null;
  const record = data as PatRecord;

  if (record.expires_at && new Date(record.expires_at).getTime() < Date.now()) {
    return null;
  }

  // last_used_at 갱신 — best effort, 실패해도 검증 통과
  void supabase
    .from("personal_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", record.id)
    .then(() => undefined);

  return {
    user_id: record.user_id,
    scope: record.scope,
    token_id: record.id,
  };
}

/**
 * 권한 검사 — 토큰 scope 가 요구 권한 이상인지.
 * read < write < admin 계층.
 */
export function patHasScope(scope: string[], required: "read" | "write" | "admin"): boolean {
  if (scope.includes("admin")) return true;
  if (required === "read") return scope.includes("read") || scope.includes("write");
  if (required === "write") return scope.includes("write");
  return false;
}
