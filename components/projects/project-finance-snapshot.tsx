"use client";

import Image from "next/image";
import { CheckCircle2, DollarSign, TrendingUp, TrendingDown, Wallet, Users, Trophy } from "lucide-react";

interface MilestoneSnap {
  id: string;
  title: string;
  status: string;
  reward_percentage: number;
  reward_amount: number;
  is_settled: boolean;
  settled_at?: string | null;
}

interface MemberSnap {
  user_id: string;
  role?: string | null;
  reward_ratio: number;
  reward_amount: number;
  nickname?: string | null;
  avatar_url?: string | null;
}

export interface FinanceSnapshot {
  currency: string;
  total_budget: number;
  reward_total: number;
  income_total: number;
  expense_total: number;
  balance: number;
  transaction_count: number;
  milestones: MilestoneSnap[];
  members: MemberSnap[];
  computed_at: string;
}

interface Props {
  snapshot: FinanceSnapshot;
  finalizedAt?: string | null;
}

function fmt(n: number, currency: string = "KRW"): string {
  return `${n.toLocaleString("ko-KR")} ${currency === "KRW" ? "원" : currency}`;
}

/**
 * 마감된 프로젝트의 자금/보상 최종 정산 뷰.
 * project.finance_snapshot 에서 읽어 렌더 → 원본 project_finance 권한 없이도 결과 요약 조회 가능.
 */
export function ProjectFinanceSnapshot({ snapshot, finalizedAt }: Props) {
  const { currency, total_budget, reward_total, income_total, expense_total, balance, transaction_count, milestones, members } = snapshot;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="border-[2.5px] border-green-600 bg-green-50 p-4 shadow-[4px_4px_0_0_rgba(21,128,61,0.2)]">
        <div className="flex items-center gap-2 flex-wrap">
          <CheckCircle2 size={20} className="text-green-700" />
          <span className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-green-700 font-bold">
            최종 정산 완료
          </span>
          {finalizedAt && (
            <span className="font-mono-nu text-[10px] text-nu-graphite ml-auto">
              {new Date(finalizedAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}
        </div>
        <p className="text-[12px] text-nu-graphite mt-2 leading-relaxed">
          프로젝트가 마감되어 자금·보상 내역이 스냅샷으로 잠겼습니다. 아래는 마감 시점의 최종 집계입니다.
        </p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Wallet size={18} className="text-nu-blue" />}
          label="총 예산"
          value={fmt(total_budget, currency)}
        />
        <KpiCard
          icon={<TrendingUp size={18} className="text-green-600" />}
          label="총 수입"
          value={fmt(income_total, currency)}
        />
        <KpiCard
          icon={<TrendingDown size={18} className="text-red-600" />}
          label="총 지출"
          value={fmt(expense_total, currency)}
          sub={`${transaction_count}건 거래`}
        />
        <KpiCard
          icon={<DollarSign size={18} className={balance >= 0 ? "text-green-700" : "text-red-700"} />}
          label="잔액"
          value={fmt(balance, currency)}
          accent={balance >= 0 ? "green" : "red"}
        />
      </div>

      {/* 마일스톤별 보상 */}
      {milestones.length > 0 && (
        <section className="border-[2.5px] border-nu-ink bg-nu-paper">
          <div className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center gap-2">
            <Trophy size={16} className="text-nu-pink" />
            <span className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-pink font-bold">
              마일스톤별 보상 분배
            </span>
            <span className="ml-auto font-mono-nu text-[10px] text-nu-graphite">
              총 {fmt(reward_total, currency)}
            </span>
          </div>
          <ul className="divide-y divide-nu-ink/10 list-none m-0 p-0">
            {milestones.map((m) => (
              <li key={m.id} className="p-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  m.status === "completed" ? "bg-green-600" :
                  m.status === "in_progress" ? "bg-nu-amber" : "bg-nu-ink/30"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] text-nu-ink">{m.title}</div>
                  <div className="font-mono-nu text-[10px] text-nu-graphite mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{m.status === "completed" ? "✓ 완료" : m.status === "in_progress" ? "진행" : "예정"}</span>
                    {m.is_settled && <span className="text-green-700">· 정산 완료</span>}
                    {m.reward_percentage > 0 && <span>· {m.reward_percentage}% 배분</span>}
                  </div>
                </div>
                <div className="font-mono-nu text-[13px] font-bold text-nu-ink tabular-nums shrink-0">
                  {fmt(m.reward_amount, currency)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 멤버별 보상 */}
      {members.length > 0 && (
        <section className="border-[2.5px] border-nu-ink bg-nu-paper">
          <div className="px-4 py-3 border-b-[2px] border-nu-ink flex items-center gap-2">
            <Users size={16} className="text-nu-blue" />
            <span className="font-mono-nu text-[11px] uppercase tracking-[0.3em] text-nu-blue font-bold">
              멤버별 보상 분배
            </span>
          </div>
          <ul className="divide-y divide-nu-ink/10 list-none m-0 p-0">
            {members.map((m) => (
              <li key={m.user_id} className="p-3 flex items-center gap-3">
                {m.avatar_url ? (
                  <Image src={m.avatar_url} alt="" width={32} height={32} className="w-8 h-8 object-cover border-[1.5px] border-nu-ink rounded-full shrink-0" unoptimized />
                ) : (
                  <div className="w-8 h-8 border-[1.5px] border-nu-ink rounded-full bg-nu-cream flex items-center justify-center text-[12px] shrink-0">
                    {m.nickname?.slice(0, 1) ?? "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] text-nu-ink truncate">{m.nickname ?? "(익명)"}</div>
                  <div className="font-mono-nu text-[10px] text-nu-graphite mt-0.5">
                    {m.role ?? "member"} · {m.reward_ratio}%
                  </div>
                </div>
                <div className="font-mono-nu text-[13px] font-bold text-nu-ink tabular-nums shrink-0">
                  {fmt(m.reward_amount, currency)}
                </div>
              </li>
            ))}
          </ul>
          {members.reduce((s, m) => s + m.reward_ratio, 0) !== 100 && (
            <div className="px-4 py-2 border-t-[1px] border-nu-ink/10 bg-nu-amber/10 font-mono-nu text-[10px] uppercase tracking-widest text-nu-amber">
              ⚠ 배분 비율 합계 {members.reduce((s, m) => s + m.reward_ratio, 0)}% (100% 가 아님)
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "red";
}) {
  const border = accent === "green" ? "border-green-600" : accent === "red" ? "border-red-600" : "border-nu-ink";
  const bg = accent === "green" ? "bg-green-50" : accent === "red" ? "bg-red-50" : "bg-nu-paper";
  return (
    <div className={`border-[2.5px] ${border} ${bg} p-3`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite">{label}</span>
      </div>
      <div className="font-bold text-[16px] text-nu-ink tabular-nums">{value}</div>
      {sub && <div className="font-mono-nu text-[9px] text-nu-graphite mt-0.5">{sub}</div>}
    </div>
  );
}
