"use client";

import { useEffect, useState } from "react";
import { X, Share2, Copy, RotateCw, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  pageId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * 페이지 외부 공유 토글.
 * 활성화 시 share_token 발급 → /shared/{token} 공개 URL.
 * rotate 로 새 토큰, DELETE 로 해제.
 */
export function ShareToggle({ pageId, open, onClose }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/spaces/pages/${pageId}/share`)
      .then((r) => r.json())
      .then((j: { share_token: string | null }) => setToken(j.share_token ?? null))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [pageId, open]);

  async function enable(rotate = false) {
    setBusy(true);
    try {
      const res = await fetch(`/api/spaces/pages/${pageId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "활성화 실패");
      setToken(j.share_token);
      toast.success(rotate ? "새 공유 링크 발급" : "공유 활성화");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!window.confirm("공유 링크를 해제할까요? 기존 링크는 더 이상 작동하지 않습니다.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/spaces/pages/${pageId}/share`, { method: "DELETE" });
      if (!res.ok) throw new Error("해제 실패");
      setToken(null);
      toast.success("공유 해제");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!token) return;
    const url = `${window.location.origin}/shared/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopying(true);
      setTimeout(() => setCopying(false), 1200);
    } catch {
      toast.error("복사 실패");
    }
  }

  if (!open) return null;
  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/shared/${token}` : "";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-md w-full">
        <div className="px-3 py-2 border-b-[3px] border-nu-ink bg-white flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">
            <Share2 size={11} /> 외부 공유
          </div>
          <button onClick={onClose} className="p-1 text-nu-muted hover:text-nu-ink"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center gap-1.5 text-[12px] text-nu-muted">
              <Loader2 size={11} className="animate-spin" /> 상태 확인 중…
            </div>
          ) : token ? (
            <>
              <div className="bg-emerald-50 border-[2px] border-emerald-700 px-3 py-2">
                <div className="font-mono-nu text-[10px] uppercase tracking-widest text-emerald-800 mb-1">
                  ● 공유 활성 — 누구나 링크로 읽기 가능
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    readOnly
                    value={url}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 px-2 py-1 text-[11px] border border-nu-ink/20 bg-white outline-none font-mono-nu"
                  />
                  <button
                    type="button"
                    onClick={copyUrl}
                    title="URL 복사"
                    className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-ink bg-nu-ink text-nu-paper flex items-center gap-1"
                  >
                    {copying ? <Check size={11} /> : <Copy size={11} />}
                    {copying ? "복사됨" : "복사"}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => enable(true)}
                  className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-ink/30 hover:bg-nu-cream disabled:opacity-30 flex items-center gap-1"
                  title="새 토큰 — 기존 링크 무효화"
                >
                  <RotateCw size={10} /> 새 링크
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={disable}
                  className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-red-700 text-red-700 hover:bg-red-50 disabled:opacity-30"
                >
                  공유 해제
                </button>
              </div>
              <p className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
                공유된 페이지는 읽기 전용 — 댓글·편집 불가
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-nu-ink/85">
                이 페이지를 너트/볼트 멤버 외에도 공개할까요? 링크를 가진 누구나 읽기 가능.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => enable(false)}
                className="w-full font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink bg-nu-ink text-nu-paper disabled:opacity-30 flex items-center justify-center gap-1.5"
              >
                {busy ? <Loader2 size={11} className="animate-spin" /> : <Share2 size={11} />}
                공유 링크 만들기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
