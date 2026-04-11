"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  PieChart,
  Plus,
  Filter,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Loader2,
  X,
  ChevronDown,
} from "lucide-react";
import type { ProjectFinance, ProjectMilestone } from "@/lib/types";

interface ProjectFinanceDashboardProps {
  projectId: string;
  totalBudget: number;
  isLead: boolean;
  milestones?: ProjectMilestone[];
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  personnel: {
    label: "인건비",
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  tools: {
    label: "툴/소프트웨어",
    color: "text-purple-600",
    bg: "bg-purple-100",
  },
  marketing: {
    label: "마케팅",
    color: "text-pink-600",
    bg: "bg-pink-100",
  },
  other: {
    label: "기타",
    color: "text-gray-600",
    bg: "bg-gray-100",
  },
};

const CATEGORY_COLORS = {
  personnel: "#3b82f6",
  tools: "#a855f7",
  marketing: "#ec4899",
  other: "#9ca3af",
};

export function ProjectFinanceDashboard({
  projectId,
  totalBudget,
  isLead,
  milestones = [],
}: ProjectFinanceDashboardProps) {
  const [transactions, setTransactions] = useState<ProjectFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    type: "expense" as "expense" | "income" | "budget_allocation",
    category: "other" as string,
    milestoneId: "",
    receiptUrl: "",
    description: "",
  });

  // Load transactions
  const loadTransactions = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_finance")
        .select("*")
        .eq("project_id", projectId)
        .order("recorded_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err: any) {
      toast.error(err.message || "재무 거래 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  // Load transactions on mount
  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setInitialized(true);
    loadTransactions();
  }

  // Calculate metrics
  const metrics = useMemo(() => {
    const expenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSpent = expenses - income;
    const remaining = totalBudget - totalSpent;
    const burnRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      expenses,
      income,
      totalSpent,
      remaining,
      burnRate: Math.min(burnRate, 100),
    };
  }, [transactions, totalBudget]);

  // Calculate category breakdown
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {
      personnel: 0,
      tools: 0,
      marketing: 0,
      other: 0,
    };

    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        breakdown[t.category] = (breakdown[t.category] || 0) + t.amount;
      });

    return breakdown;
  }, [transactions]);

  const totalCategoryAmount = Object.values(categoryBreakdown).reduce(
    (a, b) => a + b,
    0
  );

  // Filter transactions by category
  const filteredTransactions = useMemo(() => {
    if (!selectedCategory) return transactions;
    return transactions.filter((t) => t.category === selectedCategory);
  }, [transactions, selectedCategory]);

  // Handle add transaction
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.amount) {
      toast.error("제목과 금액을 입력해주세요");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_finance")
        .insert({
          project_id: projectId,
          title: formData.title.trim(),
          amount: parseFloat(formData.amount),
          type: formData.type,
          category: formData.category,
          milestone_id: formData.milestoneId || null,
          receipt_url: formData.receiptUrl || null,
          description: formData.description || null,
          recorded_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error) throw error;

      setTransactions((prev) => [data, ...prev]);
      setFormData({
        title: "",
        amount: "",
        type: "expense",
        category: "other",
        milestoneId: "",
        receiptUrl: "",
        description: "",
      });
      setShowAddForm(false);
      toast.success("거래가 추가되었습니다");
    } catch (err: any) {
      toast.error(err.message || "거래 추가 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const getBurnRateColor = (rate: number) => {
    if (rate < 60) return "text-green-600";
    if (rate < 80) return "text-nu-amber";
    return "text-red-500";
  };

  const getBurnRateBg = (rate: number) => {
    if (rate < 60) return "bg-green-50 border-green-200";
    if (rate < 80) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  };

  const formatKRW = (amount: number) => {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="bg-gradient-to-r from-nu-ink via-nu-ink to-nu-ink/95 text-nu-paper px-6 py-5 relative overflow-hidden border-2 border-nu-ink/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-nu-pink/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={16} className="text-nu-pink" />
            <span className="font-mono-nu text-[9px] font-black uppercase tracking-[0.25em] text-nu-pink">
              Finance_Dashboard
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Budget */}
            <div className="bg-nu-ink/40 backdrop-blur-sm border border-nu-pink/20 rounded-lg p-4">
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink mb-1">
                총 예산
              </p>
              <p className="font-head text-2xl font-extrabold text-nu-paper">
                {formatKRW(totalBudget)}
              </p>
            </div>

            {/* Total Spent */}
            <div className="bg-nu-ink/40 backdrop-blur-sm border border-nu-blue/20 rounded-lg p-4">
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-blue mb-1">
                총 지출
              </p>
              <p className="font-head text-2xl font-extrabold text-nu-paper">
                {formatKRW(metrics.totalSpent)}
              </p>
            </div>

            {/* Remaining */}
            <div className="bg-nu-ink/40 backdrop-blur-sm border border-green-500/20 rounded-lg p-4">
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-green-400 mb-1">
                잔여 예산
              </p>
              <p className="font-head text-2xl font-extrabold text-green-300">
                {formatKRW(Math.max(0, metrics.remaining))}
              </p>
            </div>

            {/* Burn Rate */}
            <div
              className={`backdrop-blur-sm border-2 rounded-lg p-4 ${getBurnRateBg(
                metrics.burnRate
              )}`}
            >
              <p className="font-mono-nu text-[10px] uppercase tracking-widest mb-1">
                소진율
              </p>
              <p className={`font-head text-2xl font-extrabold ${getBurnRateColor(metrics.burnRate)}`}>
                {metrics.burnRate.toFixed(1)}%
              </p>
              {metrics.burnRate > 80 && (
                <p className="text-[9px] text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={10} /> 주의
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Budget Breakdown Chart */}
      <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
        <div className="px-6 py-5 border-b border-nu-ink/[0.06]">
          <h3 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-muted mb-4 flex items-center gap-2">
            <PieChart size={12} /> 예산 배분 현황
          </h3>

          {/* Pure CSS/HTML Bar Chart */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="font-mono-nu text-[10px] font-bold w-24 text-nu-muted">
                예산 현황
              </span>
              <div className="flex-1 h-6 bg-nu-ink/5 rounded-full overflow-hidden flex">
                {Object.entries(categoryBreakdown).map(([cat, amount]) => {
                  const percentage =
                    totalCategoryAmount > 0
                      ? (amount / totalCategoryAmount) * 100
                      : 0;
                  if (percentage === 0) return null;
                  return (
                    <div
                      key={cat}
                      className="h-full transition-all hover:opacity-80 cursor-pointer"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS],
                        minWidth: percentage > 5 ? "auto" : "0",
                      }}
                      title={`${CATEGORY_LABELS[cat].label}: ${formatKRW(amount)}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {Object.entries(categoryBreakdown).map(([cat, amount]) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 p-2 rounded hover:bg-nu-cream/20 cursor-pointer transition-colors"
                  onClick={() =>
                    setSelectedCategory(selectedCategory === cat ? null : cat)
                  }
                >
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{
                      backgroundColor: CATEGORY_COLORS[cat as keyof typeof CATEGORY_COLORS],
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono-nu text-[9px] font-bold text-nu-muted">
                      {CATEGORY_LABELS[cat].label}
                    </p>
                    <p className="text-[10px] font-head font-bold text-nu-ink">
                      {formatKRW(amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Milestone-linked Spending */}
      {milestones.length > 0 && (
        <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
          <div className="px-6 py-5 border-b border-nu-ink/[0.06]">
            <h3 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-muted mb-4 flex items-center gap-2">
              <TrendingUp size={12} /> 마일스톤 별 예산 현황
            </h3>

            <div className="space-y-4">
              {milestones.map((ms) => {
                const msTransactions = transactions.filter(
                  (t) => t.milestone_id === ms.id && t.type === "expense"
                );
                const msSpent = msTransactions.reduce((sum, t) => sum + t.amount, 0);
                // Use actual reward_percentage from milestone, fallback to equal split
                const pct = (ms as any).reward_percentage || (milestones.length > 0 ? 100 / milestones.length : 25);
                const msAllocated = totalBudget * (pct / 100);

                return (
                  <div key={ms.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-nu-ink">{ms.title}</p>
                        <p className="font-mono-nu text-[9px] text-nu-muted">
                          {formatKRW(msSpent)} / {formatKRW(msAllocated)}
                        </p>
                      </div>
                      <span className="font-mono-nu text-[10px] font-bold text-nu-pink">
                        {msAllocated > 0
                          ? Math.round((msSpent / msAllocated) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="h-2 bg-nu-ink/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-nu-pink transition-all"
                        style={{
                          width: `${Math.min((msSpent / msAllocated) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    {msTransactions.length > 0 && (
                      <p className="font-mono-nu text-[8px] text-nu-muted">
                        {msTransactions.length}건 거래
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="bg-nu-white border-[2px] border-nu-ink/[0.08] overflow-hidden">
        <div className="px-6 py-5 border-b border-nu-ink/[0.06] flex items-center justify-between">
          <h3 className="font-mono-nu text-[10px] font-bold uppercase tracking-widest text-nu-muted flex items-center gap-2">
            <Receipt size={12} /> 거래 내역
          </h3>
          <div className="flex items-center gap-2">
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="font-mono-nu text-[9px] px-2 py-1 bg-nu-pink/10 text-nu-pink border border-nu-pink/30 rounded hover:bg-nu-pink/20 transition-colors flex items-center gap-1"
              >
                <X size={10} /> {CATEGORY_LABELS[selectedCategory]?.label}
              </button>
            )}
            {isLead && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-3 py-2 bg-nu-pink text-white hover:bg-nu-pink/90 transition-colors flex items-center gap-1"
              >
                <Plus size={12} /> 추가
              </button>
            )}
          </div>
        </div>

        {/* Add Transaction Form */}
        {isLead && showAddForm && (
          <form
            onSubmit={handleAddTransaction}
            className="px-6 py-5 bg-nu-cream/10 border-b border-nu-ink/[0.06] space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="거래 제목"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink rounded"
              />
              <input
                type="number"
                placeholder="금액"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className="px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink rounded"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as "expense" | "income" | "budget_allocation",
                  })
                }
                className="px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink rounded"
              >
                <option value="expense">지출</option>
                <option value="income">수입</option>
                <option value="budget_allocation">예산 배정</option>
              </select>

              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink rounded"
              >
                {Object.entries(CATEGORY_LABELS).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              {milestones.length > 0 && (
                <select
                  value={formData.milestoneId}
                  onChange={(e) =>
                    setFormData({ ...formData, milestoneId: e.target.value })
                  }
                  className="px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink rounded"
                >
                  <option value="">마일스톤 (선택사항)</option>
                  {milestones.map((ms) => (
                    <option key={ms.id} value={ms.id}>
                      {ms.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="url"
                placeholder="영수증 URL (선택사항)"
                value={formData.receiptUrl}
                onChange={(e) =>
                  setFormData({ ...formData, receiptUrl: e.target.value })
                }
                className="px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink rounded"
              />
              <textarea
                placeholder="설명 (선택사항)"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="px-4 py-3 bg-nu-paper border border-nu-ink/[0.12] text-sm focus:outline-none focus:border-nu-pink rounded resize-none"
                rows={1}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                {submitting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  "거래 추가"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink px-3 py-2"
              >
                취소
              </button>
            </div>
          </form>
        )}

        {/* Transaction List */}
        <div className="max-h-[500px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-nu-muted" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-nu-muted text-sm">
                {selectedCategory ? "해당 카테고리의 거래가 없습니다" : "거래 내역이 없습니다"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-nu-ink/[0.06]">
              {filteredTransactions.map((tx) => {
                const catLabel = CATEGORY_LABELS[tx.category];
                const isExpense = tx.type === "expense";

                return (
                  <div
                    key={tx.id}
                    className="px-6 py-3 hover:bg-nu-cream/10 transition-colors flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-nu-ink truncate">
                          {tx.title}
                        </p>
                        {catLabel && (
                          <span
                            className={`font-mono-nu text-[8px] font-bold uppercase px-2 py-0.5 ${catLabel.bg} ${catLabel.color} border border-current/20 rounded`}
                          >
                            {catLabel.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-nu-muted">
                        <span>
                          {new Date(tx.recorded_at).toLocaleDateString("ko", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        {tx.milestone && (
                          <span className="bg-nu-ink/5 px-1.5 py-0.5 rounded">
                            {tx.milestone.title}
                          </span>
                        )}
                        {tx.description && (
                          <span className="italic">{tx.description}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <div className="text-right">
                        <p
                          className={`font-head text-sm font-bold ${
                            isExpense ? "text-red-500" : "text-green-600"
                          }`}
                        >
                          {isExpense ? "-" : "+"}
                          {formatKRW(tx.amount)}
                        </p>
                      </div>
                      {tx.receipt_url && (
                        <a
                          href={tx.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-nu-pink/10 rounded transition-colors"
                          title="영수증"
                        >
                          <Receipt
                            size={14}
                            className="text-nu-pink hover:text-nu-pink/80"
                          />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {!loading && transactions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 border-2 border-green-200 px-4 py-3 rounded-lg">
            <p className="font-mono-nu text-[9px] uppercase tracking-widest text-green-700 mb-1">
              <ArrowDownRight size={12} className="inline mr-1" />
              총 수입
            </p>
            <p className="font-head text-lg font-bold text-green-600">
              {formatKRW(metrics.income)}
            </p>
          </div>

          <div className="bg-red-50 border-2 border-red-200 px-4 py-3 rounded-lg">
            <p className="font-mono-nu text-[9px] uppercase tracking-widest text-red-700 mb-1">
              <ArrowUpRight size={12} className="inline mr-1" />
              총 지출
            </p>
            <p className="font-head text-lg font-bold text-red-600">
              {formatKRW(metrics.expenses)}
            </p>
          </div>

          <div className="bg-nu-blue/5 border-2 border-nu-blue/20 px-4 py-3 rounded-lg">
            <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-blue mb-1">
              거래 건수
            </p>
            <p className="font-head text-lg font-bold text-nu-blue">
              {transactions.length}건
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
