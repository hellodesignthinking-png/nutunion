"use client";

import { useEffect, useRef, useState } from "react";
import type { SpaceBlock, BlockType } from "./space-pages-types";
import { SLASH_COMMANDS } from "./space-pages-types";

interface Props {
  block: SpaceBlock;
  onChange: (patch: Partial<SpaceBlock>) => void;
  /** 빈 블록에서 Enter — 아래 새 블록 생성 */
  onEnter: () => void;
  /** 빈 블록에서 Backspace — 이 블록 삭제 */
  onBackspaceEmpty: () => void;
  /** 슬래시 메뉴에서 type 선택 시 — 부모가 type 변경 */
  onSlashSelect: (type: BlockType) => void;
}

export function SpaceBlockRenderer({ block, onChange, onEnter, onBackspaceEmpty, onSlashSelect }: Props) {
  const [draft, setDraft] = useState(block.content);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIdx, setSlashIdx] = useState(0);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // block prop 이 바뀌면 (다른 블록으로) draft 동기화
  useEffect(() => { setDraft(block.content); }, [block.id]);

  // 슬래시 메뉴 — 빈 블록에서 "/" 만 입력했을 때 + 그 후 타이핑하는 검색어로 필터
  const slashQuery = draft.startsWith("/") ? draft.slice(1).toLowerCase() : "";
  const showSlash = slashOpen && draft.startsWith("/");
  const filtered = SLASH_COMMANDS.filter((cmd) =>
    !slashQuery || cmd.keys.some((k) => k.toLowerCase().includes(slashQuery)) || cmd.label.toLowerCase().includes(slashQuery),
  );

  function autoresize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleChange(v: string) {
    setDraft(v);
    if (v === "/") {
      setSlashOpen(true);
      setSlashIdx(0);
    } else if (!v.startsWith("/") && slashOpen) {
      setSlashOpen(false);
    }
    if (!v.startsWith("/")) {
      onChange({ content: v });
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    if (showSlash) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => Math.min(filtered.length - 1, i + 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSlashIdx((i) => Math.max(0, i - 1)); return; }
      if (e.key === "Enter")     {
        e.preventDefault();
        const cmd = filtered[slashIdx];
        if (cmd) {
          setSlashOpen(false);
          setDraft("");
          onSlashSelect(cmd.type);
        }
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); setSlashOpen(false); setDraft(""); onChange({ content: "" }); return; }
    } else {
      // code/quote/callout 은 multiline — 그 외 enter = 새 블록
      const multiline = block.type === "code" || block.type === "quote" || block.type === "callout";
      if (e.key === "Enter" && !e.shiftKey && !multiline) {
        e.preventDefault();
        onEnter();
        return;
      }
      if (e.key === "Backspace" && draft === "") {
        e.preventDefault();
        onBackspaceEmpty();
        return;
      }
    }
  }

  // ── 타입별 렌더 ─────────────────────────────────────────────────
  if (block.type === "divider") {
    return (
      <div className="py-2">
        <hr className="border-nu-ink/20" />
      </div>
    );
  }

  // 공통 textarea — 한 줄 → 자동 높이
  const textareaClass = "w-full bg-transparent outline-none border-0 resize-none placeholder:text-nu-muted/60 leading-relaxed";

  if (block.type === "todo") {
    const checked = (block.data as { checked?: boolean } | undefined)?.checked === true;
    return (
      <div className="flex items-start gap-2 py-1">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange({ data: { ...(block.data || {}), checked: e.target.checked } })}
          className="mt-1.5 w-4 h-4 border-2 border-nu-ink rounded-none accent-nu-pink shrink-0"
          aria-label="할 일 완료"
        />
        <textarea
          ref={taRef}
          rows={1}
          value={draft}
          onChange={(e) => { handleChange(e.target.value); autoresize(e.target); }}
          onKeyDown={handleKey}
          onFocus={(e) => autoresize(e.target)}
          placeholder="할 일… (/ 입력으로 블록 변경)"
          className={`${textareaClass} text-[14px] ${checked ? "line-through text-nu-muted" : "text-nu-ink"}`}
        />
        {showSlash && <SlashMenu items={filtered} active={slashIdx} onPick={(type) => { setSlashOpen(false); setDraft(""); onSlashSelect(type); }} />}
      </div>
    );
  }

  if (block.type === "code") {
    const lang = String((block.data as { lang?: string } | undefined)?.lang || "");
    return (
      <div className="bg-nu-ink text-nu-paper border-[2px] border-nu-ink py-2 px-3 my-1 relative font-mono-nu">
        <div className="flex items-center justify-between mb-1 -mt-1">
          <input
            type="text"
            value={lang}
            onChange={(e) => onChange({ data: { ...(block.data || {}), lang: e.target.value } })}
            placeholder="언어"
            className="bg-transparent outline-none text-[10px] uppercase tracking-widest text-nu-paper/60 placeholder:text-nu-paper/40 border-b border-nu-paper/20 focus:border-nu-paper/60 px-0 py-0 w-24"
          />
        </div>
        <textarea
          ref={taRef}
          rows={2}
          value={draft}
          onChange={(e) => { handleChange(e.target.value); autoresize(e.target); }}
          onKeyDown={handleKey}
          onFocus={(e) => autoresize(e.target)}
          placeholder="// 코드 입력"
          className={`${textareaClass} text-[12px] text-nu-paper`}
        />
        {showSlash && <SlashMenu items={filtered} active={slashIdx} onPick={(type) => { setSlashOpen(false); setDraft(""); onSlashSelect(type); }} />}
      </div>
    );
  }

  if (block.type === "quote") {
    return (
      <div className="border-l-[4px] border-nu-pink pl-3 py-1 my-1 italic relative">
        <textarea
          ref={taRef}
          rows={1}
          value={draft}
          onChange={(e) => { handleChange(e.target.value); autoresize(e.target); }}
          onKeyDown={handleKey}
          onFocus={(e) => autoresize(e.target)}
          placeholder="인용… (Shift+Enter 줄바꿈)"
          className={`${textareaClass} text-[14px] text-nu-ink/80`}
        />
        {showSlash && <SlashMenu items={filtered} active={slashIdx} onPick={(type) => { setSlashOpen(false); setDraft(""); onSlashSelect(type); }} />}
      </div>
    );
  }

  if (block.type === "callout") {
    const icon = (block.data as { icon?: string } | undefined)?.icon || "💡";
    return (
      <div className="bg-yellow-50 border-[2px] border-yellow-700 px-3 py-2 my-1 flex gap-2 relative">
        <button
          type="button"
          onClick={() => {
            const newIcon = window.prompt("아이콘 (이모지)", icon);
            if (newIcon) onChange({ data: { ...(block.data || {}), icon: newIcon.slice(0, 4) } });
          }}
          className="text-[18px] leading-none shrink-0"
          title="아이콘 변경"
        >
          {icon}
        </button>
        <textarea
          ref={taRef}
          rows={1}
          value={draft}
          onChange={(e) => { handleChange(e.target.value); autoresize(e.target); }}
          onKeyDown={handleKey}
          onFocus={(e) => autoresize(e.target)}
          placeholder="강조할 내용… (Shift+Enter 줄바꿈)"
          className={`${textareaClass} text-[13px] text-yellow-950`}
        />
        {showSlash && <SlashMenu items={filtered} active={slashIdx} onPick={(type) => { setSlashOpen(false); setDraft(""); onSlashSelect(type); }} />}
      </div>
    );
  }

  if (block.type === "bullet" || block.type === "numbered") {
    return (
      <div className="flex items-start gap-2 py-0.5 relative">
        <span className="font-mono-nu text-nu-muted shrink-0 mt-1">
          {block.type === "bullet" ? "•" : `${(block.position).toString()}.`}
        </span>
        <textarea
          ref={taRef}
          rows={1}
          value={draft}
          onChange={(e) => { handleChange(e.target.value); autoresize(e.target); }}
          onKeyDown={handleKey}
          onFocus={(e) => autoresize(e.target)}
          placeholder={block.type === "bullet" ? "글머리 항목" : "번호 항목"}
          className={`${textareaClass} text-[14px] text-nu-ink`}
        />
        {showSlash && <SlashMenu items={filtered} active={slashIdx} onPick={(type) => { setSlashOpen(false); setDraft(""); onSlashSelect(type); }} />}
      </div>
    );
  }

  // h1 / h2 / h3 / text
  const sizeCls =
    block.type === "h1" ? "text-[22px] font-extrabold" :
    block.type === "h2" ? "text-[18px] font-extrabold" :
    block.type === "h3" ? "text-[15px] font-extrabold" :
    "text-[14px]";

  return (
    <div className="relative py-0.5">
      <textarea
        ref={taRef}
        rows={1}
        value={draft}
        onChange={(e) => { handleChange(e.target.value); autoresize(e.target); }}
        onKeyDown={handleKey}
        onFocus={(e) => autoresize(e.target)}
        placeholder={
          block.type === "h1" ? "제목 1" :
          block.type === "h2" ? "제목 2" :
          block.type === "h3" ? "제목 3" :
          "텍스트… (/ 입력으로 블록 변경)"
        }
        className={`${textareaClass} ${sizeCls} text-nu-ink`}
      />
      {showSlash && <SlashMenu items={filtered} active={slashIdx} onPick={(type) => { setSlashOpen(false); setDraft(""); onSlashSelect(type); }} />}
    </div>
  );
}

function SlashMenu({
  items,
  active,
  onPick,
}: {
  items: typeof SLASH_COMMANDS;
  active: number;
  onPick: (type: BlockType) => void;
}) {
  return (
    <div className="absolute top-full left-0 mt-1 z-30 bg-white border-[2px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] min-w-[220px] max-h-[280px] overflow-auto">
      <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted px-2 py-1 border-b border-nu-ink/10">
        블록 유형 (↑↓ Enter)
      </div>
      {items.length === 0 ? (
        <div className="px-2 py-2 text-[11px] text-nu-muted">결과 없음</div>
      ) : (
        items.map((cmd, i) => (
          <button
            key={cmd.type}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onPick(cmd.type); }}
            className={`w-full text-left flex items-center justify-between px-2 py-1.5 ${i === active ? "bg-nu-cream" : "hover:bg-nu-cream/50"}`}
          >
            <span className="text-[12px] font-bold text-nu-ink">{cmd.label}</span>
            <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">{cmd.sub}</span>
          </button>
        ))
      )}
    </div>
  );
}
