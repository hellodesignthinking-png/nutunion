"use client";

import { useEffect, useState } from "react";
import { X, Sparkles, Network, Keyboard, Compass, ArrowRight } from "lucide-react";

const STORAGE_KEY = "dashboard.mindmap.tour.v2";

interface Step {
  icon: typeof Sparkles;
  title: string;
  body: string;
  hint?: string;
}

const STEPS: Step[] = [
  {
    icon: Network,
    title: "당신의 세계관",
    body: "너트(그룹) · 볼트(프로젝트) · 일정 · 이슈 · 와셔(동료) · 탭 · 파일이 한 화면에서 연결됩니다. 자동으로 도메인 의미를 알아 색깔과 모양이 다릅니다.",
    hint: "마우스 휠 줌 / 드래그 이동",
  },
  {
    icon: Sparkles,
    title: "Genesis AI 가 중심",
    body: "가운데 핑크 글로우 노드에 한 줄로 질문하면, AI 가 단계·역할·액션을 만들어 매칭 노드로 카메라가 줌됩니다.",
    hint: "예: \"이번 주 시급한 일은?\" \"새 프로젝트 어떻게 시작할까?\"",
  },
  {
    icon: Compass,
    title: "노드를 클릭해보세요",
    body: "클릭하면 우측 패널에 그 entity 의 모든 연결점(소속·동료·이슈·파일)이 칩으로 펼쳐집니다. 칩 클릭 = 그 노드로 jump.",
    hint: "우클릭 = 컨텍스트 메뉴 (포커스 / Genesis 분기)",
  },
  {
    icon: Keyboard,
    title: "키보드로 빠르게",
    body: "⌘P 노드 검색 · F 포커스 모드 (1-hop만 보기) · ? 모든 단축키 · I 시각 언어 안내. ESC 로 어디서든 닫기.",
    hint: "툴바 우상단 ⌨ 아이콘으로 언제든 다시 보기",
  },
];

export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // 첫 방문 — 살짝 딜레이 후 자동 열기 (마인드맵 전환 직후 주의 분산 방지)
        setTimeout(() => setOpen(true), 600);
      }
    } catch { /* ignore */ }
  }, []);

  const finish = () => {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
  };

  if (!open) return null;
  const s = STEPS[step];
  const Icon = s.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="마인드맵 온보딩">
      <div className="absolute inset-0 bg-nu-ink/50 backdrop-blur-sm" onClick={finish} />
      <div className="relative bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-md w-full overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <div className="px-4 py-3 border-b-[3px] border-nu-ink bg-white flex items-center justify-between">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink flex items-center gap-1.5">
            <Sparkles size={11} /> 마인드맵 시작 가이드
          </div>
          <button onClick={finish} className="p-1 text-nu-muted hover:text-nu-ink" aria-label="건너뛰기">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-nu-pink/10 border-[2px] border-nu-pink flex items-center justify-center">
              <Icon size={16} className="text-nu-pink" />
            </div>
            <div className="font-head text-[16px] font-extrabold text-nu-ink">
              {s.title}
            </div>
          </div>
          <p className="text-[13px] text-nu-ink/85 leading-relaxed">{s.body}</p>
          {s.hint && (
            <div className="bg-nu-cream/50 border border-nu-ink/15 px-2.5 py-1.5 font-mono-nu text-[11px] text-nu-ink/75">
              💡 {s.hint}
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t-[2px] border-nu-ink/10 bg-white flex items-center justify-between">
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full ${i === step ? "bg-nu-pink" : "bg-nu-ink/20"}`}
                aria-label={`${i + 1}단계로`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-ink/30 hover:bg-nu-cream"
              >
                이전
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                onClick={finish}
                className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1 border-[2px] border-nu-ink bg-nu-ink text-nu-paper flex items-center gap-1"
              >
                시작하기 <ArrowRight size={11} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1 border-[2px] border-nu-ink bg-nu-ink text-nu-paper flex items-center gap-1"
              >
                다음 <ArrowRight size={11} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
