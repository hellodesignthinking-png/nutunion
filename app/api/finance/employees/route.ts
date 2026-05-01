import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog, extractRequestMeta } from "@/lib/finance/audit-log";
import { checkRateLimit, rateLimitResponse } from "@/lib/finance/rate-limit";
import { EmployeeCreateSchema, formatZodError } from "@/lib/finance/validators";

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
    // 숫자형 필드가 문자열로 오는 경우 변환
    const normalized = {
      ...body,
      annual_salary: body?.annual_salary !== undefined && body.annual_salary !== "" ? Number(body.annual_salary) : undefined,
      hourly_wage: body?.hourly_wage !== undefined && body.hourly_wage !== "" ? Number(body.hourly_wage) : undefined,
      weekly_days: body?.weekly_days !== undefined && body.weekly_days !== "" ? Number(body.weekly_days) : undefined,
      daily_hours: body?.daily_hours !== undefined && body.daily_hours !== "" ? Number(body.daily_hours) : undefined,
    };
    const parsed = EmployeeCreateSchema.safeParse(normalized);
    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400 });
    }
    const d = parsed.data;
    const isAlba = d.employment_type === "알바";

    // 정규직은 연봉 필수
    if (!isAlba && !d.annual_salary) {
      return NextResponse.json({ error: "연봉을 입력하세요" }, { status: 400 });
    }

    const record = {
      name: d.name,
      company: d.company,
      position: d.position || "사원",
      department: d.department ?? null,
      employment_type: d.employment_type || "정규직",
      status: "재직",
      email: d.email || null,
      phone: d.phone ?? null,
      join_date: d.join_date || new Date().toISOString().slice(0, 10),
      annual_salary: isAlba
        ? Math.round((d.hourly_wage ?? 0) * (d.daily_hours ?? 8) * (d.weekly_days ?? 5) * 52)
        : (d.annual_salary ?? 0),
      annual_leave_total: isAlba ? 0 : 15,
      annual_leave_used: 0,
      hourly_wage: isAlba ? (d.hourly_wage ?? null) : null,
      weekly_days: isAlba ? (d.weekly_days ?? 5) : null,
      daily_hours: isAlba ? (d.daily_hours ?? 8) : null,
      work_days: isAlba ? (d.work_days ?? null) : null,
      bank_name: d.bank_name ?? null,
      bank_account: d.bank_account ?? null,
      created_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase
      .from("employees")
      .insert(record)
      .select()
      .single();
    if (error) {
      console.error("[Employees POST]", error);
      return NextResponse.json({ error: "저장에 실패했습니다" }, { status: 500 });
    }

    await writeAuditLog(supabase, user, {
      entity_type: "employee",
      entity_id: inserted.id,
      action: "create",
      company: inserted.company,
      summary: `직원 등록: ${inserted.name} (${inserted.employment_type})`,
      diff: { after: inserted },
      actor_role: profile.role,
    }, extractRequestMeta(req));

    return NextResponse.json({ success: true, employee: inserted });
  } catch (err) {
    log.error(err, "finance.employees.failed");
    console.error("[Employees POST]", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
