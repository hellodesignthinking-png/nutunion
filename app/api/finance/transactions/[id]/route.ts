import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";

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

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const check = await checkPermission();
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status });

  const body = await req.json();
  const allowed = [
    "date", "company", "type", "description", "amount", "category",
    "memo", "receipt_type", "vendor_name", "payment_method",
  ];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) updates[k] = body[k];
  }

  if (updates.date && !/^\d{4}-\d{2}-\d{2}$/.test(String(updates.date))) {
    return NextResponse.json({ error: "날짜 형식 오류" }, { status: 400 });
  }
  if ("amount" in updates) {
    const amt = Number(updates.amount);
    if (isNaN(amt)) {
      return NextResponse.json({ error: "금액 오류" }, { status: 400 });
    }
    if (amt === 0) {
      return NextResponse.json({ error: "금액은 0이 될 수 없습니다" }, { status: 400 });
    }
    updates.amount = amt;
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
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const check = await checkPermission();
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status });

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
}
