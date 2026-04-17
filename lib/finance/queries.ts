import { createClient } from "@/lib/supabase/server";
import type { Project, ProjectFinance } from "@/lib/types";

export interface BoltFinanceSummary {
  project: Project;
  totalBudget: number;
  totalIncome: number;
  totalExpense: number;
  balance: number; // 예산 - 지출
  netProfit: number; // 수입 - 지출
  transactionCount: number;
  categoryBreakdown: Record<string, number>; // 카테고리별 지출
}

/**
 * 모든 볼트(프로젝트) + 각 볼트의 재무 요약 데이터
 */
export async function getBoltsWithFinance(): Promise<BoltFinanceSummary[]> {
  const supabase = await createClient();

  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (projErr || !projects) return [];

  const { data: finances } = await supabase
    .from("project_finance")
    .select("*");

  const financesByProject = new Map<string, ProjectFinance[]>();
  (finances || []).forEach((f) => {
    const arr = financesByProject.get(f.project_id) || [];
    arr.push(f);
    financesByProject.set(f.project_id, arr);
  });

  return projects.map((project) => {
    const txs = financesByProject.get(project.id) || [];
    let totalBudget = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    const categoryBreakdown: Record<string, number> = {};

    txs.forEach((t) => {
      if (t.type === "budget_allocation") totalBudget += t.amount;
      else if (t.type === "income") totalIncome += t.amount;
      else if (t.type === "expense") {
        totalExpense += t.amount;
        categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount;
      }
    });

    return {
      project,
      totalBudget,
      totalIncome,
      totalExpense,
      balance: totalBudget - totalExpense,
      netProfit: totalIncome - totalExpense,
      transactionCount: txs.length,
      categoryBreakdown,
    };
  });
}

/**
 * 특정 볼트(프로젝트)의 재무 상세
 */
export async function getBoltFinance(projectId: string) {
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) return null;

  const { data: finances } = await supabase
    .from("project_finance")
    .select("*")
    .eq("project_id", projectId)
    .order("recorded_at", { ascending: false });

  const { data: milestones } = await supabase
    .from("project_milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  const totalBudget = (finances || [])
    .filter((f) => f.type === "budget_allocation")
    .reduce((s, f) => s + f.amount, 0);

  return {
    project: project as Project,
    finances: (finances || []) as ProjectFinance[],
    milestones: milestones || [],
    totalBudget,
  };
}
