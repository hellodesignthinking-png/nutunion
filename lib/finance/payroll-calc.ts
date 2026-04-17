/**
 * 한국 기준 급여 계산 (2026)
 * - 4대 사회보험 근로자 부담분
 * - 간이세액표 근사 (월별 소득세)
 */

export const INSURANCE_RATES = {
  /** 국민연금 근로자 부담 (4.5%) */
  nationalPension: 0.045,
  /** 건강보험 근로자 부담 (7.09%의 절반) */
  healthInsurance: 0.03545,
  /** 장기요양보험 (건강보험 × 12.81%) */
  longTermCareRate: 0.1281,
  /** 고용보험 근로자 부담 (0.9%) */
  employmentInsurance: 0.009,
};

export interface PayrollInput {
  annualSalary?: number;
  hourlyWage?: number;
  dailyHours?: number;
  weeklyDays?: number;
  workDays?: string; // "월,화,수"
  employmentType?: string; // 정규직/계약직/인턴/알바
  overtimeHours?: number;
  bonusPay?: number;
  annualLeavePay?: number;
  otherPay?: number;
}

export interface PayrollResult {
  basePay: number;
  hourlyRate: number;
  overtimeHours: number;
  overtimePay: number;
  bonusPay: number;
  annualLeavePay: number;
  otherPay: number;
  totalPay: number;
  // 공제
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  incomeTax: number;
  localIncomeTax: number;
  totalDeduction: number;
  // 최종
  netPay: number;
}

/**
 * 간이세액표 근사치 — 월급 기준 근로소득세
 * 실제 세무처리는 국세청 간이세액표 기준으로 별도 확인 필요
 */
function estimateIncomeTax(monthlyPay: number): number {
  // 근로소득공제 근사 150,000원
  const taxable = monthlyPay - 150_000;
  if (taxable <= 0) return 0;
  if (taxable <= 1_000_000) return Math.round(taxable * 0.06);
  if (taxable <= 3_000_000) return Math.round(60_000 + (taxable - 1_000_000) * 0.08);
  if (taxable <= 5_000_000) return Math.round(220_000 + (taxable - 3_000_000) * 0.12);
  if (taxable <= 8_000_000) return Math.round(460_000 + (taxable - 5_000_000) * 0.15);
  return Math.round(910_000 + (taxable - 8_000_000) * 0.2);
}

export function calculatePayroll(emp: PayrollInput): PayrollResult {
  const isAlba = emp.employmentType === "알바";

  // 월 기본급 계산
  let basePay: number;
  let hourlyRate: number;
  if (isAlba && emp.hourlyWage) {
    const weeklyHours = (Number(emp.dailyHours) || 8) * (Number(emp.weeklyDays) || 5);
    const hasHolidayPay = weeklyHours >= 15;
    const weeklyHolidayHours = hasHolidayPay ? (weeklyHours / 40) * 8 : 0;
    const weeklyTotal = (weeklyHours + weeklyHolidayHours) * emp.hourlyWage;
    basePay = Math.round(weeklyTotal * (52 / 12));
    hourlyRate = emp.hourlyWage;
  } else {
    basePay = Math.round((emp.annualSalary || 0) / 12);
    hourlyRate = Math.round(basePay / 209); // 월 209h 기준
  }

  const overtimeHours = Number(emp.overtimeHours) || 0;
  const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5);
  const bonusPay = Math.round(emp.bonusPay || 0);
  const annualLeavePay = Math.round(emp.annualLeavePay || 0);
  const otherPay = Math.round(emp.otherPay || 0);

  const totalPay = basePay + overtimePay + bonusPay + annualLeavePay + otherPay;

  // 4대 보험 (근로자 부담분)
  const nationalPension = Math.round(totalPay * INSURANCE_RATES.nationalPension);
  const healthInsurance = Math.round(totalPay * INSURANCE_RATES.healthInsurance);
  const longTermCare = Math.round(healthInsurance * INSURANCE_RATES.longTermCareRate);
  const employmentInsurance = Math.round(totalPay * INSURANCE_RATES.employmentInsurance);

  // 세금
  const incomeTax = estimateIncomeTax(totalPay);
  const localIncomeTax = Math.round(incomeTax * 0.1);

  const totalDeduction =
    nationalPension + healthInsurance + longTermCare + employmentInsurance + incomeTax + localIncomeTax;
  const netPay = totalPay - totalDeduction;

  return {
    basePay,
    hourlyRate,
    overtimeHours,
    overtimePay,
    bonusPay,
    annualLeavePay,
    otherPay,
    totalPay,
    nationalPension,
    healthInsurance,
    longTermCare,
    employmentInsurance,
    incomeTax,
    localIncomeTax,
    totalDeduction,
    netPay,
  };
}
