import { createClient } from "@/lib/supabase/server";
import type { FinEmployee, FinPayroll } from "./types";

export interface MonthlyPayrollRow {
  employee: FinEmployee;
  payroll?: FinPayroll;
}

export async function getMonthlyPayroll(yearMonth: string, companyId?: string): Promise<MonthlyPayrollRow[]> {
  const supabase = await createClient();

  let empQuery = supabase.from("employees").select("*").eq("status", "재직");
  if (companyId && companyId !== "all") empQuery = empQuery.eq("company", companyId);
  const { data: employees } = await empQuery;

  const employeeIds = (employees || []).map((e) => String(e.id));
  let payrolls: FinPayroll[] = [];
  if (employeeIds.length > 0) {
    const { data } = await supabase
      .from("payroll")
      .select("*")
      .in("employee_id", employeeIds)
      .eq("year_month", yearMonth);
    payrolls = data || [];
  }

  const payMap = new Map(payrolls.map((p) => [String(p.employee_id), p]));

  return (employees || []).map((emp) => ({
    employee: emp,
    payroll: payMap.get(String(emp.id)),
  }));
}

export async function getPayrollRecord(employeeId: string, yearMonth: string): Promise<FinPayroll | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payroll")
    .select("*")
    .eq("employee_id", String(employeeId))
    .eq("year_month", yearMonth)
    .maybeSingle();
  return data;
}
