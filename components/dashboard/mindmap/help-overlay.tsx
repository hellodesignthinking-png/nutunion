"use client";

import { useEffect } from "react";
import { X, Keyboard, Info } from "lucide-react";
import { NODE_COLORS } from "@/lib/dashboard/mindmap-types";

interface Props {
  /** "help" = 키보드 단축키, "legend" = 시각 언어 설명. null 이면 닫힘. */
  mode: "help" | "legend" | null;
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string[]; what: string }> = [
  { keys: ["⌘", "K"], what: "노드 검색창 포커스" },
  { keys: ["F"], what: "선택 노드 + 1-hop 만 보기 (포커스 모드)" },
  { keys: ["Esc"], what: "포커스 / 도움말 / 메뉴 닫기" },
  { keys: ["?"], what: "이 도움말 토글" },
  { keys: ["I"], what: "Legend (시각 언어 설명) 토글" },
  { keys: ["Shift", "드래그"], what: "다중 선택 (선택 박스)" },
  { keys: ["⌘ / Ctrl", "클릭"], what: "다중 선택 (개별 추가)" },
  { keys: ["우클릭"], what: "노드 / 엣지 컨텍스트 메뉴" },
  { keys: ["더블클릭"], what: "사용자 엣지 라벨 편집" },
  { keys: ["휠"], what: "줌 인/아웃" },
  { keys: ["스페이스 또는 우클릭+드래그"], what: "캔버스 이동" },
];

const LEGEND_NODES: Array<{ kind: keyof typeof NODE_COLORS; label: string; what: string }> = [
  { kind: "center", label: "중앙 — Genesis AI", what: "글로우링이 회전. 질문 입력창 내장." },
  { kind: "nut", label: "너트 (그룹)", what: "역할 칩(👑 호스트 / 🔧 운영 / 멤버)" },
  { kind: "bolt", label: "볼트 (프로젝트)", what: "진행률 바 + 담당자 아바타" },
  { kind: "schedule", label: "일정", what: "D-Day 큰 emerald 뱃지" },
  { kind: "issue", label: "이슈", what: "좌측 빨간 띠 + 🔥 HIGH / 💬 MED" },
  { kind: "topic", label: "위키 탭", what: "너트의 지식 분류" },
  { kind: "file", label: "파일", what: "유형/크기 칩, 호버 시 프리뷰" },
  { kind: "washer", label: "와셔 (동료)", what: "프로필 사진 + N(너트)/B(볼트)" },
];

const LEGEND_EDGES: Array<{ color: string; what: string }> = [
  { color: "stroke-amber-500", what: "활성 볼트 흐르는 점선 — 진행 중" },
  { color: "stroke-emerald-500", what: "임박 일정 (<48h) 흐르는 점선" },
  { color: "stroke-red-600", what: "마감 지난 이슈 — 빨간 흐름 + 긴급 라벨" },
  { color: "stroke-sky-500", what: "너트 → 탭 — 지식 (sky 점선)" },
  { color: "stroke-violet-500", what: "너트 ↔ 와셔 — 인적 (violet)" },
  { color: "stroke-amber-700", what: "볼트 ↔ 와셔 — 인적 (amber)" },
  { color: "stroke-stone-500", what: "볼트 → 파일 — 첨부 (stone)" },
  { color: "stroke-pink-500", what: "내가 그린 자유 엣지 (핑크 dashed)" },
  { color: "stroke-black", what: "너트 ↔ 볼트 — 공유 와셔 N명 (굵은 점선)" },
];

export function HelpOverlay({ mode, onClose }: Props) {
  useEffect(() => {
    if (!mode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onClose]);

  if (!mode) return null;

  const Icon = mode === "help" ? Keyboard : Info;
  const title = mode === "help" ? "키보드 단축키" : "시각 언어 (Legend)";

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b-[3px] border-nu-ink bg-white">
          <div className="flex items-center gap-2">
            <Icon size={14} className="text-nu-pink" />
            <h3 className="font-head text-[15px] font-extrabold text-nu-ink">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-nu-muted hover:text-nu-ink" aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
          {mode === "help" ? (
            <ul className="space-y-1.5">
              {SHORTCUTS.map((s, i) => (
                <li key={i} className="flex items-center gap-3 py-1 border-b border-nu-ink/10 last:border-b-0">
                  <div className="flex items-center gap-1 shrink-0 min-w-[120px]">
                    {s.keys.map((k, ki) => (
                      <kbd
                        key={ki}
                        className="font-mono-nu text-[10px] uppercase tracking-widest border-[2px] border-nu-ink bg-white px-1.5 py-0.5 shadow-[1px_1px_0_0_#0D0F14]"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                  <span className="text-[12px] text-nu-ink/85">{s.what}</span>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <div>
                <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1.5">노드</div>
                <ul className="space-y-1">
                  {LEGEND_NODES.map((n) => {
                    const c = NODE_COLORS[n.kind];
                    return (
                      <li key={n.kind} className="flex items-start gap-2">
                        <span className={`shrink-0 ${c.bg} border-[2px] ${c.border} ${c.ink} px-1.5 py-0.5 font-mono-nu text-[9px] uppercase tracking-widest`}>
                          {n.kind}
                        </span>
                        <div className="text-[11px] flex-1">
                          <div className="font-bold text-nu-ink">{n.label}</div>
                          <div className="text-nu-muted">{n.what}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1.5">엣지 (관계)</div>
                <ul className="space-y-1">
                  {LEGEND_EDGES.map((e, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <svg width={28} height={6} className="shrink-0">
                        <line x1="0" y1="3" x2="28" y2="3" className={e.color} strokeWidth={2.5} strokeDasharray={i % 2 ? "0" : "5 3"} />
                      </svg>
                      <span className="text-[11px] text-nu-ink/85">{e.what}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-nu-ink/10 pt-2">
                <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">엣지 애니메이션</div>
                <p className="text-[11px] text-nu-ink/85">
                  "흐르는 점선" = 진행 중 / 임박 / 긴급. 정적 점선 = 소속/연관.
                </p>
              </div>
            </>
          )}
        </div>
        <div className="px-4 py-2 border-t-[2px] border-nu-ink/10 bg-white font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
          {mode === "help" ? "I — Legend 보기 · ESC 닫기" : "? — 단축키 보기 · ESC 닫기"}
        </div>
      </div>
    </div>
  );
}
