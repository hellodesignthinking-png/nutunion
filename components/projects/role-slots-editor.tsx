"use client";

import { useState } from "react";
import { Plus, X, Briefcase, Clock, Coins } from "lucide-react";

export interface RoleSlot {
  role_type: "pm" | "lead" | "member" | "support" | "mentor" | "sponsor" | "observer";
  count: number;
  reward_type: "experience" | "revenue" | "equity" | "cash" | "none";
  hours: "flexible" | number;   // 주당 시간 또는 "flexible"
  description?: string;
}

const ROLE_META: Record<RoleSlot["role_type"], { label: string; emoji: string; color: string; hint: string }> = {
  pm:       { label: "PM",       emoji: "🎯", color: "bg-nu-pink",   hint: "프로젝트 총괄 · 일정/소통 책임" },
  lead:     { label: "Lead",     emoji: "⚡", color: "bg-nu-amber",  hint: "도메인 리더 · 설계/판단" },
  member:   { label: "Member",   emoji: "🛠",  color: "bg-nu-blue",   hint: "실행 담당 · 마일스톤 수행" },
  support:  { label: "Support",  emoji: "🤝", color: "bg-green-600", hint: "보조 · 리서치/문서/운영" },
  mentor:   { label: "Mentor",   emoji: "🎓", color: "bg-purple-600",hint: "자문 · 주당 소규모" },
  sponsor:  { label: "Sponsor",  emoji: "💎", color: "bg-yellow-600",hint: "자원 지원 · 실무 비참여" },
  observer: { label: "Observer", emoji: "👁",  color: "bg-nu-graphite",hint: "관찰자 · 학습 목적" },
};

const REWARD_META: Record<RoleSlot["reward_type"], { label: string; emoji: string }> = {
  experience: { label: "경험",    emoji: "🌱" },
  revenue:    { label: "수익분배", emoji: "💰" },
  equity:     { label: "지분",    emoji: "📊" },
  cash:       { label: "현금보상", emoji: "💵" },
  none:       { label: "무보상",  emoji: "🎁" },
};

interface Props {
  value: RoleSlot[];
  onChange: (next: RoleSlot[]) => void;
}

export function RoleSlotsEditor({ value, onChange }: Props) {
  const [addingOpen, setAddingOpen] = useState(false);

  function addSlot(type: RoleSlot["role_type"]) {
    onChange([...value, { role_type: type, count: 1, reward_type: "experience", hours: 4 }]);
    setAddingOpen(false);
  }

  function updateSlot(i: number, patch: Partial<RoleSlot>) {
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function removeSlot(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted">
            <Briefcase size={11} className="inline mr-1" /> 역할 구조 (슬롯)
          </label>
          <p className="text-[11px] text-nu-graphite mt-0.5">
            이 볼트에 필요한 역할을 정의합니다. 지원자가 역할을 보고 지원합니다.
          </p>
        </div>
        <span className="font-mono-nu text-[10px] text-nu-muted">
          {value.reduce((sum, s) => sum + s.count, 0)}명 · {value.length}종
        </span>
      </div>

      {value.length === 0 ? (
        <div className="border-[2px] border-dashed border-nu-ink/20 p-4 text-center">
          <p className="text-[12px] text-nu-graphite mb-2">아직 정의된 역할이 없습니다</p>
          <p className="text-[11px] text-nu-muted mb-3">
            PM / Lead / Member 등으로 모집 구조를 명시하면 적합한 와셔가 지원합니다
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((slot, i) => {
            const meta = ROLE_META[slot.role_type];
            return (
              <div key={i} className="border-[2px] border-nu-ink/15 p-3 space-y-2 bg-nu-paper">
                <div className="flex items-start gap-2">
                  <span className={`w-7 h-7 ${meta.color} text-nu-paper flex items-center justify-center shrink-0`}>
                    {meta.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[13px] text-nu-ink">{meta.label}</span>
                      <span className="font-mono-nu text-[10px] text-nu-graphite">{meta.hint}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeSlot(i)} aria-label="역할 삭제" className="text-nu-muted hover:text-red-500 p-1">
                    <X size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 pl-9">
                  {/* 인원 */}
                  <div>
                    <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-0.5">인원</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={slot.count}
                      onChange={(e) => updateSlot(i, { count: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                      className="w-full px-2 py-1 border-[2px] border-nu-ink/15 text-sm focus:border-nu-pink outline-none tabular-nums"
                    />
                  </div>

                  {/* 주당 시간 */}
                  <div>
                    <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-0.5">
                      <Clock size={9} className="inline mr-0.5" /> 주당
                    </label>
                    <select
                      value={slot.hours === "flexible" ? "flexible" : String(slot.hours)}
                      onChange={(e) => updateSlot(i, { hours: e.target.value === "flexible" ? "flexible" : Number(e.target.value) })}
                      className="w-full px-2 py-1 border-[2px] border-nu-ink/15 text-sm focus:border-nu-pink outline-none"
                    >
                      <option value="2">2h</option>
                      <option value="4">4h</option>
                      <option value="8">8h</option>
                      <option value="16">16h</option>
                      <option value="24">24h</option>
                      <option value="40">40h (풀)</option>
                      <option value="flexible">유연</option>
                    </select>
                  </div>

                  {/* 보상 */}
                  <div>
                    <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-0.5">
                      <Coins size={9} className="inline mr-0.5" /> 보상
                    </label>
                    <select
                      value={slot.reward_type}
                      onChange={(e) => updateSlot(i, { reward_type: e.target.value as RoleSlot["reward_type"] })}
                      className="w-full px-2 py-1 border-[2px] border-nu-ink/15 text-sm focus:border-nu-pink outline-none"
                    >
                      {Object.entries(REWARD_META).map(([k, m]) => (
                        <option key={k} value={k}>{m.emoji} {m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <input
                  type="text"
                  value={slot.description || ""}
                  onChange={(e) => updateSlot(i, { description: e.target.value })}
                  placeholder="역할 상세 (예: Figma 기반 UX 리서치, 사용자 인터뷰 5건)"
                  className="w-full ml-9 px-2 py-1 border-[2px] border-nu-ink/10 text-[12px] focus:border-nu-pink outline-none"
                  style={{ width: "calc(100% - 2.25rem)" }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* 추가 버튼 */}
      {!addingOpen ? (
        <button
          type="button"
          onClick={() => setAddingOpen(true)}
          className="w-full py-2 border-[2px] border-dashed border-nu-ink/20 font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite hover:border-nu-pink hover:text-nu-pink transition-colors inline-flex items-center justify-center gap-1"
        >
          <Plus size={12} /> 역할 추가
        </button>
      ) : (
        <div className="border-[2px] border-nu-pink bg-nu-pink/5 p-3">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink mb-2">어떤 역할을 추가할까요?</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
            {(Object.entries(ROLE_META) as [RoleSlot["role_type"], typeof ROLE_META[RoleSlot["role_type"]]][]).map(([k, m]) => (
              <button
                key={k}
                type="button"
                onClick={() => addSlot(k)}
                className="flex flex-col items-center gap-1 p-2 border-[2px] border-nu-ink/20 hover:border-nu-pink bg-nu-paper transition-colors"
              >
                <span className={`w-6 h-6 ${m.color} text-nu-paper flex items-center justify-center text-[12px]`}>
                  {m.emoji}
                </span>
                <span className="font-mono-nu text-[10px] uppercase text-nu-ink">{m.label}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setAddingOpen(false)} className="mt-2 font-mono-nu text-[10px] text-nu-graphite hover:text-nu-ink">
            취소
          </button>
        </div>
      )}
    </div>
  );
}

// Display-only read component for project detail
export function RoleSlotsDisplay({ slots, filled }: { slots: RoleSlot[]; filled?: Record<string, number> }) {
  if (!slots || slots.length === 0) return null;
  return (
    <div className="border-[2px] border-nu-ink bg-nu-paper">
      <div className="px-3 py-2 border-b-[2px] border-nu-ink/10 bg-nu-cream/30 font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite">
        <Briefcase size={11} className="inline mr-1" /> 필요 역할 ({slots.reduce((s, x) => s + x.count, 0)}명)
      </div>
      <ul className="list-none m-0 p-0 divide-y divide-nu-ink/10">
        {slots.map((s, i) => {
          const meta = ROLE_META[s.role_type];
          const rw = REWARD_META[s.reward_type];
          const f = filled?.[s.role_type] ?? 0;
          const remain = Math.max(0, s.count - f);
          return (
            <li key={i} className="flex items-center gap-2 p-2.5">
              <span className={`w-6 h-6 ${meta.color} text-nu-paper flex items-center justify-center text-[11px] shrink-0`}>
                {meta.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-[13px] text-nu-ink">{meta.label}</span>
                  <span className="font-mono-nu text-[10px] text-nu-graphite">
                    {typeof s.hours === "number" ? `${s.hours}h/주` : "유연"} · {rw.emoji} {rw.label}
                  </span>
                </div>
                {s.description && <p className="text-[11px] text-nu-graphite truncate">{s.description}</p>}
              </div>
              <div className="font-mono-nu text-[11px] text-nu-ink tabular-nums shrink-0">
                {remain === 0 ? (
                  <span className="text-green-600">✓ 마감</span>
                ) : (
                  <span>
                    <span className="text-nu-pink font-bold">{remain}</span>
                    <span className="text-nu-muted"> / {s.count}</span>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
