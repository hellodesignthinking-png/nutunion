"use client";

/**
 * EmojiPicker — 경량 이모지 프리셋.
 * 외부 라이브러리 없이 카테고리별로 자주 쓰는 이모지만 제공.
 */

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

const CATEGORIES: Array<{ key: string; label: string; items: string[] }> = [
  { key: "smileys", label: "😀", items: [
    "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇",
    "🙂","😉","😌","😍","🥰","😘","😗","😙","😚","😋",
    "😛","😝","😜","🤪","🤨","🧐","🤓","😎","🤩","🥳",
    "😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺",
    "😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱",
  ]},
  { key: "gestures", label: "👍", items: [
    "👍","👎","👏","🙌","👐","🤲","🤝","🙏","✌️","🤞",
    "🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚",
    "🖐️","🖖","👋","🤏","💪","🦾","👀","👁️","🧠","💅",
  ]},
  { key: "hearts", label: "❤️", items: [
    "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔",
    "❣️","💕","💞","💓","💗","💖","💘","💝","💟","♥️",
  ]},
  { key: "objects", label: "🎉", items: [
    "🎉","🎊","🎈","🎂","🎁","🏆","🎯","🔥","✨","⭐",
    "🌟","💡","🔑","📌","📎","📝","📄","📚","✅","❌",
    "⚠️","❓","❗","💯","🚀","💎","⚡","☀️","🌙","☕",
  ]},
  { key: "food", label: "🍕", items: [
    "🍕","🍔","🍟","🌭","🥪","🌮","🌯","🥗","🍝","🍜",
    "🍲","🥘","🍱","🍣","🍤","🍙","🍘","🍚","🍛","🍲",
    "🥟","🍖","🍗","🥩","🥓","🍞","🥐","🥖","🧀","🥞",
    "☕","🍵","🧃","🥤","🍺","🍻","🥂","🍷","🍸","🍹",
  ]},
];

interface Props {
  onSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ onSelect, className }: Props) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(CATEGORIES[0].key);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    setTimeout(() => document.addEventListener("click", onClick), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = CATEGORIES.find((c) => c.key === cat) || CATEGORIES[0];

  return (
    <div className={`relative ${className || ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 text-nu-graphite hover:text-nu-ink hover:bg-nu-ink/5 rounded"
        aria-label="이모지"
        title="이모지"
      >
        <Smile size={16} />
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute bottom-full mb-2 left-0 z-50 bg-white border-[2px] border-nu-ink shadow-lg rounded-[var(--ds-radius-md)] p-2 w-[300px]"
        >
          {/* 카테고리 탭 */}
          <div className="flex items-center gap-0.5 mb-2 border-b border-nu-ink/10 pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`p-1.5 rounded text-[16px] ${
                  c.key === cat ? "bg-nu-pink/10 ring-1 ring-nu-pink/30" : "hover:bg-nu-ink/5"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {/* 이모지 그리드 */}
          <div className="grid grid-cols-8 gap-0.5 max-h-[180px] overflow-y-auto">
            {current.items.map((e, i) => (
              <button
                key={`${cat}-${i}`}
                onClick={() => {
                  onSelect(e);
                  setOpen(false);
                }}
                className="p-1 text-[18px] hover:bg-nu-cream/50 rounded"
                title={e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
