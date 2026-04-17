import { createClient } from "@/lib/supabase/server";
import type { FinEmployee, FinAttendance, FinPayroll, EmployeeSummary } from "./types";
import { parseYearMonth, lastDayOfMonth } from "./date-utils";

export interface HRDashboardData {
  totalEmployees: number;
  activeEmployees: number;
  byCompany: Record<string, { total: number; active: number; totalSalary: number }>;
  byEmploymentType: Record<string, number>;
  thisMonthPayrollTotal: number;
  thisMonthPayrollCount: number;
  recentAttendance: number; // 이번 달 출근 기록 수
  pendingContracts: number; // 서명 대기
  onLeaveToday: number; // 오늘 연차/병가
}

export async function getHRDashboard(): Promise<HRDashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = now.toISOString().slice(0, 10);

  const [empRes, payRes, attRes] = await Promise.all([
    supabase.from("employees").select("*"),
    supabase.from("payroll").select("*").eq("year_month", ym),
    supabase.from("attendances").select("*").gte("date", `${ym}-01`),
  ]);

  const employees: FinEmployee[] = empRes.data || [];
  const payrolls: FinPayroll[] = payRes.data || [];
  const attendances: FinAttendance[] = attRes.data || [];

  const byCompany: Record<string, { total: number; active: number; totalSalary: number }> = {};
  const byEmploymentType: Record<string, number> = {};
  let activeEmployees = 0;
  let pendingContracts = 0;

  employees.forEach((e) => {
    const c = e.company || "unknown";
    if (!byCompany[c]) byCompany[c] = { total: 0, active: 0, totalSalary: 0 };
    byCompany[c].total++;
    if (e.status === "재직") {
      byCompany[c].active++;
      activeEmployees++;
      byCompany[c].totalSalary += Number(e.annual_salary) || 0;
    }
    const type = e.employment_type || "기타";
    byEmploymentType[type] = (byEmploymentType[type] || 0) + 1;
    if (e.contract_status === "sent" && !e.contract_signed) pendingContracts++;
  });

  const thisMonthPayrollTotal = payrolls.reduce((s, p) => s + (Number(p.net_pay) || 0), 0);
  const todayAtt = attendances.filter((a) => a.date === today);
  const onLeaveToday = todayAtt.filter((a) => a.type === "연차" || a.type?.includes("반차") || a.type === "병가").length;

  return {
    totalEmployees: employees.length,
    activeEmployees,
    byCompany,
    byEmploymentType,
    thisMonthPayrollTotal,
    thisMonthPayrollCount: payrolls.length,
    recentAttendance: attendances.filter((a) => a.type === "출근").length,
    pendingContracts,
    onLeaveToday,
  };
}

export async function getEmployees(
  opts: { company?: string; status?: string; search?: string } = {}
): Promise<FinEmployee[]> {
  const supabase = await createClient();
  // 목록 뷰에서는 PII(서명, 계좌) 제외 — 상세 페이지에서만 로드
  const LIST_COLUMNS = "id,name,company,position,department,employment_type,status,email,phone,join_date,end_date,annual_salary,annual_leave_total,annual_leave_used,hourly_wage,weekly_days,daily_hours,work_days,contract_signed,contract_status,contract_date,contract_sent_date,created_at";
  let query = supabase.from("employees").select(LIST_COLUMNS).order("created_at", { ascending: false });
  if (opts.company && opts.company !== "all") query = query.eq("company", opts.company);
  if (opts.status) query = query.eq("status", opts.status);
  const { data } = await query;
  let results = (data as unknown as FinEmployee[]) || [];
  // 클라이언트측 검색 필터 (이름/부서/직급/이메일)
  if (opts.search) {
    const q = opts.search.toLowerCase();
    results = results.filter((e) =>
      e.name?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q) ||
      e.position?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q)
    );
  }
  return results;
}

export async function getEmployeeDetail(id: string): Promise<EmployeeSummary | null> {
  const supabase = await createClient();
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data: employee } = await supabase.from("employees").select("*").eq("id", id).single();
  if (!employee) return null;

  const [attRes, payRes] = await Promise.all([
    supabase.from("attendances").select("*").eq("employee_id", String(id)).gte("date", `${ym}-01`),
    supabase.from("payroll").select("*").eq("employee_id", String(id)).eq("year_month", ym).maybeSingle(),
  ]);

  const attendances: FinAttendance[] = attRes.data || [];
  const monthlyAttendance: Record<string, number> = {};
  attendances.forEach((a) => {
    monthlyAttendance[a.type] = (monthlyAttendance[a.type] || 0) + 1;
  });

  return {
    employee,
    monthlyAttendance,
    thisMonthPayroll: payRes.data || undefined,
  };
}

export async function getEmployeePayrollHistory(id: string): Promise<FinPayroll[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payroll")
    .select("*")
    .eq("employee_id", String(id))
    .order("year_month", { ascending: false })
    .limit(12);
  return data || [];
}

export interface MonthlyAttendanceRow {
  employee: FinEmployee;
  counts: Record<string, number>;
}

const DEFAULT_ATTENDANCE_TYPES = ["출근", "연차", "반차(오전)", "반차(오후)", "병가", "외근", "출장", "재택근무"];

export async function getAttendanceTypes(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("attendances").select("type").limit(1000);
  if (!data) return DEFAULT_ATTENDANCE_TYPES;
  const unique = Array.from(new Set(data.map((a) => a.type).filter((t): t is string => Boolean(t))));
  // 기본 순서 + 추가 유형
  const ordered = DEFAULT_ATTENDANCE_TYPES.filter((t) => unique.includes(t));
  const extras = unique.filter((t) => !DEFAULT_ATTENDANCE_TYPES.includes(t));
  const result = [...ordered, ...extras];
  return result.length > 0 ? result : DEFAULT_ATTENDANCE_TYPES;
}

export async function getMonthlyAttendance(yearMonth: string, companyId?: string): Promise<MonthlyAttendanceRow[]> {
  const supabase = await createClient();
  const { ym, y, m } = parseYearMonth(yearMonth);

  let empQuery = supabase.from("employees").select("*").eq("status", "재직");
  if (companyId && companyId !== "all") empQuery = empQuery.eq("company", companyId);
  const { data: employees } = await empQuery;

  let attQuery = supabase
    .from("attendances")
    .select("*")
    .gte("date", `${ym}-01`)
    .lte("date", lastDayOfMonth(y, m));
  if (companyId && companyId !== "all") attQuery = attQuery.eq("company", companyId);
  const { data: attendances } = await attQuery;

  const byEmployee: Record<string, FinAttendance[]> = {};
  (attendances || []).forEach((a) => {
    const k = String(a.employee_id);
    if (!byEmployee[k]) byEmployee[k] = [];
    byEmployee[k].push(a);
  });

  return (employees || []).map((emp) => {
    const records = byEmployee[String(emp.id)] || [];
    const counts: Record<string, number> = {};
    records.forEach((r) => {
      counts[r.type] = (counts[r.type] || 0) + 1;
    });
    return { employee: emp, counts };
  });
}
