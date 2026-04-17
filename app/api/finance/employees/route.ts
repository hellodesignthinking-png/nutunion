import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // rate limit: 분당 10건
    const rl = await checkRateLimit(supabase, `${user.id}:employee-create`, 10, 60);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await req.json();
    const {
      name, company, position, department, employment_type, email, phone,
      annual_salary, hourly_wage, weekly_days, daily_hours, work_days,
      bank_name, bank_account, join_date,
    } = body || {};

    if (!name?.trim() || !company) {
      return NextResponse.json({ error: "이름과 법인은 필수입니다" }, { status: 400 });
    }

    const isAlba = employment_type === "알바";
    if (!isAlba && (!annual_salary || isNaN(Number(annual_salary)))) {
      return NextResponse.json({ error: "연봉을 입력하세요" }, { status: 400 });
    }
    if (isAlba && (!hourly_wage || isNaN(Number(hourly_wage)))) {
      return NextResponse.json({ error: "시급을 입력하세요" }, { status: 400 });
    }

    const record = {
      id: Date.now(),
      name: name.trim(),
      company,
      position: position || "사원",
      department: department || null,
      employment_type: employment_type || "정규직",
      status: "재직",
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      join_date: join_date || new Date().toISOString().slice(0, 10),
      annual_salary: isAlba
        ? Math.round(Number(hourly_wage) * Number(daily_hours || 8) * Number(weekly_days || 5) * 52)
        : Number(annual_salary),
      annual_leave_total: isAlba ? 0 : 15,
      annual_leave_used: 0,
      hourly_wage: isAlba ? Number(hourly_wage) : null,
      weekly_days: isAlba ? Number(weekly_days || 5) : null,
      daily_hours: isAlba ? Number(daily_hours || 8) : null,
      work_days: isAlba ? work_days || null : null,
      bank_name: bank_name || null,
      bank_account: bank_account || null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("employees").insert(record);
    if (error) {
      console.error("[Employees POST]", error);
      return NextResponse.json({ error: "저장에 실패했습니다" }, { status: 500 });
    }

    await writeAuditLog(supabase, user, {
      entity_type: "employee",
      entity_id: record.id,
      action: "create",
      company: record.company,
      summary: `직원 등록: ${record.name} (${record.employment_type})`,
      diff: { after: record },
      actor_role: profile.role,
    }, extractRequestMeta(req));

    return NextResponse.json({ success: true, employee: record });
  } catch (err) {
    console.error("[Employees POST]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
