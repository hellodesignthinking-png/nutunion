"use client";

import { useEffect } from "react";
import { X, Sparkles, ListTodo, Lightbulb, BookOpen, Flag, Folder } from "lucide-react";

export interface GenesisPlan {
  title?: string;
  summary?: string;
  category?: string;
  phases?: Array<{
    name: string;
    goal?: string;
    duration_days?: number | null;
    wiki_pages?: Array<{ title: string; outline?: string }>;
    milestones?: string[];
  }>;
  suggested_roles?: Array<{
    role_name?: string;
    name?: string;
    specialty_tags?: string[];
    why?: string;
  }>;
  resources_folders?: string[];
  first_tasks?: string[];
}

interface Props {
  plan: GenesisPlan | null;
  intent?: string;
  onClose: () => void;
}

/**
 * Genesis 가 만들어준 plan 전체를 하나의 패널로 펼쳐 보여줌.
 *
 * center 노드의 짧은 요약 한 줄로는 정보가 너무 빈약 — 전체 phases/wiki/role/task/folder 를
 * 시각적으로 정리해 사용자가 실제로 행동에 옮길 수 있게.
 *
 * 우측 슬라이드 drawer (NodeDrawer 와 동일 패턴 / 너비 480 으로 약간 더 넓게).
 * ESC 또는 X 로 닫음.
 */
export function GenesisPlanPanel({ plan, intent, onClose }: Props) {
  useEffect(() => {
    if (!plan) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [plan, onClose]);

  if (!plan) return null;

  return (
    <div className="fixed inset-0 z-[90] flex" role="dialog" aria-modal="true" aria-label="Genesis 답변 자세히">
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full sm:w-[480px] max-w-full h-full bg-nu-paper border-l-[3px] border-nu-ink shadow-[-4px_0_0_0_#0D0F14] flex flex-col animate-in slide-in-from-right duration-200 ease-out">
        <div className="flex items-center justify-between px-4 py-3 border-b-[3px] border-nu-ink bg-white">
          <div>
            <div className="flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
              <Sparkles size={11} /> Genesis 답변
            </div>
            <h3 className="font-head text-lg font-extrabold text-nu-ink mt-0.5">
              {plan.title || "실행 계획"}
            </h3>
            {plan.category && (
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mt-0.5">
                {plan.category}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-nu-muted hover:text-nu-ink shrink-0" aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
          {intent && (
            <div className="bg-nu-cream/40 border-[2px] border-nu-ink/20 px-3 py-2">
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">질문</div>
              <p className="text-[13px] text-nu-ink/80">{intent}</p>
            </div>
          )}
          {plan.summary && (
            <div className="bg-white border-[2px] border-nu-ink shadow-[2px_2px_0_0_#0D0F14] px-3 py-2.5">
              <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink mb-1 flex items-center gap-1">
                <Sparkles size={10} /> 요약
              </div>
              <p className="text-[13px] text-nu-ink whitespace-pre-wrap leading-relaxed">{plan.summary}</p>
            </div>
          )}

          {plan.phases && plan.phases.length > 0 && (
            <Section icon={Flag} title={`단계 ${plan.phases.length}`}>
              <ol className="space-y-2">
                {plan.phases.map((p, i) => (
                  <li key={`${i}-${p.name}`} className="border-[2px] border-nu-ink bg-white">
                    <div className="bg-nu-ink text-nu-paper px-2 py-1 flex items-center justify-between">
                      <span className="font-head font-extrabold text-[12px]">{p.name}</span>
                      {p.duration_days != null && (
                        <span className="font-mono-nu text-[9px] uppercase tracking-widest opacity-70">
                          {p.duration_days}일
                        </span>
                      )}
                    </div>
                    <div className="px-2.5 py-2 space-y-1.5">
                      {p.goal && <p className="text-[12px] text-nu-ink/85">{p.goal}</p>}
                      {p.milestones && p.milestones.length > 0 && (
                        <ul className="text-[11px] text-nu-ink/75 list-disc list-inside space-y-0.5">
                          {p.milestones.map((m, mi) => <li key={mi}>{m}</li>)}
                        </ul>
                      )}
                      {p.wiki_pages && p.wiki_pages.length > 0 && (
                        <details className="group">
                          <summary className="cursor-pointer font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted hover:text-nu-ink list-none flex items-center gap-1">
                            <BookOpen size={10} /> 위키 페이지 {p.wiki_pages.length}개
                          </summary>
                          <div className="mt-1.5 pl-3 border-l-[2px] border-nu-ink/20 space-y-1.5">
                            {p.wiki_pages.map((w, wi) => (
                              <div key={wi}>
                                <div className="text-[11px] font-bold text-nu-ink">{w.title}</div>
                                {w.outline && (
                                  <pre className="text-[10px] text-nu-muted whitespace-pre-wrap font-mono-nu mt-0.5">{w.outline}</pre>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {plan.first_tasks && plan.first_tasks.length > 0 && (
            <Section icon={ListTodo} title={`첫 액션 ${plan.first_tasks.length}`}>
              <ul className="space-y-1">
                {plan.first_tasks.map((t, i) => (
                  <li key={i} className="bg-orange-50 border-[2px] border-orange-700 px-2 py-1 text-[12px] text-orange-950">
                    {i + 1}. {t}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {plan.suggested_roles && plan.suggested_roles.length > 0 && (
            <Section icon={Lightbulb} title={`추천 역할 ${plan.suggested_roles.length}`}>
              <div className="grid grid-cols-1 gap-1.5">
                {plan.suggested_roles.map((r, i) => (
                  <div key={i} className="bg-yellow-50 border-[2px] border-yellow-600 px-2 py-1.5">
                    <div className="font-bold text-[12px] text-yellow-900">{r.role_name || r.name}</div>
                    {r.specialty_tags && r.specialty_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {r.specialty_tags.map((tag, ti) => (
                          <span key={ti} className="font-mono-nu text-[8px] uppercase tracking-widest bg-yellow-200 text-yellow-900 px-1">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.why && <p className="text-[10px] text-yellow-800 mt-1">{r.why}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {plan.resources_folders && plan.resources_folders.length > 0 && (
            <Section icon={Folder} title={`자료실 폴더 ${plan.resources_folders.length}`}>
              <div className="flex flex-wrap gap-1">
                {plan.resources_folders.map((f, i) => (
                  <span key={i} className="font-mono-nu text-[10px] uppercase tracking-widest bg-stone-100 border-[2px] border-stone-700 text-stone-900 px-1.5 py-0.5">
                    📁 {f}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Sparkles;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={12} className="text-nu-ink" />
        <h4 className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-ink font-bold">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}
