import { createClient } from "@/lib/supabase/server";
import type { FinCompany, FinTransaction, CompanyFinanceSummary } from "./types";

const NU_COMPANY: FinCompany = {
  id: "all",
  name: "nutunion",
  label: "전체 통합",
  color: "#C8A97E",
  icon: "◈",
};

/**
 * 모든 법인 로드 (기본 "all" 포함)
 */
export async function getCompanies(): Promise<FinCompany[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: true });
  return [NU_COMPANY, ...(data || [])];
}

/**
 * 법인별 재무 요약 (기본은 "최근 N개월")
 */
export async function getCompaniesWithFinance(
  months: number = 6
): Promise<CompanyFinanceSummary[]> {
  const supabase = await createClient();

  const [companiesRes, txRes] = await Promise.all([
    supabase.from("companies").select("*").order("created_at", { ascending: true }),
    supabase.from("transactions").select("*"),
  ]);

  const companies: FinCompany[] = companiesRes.data || [];
  const txs: FinTransaction[] = txRes.data || [];

  // 최근 N개월 경계
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1).toISOString().slice(0, 10);
  const recentTxs = txs.filter((t) => t.date >= cutoff);

  return companies.map((company) => {
    const companyTxs = recentTxs.filter((t) => t.company === company.id);

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryMap: Record<string, number> = {};
    const monthMap: Record<string, { income: number; expense: number }> = {};

    companyTxs.forEach((t) => {
      const month = t.date?.slice(0, 7) || "";
      if (!monthMap[month]) monthMap[month] = { income: 0, expense: 0 };

      if (t.amount >= 0) {
        totalIncome += t.amount;
        monthMap[month].income += t.amount;
      } else {
        const abs = Math.abs(t.amount);
        totalExpense += abs;
        monthMap[month].expense += abs;
        const cat = t.category || "미분류";
        categoryMap[cat] = (categoryMap[cat] || 0) + abs;
      }
    });

    const monthlyBreakdown = Object.entries(monthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, ...v }));

    const categoryBreakdown = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([category, amount]) => ({ category, amount }));

    return {
      company,
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      transactionCount: companyTxs.length,
      monthlyBreakdown,
      categoryBreakdown,
    };
  });
}

/**
 * 특정 법인의 거래 목록
 */
export async function getCompanyTransactions(
  companyId: string,
  options: { limit?: number; fromDate?: string; toDate?: string } = {}
): Promise<{ company: FinCompany | null; transactions: FinTransaction[] }> {
  const supabase = await createClient();

  let company: FinCompany | null = null;
  if (companyId === "all") {
    company = NU_COMPANY;
  } else {
    const { data } = await supabase.from("companies").select("*").eq("id", companyId).single();
    company = data;
  }

  if (!company) return { company: null, transactions: [] };

  let query = supabase.from("transactions").select("*").order("date", { ascending: false });
  if (companyId !== "all") query = query.eq("company", companyId);
  if (options.fromDate) query = query.gte("date", options.fromDate);
  if (options.toDate) query = query.lte("date", options.toDate);
  if (options.limit) query = query.limit(options.limit);

  const { data } = await query;
  return { company, transactions: data || [] };
}
