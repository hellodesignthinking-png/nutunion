"use client";

/**
 * RoleTagsPicker — 프로필 편집 화면에서 사용하는 칩 선택기.
 *
 * - 4 그룹 (프로젝트/운영/플랫폼/메타) 으로 정리된 칩
 * - 다중 선택, 최대 MAX_ROLE_TAGS (7개)
 * - 저장은 부모가 담당 (value + onChange)
 */

import { useEffect, useState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { ROLE_GROUPS, MAX_ROLE_TAGS, type RoleTag } from "@/lib/washer/role-tags";

interface Props {
  value: RoleTag[];
  onChange: (tags: RoleTag[]) => void;
  disabled?: boolean;
}

export function RoleTagsPicker({ value, onChange, disabled }: Props) {
  const [selected, setSelected] = useState<Set<RoleTag>>(new Set(value));

  useEffect(() => {
    setSelected(new Set(value));
  }, [value]);

  function toggle(tag: RoleTag) {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(tag)) {
      next.delete(tag);
    } else {
      if (next.size >= MAX_ROLE_TAGS) return;
      next.add(tag);
    }
    setSelected(next);
    onChange(Array.from(next));
  }

  const count = selected.size;
  const full = count >= MAX_ROLE_TAGS;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite font-bold">
            역할 태그
          </div>
          <p className="text-[11px] text-nu-graphite mt-0.5">
            최대 {MAX_ROLE_TAGS}개까지 선택 가능. 매칭 엔진이 이 태그로 볼트를 추천합니다.
          </p>
        </div>
        <span className={`font-mono-nu text-[11px] tabular-nums font-bold ${full ? "text-nu-pink" : "text-nu-graphite"}`}>
          {count} / {MAX_ROLE_TAGS}
        </span>
      </div>

      {full && (
        <div className="flex items-start gap-2 p-2 bg-nu-pink/5 border-l-[3px] border-nu-pink text-[11px] text-nu-pink">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span>최대 개수에 도달했어요. 다른 태그를 선택하려면 먼저 해제하세요.</span>
        </div>
      )}

      {ROLE_GROUPS.map((group) => (
        <div key={group.key} className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px]">{group.emoji}</span>
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink font-bold">
              {group.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.tags.map((tag) => {
              const on = selected.has(tag.key);
              const disabled2 = full && !on;
              return (
                <button
                  key={tag.key}
                  type="button"
                  disabled={disabled || disabled2}
                  onClick={() => toggle(tag.key)}
                  title={tag.hint}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 border-[1.5px] rounded-full text-[12px] font-medium transition-all ${
                    on
                      ? "border-nu-pink bg-nu-pink text-white shadow-sm"
                      : disabled2
                        ? "border-nu-ink/10 bg-white text-nu-muted opacity-50 cursor-not-allowed"
                        : "border-nu-ink/15 bg-white text-nu-graphite hover:border-nu-pink hover:text-nu-pink"
                  }`}
                >
                  {on && <Check size={11} />}
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
