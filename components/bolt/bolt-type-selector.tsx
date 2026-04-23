"use client";

/**
 * BoltTypeSelector — 볼트 생성 시 5가지 유형 중 선택하는 카드 UI.
 *
 * 한 번 정하면 변경 불가 — "복사만 가능" 원칙 (UX 경고로 유도).
 */

import { Target, Building2, Globe, Layers, Megaphone, GraduationCap } from "lucide-react";
import type { BoltType } from "@/lib/bolt/types";
import { BOLT_TYPE_META } from "@/lib/bolt/labels";
import { ALL_BOLT_TYPES } from "@/lib/bolt/guards";

const ICON_MAP = { Target, Building2, Globe, Layers, Megaphone, GraduationCap } as const;

interface Props {
  value: BoltType;
  onChange: (t: BoltType) => void;
  disabled?: boolean;
}

export function BoltTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-2">
      <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite font-bold">
        볼트 유형 선택 · Bolt Type
      </div>
      <p className="text-[12px] text-nu-graphite leading-[1.6]">
        한 번 정한 유형은 나중에 바꿀 수 없어요 (복사 생성만 가능). 실제 일의 성격에 맞게 골라주세요.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ALL_BOLT_TYPES.map((type) => {
          const meta = BOLT_TYPE_META[type];
          const Icon = ICON_MAP[meta.icon as keyof typeof ICON_MAP] ?? Target;
          const selected = value === type;
          return (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => onChange(type)}
              className={`text-left p-4 rounded-[var(--ds-radius-lg)] border-[2.5px] transition-all ${
                selected
                  ? `${meta.borderColor} ${meta.color} shadow-sm`
                  : "border-nu-ink/10 bg-white hover:border-nu-ink/30"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${meta.color} ${meta.accentColor}`}>
                  <Icon size={14} />
                </div>
                <div>
                  <div className={`font-head text-[14px] font-extrabold ${selected ? meta.accentColor : "text-nu-ink"}`}>
                    {meta.emoji} {meta.label}
                  </div>
                  <div className="font-mono-nu text-[9px] uppercase tracking-wider text-nu-graphite">
                    {meta.labelEn}
                  </div>
                </div>
              </div>
              <p className="text-[12px] font-semibold text-nu-ink mb-1">{meta.tagline}</p>
              <p className="text-[11px] text-nu-graphite leading-[1.5]">{meta.detail}</p>
              {meta.examples.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {meta.examples.slice(0, 3).map((ex) => (
                    <span
                      key={ex}
                      className="text-[10px] font-mono-nu text-nu-muted bg-nu-cream/50 px-1.5 py-0.5 rounded"
                    >
                      {ex}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
