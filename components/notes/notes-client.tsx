"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  Star, Archive, FileText, Plus, Trash2, Save, Loader2, ChevronRight,
  Bold, Italic, Code, List, ListOrdered, CheckSquare, Link2, Image as ImageIcon,
  Eye, Edit3, Columns,
} from "lucide-react";
import { toast } from "sonner";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface Backlink { id: string; title: string }
interface Note {
  id: string;
  parent_id: string | null;
  title: string;
  content: string;
  icon: string | null;
  tags: string[];
  is_favorite: boolean;
  is_archived: boolean;
  sort_order: number;
  backlinks?: Backlink[];
  created_at: string;
  updated_at: string;
}

type Tab = "all" | "favorite" | "archived";
type EditorTab = "edit" | "preview" | "split";

const TEMPLATES: { id: string; label: string; content: (title?: string) => string }[] = [
  { id: "blank", label: "📝 빈 노트", content: () => "" },
  {
    id: "diary",
    label: "📓 일기",
    content: () => {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return `# ${date}\n\n## 오늘 있었던 일\n\n## 감정 기록\n\n## 내일 할 것\n`;
    },
  },
  {
    id: "book",
    label: "📚 독서 메모",
    content: () => `# 책 제목: \n\n**저자**: \n**읽은 날**: \n\n## 주요 인용\n> \n\n## 내 생각\n\n## 한 줄 요약\n`,
  },
  {
    id: "retro",
    label: "🎯 회고",
    content: () => `# 회고\n\n## ✅ 잘한 점\n- \n\n## ⚠️ 개선할 점\n- \n\n## 🎯 다음 주 계획\n- \n`,
  },
  {
    id: "idea",
    label: "💡 아이디어",
    content: () => `# 💡 \n\n## 문제\n\n## 해결안\n\n## 실행 방안\n- [ ] \n`,
  },
];

export function NotesClient() {
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>("edit");

  // Editor local state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [icon, setIcon] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [dirty, setDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const autoOpenHandledRef = useRef(false);

  const load = useCallback(async (archived: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/personal/notes?archived=${archived ? 1 : 0}`, { cache: "no-store" });
      const data = await res.json();
      if (data.migration_needed) {
        setMigrationNeeded(true);
        setNotes([]);
      } else {
        setNotes((data.rows as Note[]) || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab === "archived");
  }, [load, tab]);

  const visibleNotes = useMemo(() => {
    if (tab === "favorite") return notes.filter((n) => n.is_favorite);
    return notes;
  }, [notes, tab]);

  const tree = useMemo(() => {
    const roots: Note[] = [];
    const childMap = new Map<string, Note[]>();
    for (const n of visibleNotes) {
      if (n.parent_id) {
        const arr = childMap.get(n.parent_id) || [];
        arr.push(n);
        childMap.set(n.parent_id, arr);
      } else {
        roots.push(n);
      }
    }
    return { roots, childMap };
  }, [visibleNotes]);

  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) || null,
    [notes, selectedId]
  );

  useEffect(() => {
    if (selected) {
      setTitle(selected.title);
      setContent(selected.content || "");
      setIcon(selected.icon || "");
      setTagsStr((selected.tags || []).join(", "));
      setDirty(false);
      // Restore editor tab pref
      try {
        const saved = localStorage.getItem(`nu:notes:tab:${selected.id}`) as EditorTab | null;
        if (saved === "edit" || saved === "preview" || saved === "split") setEditorTab(saved);
        else setEditorTab("edit");
      } catch {}
    }
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    try { localStorage.setItem(`nu:notes:tab:${selected.id}`, editorTab); } catch {}
  }, [editorTab, selected]);

  // Forward links (notes this note references via [[title]])
  const forwardLinks = useMemo<Backlink[]>(() => {
    if (!content) return [];
    const matches = Array.from(content.matchAll(/\[\[([^\]]+)\]\]/g)).map((m) => m[1].trim());
    const unique = [...new Set(matches)];
    const result: Backlink[] = [];
    for (const t of unique) {
      const found = notes.find((n) => n.title === t);
      if (found) result.push({ id: found.id, title: found.title });
    }
    return result;
  }, [content, notes]);

  // Inbound backlinks (notes that reference this note)
  const inboundLinks = useMemo<Backlink[]>(() => {
    if (!selected) return [];
    return notes
      .filter((n) => n.id !== selected.id && (n.backlinks || []).some((b) => b.id === selected.id))
      .map((n) => ({ id: n.id, title: n.title }));
  }, [notes, selected]);

  const createNote = useCallback(async (parentId: string | null = null, initialContent = "") => {
    const res = await fetch("/api/personal/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "새 노트", parent_id: parentId, content: initialContent }),
    });
    const data = await res.json();
    if (data.row) {
      setNotes((prev) => [data.row, ...prev]);
      setSelectedId(data.row.id);
      setShowTemplates(false);
      setTimeout(() => titleRef.current?.focus(), 50);
    } else {
      toast.error("노트 생성 실패");
    }
  }, []);

  // Handle ?new=1 URL param → auto-open new note
  useEffect(() => {
    if (autoOpenHandledRef.current) return;
    if (searchParams?.get("new") === "1") {
      autoOpenHandledRef.current = true;
      createNote(null, "");
    }
  }, [searchParams, createNote]);

  async function saveNote() {
    if (!selected) return;
    setSaving(true);
    try {
      const tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await fetch(`/api/personal/notes?id=${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, icon: icon || null, tags }),
      });
      const data = await res.json();
      if (data.row) {
        setNotes((prev) => prev.map((n) => (n.id === data.row.id ? data.row : n)));
        setDirty(false);
      } else {
        toast.error("저장 실패");
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleFavorite() {
    if (!selected) return;
    const res = await fetch(`/api/personal/notes?id=${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: !selected.is_favorite }),
    });
    const data = await res.json();
    if (data.row) setNotes((prev) => prev.map((n) => (n.id === data.row.id ? data.row : n)));
  }

  async function archiveNote() {
    if (!selected) return;
    const res = await fetch(`/api/personal/notes?id=${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_archived: !selected.is_archived }),
    });
    if (res.ok) {
      setSelectedId(null);
      load(tab === "archived");
    }
  }

  async function deleteNote() {
    if (!selected) return;
    if (!confirm("영구 삭제하시겠어요?")) return;
    const res = await fetch(`/api/personal/notes?id=${selected.id}`, { method: "DELETE" });
    if (res.ok) {
      setSelectedId(null);
      setNotes((prev) => prev.filter((n) => n.id !== selected.id));
    }
  }

  // ── Markdown toolbar helpers ────────────────────────────────────────
  function applyToTextarea(transform: (text: string, sel: { start: number; end: number }) => { text: string; cursorStart: number; cursorEnd: number }) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const { text, cursorStart, cursorEnd } = transform(content, { start, end });
    setContent(text);
    setDirty(true);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function insertLinePrefix(prefix: string) {
    applyToTextarea((text, sel) => {
      const lineStart = text.lastIndexOf("\n", sel.start - 1) + 1;
      const newText = text.slice(0, lineStart) + prefix + text.slice(lineStart);
      return { text: newText, cursorStart: sel.start + prefix.length, cursorEnd: sel.end + prefix.length };
    });
  }

  function wrapSelection(before: string, after: string = before, placeholder = "텍스트") {
    applyToTextarea((text, sel) => {
      const selected = text.slice(sel.start, sel.end) || placeholder;
      const newText = text.slice(0, sel.start) + before + selected + after + text.slice(sel.end);
      return {
        text: newText,
        cursorStart: sel.start + before.length,
        cursorEnd: sel.start + before.length + selected.length,
      };
    });
  }

  function insertLink() {
    const url = prompt("URL 입력:");
    if (!url) return;
    applyToTextarea((text, sel) => {
      const selected = text.slice(sel.start, sel.end) || "링크";
      const md = `[${selected}](${url})`;
      const newText = text.slice(0, sel.start) + md + text.slice(sel.end);
      return { text: newText, cursorStart: sel.start, cursorEnd: sel.start + md.length };
    });
  }

  async function uploadImage(file: File) {
    try {
      const presign = await fetch("/api/storage/r2/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix: "uploads",
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        }),
      });
      const pre = await presign.json();
      if (!pre.configured || !pre.url) {
        toast.error("R2 저장소가 설정되지 않았습니다");
        return;
      }
      const put = await fetch(pre.url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) {
        toast.error("업로드 실패");
        return;
      }
      const md = `![${file.name}](${pre.publicUrl})`;
      applyToTextarea((text, sel) => {
        const newText = text.slice(0, sel.start) + md + "\n" + text.slice(sel.end);
        return { text: newText, cursorStart: sel.start + md.length + 1, cursorEnd: sel.start + md.length + 1 };
      });
      toast.success("이미지 삽입됨");
    } catch {
      toast.error("업로드 에러");
    }
  }

  function renderTreeNode(note: Note, depth = 0) {
    const children = tree.childMap.get(note.id) || [];
    const isSel = note.id === selectedId;
    return (
      <div key={note.id}>
        <button
          onClick={() => setSelectedId(note.id)}
          className={`w-full flex items-center gap-1 text-left px-2 py-1 border-l-2 ${isSel ? "border-nu-pink bg-nu-pink/5" : "border-transparent hover:border-nu-ink/30 hover:bg-nu-cream/30"}`}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {children.length > 0 ? <ChevronRight size={10} className="text-nu-muted shrink-0" /> : <span className="w-[10px] shrink-0" />}
          <span className="text-base shrink-0">{note.icon || "📄"}</span>
          <span className="text-sm truncate flex-1 text-nu-ink">{note.title}</span>
          {note.is_favorite && <Star size={10} className="text-yellow-500 fill-yellow-500 shrink-0" />}
        </button>
        {children.map((c) => renderTreeNode(c, depth + 1))}
      </div>
    );
  }

  if (migrationNeeded) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="border-[3px] border-amber-500 bg-amber-50 p-6">
          <h2 className="font-head text-xl font-extrabold text-nu-ink mb-2">마이그레이션 필요</h2>
          <p className="text-sm text-nu-graphite">
            <code className="font-mono-nu">supabase/migrations/112_personal_notes.sql</code>과 <code className="font-mono-nu">114_notes_backlinks.sql</code>을 적용해주세요.
          </p>
        </div>
      </div>
    );
  }

  const MarkdownPreview = (
    <div className="prose prose-sm max-w-none">
      {content.trim() ? (
        <ReactMarkdown
          components={{
            a: ({ href, children }) => {
              // [[wikilink]] custom rendering: react-markdown sees normal text so we match here on plain text
              return <a href={href || "#"} target="_blank" rel="noreferrer" className="text-nu-pink underline">{children}</a>;
            },
          }}
        >
          {content.replace(/\[\[([^\]]+)\]\]/g, (_m, title) => {
            const found = notes.find((n) => n.title === title);
            return found ? `[${title}](#wikilink-${found.id})` : `**[[${title}]]**`;
          })}
        </ReactMarkdown>
      ) : (
        <p className="text-nu-muted italic text-sm">작성된 내용이 없습니다.</p>
      )}
    </div>
  );

  const ToolbarButton = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 border-[2px] border-nu-ink/30 hover:border-nu-ink hover:bg-nu-cream/40 text-nu-ink"
    >
      {children}
    </button>
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-nu-paper">
      {/* Left sidebar */}
      <aside className="w-72 border-r-[3px] border-nu-ink bg-white flex flex-col">
        <div className="p-3 border-b-[3px] border-nu-ink">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={14} className="text-nu-pink" />
            <h2 className="font-head text-sm font-extrabold text-nu-ink uppercase tracking-tight">내 노트</h2>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className="w-full font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 bg-nu-ink text-nu-paper hover:bg-nu-pink flex items-center justify-center gap-1.5"
            >
              <Plus size={11} /> 새 노트
            </button>
            {showTemplates && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border-[2px] border-nu-ink shadow-[3px_3px_0_0_#0D0F14]">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => createNote(null, tpl.content())}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-nu-pink/10 border-b border-nu-ink/10 last:border-b-0"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex border-b-[2px] border-nu-ink/20">
          {([
            { id: "all", label: "📁 전체" },
            { id: "favorite", label: "⭐ 즐겨찾기" },
            { id: "archived", label: "🗄 보관" },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-2 ${tab === t.id ? "bg-nu-ink text-nu-paper" : "text-nu-graphite hover:bg-nu-cream/30"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 size={16} className="animate-spin text-nu-pink" />
            </div>
          ) : tree.roots.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-xs text-nu-muted">노트가 없습니다.</p>
            </div>
          ) : (
            tree.roots.map((n) => renderTreeNode(n))
          )}
        </div>
      </aside>

      {/* Center editor */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText size={40} className="mx-auto mb-3 text-nu-muted/40" />
              <p className="text-sm text-nu-muted">노트를 선택하거나 새로 만드세요.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 p-4 border-b-[3px] border-nu-ink">
              <input
                value={icon}
                onChange={(e) => { setIcon(e.target.value); setDirty(true); }}
                placeholder="📄"
                maxLength={4}
                className="w-10 text-center text-2xl border-[2px] border-nu-ink/30 focus:border-nu-ink px-1 py-1"
              />
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                onBlur={() => dirty && saveNote()}
                placeholder="제목"
                className="flex-1 font-head text-2xl font-extrabold text-nu-ink border-none focus:outline-none bg-transparent"
              />
              <button
                onClick={toggleFavorite}
                className={`p-2 border-[2px] ${selected.is_favorite ? "border-yellow-500 bg-yellow-50" : "border-nu-ink/30 hover:border-nu-ink"}`}
                title="즐겨찾기"
              >
                <Star size={14} className={selected.is_favorite ? "text-yellow-500 fill-yellow-500" : "text-nu-muted"} />
              </button>
              <button
                onClick={saveNote}
                disabled={!dirty || saving}
                className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-2 bg-nu-pink text-nu-paper hover:bg-nu-ink disabled:opacity-40 flex items-center gap-1"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} 저장
              </button>
            </div>

            {/* Editor tab switcher */}
            <div className="flex border-b-[2px] border-nu-ink/20 bg-nu-cream/20">
              {([
                { id: "edit", label: "✏️ 작성", icon: Edit3 },
                { id: "preview", label: "👁️ 미리보기", icon: Eye },
                { id: "split", label: "⚡ 나란히", icon: Columns, mdOnly: true },
              ] as { id: EditorTab; label: string; icon: any; mdOnly?: boolean }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setEditorTab(t.id)}
                  className={`font-mono-nu text-[10px] uppercase tracking-widest px-3 py-2 border-r border-nu-ink/10 flex items-center gap-1 ${editorTab === t.id ? "bg-nu-ink text-nu-paper" : "text-nu-graphite hover:bg-nu-cream/40"} ${t.mdOnly ? "hidden md:flex" : ""}`}
                >
                  <t.icon size={10} /> {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="mb-3">
                <input
                  value={tagsStr}
                  onChange={(e) => { setTagsStr(e.target.value); setDirty(true); }}
                  onBlur={() => dirty && saveNote()}
                  placeholder="태그 (쉼표로 구분)"
                  className="w-full font-mono-nu text-[11px] uppercase tracking-widest px-2 py-1.5 border-[2px] border-nu-ink/20 focus:border-nu-ink"
                />
              </div>

              {/* Toolbar — visible when not preview-only */}
              {editorTab !== "preview" && (
                <div className="flex flex-wrap gap-1 mb-2 p-1.5 border-[2px] border-nu-ink/20 bg-nu-cream/20">
                  <ToolbarButton onClick={() => insertLinePrefix("# ")} title="제목 1"><span className="font-head text-xs font-extrabold">H1</span></ToolbarButton>
                  <ToolbarButton onClick={() => insertLinePrefix("## ")} title="제목 2"><span className="font-head text-xs font-extrabold">H2</span></ToolbarButton>
                  <ToolbarButton onClick={() => insertLinePrefix("### ")} title="제목 3"><span className="font-head text-xs font-extrabold">H3</span></ToolbarButton>
                  <span className="w-px bg-nu-ink/20 mx-0.5" />
                  <ToolbarButton onClick={() => wrapSelection("**")} title="굵게"><Bold size={12} /></ToolbarButton>
                  <ToolbarButton onClick={() => wrapSelection("*")} title="기울임"><Italic size={12} /></ToolbarButton>
                  <ToolbarButton onClick={() => wrapSelection("`")} title="인라인 코드"><Code size={12} /></ToolbarButton>
                  <span className="w-px bg-nu-ink/20 mx-0.5" />
                  <ToolbarButton onClick={() => insertLinePrefix("- ")} title="리스트"><List size={12} /></ToolbarButton>
                  <ToolbarButton onClick={() => insertLinePrefix("1. ")} title="순서 리스트"><ListOrdered size={12} /></ToolbarButton>
                  <ToolbarButton onClick={() => insertLinePrefix("- [ ] ")} title="체크리스트"><CheckSquare size={12} /></ToolbarButton>
                  <span className="w-px bg-nu-ink/20 mx-0.5" />
                  <ToolbarButton onClick={insertLink} title="링크"><Link2 size={12} /></ToolbarButton>
                  <label className="p-1.5 border-[2px] border-nu-ink/30 hover:border-nu-ink hover:bg-nu-cream/40 text-nu-ink cursor-pointer" title="이미지 업로드">
                    <ImageIcon size={12} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <span className="w-px bg-nu-ink/20 mx-0.5" />
                  <ToolbarButton onClick={() => wrapSelection("[[", "]]", "노트 제목")} title="노트 연결 [[...]]"><span className="font-mono-nu text-[10px]">[[]]</span></ToolbarButton>
                </div>
              )}

              {editorTab === "edit" && (
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => { setContent(e.target.value); setDirty(true); }}
                  onBlur={() => dirty && saveNote()}
                  placeholder="# 제목&#10;- 리스트&#10;- [[다른 노트]]&#10;&#10;마크다운으로 자유롭게 작성하세요..."
                  className="w-full min-h-[60vh] px-4 py-3 border-[2px] border-nu-ink/20 focus:border-nu-ink font-mono text-sm leading-relaxed resize-none"
                />
              )}

              {editorTab === "preview" && (
                <div className="w-full min-h-[60vh] px-4 py-3 border-[2px] border-nu-ink/20 bg-white overflow-auto">
                  {MarkdownPreview}
                </div>
              )}

              {editorTab === "split" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => { setContent(e.target.value); setDirty(true); }}
                    onBlur={() => dirty && saveNote()}
                    placeholder="마크다운으로 작성..."
                    className="w-full min-h-[60vh] px-4 py-3 border-[2px] border-nu-ink/20 focus:border-nu-ink font-mono text-sm leading-relaxed resize-none"
                  />
                  <div className="w-full min-h-[60vh] px-4 py-3 border-[2px] border-nu-ink/20 bg-white overflow-auto">
                    {MarkdownPreview}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Right panel */}
      {selected && (
        <aside className="w-72 border-l-[3px] border-nu-ink bg-nu-cream/30 p-4 overflow-auto">
          <h3 className="font-head text-xs font-extrabold text-nu-ink uppercase mb-3">메타데이터</h3>
          <div className="space-y-3 text-xs">
            <div>
              <div className="font-mono-nu text-[10px] uppercase text-nu-muted tracking-widest mb-1">생성</div>
              <div className="text-nu-ink">{new Date(selected.created_at).toLocaleString("ko")}</div>
            </div>
            <div>
              <div className="font-mono-nu text-[10px] uppercase text-nu-muted tracking-widest mb-1">수정</div>
              <div className="text-nu-ink">{new Date(selected.updated_at).toLocaleString("ko")}</div>
            </div>
            {selected.parent_id && (
              <div>
                <div className="font-mono-nu text-[10px] uppercase text-nu-muted tracking-widest mb-1">상위 노트</div>
                <button onClick={() => setSelectedId(selected.parent_id)} className="text-nu-pink underline">
                  {notes.find((n) => n.id === selected.parent_id)?.title || "…"}
                </button>
              </div>
            )}
            <div>
              <div className="font-mono-nu text-[10px] uppercase text-nu-muted tracking-widest mb-1">자식 노트</div>
              <div className="space-y-1">
                {notes.filter((n) => n.parent_id === selected.id).map((c) => (
                  <button key={c.id} onClick={() => setSelectedId(c.id)} className="block text-left text-nu-ink hover:text-nu-pink">
                    {c.icon || "📄"} {c.title}
                  </button>
                ))}
                {notes.filter((n) => n.parent_id === selected.id).length === 0 && (
                  <span className="text-nu-muted italic">없음</span>
                )}
              </div>
            </div>

            {/* Backlinks */}
            <div>
              <div className="font-mono-nu text-[10px] uppercase text-nu-muted tracking-widest mb-1">🔗 연결된 노트</div>
              {forwardLinks.length === 0 && inboundLinks.length === 0 ? (
                <span className="text-nu-muted italic">없음 · <span className="font-mono-nu">[[제목]]</span></span>
              ) : (
                <div className="space-y-1.5">
                  {forwardLinks.length > 0 && (
                    <div>
                      <div className="text-[9px] font-mono-nu text-nu-muted uppercase">→ 참조</div>
                      {forwardLinks.map((b) => (
                        <button key={`fw-${b.id}`} onClick={() => setSelectedId(b.id)} className="block text-left text-nu-pink hover:underline text-xs">
                          {b.title}
                        </button>
                      ))}
                    </div>
                  )}
                  {inboundLinks.length > 0 && (
                    <div>
                      <div className="text-[9px] font-mono-nu text-nu-muted uppercase">← 역참조</div>
                      {inboundLinks.map((b) => (
                        <button key={`in-${b.id}`} onClick={() => setSelectedId(b.id)} className="block text-left text-nu-ink hover:text-nu-pink text-xs">
                          {b.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-nu-ink/10 space-y-2">
              <button
                onClick={() => createNote(selected.id)}
                className="w-full font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper flex items-center justify-center gap-1"
              >
                <Plus size={10} /> 하위 노트
              </button>
              <button
                onClick={archiveNote}
                className="w-full font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1.5 border-[2px] border-nu-ink/30 hover:border-amber-500 hover:text-amber-600 flex items-center justify-center gap-1"
              >
                <Archive size={10} /> {selected.is_archived ? "복원" : "보관"}
              </button>
              {selected.is_archived && (
                <button
                  onClick={deleteNote}
                  className="w-full font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1.5 border-[2px] border-red-300 text-red-600 hover:bg-red-50 flex items-center justify-center gap-1"
                >
                  <Trash2 size={10} /> 영구 삭제
                </button>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
