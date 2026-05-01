"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, FileText, Users, Briefcase, Loader2 } from "lucide-react";

interface SearchResults {
  pages: Array<{ id: string; title: string; icon: string; href: string }>;
  blocks: Array<{ block_id: string; page_id: string; page_title: string; page_icon: string; snippet: string; href: string }>;
  nuts: Array<{ id: string; name: string; href: string }>;
  bolts: Array<{ id: string; name: string; sub?: string; href: string }>;
}

/**
 * 스페이스 글로벌 검색 — 모든 너트/볼트/페이지/블록 통합.
 * ⌘Shift+K (또는 Ctrl+Shift+K) 로 어디서든 열림.
 */
export function SpacesGlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isOurShortcut = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "k";
      const t = e.target as HTMLElement | null;
      const inField = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (inField && !isOurShortcut) return;
      if (isOurShortcut) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQ(""); setResults(null); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/spaces/global-search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) setResults(await res.json());
        else setResults(null);
      } catch {
        setResults(null);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  const total = useMemo(() => {
    if (!results) return 0;
    return results.pages.length + results.blocks.length + results.nuts.length + results.bolts.length;
  }, [results]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4" role="dialog" aria-modal="true" aria-label="스페이스 글로벌 검색">
      <div className="absolute inset-0 bg-nu-ink/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl bg-white border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] flex flex-col max-h-[70vh] overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b-[2px] border-nu-ink">
          <Search size={14} className="text-nu-muted shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="모든 너트·볼트·페이지·블록 검색…"
            className="flex-1 px-1 py-1 text-[14px] outline-none bg-transparent"
          />
          <kbd className="font-mono-nu text-[9px] uppercase tracking-widest border border-nu-ink/30 px-1 text-nu-muted">⌘⇧K</kbd>
          <button type="button" onClick={() => setOpen(false)} className="p-0.5 text-nu-muted hover:text-nu-ink">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-auto py-1">
          {!results && q.trim().length >= 2 && searching && (
            <div className="px-3 py-3 flex items-center gap-1.5 text-[12px] text-nu-muted">
              <Loader2 size={12} className="animate-spin" /> 검색 중…
            </div>
          )}
          {results && total === 0 && (
            <div className="px-3 py-4 text-center text-[12px] text-nu-muted">결과 없음</div>
          )}
          {q.trim().length < 2 && (
            <div className="px-3 py-4 text-center text-[11px] text-nu-muted">2자 이상 입력하세요</div>
          )}
          {results && (
            <>
              {results.nuts.length > 0 && (
                <Section icon={<Users size={11} />} label={`너트 · ${results.nuts.length}`}>
                  {results.nuts.map((n) => <Row key={n.id} icon="👥" title={n.name} onClick={() => go(n.href)} />)}
                </Section>
              )}
              {results.bolts.length > 0 && (
                <Section icon={<Briefcase size={11} />} label={`볼트 · ${results.bolts.length}`}>
                  {results.bolts.map((b) => <Row key={b.id} icon="📦" title={b.name} sub={b.sub} onClick={() => go(b.href)} />)}
                </Section>
              )}
              {results.pages.length > 0 && (
                <Section icon={<FileText size={11} />} label={`페이지 · ${results.pages.length}`}>
                  {results.pages.map((p) => <Row key={p.id} icon={p.icon} title={p.title} onClick={() => go(p.href)} />)}
                </Section>
              )}
              {results.blocks.length > 0 && (
                <Section icon={<FileText size={11} />} label={`블록 · ${results.blocks.length}`}>
                  {results.blocks.map((b) => (
                    <Row key={b.block_id} icon={b.page_icon} title={b.page_title} sub={b.snippet} onClick={() => go(b.href)} />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
        <div className="px-3 py-1.5 border-t border-nu-ink/10 bg-nu-cream/40 font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted flex items-center justify-between">
          <span>Enter 이동 · Esc 닫기</span>
          {total > 0 && <span>{total}개</span>}
        </div>
      </div>
    </div>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="py-1 border-b border-nu-ink/5 last:border-b-0">
      <div className="flex items-center gap-1.5 px-3 py-0.5 font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

function Row({ icon, title, sub, onClick }: { icon: string; title: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-start gap-2 px-3 py-1.5 hover:bg-nu-cream"
    >
      <span className="text-[14px] shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-nu-ink truncate">{title}</div>
        {sub && <div className="text-[11px] text-nu-muted truncate">{sub}</div>}
      </div>
    </button>
  );
}
