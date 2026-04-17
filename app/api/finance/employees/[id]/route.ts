import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function checkPermission() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, message: "Unauthorized" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { ok: false as const, status: 403, message: "Forbidden" };
  }
  return { ok: true as const, supabase };
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

  const { error } = await check.supabase.from("employees").update(updates).eq("id", id);
  if (error) {
    console.error("[Employees PATCH]", error);
    return NextResponse.json({ error: "수정 실패" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const check = await checkPermission();
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status });

  // 완전 삭제 대신 소프트 삭제: status를 '퇴직'으로
  const { error } = await check.supabase
    .from("employees")
    .update({ status: "퇴직", end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", id);
  if (error) {
    console.error("[Employees DELETE]", error);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
