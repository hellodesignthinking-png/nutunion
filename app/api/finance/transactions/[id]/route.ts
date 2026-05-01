import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";
import { TransactionUpdateSchema, formatZodError } from "@/lib/finance/validators";

async function checkPermission() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, message: "Unauthorized" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { ok: false as const, status: 403, message: "Forbidden" };
  }
  return { ok: true as const, supabase, user, role: profile.role };
}

export const PATCH = withRouteLog("finance.transactions.id.patch", async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const check = await checkPermission();
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status });

  // rate limit: 분당 30건
  const rl = await checkRateLimit(check.supabase, `${check.user.id}:tx-mutate`, 30, 60);
  if (!rl.allowed) return rateLimitResponse(rl);

  const body = await req.json();
  // amount 가 문자열로 오는 경우 숫자로 변환
  const normalized = {
    ...body,
    ...(body?.amount !== undefined ? { amount: Number(body.amount) } : {}),
  };
  const parsed = TransactionUpdateSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 });
  }
  // Zod 결과에서 undefined 필드 제거 (Supabase update 에 포함 안 되도록)
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updates[k] = v;
  }

  // 변경 전 스냅샷 (감사 로그용)
  const { data: before } = await check.supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const { error } = await check.supabase.from("transactions").update(updates).eq("id", id);
  if (error) {
    console.error("[Transactions PATCH]", error);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }

  await writeAuditLog(check.supabase, check.user, {
    entity_type: "transaction",
    entity_id: id,
    action: "update",
    company: (before?.company as string) ?? null,
    summary: `거래 수정: ${before?.date ?? ""} ${before?.description ?? ""}`,
    diff: { before, after: updates },
    actor_role: check.role,
  }, extractRequestMeta(req));

  return NextResponse.json({ success: true });
});

export const DELETE = withRouteLog("finance.transactions.id.delete", async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const check = await checkPermission();
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status });

  // rate limit: 분당 30건
  const rl = await checkRateLimit(check.supabase, `${check.user.id}:tx-mutate`, 30, 60);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { data: before } = await check.supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const { error } = await check.supabase.from("transactions").delete().eq("id", id);
  if (error) {
    console.error("[Transactions DELETE]", error);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }

  await writeAuditLog(check.supabase, check.user, {
    entity_type: "transaction",
    entity_id: id,
    action: "delete",
    company: (before?.company as string) ?? null,
    summary: `거래 삭제: ${before?.date ?? ""} ${before?.description ?? ""}`,
    diff: { before },
    actor_role: check.role,
  }, extractRequestMeta(req));

  return NextResponse.json({ success: true });
});
