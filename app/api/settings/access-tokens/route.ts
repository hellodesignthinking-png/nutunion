import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";

/**
 * Personal Access Tokens — 외부에서 nutunion API 호출용.
 *
 * GET    → { tokens: [...] } — 본인 토큰 목록 (해시는 미노출, prefix 만)
 * POST   body: { name, scope?, expires_at? } → { token, prefix, ... }  (token 평문은 1회만)
 */

const ALLOWED_SCOPES = ["read", "write", "admin"] as const;

function generateToken(): { plain: string; hash: string; prefix: string } {
  const raw = randomBytes(24).toString("base64url"); // 32자 정도
  const plain = `nut_${raw}`;
  const hash = createHash("sha256").update(plain).digest("hex");
  const prefix = plain.slice(0, 8);
  return { plain, hash, prefix };
}

export const GET = withRouteLog("settings.tokens.get", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("personal_access_tokens")
    .select("id, name, prefix, scope, last_used_at, expires_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tokens: data ?? [] });
});

export const POST = withRouteLog("settings.tokens.post", async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    name?: string;
    scope?: string[];
    expires_in_days?: number;
  } | null;
  const name = (body?.name ?? "").trim().slice(0, 60) || "Untitled";
  const scope = (body?.scope ?? ["read"]).filter((s): s is string =>
    typeof s === "string" && (ALLOWED_SCOPES as readonly string[]).includes(s),
  );
  if (scope.length === 0) scope.push("read");
  const expiresAt = body?.expires_in_days
    ? new Date(Date.now() + Math.min(365, body.expires_in_days) * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // 토큰 개수 상한 — 사용자당 20개
  const { count } = await supabase
    .from("personal_access_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= 20) {
    return NextResponse.json({ error: "max_tokens_reached" }, { status: 413 });
  }

  const t = generateToken();
  const { data, error } = await supabase
    .from("personal_access_tokens")
    .insert({
      user_id: user.id,
      name,
      token_hash: t.hash,
      prefix: t.prefix,
      scope,
      expires_at: expiresAt,
    })
    .select("id, name, prefix, scope, expires_at, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    token: t.plain, // 발급 시점에만 평문 반환
    record: data,
  });
});
