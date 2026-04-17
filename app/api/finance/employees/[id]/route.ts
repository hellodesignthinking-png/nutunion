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

const NUMERIC_FIELDS = ["annual_salary", "annual_leave_total", "annual_leave_used", "hourly_wage", "weekly_days", "daily_hours"];

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const check = await checkPermission();
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status });

  const body = await req.json();
  const allowed = [
    "name", "company", "position", "department", "employment_type", "status",
    "email", "phone", "join_date", "end_date",
    "annual_salary", "annual_leave_total", "annual_leave_used",
    "hourly_wage", "weekly_days", "daily_hours", "work_days", "work_start_time", "work_end_time",
    "bank_name", "bank_account", "memo",
  ];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) {
      if (NUMERIC_FIELDS.includes(k) && body[k] !== null && body[k] !== "") {
        const n = Number(body[k]);
        if (isNaN(n)) continue;
        updates[k] = n;
      } else {
        updates[k] = body[k];
      }
    }
  }

  // 고용형태 전환 시 데이터 정리
  if ("employment_type" in updates) {
    if (updates.employment_type === "알바") {
      // 알바로 전환: 시급 정보가 없으면 annual_salary는 그대로 유지(경고 없음)
      // 알바의 연차는 0
      if (!("annual_leave_total" in updates)) updates.annual_leave_total = 0;
    } else {
      // 정규직/계약직/인턴으로 전환: 알바 전용 필드 클리어
      updates.hourly_wage = null;
      updates.weekly_days = null;
      updates.daily_hours = null;
      updates.work_days = null;
    }
  }

  // 알바 급여 자동 계산 — annual_salary가 명시적으로 전달되지 않았고, 시급/근무 정보만 변경된 경우에만
  const isAlbaUpdate = updates.employment_type === "알바" || (!("employment_type" in updates) && body.employment_type === "알바");
  const touchedWageFields = "hourly_wage" in updates || "daily_hours" in updates || "weekly_days" in updates;
  if (isAlbaUpdate && touchedWageFields && !("annual_salary" in body)) {
    const { data: existing } = await check.supabase.from("employees").select("hourly_wage,daily_hours,weekly_days").eq("id", id).single();
    const hw = Number(updates.hourly_wage ?? existing?.hourly_wage ?? 0);
    const dh = Number(updates.daily_hours ?? existing?.daily_hours ?? 8);
    const wd = Number(updates.weekly_days ?? existing?.weekly_days ?? 5);
    if (hw > 0) {
      updates.annual_salary = Math.round(hw * dh * wd * 52);
    }
  }

  // 변경 전 스냅샷
  const { data: before } = await check.supabase.from("employees").select("*").eq("id", id).maybeSingle();

  const { error } = await check.supabase.from("employees").update(updates).eq("id", id);
  if (error) {
    console.error("[Employees PATCH]", error);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }

  await writeAuditLog(check.supabase, check.user, {
    entity_type: "employee",
    entity_id: id,
    action: "update",
    company: (before?.company as string) ?? null,
    summary: `직원 수정: ${before?.name ?? ""}`,
    diff: { before, after: updates },
    actor_role: check.role,
  }, extractRequestMeta(req));

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const check = await checkPermission();
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status });

  // 현재 상태 확인
  const { data: existing } = await check.supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  // 소프트 삭제: status='퇴직' + 서명 대기 중 계약 자동 취소
  const updates: Record<string, unknown> = {
    status: "퇴직",
    end_date: new Date().toISOString().slice(0, 10),
  };
  if (existing?.contract_status === "sent" && !existing.contract_signed) {
    updates.contract_status = null;
    updates.contract_sent_date = null;
  }

  const { error } = await check.supabase.from("employees").update(updates).eq("id", id);
  if (error) {
    console.error("[Employees DELETE]", error);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }

  const cancelledContract = existing?.contract_status === "sent" && !existing.contract_signed;

  await writeAuditLog(check.supabase, check.user, {
    entity_type: "employee",
    entity_id: id,
    action: "delete",
    company: (existing?.company as string) ?? null,
    summary: `직원 퇴직 처리: ${existing?.name ?? ""}${cancelledContract ? " (대기 계약서 자동 취소)" : ""}`,
    diff: { before: existing, after: updates },
    actor_role: check.role,
  }, extractRequestMeta(req));

  return NextResponse.json({
    success: true,
    cancelled_pending_contract: cancelledContract,
  });
}
