"use client";

import { useEffect, useRef, useState } from "react";
import { FilePlus2, ChevronDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";

/**
 * NewDocDropdown — "새 문서" 버튼 + Google Docs/Sheets/Slides 드롭다운.
 *
 * 흐름:
 *  1) 사용자가 종류 선택 (Docs/Sheets/Slides)
 *  2) 모달 열림 → 제목 입력 → "만들기"
 *  3) POST /api/google/drive/create-doc — 사용자 Drive 에 생성 + DB 등록
 *  4) 성공 토스트 + onCreated() 콜백 → 부모가 자료실 리로드
 *  5) 새 탭에서 Drive 편집 화면 자동 오픈 (선택적)
 */

interface Props {
  scope: "group" | "project";
  scopeId: string;
  onCreated?: (doc: { url: string; name: string; type: string }) => void;
  className?: string;
}

const TYPES: Array<{ key: "doc" | "sheet" | "slide" | "drawing" | "drawing"; icon: string; label: string; desc: string }> = [
  { key: "doc",     icon: "📄", label: "Google 문서",     desc: "보고서·메모·기획서" },
  { key: "sheet",   icon: "📊", label: "Google 시트",     desc: "표·예산·일정·계산" },
  { key: "slide",   icon: "🖼️", label: "Google 슬라이드", desc: "프레젠테이션·발표" },
  { key: "drawing", icon: "✏️", label: "Google 드로잉",   desc: "다이어그램·플로우차트·화이트보드" },
];

export function NewDocDropdown({ scope, scopeId, onCreated, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<"doc" | "sheet" | "slide" | "drawing" | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(type: "doc" | "sheet" | "slide" | "drawing") {
    setPicked(type);
    setOpen(false);
    setTitle("");
  }

  async function handleCreate() {
    if (!picked || !title.trim()) return;
    setCreating(true);
    try {
      const r = await fetch("/api/google/drive/create-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: picked, title: title.trim(), scope, scope_id: scopeId }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (json.code === "NOT_CONNECTED" || json.code === "GOOGLE_NOT_CONNECTED") {
          toast.error("Google 계정 연결이 필요해요");
          window.open("/settings/integrations", "_blank");
        } else if (json.code === "TOKEN_EXPIRED") {
          toast.error("Google 토큰 만료 — 재연결 필요");
          window.open("/settings/integrations", "_blank");
        } else {
          toast.error(json.error || "문서 생성 실패");
        }
        return;
      }
      toast.success(`${TYPES.find((t) => t.key === picked)?.label} 가 생성됐어요`);
      // 새 탭에서 Drive 편집창 열기
      if (json.web_view_link) {
        window.open(json.web_view_link, "_blank", "noopener,noreferrer");
      }
      // 부모에게 알림 (자료실 리로드)
      onCreated?.({ url: json.web_view_link, name: json.name, type: `drive-${picked}` });
      setPicked(null);
      setTitle("");
    } catch (e: any) {
      toast.error(e?.message || "오류");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div ref={ref} className={`relative inline-block ${className}`}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 px-3 py-2 border-[2px] border-nu-ink bg-nu-paper hover:bg-nu-ink hover:text-nu-paper transition-colors font-mono-nu text-[12px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-nu-pink"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <FilePlus2 size={13} />
          새 문서
          <ChevronDown size={13} />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 mt-1 z-50 w-72 border-[3px] border-nu-ink bg-nu-paper shadow-[4px_4px_0_0_#0D0F14]"
          >
            <div className="px-3 py-2 border-b-[2px] border-nu-ink/10 bg-nu-cream/30">
              <p className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">Google Drive 에 생성</p>
            </div>
            <div className="p-1">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => pick(t.key)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-nu-pink/10 transition-colors text-left rounded-sm focus:outline-none focus:bg-nu-pink/10"
                  role="menuitem"
                >
                  <span className="text-2xl leading-none mt-0.5 shrink-0">{t.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-nu-ink">{t.label}</span>
                    <span className="block text-[11px] text-nu-muted">{t.desc}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="px-3 py-2 border-t-[2px] border-nu-ink/10 bg-nu-cream/20">
              <p className="text-[10px] text-nu-muted/80">
                선택하면 사용자 Google Drive 에 생성되며 자료실에 자동 등록됩니다.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Title 입력 모달 */}
      {picked && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] bg-nu-ink/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !creating && setPicked(null)}
        >
          <div
            className="bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b-[3px] border-nu-ink flex items-center justify-between bg-nu-cream/40">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{TYPES.find((t) => t.key === picked)?.icon}</span>
                <h2 className="font-head text-base font-extrabold text-nu-ink">
                  새 {TYPES.find((t) => t.key === picked)?.label}
                </h2>
              </div>
              <button
                onClick={() => !creating && setPicked(null)}
                aria-label="닫기"
                className="p-1.5 hover:bg-nu-ink/10 focus:outline-none focus:ring-2 focus:ring-nu-pink"
                disabled={creating}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <label className="block">
                <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">제목</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && title.trim() && !creating) handleCreate();
                  }}
                  placeholder="문서 제목을 입력하세요"
                  className="mt-1 w-full px-3 py-2.5 border-[2px] border-nu-ink/20 focus:border-nu-pink outline-none text-sm bg-white"
                  autoFocus
                  disabled={creating}
                />
              </label>
              <p className="text-[11px] text-nu-muted">
                생성 후 자동으로 Drive 편집 탭이 열리고, 자료실에 등록됩니다.
              </p>
            </div>

            <div className="px-5 py-4 border-t-[2px] border-nu-ink/10 bg-nu-cream/20 flex items-center justify-end gap-2">
              <button
                onClick={() => setPicked(null)}
                disabled={creating}
                className="px-4 py-2 border-[2px] border-nu-ink/20 hover:bg-nu-ink/5 text-sm font-mono-nu uppercase tracking-widest disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !title.trim()}
                className="px-4 py-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors text-sm font-mono-nu font-bold uppercase tracking-widest disabled:opacity-50 inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-nu-pink"
              >
                {creating ? <Loader2 size={13} className="animate-spin" /> : <FilePlus2 size={13} />}
                {creating ? "생성 중..." : "만들기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
