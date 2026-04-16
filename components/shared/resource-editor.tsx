"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Save,
  X,
  Eye,
  Edit3,
  Loader2,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Table,
  Minus,
  Quote,
  Undo2,
  Redo2,
  CheckSquare,
  Copy,
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";

/* ─── Types ─── */
interface ResourceEditorProps {
  /** "project_resource" or "file_attachment" */
  targetType: "project_resource" | "file_attachment";
  /** The resource row id */
  resourceId: string;
  /** Resource name for header */
  name: string;
  /** Initial markdown content */
  initialContent: string;
  /** Can the user edit? */
  canEdit: boolean;
  /** Called when content is saved */
  onSave?: (newContent: string) => void;
  /** Called when editor is closed */
  onClose?: () => void;
}

/* ─── Markdown renderer (simple) ─── */
function renderMarkdown(md: string): string {
  let html = md
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-nu-ink mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-extrabold text-nu-ink mt-6 mb-3 pb-1 border-b border-nu-ink/10">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-extrabold text-nu-ink mt-6 mb-4 pb-2 border-b-2 border-nu-ink/20">$1</h1>')
    // Bold / Italic
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-nu-ink">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="my-4 border-nu-ink/10" />')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-nu-blue/30 pl-4 py-1 my-3 text-nu-graphite bg-nu-blue/5">$1</blockquote>')
    // Checkboxes
    .replace(/^- \[x\] (.+)$/gm, '<div class="flex items-start gap-2 my-1"><span class="text-green-500 mt-0.5">☑</span><span class="line-through text-nu-muted">$1</span></div>')
    .replace(/^- \[ \] (.+)$/gm, '<div class="flex items-start gap-2 my-1"><span class="text-nu-muted mt-0.5">☐</span><span>$1</span></div>')
    // Unordered list
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc my-0.5">$1</li>')
    // Ordered list (numbered)
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal my-0.5" value="$1">$2</li>');

  // Tables
  html = html.replace(
    /(\|.+\|\n)+/g,
    (table) => {
      const rows = table.trim().split("\n");
      if (rows.length < 2) return table;
      let out = '<div class="overflow-x-auto my-4"><table class="w-full text-sm border-collapse">';
      rows.forEach((row, i) => {
        // Skip separator row
        if (/^\|[\s-:|]+\|$/.test(row)) return;
        const cells = row.split("|").filter((c) => c.trim() !== "");
        const tag = i === 0 ? "th" : "td";
        const cls = i === 0
          ? 'class="text-left px-3 py-2 font-mono-nu text-[12px] uppercase tracking-widest text-nu-muted border-b-2 border-nu-ink/10 bg-nu-cream/30 font-normal"'
          : 'class="px-3 py-2 border-b border-nu-ink/[0.06] text-nu-graphite"';
        out += `<tr>${cells.map((c) => `<${tag} ${cls}>${c.trim()}</${tag}>`).join("")}</tr>`;
      });
      out += "</table></div>";
      return out;
    }
  );

  // Wrap consecutive <li> in <ul> or <ol>
  html = html.replace(
    /(<li class="ml-4 list-disc[^"]*">[^<]*<\/li>\n?)+/g,
    (m) => `<ul class="my-2">${m}</ul>`
  );
  html = html.replace(
    /(<li class="ml-4 list-decimal[^"]*"[^>]*>[^<]*<\/li>\n?)+/g,
    (m) => `<ol class="my-2">${m}</ol>`
  );

  // Paragraphs (lines that aren't already HTML)
  html = html
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      if (line.startsWith("<")) return line;
      return `<p class="my-1.5 text-nu-graphite leading-relaxed">${line}</p>`;
    })
    .join("\n");

  return html;
}

/* ─── Toolbar helper ─── */
function insertAtCursor(ref: React.RefObject<HTMLTextAreaElement | null>, before: string, after = "") {
  const el = ref.current;
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const text = el.value;
  const selected = text.substring(start, end);
  const newText = text.substring(0, start) + before + selected + after + text.substring(end);
  el.value = newText;
  el.focus();
  el.selectionStart = start + before.length;
  el.selectionEnd = start + before.length + selected.length;
  // Trigger React state update
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/* ─── Main Component ─── */
export function ResourceEditor({
  targetType,
  resourceId,
  name,
  initialContent,
  canEdit,
  onSave,
  onClose,
}: ResourceEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [mode, setMode] = useState<"preview" | "edit">(canEdit ? "edit" : "preview");
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleContentChange = useCallback((val: string) => {
    setContent(val);
    setHasChanges(val !== initialContent);
  }, [initialContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (mode === "edit" && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      el.style.height = Math.max(400, el.scrollHeight) + "px";
    }
  }, [content, mode]);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    const table = targetType === "project_resource" ? "project_resources" : "file_attachments";
    const { error } = await supabase
      .from(table)
      .update({ content })
      .eq("id", resourceId);

    if (error) {
      // If the content column doesn't exist yet, show a helpful message
      if (error.message?.includes("content") || error.code === "42703") {
        toast.error("DB 마이그레이션(023)을 먼저 실행해주세요");
      } else {
        toast.error("저장 실패: " + error.message);
      }
    } else {
      toast.success("문서가 저장되었습니다");
      setHasChanges(false);
      onSave?.(content);
    }
    setSaving(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("클립보드에 복사되었습니다");
    } catch {
      toast.error("복사 실패");
    }
  }

  const toolbarActions = [
    { icon: Bold, label: "Bold", action: () => insertAtCursor(textareaRef, "**", "**") },
    { icon: Italic, label: "Italic", action: () => insertAtCursor(textareaRef, "*", "*") },
    { icon: null, label: "sep1" },
    { icon: Heading1, label: "H1", action: () => insertAtCursor(textareaRef, "# ") },
    { icon: Heading2, label: "H2", action: () => insertAtCursor(textareaRef, "## ") },
    { icon: Heading3, label: "H3", action: () => insertAtCursor(textareaRef, "### ") },
    { icon: null, label: "sep2" },
    { icon: List, label: "목록", action: () => insertAtCursor(textareaRef, "- ") },
    { icon: ListOrdered, label: "번호", action: () => insertAtCursor(textareaRef, "1. ") },
    { icon: CheckSquare, label: "체크", action: () => insertAtCursor(textareaRef, "- [ ] ") },
    { icon: null, label: "sep3" },
    { icon: Quote, label: "인용", action: () => insertAtCursor(textareaRef, "> ") },
    { icon: Minus, label: "구분선", action: () => insertAtCursor(textareaRef, "\n---\n") },
    { icon: Table, label: "표", action: () => insertAtCursor(textareaRef, "\n| 항목 | 내용 |\n|------|------|\n| | |\n") },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-nu-ink bg-nu-cream/30 shrink-0">
        <div className="min-w-0 pr-3">
          <p className="font-head text-[12px] font-black text-nu-ink truncate uppercase tracking-tight">
            {name}
          </p>
          <p className="font-mono-nu text-[10px] text-nu-muted uppercase tracking-widest mt-0.5">
            {mode === "edit" ? "편집 모드" : "미리보기"}
            {hasChanges && <span className="ml-2 text-nu-pink">● 변경사항 있음</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mode toggle */}
          {canEdit && (
            <>
              <button
                onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
                className={`p-1.5 transition-colors ${mode === "edit" ? "text-nu-blue" : "text-nu-muted hover:text-nu-ink"}`}
                title={mode === "edit" ? "미리보기" : "편집"}
              >
                {mode === "edit" ? <Eye size={14} /> : <Edit3 size={14} />}
              </button>
              <button onClick={handleCopy} className="p-1.5 text-nu-muted hover:text-nu-ink" title="복사">
                <Copy size={13} />
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex items-center gap-1 px-3 py-1 font-mono-nu text-[11px] uppercase tracking-widest bg-nu-pink text-white hover:bg-nu-pink/90 disabled:opacity-40 transition-colors"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                저장
              </button>
            </>
          )}
          {!canEdit && (
            <button onClick={handleCopy} className="p-1.5 text-nu-muted hover:text-nu-ink" title="복사">
              <Copy size={13} />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1.5 text-nu-muted hover:text-nu-ink">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar (edit mode only) */}
      {mode === "edit" && canEdit && (
        <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-nu-ink/[0.08] bg-nu-paper/50 shrink-0 overflow-x-auto">
          {toolbarActions.map((action, i) =>
            action.icon === null ? (
              <div key={action.label} className="w-px h-4 bg-nu-ink/10 mx-1" />
            ) : (
              <button
                key={action.label}
                onClick={action.action}
                className="p-1.5 text-nu-muted hover:text-nu-ink hover:bg-nu-cream/50 transition-colors rounded-sm"
                title={action.label}
              >
                <action.icon size={14} />
              </button>
            )
          )}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {mode === "edit" ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.max(400, el.scrollHeight) + "px";
            }}
            className="w-full min-h-[400px] p-5 text-sm font-mono leading-relaxed text-nu-ink bg-nu-white border-0 focus:outline-none resize-none"
            placeholder="마크다운으로 내용을 작성하세요..."
            spellCheck={false}
          />
        ) : (
          <div
            className="p-5 prose-nu text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(content)) }}
          />
        )}
      </div>

      {/* Unsaved changes warning */}
      {hasChanges && mode === "edit" && (
        <div className="px-4 py-2 border-t border-nu-amber/30 bg-nu-amber/5 shrink-0 flex items-center justify-between">
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-amber">
            저장되지 않은 변경사항이 있습니다
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1 bg-nu-amber text-white hover:bg-nu-amber/90 disabled:opacity-40"
          >
            {saving ? "저장 중..." : "지금 저장"}
          </button>
        </div>
      )}
    </div>
  );
}
