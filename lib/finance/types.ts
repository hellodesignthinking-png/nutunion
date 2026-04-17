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
