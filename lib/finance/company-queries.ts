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

export interface GlobalFinanceTrend {
  thisMonth: { income: number; expense: number };
  lastMonth: { income: number; expense: number };
  incomeChangePct: number;
  expenseChangePct: number;
}

export async function getGlobalFinanceTrend(): Promise<GlobalFinanceTrend> {
  const supabase = await createClient();
  const now = new Date();
  const thisY = now.getFullYear(), thisM = now.getMonth();
  const thisYm = `${thisY}-${String(thisM + 1).padStart(2, "0")}`;
  const lastY = thisM === 0 ? thisY - 1 : thisY;
  const lastM = thisM === 0 ? 12 : thisM;
  const lastYm = `${lastY}-${String(lastM).padStart(2, "0")}`;

  const { data: txs } = await supabase
    .from("transactions")
    .select("date,amount")
    .gte("date", `${lastYm}-01`);

  const acc = { thisM: { i: 0, e: 0 }, lastM: { i: 0, e: 0 } };
  (txs || []).forEach((t) => {
    const m = t.date?.slice(0, 7);
    const bucket = m === thisYm ? acc.thisM : m === lastYm ? acc.lastM : null;
    if (!bucket) return;
    if (t.amount >= 0) bucket.i += t.amount;
    else bucket.e += Math.abs(t.amount);
  });

  const calcPct = (cur: number, prev: number): number => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  };

  return {
    thisMonth: { income: acc.thisM.i, expense: acc.thisM.e },
    lastMonth: { income: acc.lastM.i, expense: acc.lastM.e },
    incomeChangePct: calcPct(acc.thisM.i, acc.lastM.i),
    expenseChangePct: calcPct(acc.thisM.e, acc.lastM.e),
  };
}

/**
 * 법인별 재무 요약 (기본은 "최근 N개월")
 */
export async function getCompaniesWithFinance(
  months: number = 6
): Promise<(CompanyFinanceSummary & { employeeCount: number })[]> {
  const supabase = await createClient();

  const [companiesRes, txRes, empRes] = await Promise.all([
    supabase.from("companies").select("*").order("created_at", { ascending: true }),
    supabase.from("transactions").select("*"),
    supabase.from("employees").select("company,status"),
  ]);

  const companies: FinCompany[] = companiesRes.data || [];
  const txs: FinTransaction[] = txRes.data || [];
  const empsByCompany = new Map<string, number>();
  (empRes.data || []).filter((e) => e.status === "재직").forEach((e) => {
    empsByCompany.set(e.company, (empsByCompany.get(e.company) || 0) + 1);
  });

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
      employeeCount: empsByCompany.get(company.id) || 0,
    };
  });
}

/**
 * 특정 법인의 거래 목록
 */
export async function getCompanyTransactions(
  companyId: string,
  options: { limit?: number; offset?: number; fromDate?: string; toDate?: string } = {}
): Promise<{ company: FinCompany | null; transactions: FinTransaction[]; totalCount: number }> {
  const supabase = await createClient();

  let company: FinCompany | null = null;
  if (companyId === "all") {
    company = NU_COMPANY;
  } else {
    const { data } = await supabase.from("companies").select("*").eq("id", companyId).single();
    company = data;
  }

  if (!company) return { company: null, transactions: [], totalCount: 0 };

  // 총 개수 카운트
  let countQuery = supabase.from("transactions").select("*", { count: "exact", head: true });
  if (companyId !== "all") countQuery = countQuery.eq("company", companyId);
  if (options.fromDate) countQuery = countQuery.gte("date", options.fromDate);
  if (options.toDate) countQuery = countQuery.lte("date", options.toDate);
  const { count } = await countQuery;

  // 페이지 데이터
  let query = supabase.from("transactions").select("*").order("date", { ascending: false });
  if (companyId !== "all") query = query.eq("company", companyId);
  if (options.fromDate) query = query.gte("date", options.fromDate);
  if (options.toDate) query = query.lte("date", options.toDate);
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data } = await query;
  return { company, transactions: data || [], totalCount: count ?? 0 };
}
