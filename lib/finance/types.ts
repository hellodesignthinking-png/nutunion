// Vite 재무 시스템의 테이블 구조를 Next.js에서 읽기용으로 매핑

export interface FinCompany {
  id: string;
  name: string;
  label?: string;
  color?: string;
  icon?: string;
  biz_no?: string;
  representative?: string;
  biz_type?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface FinTransaction {
  id: number;
  date: string; // YYYY-MM-DD
  company: string; // company.id
  type: string; // 거래 유형
  description: string;
  amount: number; // 수입 +, 지출 -
  category: string;
  memo?: string;
  receipt_type?: string;
  vendor_name?: string;
  vendor_biz_no?: string;
  payment_method?: string;
  vat_amount?: number;
  supply_amount?: number;
  tax_amount?: number;
  account_name?: string;
  account_no?: string;
  created_at?: string;
}

export interface CompanyFinanceSummary {
  company: FinCompany;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  transactionCount: number;
  monthlyBreakdown: { month: string; income: number; expense: number }[];
  categoryBreakdown: { category: string; amount: number }[];
}

// HR
export interface FinEmployee {
  id: number | string;
  name: string;
  company: string;
  position?: string;
  department?: string;
  employment_type?: string; // 정규직/계약직/인턴/알바
  status?: string; // 재직/휴직/퇴직
  email?: string;
  phone?: string;
  join_date?: string;
  end_date?: string;
  annual_salary?: number;
  annual_leave_total?: number;
  annual_leave_used?: number;
  hourly_wage?: number;
  weekly_days?: number;
  daily_hours?: number;
  work_days?: string;
  work_start_time?: string;
  work_end_time?: string;
  bank_name?: string;
  bank_account?: string;
  contract_signed?: boolean;
  contract_status?: string;
  contract_date?: string;
  contract_sent_date?: string;
  signature_image?: string;
  created_at?: string;
}

export interface FinAttendance {
  id: number | string;
  employee_id: string;
  employee_name?: string;
  company: string;
  date: string;
  time?: string;
  type: string; // 출근/퇴근/연차/반차(오전)/반차(오후)/병가/외근/출장/재택근무/경조사
  memo?: string;
}

export interface FinPayroll {
  id: number | string;
  employee_id: string;
  company: string;
  year_month: string;
  base_pay: number;
  overtime_hours?: number;
  overtime_pay: number;
  bonus_pay: number;
  annual_leave_pay: number;
  total_pay: number;
  national_pension: number;
  health_insurance: number;
  long_term_care: number;
  employment_insurance: number;
  income_tax: number;
  local_income_tax: number;
  total_deduction: number;
  net_pay: number;
  paid_date?: string;
  memo?: string;
}

export interface EmployeeSummary {
  employee: FinEmployee;
  monthlyAttendance: Record<string, number>; // type → count
  thisMonthPayroll?: FinPayroll;
}
