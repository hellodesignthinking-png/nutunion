"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Palette, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { toast } from "sonner";
import type { SpaceBlock, BlockType, BlockColor, BlockAlign } from "./space-pages-types";
import { SLASH_COMMANDS, BLOCK_COLOR_CLASSES } from "./space-pages-types";
import { TableBlock } from "./blocks/table-block";
import { EmbedBlock } from "./blocks/embed-block";
import { AudioBlock } from "./blocks/audio-block";
import { ImageBlock } from "./blocks/image-block";

interface Props {
  block: SpaceBlock;
  onChange: (patch: Partial<SpaceBlock>) => void;
  /** 빈 블록에서 Enter — 아래 새 블록 생성 */
  onEnter: () => void;
  /** 빈 블록에서 Backspace — 이 블록 삭제 */
  onBackspaceEmpty: () => void;
  /** 슬래시 메뉴에서 type 선택 시 — 부모가 type 변경 */
  onSlashSelect: (type: BlockType) => void;
  /** mention 자동완성용 — 부모가 owner 정보 전달 */
  ownerType?: "nut" | "bolt";
  ownerId?: string;
}

interface MentionItem {
  kind: "user" | "nut" | "bolt" | "page" | "topic";
  id: string;
  label: string;
  sub?: string;
  icon?: string;
}

// `# ` `## ` `### ` `- ` `1. ` `[] ` `> ` 자동 변환 — Notion 풍 인라인 단축키
const MARKDOWN_SHORTCUTS: Array<{ pattern: RegExp; type: BlockType; data?: Record<string, unknown> }> = [
  { pattern: /^#\s$/, type: "h1" },
  { pattern: /^##\s$/, type: "h2" },
  { pattern: /^###\s$/, type: "h3" },
  { pattern: /^-\s$/, type: "bullet" },
  { pattern: /^\*\s$/, type: "bullet" },
  { pattern: /^1\.\s$/, type: "numbered" },
  { pattern: /^\[\]\s$/, type: "todo" },
  { pattern: /^\[ \]\s$/, type: "todo" },
  { pattern: /^>\s$/, type: "quote" },
  { pattern: /^```\s$/, type: "code" },
  { pattern: /^---$/, type: "divider" },
  { pattern: /^\/\/\/\s$/, type: "callout" },
];

export function SpaceBlockRenderer({ block, onChange, onEnter, onBackspaceEmpty, onSlashSelect, ownerType, ownerId }: Props) {
  const [draft, setDraft] = useState(block.content);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashIdx, setSlashIdx] = useState(0);
  // mention 자동완성
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionItem[]>([]);
  const [mentionIdx, setMentionIdx] = useState(0);
  // AI 메뉴 (Cmd+I)
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  // 스타일 메뉴 (Cmd+.)
  const [styleOpen, setStyleOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // block prop 이 바뀌면 (다른 블록으로) draft 동기화
  useEffect(() => { setDraft(block.content); setAiPreview(null); }, [block.id]);

  // mention 검색 — 디바운스 200ms
  useEffect(() => {
    if (mentionQuery == null || mentionQuery.length === 0) {
      setMentionResults([]);
      return;
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q: mentionQuery });
      if (ownerType && ownerId) {
        params.set("owner_type", ownerType);
        params.set("owner_id", ownerId);
      }
      fetch(`/api/spaces/mention-search?${params.toString()}`)
        .then((r) => r.ok ? r.json() : Promise.resolve({ results: [] }))
        .then((j) => setMentionResults(j.results ?? []))
        .catch(() => setMentionResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [mentionQuery, ownerType, ownerId]);

  function insertMention(item: MentionItem) {
    const ta = taRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    // @로부터 현재까지 영역을 mention chip 마크다운으로 치환
    // syntax: @[label](kind:id)
    const before = draft.slice(0, pos);
    const after = draft.slice(pos);
    // 마지막 @ 위치 찾기
    const atIdx = before.lastIndexOf("@");
    if (atIdx < 0) return;
    const newBefore = before.slice(0, atIdx);
    const chip = `@[${item.label}](${item.kind}:${item.id})`;
    const next = newBefore + chip + " " + after;
    setDraft(next);
    onChange({ content: next });
    setMentionQuery(null);
    setTimeout(() => {
      ta.focus();
      const caret = (newBefore + chip + " ").length;
      ta.setSelectionRange(caret, caret);
    }, 0);
  }

  async function runAi(action: "rewrite" | "summarize" | "expand" | "continue" | "improve" | "translate", instruction?: string) {
    setAiBusy(true);
    setAiPreview(null);
    try {
      const res = await fetch(`/api/spaces/blocks/${block.id}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, instruction }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "AI 호출 실패");
      setAiPreview(json.suggestion ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI 호출 실패");
    } finally {
      setAiBusy(false);
    }
  }

  function applyAi() {
    if (aiPreview == null) return;
    setDraft(aiPreview);
    onChange({ content: aiPreview });
    setAiPreview(null);
    setAiOpen(false);
  }

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

    // 슬래시 메뉴
    if (v === "/") {
      setSlashOpen(true);
      setSlashIdx(0);
    } else if (!v.startsWith("/") && slashOpen) {
      setSlashOpen(false);
    }

    // 마크다운 단축키 — 빈 블록(text/h1-3 만)에서 시작 부분 패턴 매칭
    if (block.type === "text") {
      for (const sc of MARKDOWN_SHORTCUTS) {
        if (sc.pattern.test(v)) {
          // type 변경 + 본문 비우기
          onSlashSelect(sc.type);
          setDraft("");
          return;
        }
      }
    }

    // mention 디텍션 — 커서 직전에 "@..." 가 있으면 검색 모드
    const ta = taRef.current;
    if (ta) {
      const pos = ta.selectionStart;
      const before = v.slice(0, pos);
      const m = before.match(/@([^\s@\[]{0,30})$/);
      if (m) {
        setMentionQuery(m[1]);
        setMentionIdx(0);
      } else if (mentionQuery !== null) {
        setMentionQuery(null);
      }
    }

    if (!v.startsWith("/")) {
      onChange({ content: v });
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    // Cmd/Ctrl+I — AI 메뉴 토글
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      setAiOpen((v) => !v);
      return;
    }
    // Cmd/Ctrl+. — 스타일 메뉴 토글
    if ((e.metaKey || e.ctrlKey) && e.key === ".") {
      e.preventDefault();
      setStyleOpen((v) => !v);
      return;
    }
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
    } else if (mentionQuery !== null && mentionResults.length > 0) {
      // mention 자동완성 활성 — ↑↓/Enter/Esc 처리
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((i) => Math.min(mentionResults.length - 1, i + 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIdx((i) => Math.max(0, i - 1)); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const item = mentionResults[mentionIdx];
        if (item) insertMention(item);
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); setMentionQuery(null); return; }
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
  if (block.type === "table") {
    return <TableBlock block={block} onChange={onChange} />;
  }
  if (block.type === "embed") {
    return <EmbedBlock block={block} onChange={onChange} />;
  }
  if (block.type === "audio") {
    return <AudioBlock block={block} onChange={onChange} />;
  }
  if (block.type === "image") {
    return <ImageBlock block={block} onChange={onChange} />;
  }

  // 스타일 데이터 — color / align (text/h1-3/quote/callout 만 유효)
  const blockColor = ((block.data as { color?: BlockColor } | undefined)?.color) || "default";
  const blockAlign = ((block.data as { align?: BlockAlign } | undefined)?.align) || "left";
  const colorCls = BLOCK_COLOR_CLASSES[blockColor];
  const alignCls = blockAlign === "center" ? "text-center" : blockAlign === "right" ? "text-right" : "";

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
    <div className={`relative py-0.5 ${colorCls.bg ? `${colorCls.bg} -mx-2 px-2 rounded` : ""}`}>
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
          "텍스트… ( / 블록 · @ 멘션 · ⌘I AI · ⌘. 스타일 )"
        }
        className={`${textareaClass} ${sizeCls} ${colorCls.text} ${alignCls}`}
      />
      {showSlash && <SlashMenu items={filtered} active={slashIdx} onPick={(type) => { setSlashOpen(false); setDraft(""); onSlashSelect(type); }} />}
      {mentionQuery !== null && mentionResults.length > 0 && (
        <MentionMenu items={mentionResults} active={mentionIdx} onPick={insertMention} />
      )}
      {aiOpen && (
        <AiPopover
          busy={aiBusy}
          preview={aiPreview}
          onAction={runAi}
          onApply={applyAi}
          onClose={() => { setAiOpen(false); setAiPreview(null); }}
        />
      )}
      {styleOpen && (
        <StylePopover
          color={blockColor}
          align={blockAlign}
          onColorChange={(c) => onChange({ data: { ...(block.data || {}), color: c } })}
          onAlignChange={(a) => onChange({ data: { ...(block.data || {}), align: a } })}
          onClose={() => setStyleOpen(false)}
        />
      )}
    </div>
  );
}

function MentionMenu({
  items,
  active,
  onPick,
}: {
  items: MentionItem[];
  active: number;
  onPick: (item: MentionItem) => void;
}) {
  return (
    <div className="absolute top-full left-0 mt-1 z-30 bg-white border-[2px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] min-w-[260px] max-h-[280px] overflow-auto">
      <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted px-2 py-1 border-b border-nu-ink/10">
        멘션 (↑↓ Enter)
      </div>
      {items.map((item, i) => {
        const KIND_LABEL: Record<string, string> = {
          user: "동료", nut: "너트", bolt: "볼트", page: "페이지", topic: "탭",
        };
        return (
          <button
            key={`${item.kind}-${item.id}`}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onPick(item); }}
            className={`w-full text-left flex items-center gap-2 px-2 py-1.5 ${i === active ? "bg-nu-cream" : "hover:bg-nu-cream/50"}`}
          >
            <span className="font-mono-nu text-[8px] uppercase tracking-widest bg-nu-ink text-nu-paper px-1 py-0.5">
              {KIND_LABEL[item.kind] || item.kind}
            </span>
            <span className="text-[12px] font-bold text-nu-ink truncate flex-1">{item.label}</span>
            {item.sub && (
              <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted shrink-0">{item.sub}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function StylePopover({
  color,
  align,
  onColorChange,
  onAlignChange,
  onClose,
}: {
  color: BlockColor;
  align: BlockAlign;
  onColorChange: (c: BlockColor) => void;
  onAlignChange: (a: BlockAlign) => void;
  onClose: () => void;
}) {
  const colors: Array<{ key: BlockColor; bg: string; label: string }> = [
    { key: "default", bg: "bg-white border-nu-ink/30",   label: "기본" },
    { key: "red",     bg: "bg-red-200",     label: "빨강" },
    { key: "amber",   bg: "bg-amber-200",   label: "앰버" },
    { key: "emerald", bg: "bg-emerald-200", label: "에메랄드" },
    { key: "sky",     bg: "bg-sky-200",     label: "스카이" },
    { key: "violet",  bg: "bg-violet-200",  label: "바이올렛" },
    { key: "pink",    bg: "bg-pink-200",    label: "핑크" },
  ];
  return (
    <div className="absolute top-full left-0 mt-1 z-30 bg-white border-[2px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14] min-w-[260px]">
      <div className="px-2 py-1 border-b border-nu-ink/10 flex items-center justify-between">
        <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted flex items-center gap-1">
          <Palette size={10} /> 스타일
        </span>
        <button type="button" onClick={onClose} className="text-nu-muted hover:text-nu-ink text-[12px]">×</button>
      </div>
      <div className="p-2 space-y-2">
        <div>
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">색상</div>
          <div className="flex flex-wrap gap-1">
            {colors.map((c) => (
              <button
                key={c.key}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onColorChange(c.key); }}
                className={`w-6 h-6 ${c.bg} border-[2px] ${color === c.key ? "border-nu-pink" : "border-nu-ink/20"}`}
                title={c.label}
                aria-label={c.label}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">정렬</div>
          <div className="flex gap-1">
            {([
              { key: "left" as BlockAlign,   icon: AlignLeft },
              { key: "center" as BlockAlign, icon: AlignCenter },
              { key: "right" as BlockAlign,  icon: AlignRight },
            ]).map((a) => (
              <button
                key={a.key}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onAlignChange(a.key); }}
                className={`p-1.5 border-[2px] ${align === a.key ? "border-nu-ink bg-nu-cream" : "border-nu-ink/20 hover:bg-nu-cream"}`}
                title={a.key}
              >
                <a.icon size={11} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AiPopover({
  busy,
  preview,
  onAction,
  onApply,
  onClose,
}: {
  busy: boolean;
  preview: string | null;
  onAction: (action: "rewrite" | "summarize" | "expand" | "continue" | "improve" | "translate", instruction?: string) => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const [customInstr, setCustomInstr] = useState("");
  const QUICK = [
    { action: "improve" as const,    label: "다듬기",   icon: "✨", hint: "문법·표현·가독성" },
    { action: "rewrite" as const,    label: "다시 쓰기", icon: "🔄", hint: "표현 바꿈" },
    { action: "summarize" as const,  label: "요약",     icon: "📝", hint: "1~2문장" },
    { action: "expand" as const,     label: "확장",     icon: "📖", hint: "3~5문장" },
    { action: "continue" as const,   label: "이어쓰기", icon: "➡️", hint: "1~3문장 추가" },
    { action: "translate" as const,  label: "영문 번역", icon: "🌐", hint: "→ English" },
  ];
  return (
    <div className="absolute top-full left-0 mt-1 z-40 bg-white border-[2px] border-nu-pink shadow-[3px_3px_0_0_rgba(255,61,136,0.4)] min-w-[320px] max-w-[420px]">
      <div className="px-2 py-1 border-b border-nu-pink/30 flex items-center justify-between">
        <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink flex items-center gap-1">
          <Sparkles size={10} /> Genesis AI · 이 블록
        </span>
        <button type="button" onClick={onClose} className="text-nu-muted hover:text-nu-ink text-[12px]">×</button>
      </div>
      {preview ? (
        <div>
          <div className="px-2 py-1 font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">미리보기</div>
          <pre className="px-2.5 py-2 max-h-[180px] overflow-auto text-[12px] text-nu-ink whitespace-pre-wrap font-sans bg-nu-cream/40 border-y border-nu-ink/10">
            {preview}
          </pre>
          <div className="flex items-center gap-1 px-2 py-1.5">
            <button
              type="button"
              onClick={onApply}
              className="flex-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-ink bg-nu-ink text-nu-paper"
            >
              적용
            </button>
            <button
              type="button"
              onClick={onClose}
              className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-ink/30 hover:bg-nu-cream"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="p-2 space-y-2">
          <div className="grid grid-cols-2 gap-1">
            {QUICK.map((q) => (
              <button
                key={q.action}
                type="button"
                disabled={busy}
                onClick={() => onAction(q.action)}
                className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1.5 border-[2px] border-nu-ink/20 hover:border-nu-ink hover:bg-nu-cream disabled:opacity-40 text-left flex flex-col gap-0.5"
                title={q.hint}
              >
                <span className="flex items-center gap-1">
                  <span className="text-[12px]">{q.icon}</span>
                  <span>{q.label}</span>
                </span>
                <span className="text-[8px] text-nu-muted normal-case tracking-normal">{q.hint}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-nu-ink/10 pt-2">
            <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-1">커스텀 지시</div>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={customInstr}
                onChange={(e) => setCustomInstr(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customInstr.trim()) {
                    e.preventDefault();
                    onAction("rewrite", customInstr.trim());
                  }
                }}
                placeholder="예: 더 친근한 말투로"
                className="flex-1 px-1.5 py-1 text-[12px] border-[2px] border-nu-ink/20 focus:border-nu-ink outline-none"
              />
              <button
                type="button"
                disabled={busy || !customInstr.trim()}
                onClick={() => onAction("rewrite", customInstr.trim())}
                className="font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-pink bg-nu-pink text-white disabled:opacity-40"
              >
                실행
              </button>
            </div>
          </div>
          {busy && (
            <div className="flex items-center gap-1.5 text-[11px] text-nu-muted px-1">
              <Loader2 size={11} className="animate-spin" /> Genesis 가 작업 중…
            </div>
          )}
        </div>
      )}
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
