"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { VenturePlan } from "@/lib/venture/types";

interface Props {
  projectId: string;
  plan: VenturePlan | null;
  locked?: boolean;
  lockReason?: string;
}

export function VenturePlanCard({ projectId, plan, locked, lockReason }: Props) {
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const [submittingFund, setSubmittingFund] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/venture/${projectId}/plan`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "생성 실패");
      toast.success("사업계획서 초안 생성됨");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "실패");
    } finally {
      setGenerating(false);
    }
  };

  const submitFunding = async () => {
    if (!plan) return;
    const amountStr = prompt("요청 금액 (KRW, 숫자만 — 생략 가능):", "");
    if (amountStr === null) return;
    const amount = amountStr.trim() ? Number(amountStr.replace(/,/g, "")) : undefined;
    if (amountStr.trim() && (isNaN(amount ?? NaN) || (amount ?? 0) < 0)) {
      toast.error("잘못된 금액");
      return;
    }
    setSubmittingFund(true);
    try {
      const res = await fetch("/api/funding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          plan_id: plan.id,
          amount_req: amount,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "제출 실패");
      toast.success("펀딩 포털에 제출되었습니다");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "실패");
    } finally {
      setSubmittingFund(false);
    }
  };

  if (locked) {
    return (
      <section className="border-[2px] border-dashed border-nu-ink/30 bg-nu-paper p-6 text-center">
        <div className="text-[32px] mb-1">🔒</div>
        <h3 className="font-bold text-[16px] text-nu-ink mb-1">⑤ 사업계획 — 최종 결실</h3>
        <p className="text-[12px] text-nu-graphite">{lockReason ?? "프로토타입 단계 완료 필요"}</p>
      </section>
    );
  }

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper shadow-[4px_4px_0_0_rgba(13,13,13,1)]">
      <div className="p-4 border-b-[2px] border-nu-ink flex justify-between items-center flex-wrap gap-2">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite">⑤ 사업계획</div>
          <h2 className="text-[18px] font-bold text-nu-ink mt-0.5">Business Plan</h2>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="border-[2.5px] border-nu-ink bg-nu-pink text-nu-paper px-4 py-2 font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink disabled:opacity-50"
        >
          {generating ? "AI 작성 중... (10~30초)" : plan ? "↻ AI 재생성" : "🤖 AI 초안 생성"}
        </button>
      </div>

      {!plan ? (
        <div className="p-8 text-center">
          <div className="text-[32px] mb-2">📑</div>
          <p className="text-[13px] text-nu-graphite mb-2">
            지금까지 수집된 인사이트, HMW, 선정된 아이디어, 프로토타입 결과를 종합해<br />
            AI 가 사업계획서 초안을 작성합니다.
          </p>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="font-mono-nu text-[9px] uppercase tracking-wider bg-nu-ink text-nu-paper px-2 py-0.5">v{plan.version}</span>
            <span className="font-mono-nu text-[10px] text-nu-graphite">
              {new Date(plan.created_at).toLocaleString("ko-KR")}
            </span>
          </div>

          <PlanField label="경영진 요약" value={plan.content.summary} />
          <PlanField label="문제" value={plan.content.problem} />
          <PlanField label="솔루션" value={plan.content.solution} />
          <PlanField label="타겟 고객" value={plan.content.target} />
          <PlanField label="시장" value={plan.content.market} />
          <PlanField label="비즈니스 모델" value={plan.content.business_model} />

          <button onClick={() => setExpanded(!expanded)} className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-ink hover:text-nu-pink">
            {expanded ? "▲ 접기" : "▼ 마일스톤 · 팀 펼치기"}
          </button>

          {expanded && (
            <>
              <div>
                <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">마일스톤</div>
                <ul className="list-decimal pl-5 space-y-1">
                  {plan.content.milestones.map((m, i) => <li key={i} className="text-[13px] text-nu-ink">{m}</li>)}
                </ul>
              </div>
              <PlanField label="팀" value={plan.content.team} />
            </>
          )}

          <div className="pt-3 border-t border-nu-ink/10 flex items-center justify-between flex-wrap gap-2">
            {plan.model && (
              <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
                Generated by {plan.model}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <a
                href={`/projects/${projectId}/venture/export`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper no-underline"
              >
                📄 PDF 내보내기
              </a>
              <button
                type="button"
                onClick={submitFunding}
                disabled={submittingFund}
                className="border-[2.5px] border-nu-ink bg-nu-ink text-nu-paper px-3 py-1.5 font-mono-nu text-[10px] uppercase tracking-widest hover:bg-nu-pink disabled:opacity-50"
              >
                {submittingFund ? "제출 중..." : "💸 펀딩 포털 제출"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PlanField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite mb-1.5">{label}</div>
      <p className="text-[13px] text-nu-ink whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}
