"use client";

import { useState } from "react";
import { AISuggestButton } from "./ai-suggest-button";
import { Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { RoleSlot } from "@/components/projects/role-slots-editor";

interface Scoping {
  roles: Array<{ role_type: string; count: number; hours_per_week: number; description: string; skills?: string[] }>;
  milestones: Array<{ title: string; weeks_from_start: number; success_criteria: string }>;
  reward_guide: { type: string; rationale: string };
}

/**
 * 볼트 생성 폼 옆에 붙는 AI 스코핑 제안.
 * 목표 한 줄 입력 → 역할·마일스톤·리워드 자동 제안.
 */
export function BoltScopingSuggest({
  title, description, category, onAccept,
}: {
  title: string;
  description: string;
  category: string;
  onAccept: (slots: RoleSlot[], milestonesText: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Scoping | null>(null);

  async function run() {
    const goal = [title, description].filter(Boolean).join(" — ");
    if (!goal.trim()) { toast.error("볼트 제목을 먼저 입력해주세요"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/bolt-scoping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, category, durationWeeks: 8 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "AI 호출 실패");
      if (!body.scoping) { toast.error("스코핑 파싱 실패 — 다시 시도"); return; }
      setData(body.scoping);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function accept() {
    if (!data) return;
    const slots: RoleSlot[] = data.roles.map((r) => ({
      role_type: (["pm","lead","member","support","mentor","sponsor","observer"].includes(r.role_type) ? r.role_type : "member") as any,
      count: Math.max(1, r.count || 1),
      reward_type: (["experience","revenue","equity","cash","none"].includes(data.reward_guide.type) ? data.reward_guide.type : "experience") as any,
      hours: r.hours_per_week || 4,
      description: r.description,
    }));
    const milestonesText = data.milestones.map((m, i) => `M${i + 1}. ${m.title} (Week ${m.weeks_from_start}) — ${m.success_criteria}`).join("\n");
    onAccept(slots, milestonesText);
    toast.success("AI 스코핑 반영됨 — 편집 가능");
    setData(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono-nu text-[10px] uppercase tracking-[0.25em] text-[color:var(--neutral-500)]">AI 볼트 스코핑</span>
        <AISuggestButton onClick={run} loading={loading} label={data ? "다시 제안" : "역할·마일스톤 제안"} />
      </div>

      {data && (
        <div className="border-l-[3px] border-[color:var(--liquid-primary)] bg-[color:var(--liquid-primary)]/5 rounded-[var(--ds-radius-md)] p-3 space-y-3">
          {/* Roles */}
          <section>
            <div className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-[color:var(--liquid-primary)] font-bold mb-1.5">
              <Sparkles size={10} className="inline mr-1" /> 역할 {data.roles.length}개
            </div>
            <ul className="list-none m-0 p-0 space-y-1">
              {data.roles.map((r, i) => (
                <li key={i} className="text-[12px] leading-[1.5] text-[color:var(--neutral-900)]">
                  <strong>{r.role_type.toUpperCase()}</strong> · {r.count}명 · 주 {r.hours_per_week}h — {r.description}
                </li>
              ))}
            </ul>
          </section>

          {/* Milestones */}
          <section>
            <div className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-[color:var(--liquid-primary)] font-bold mb-1.5">
              마일스톤 {data.milestones.length}개
            </div>
            <ul className="list-none m-0 p-0 space-y-1">
              {data.milestones.map((m, i) => (
                <li key={i} className="text-[12px] leading-[1.5] text-[color:var(--neutral-900)]">
                  <strong>M{i + 1}.</strong> {m.title} <span className="text-[color:var(--neutral-500)]">(W{m.weeks_from_start})</span>
                  <div className="text-[11px] text-[color:var(--neutral-500)]">— {m.success_criteria}</div>
                </li>
              ))}
            </ul>
          </section>

          {/* Reward */}
          <section>
            <div className="font-mono-nu text-[9px] uppercase tracking-[0.3em] text-[color:var(--liquid-primary)] font-bold mb-1">
              리워드 제안 · {data.reward_guide.type}
            </div>
            <p className="text-[12px] text-[color:var(--neutral-900)] leading-[1.6]">{data.reward_guide.rationale}</p>
          </section>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={accept}
              className="px-3 py-1.5 bg-[color:var(--neutral-900)] text-white rounded-[var(--ds-radius-sm)] text-[12px] font-medium hover:bg-[color:var(--liquid-primary)] inline-flex items-center gap-1">
              <Check size={11} /> 역할·마일스톤 반영
            </button>
            <button type="button" onClick={() => setData(null)}
              className="px-3 py-1.5 border border-[color:var(--neutral-200)] rounded-[var(--ds-radius-sm)] text-[12px] text-[color:var(--neutral-700)] inline-flex items-center gap-1">
              <X size={11} /> 거절
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
