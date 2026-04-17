import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculatePayroll } from "@/lib/finance/payroll-calc";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";

/**
 * POST /api/finance/payroll
 * Body: { employee_id, year_month, overtime_hours?, bonus_pay?, annual_leave_pay?, other_pay?, memo? }
 * 직원 정보를 바탕으로 계산하여 upsert
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // rate limit: 분당 30건
    const rl = await checkRateLimit(supabase, `${user.id}:payroll-upsert`, 30, 60);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json();
    const { employee_id, year_month, overtime_hours, bonus_pay, annual_leave_pay, other_pay, memo, paid_date } = body || {};

    if (!employee_id || !year_month) {
      return NextResponse.json({ error: "employee_id, year_month 필수" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}$/.test(year_month)) {
      return NextResponse.json({ error: "year_month 형식 오류 (YYYY-MM)" }, { status: 400 });
    }

    const { data: employee } = await supabase.from("employees").select("*").eq("id", employee_id).single();
    if (!employee) return NextResponse.json({ error: "직원 없음" }, { status: 404 });

    const calc = calculatePayroll({
      annualSalary: Number(employee.annual_salary) || 0,
      hourlyWage: Number(employee.hourly_wage) || 0,
      dailyHours: Number(employee.daily_hours) || 8,
      weeklyDays: Number(employee.weekly_days) || 5,
      workDays: employee.work_days,
      employmentType: employee.employment_type,
      overtimeHours: Number(overtime_hours) || 0,
      bonusPay: Number(bonus_pay) || 0,
      annualLeavePay: Number(annual_leave_pay) || 0,
      otherPay: Number(other_pay) || 0,
    });

    // 기존 레코드 확인 (같은 직원/월)
    const { data: existing } = await supabase
      .from("payroll")
      .select("id")
      .eq("employee_id", String(employee_id))
      .eq("year_month", year_month)
      .maybeSingle();

    const record = {
      id: existing?.id || Date.now(),
      employee_id: String(employee_id),
      company: employee.company,
      year_month,
      base_pay: calc.basePay,
      overtime_hours: calc.overtimeHours,
      overtime_pay: calc.overtimePay,
      bonus_pay: calc.bonusPay,
      annual_leave_pay: calc.annualLeavePay,
      total_pay: calc.totalPay,
      national_pension: calc.nationalPension,
      health_insurance: calc.healthInsurance,
      long_term_care: calc.longTermCare,
      employment_insurance: calc.employmentInsurance,
      income_tax: calc.incomeTax,
      local_income_tax: calc.localIncomeTax,
      total_deduction: calc.totalDeduction,
      net_pay: calc.netPay,
      paid_date: paid_date || null,
      memo: memo || null,
    };

    const { error } = await supabase.from("payroll").upsert(record, { onConflict: "id" });
    if (error) {
      console.error("[Payroll POST]", error);
      return NextResponse.json({ error: "저장 실패" }, { status: 500 });
    }

    await writeAuditLog(supabase, user, {
      entity_type: "payroll",
      entity_id: record.id,
      action: existing ? "update" : "create",
      company: record.company,
      summary: `급여명세서 ${existing ? "수정" : "작성"}: ${employee.name} ${year_month} (지급 ${record.net_pay.toLocaleString()}원)`,
      diff: { after: record },
      actor_role: profile.role,
    }, extractRequestMeta(req));

    return NextResponse.json({ success: true, payroll: record });
  } catch (err) {
    console.error("[Payroll POST]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
