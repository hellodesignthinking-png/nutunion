"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, Code, Link2, Image,
  Eye, Edit3, Save, History, Clock,
  Tag, Users, GitBranch, ChevronRight, Loader2
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";

interface WikiPageEditorProps {
  pageId?: string;
  topicId: string;
  groupId: string;
  initialTitle?: string;
  initialContent?: string;
  initialTags?: string[];
  mode?: "create" | "edit";
  onSave?: (page: any) => void;
}

const TOOLBAR_ACTIONS = [
  { icon: Bold, label: "Bold", markdown: "**", wrap: true, shortcut: "⌘B" },
  { icon: Italic, label: "Italic", markdown: "*", wrap: true, shortcut: "⌘I" },
  { icon: Heading1, label: "H1", markdown: "# ", prefix: true },
  { icon: Heading2, label: "H2", markdown: "## ", prefix: true },
  { icon: Heading3, label: "H3", markdown: "### ", prefix: true },
  { icon: List, label: "List", markdown: "- ", prefix: true },
  { icon: ListOrdered, label: "Ordered List", markdown: "1. ", prefix: true },
  { icon: Code, label: "Code", markdown: "`", wrap: true },
  { icon: Link2, label: "Link", markdown: "[link](url)", insert: true, shortcut: "⌘K" },
];

export function WikiPageEditor({
  pageId,
  topicId,
  groupId,
  initialTitle = "",
  initialContent = "",
  initialTags = [],
  mode = "create",
  onSave,
}: WikiPageEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [newTag, setNewTag] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<{ id: string; name: string; color: string }[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changeSummary, setChangeSummary] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // ── Auto-save drafts to localStorage ──
  const draftKey = `wiki-draft-${mode}-${pageId || topicId}`;

  useEffect(() => {
    if (mode === "create" && !initialContent) {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          if (draft.title || draft.content) {
            setTitle(draft.title || "");
            setContent(draft.content || "");
            setDraftRestored(true);
          }
        } catch { /* ignore corrupt drafts */ }
      }
    }
  }, [draftKey, mode, initialContent]);

  useEffect(() => {
    if (!title.trim() && !content.trim()) return;
    const timer = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ title, content, savedAt: Date.now() }));
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, content, draftKey]);

  const clearDraft = () => localStorage.removeItem(draftKey);

  // Load existing tags for this group (auto-complete)
  useEffect(() => {
    async function loadGroupTags() {
      const supabase = createClient();
      const { data } = await supabase
        .from("wiki_tags")
        .select("id, name, color")
        .eq("group_id", groupId)
        .order("name");
      setTagSuggestions(data || []);
    }
    loadGroupTags();
  }, [groupId]);

  // Load existing page tags on edit mode
  useEffect(() => {
    if (mode !== "edit" || !pageId) return;
    async function loadPageTags() {
      const supabase = createClient();
      const { data } = await supabase
        .from("wiki_page_tags")
        .select("tag:wiki_tags(name)")
        .eq("page_id", pageId);
      if (data) {
        const names = data.map((d: any) => d.tag?.name).filter(Boolean);
        if (names.length > 0) setTags(names);
      }
    }
    loadPageTags();
  }, [mode, pageId]);

  // Keyboard shortcuts (Cmd/Ctrl + B, I, K, S)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || preview) return;
      const key = e.key.toLowerCase();
      let action: typeof TOOLBAR_ACTIONS[0] | undefined;
      if (key === "b") action = TOOLBAR_ACTIONS.find(a => a.label === "Bold");
      else if (key === "i") action = TOOLBAR_ACTIONS.find(a => a.label === "Italic");
      else if (key === "k") action = TOOLBAR_ACTIONS.find(a => a.label === "Link");
      else if (key === "s") { e.preventDefault(); handleSave(); return; }
      if (action) { e.preventDefault(); insertMarkdown(action); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }); // intentionally no deps — uses latest refs via closures

  const insertMarkdown = useCallback((action: typeof TOOLBAR_ACTIONS[0]) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);

    let newContent = content;
    if (action.wrap) {
      newContent = content.slice(0, start) + action.markdown + selected + action.markdown + content.slice(end);
    } else if (action.prefix) {
      const lineStart = content.lastIndexOf("\n", start - 1) + 1;
      newContent = content.slice(0, lineStart) + action.markdown + content.slice(lineStart);
    } else if (action.insert) {
      newContent = content.slice(0, start) + action.markdown + content.slice(end);
    }
    setContent(newContent);
  }, [content]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("제목을 입력해주세요"); return; }
    if (!content.trim()) { toast.error("내용을 입력해주세요"); return; }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다");

      if (mode === "create") {
        // Create new page
        const { data: page, error } = await supabase
          .from("wiki_pages")
          .insert({
            topic_id: topicId,
            title: title.trim(),
            content: content.trim(),
            created_by: user.id,
            last_updated_by: user.id,
            version: 1,
          })
          .select()
          .single();

        if (error) throw error;

        // Log contribution
        await supabase.from("wiki_contributions").insert({
          page_id: page.id,
          user_id: user.id,
          change_summary: "페이지 생성",
        });

        // Create version snapshot
        await supabase.from("wiki_page_versions").insert({
          page_id: page.id,
          version: 1,
          title: title.trim(),
          content: content.trim(),
          edited_by: user.id,
          change_summary: "초기 버전",
        });

        toast.success("위키 페이지가 생성되었습니다!");
        clearDraft();

        // Save tags
        await saveTagsForPage(supabase, page.id, user.id);

        onSave?.(page);
      } else {
        // Update existing page
        const { data: currentPage } = await supabase
          .from("wiki_pages")
          .select("version")
          .eq("id", pageId)
          .single();

        const newVersion = (currentPage?.version || 0) + 1;

        const { error: updateError } = await supabase
          .from("wiki_pages")
          .update({
            title: title.trim(),
            content: content.trim(),
            last_updated_by: user.id,
            version: newVersion,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pageId);

        if (updateError) throw updateError;

        // Log contribution
        await supabase.from("wiki_contributions").insert({
          page_id: pageId,
          user_id: user.id,
          change_summary: changeSummary || "페이지 수정",
        });

        // Save version snapshot
        await supabase.from("wiki_page_versions").insert({
          page_id: pageId,
          version: newVersion,
          title: title.trim(),
          content: content.trim(),
          edited_by: user.id,
          change_summary: changeSummary || "페이지 수정",
        });

        toast.success("위키 페이지가 업데이트되었습니다!");
        clearDraft();

        // Sync tags
        await saveTagsForPage(supabase, pageId!, user.id);

        onSave?.({ id: pageId, title, content, version: newVersion });
      }
    } catch (err: any) {
      toast.error(err.message || "저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    const tagName = newTag.trim();
    if (tagName && !tags.includes(tagName)) {
      setTags([...tags, tagName]);
      setNewTag("");
      setShowTagSuggestions(false);
    }
  };

  const filteredSuggestions = tagSuggestions.filter(
    s => s.name.toLowerCase().includes(newTag.toLowerCase()) && !tags.includes(s.name)
  );

  // Save tags to DB
  const saveTagsForPage = async (supabase: any, targetPageId: string, userId: string) => {
    try {
      // Delete existing page-tag associations
      await supabase.from("wiki_page_tags").delete().eq("page_id", targetPageId);

      if (tags.length === 0) return;

      // Ensure all tags exist in wiki_tags
      for (const tagName of tags) {
        const existing = tagSuggestions.find(s => s.name === tagName);
        if (!existing) {
          // Create new tag
          const { data: newTagData } = await supabase
            .from("wiki_tags")
            .insert({ group_id: groupId, name: tagName })
            .select("id, name, color")
            .single();
          if (newTagData) {
            setTagSuggestions(prev => [...prev, newTagData]);
          }
        }
      }

      // Re-fetch all tags to get IDs
      const { data: allTags } = await supabase
        .from("wiki_tags")
        .select("id, name")
        .eq("group_id", groupId)
        .in("name", tags);

      // Insert page-tag associations
      const inserts = (allTags || []).map((t: any) => ({
        page_id: targetPageId,
        tag_id: t.id,
      }));
      if (inserts.length > 0) {
        await supabase.from("wiki_page_tags").insert(inserts);
      }
    } catch (err) {
      console.error("Tag save error:", err);
    }
  };

  // Simple markdown preview renderer (with XSS protection)
  const escapeHtml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const renderPreview = (md: string) => {
    // First escape HTML to prevent XSS, then apply markdown transforms
    return escapeHtml(md)
      .replace(/### (.+)/g, '<h3 class="font-head text-base font-bold mt-4 mb-2">$1</h3>')
      .replace(/## (.+)/g, '<h2 class="font-head text-lg font-extrabold mt-6 mb-3">$1</h2>')
      .replace(/# (.+)/g, '<h1 class="font-head text-xl font-extrabold mt-8 mb-4">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-nu-ink">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-nu-cream/50 px-1.5 py-0.5 text-nu-pink font-mono-nu text-xs border border-nu-ink/10">$1</code>')
      .replace(/^- (.+)/gm, '<li class="ml-4 list-disc text-sm text-nu-graphite">$1</li>')
      .replace(/^\d+\. (.+)/gm, '<li class="ml-4 list-decimal text-sm text-nu-graphite">$1</li>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-nu-blue hover:text-nu-pink underline" rel="noopener noreferrer">$1</a>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="위키 페이지 제목..."
        className="w-full font-head text-3xl font-extrabold text-nu-ink bg-transparent border-0 border-b-[2px] border-nu-ink/10 focus:border-nu-pink focus:outline-none pb-3 placeholder:text-nu-ink/20 transition-colors"
      />

      {/* Tags with autocomplete */}
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <Tag size={14} className="text-nu-muted" />
          {tags.map(t => (
            <span key={t} className="font-mono-nu text-[9px] px-2 py-1 bg-nu-pink/10 text-nu-pink border border-nu-pink/20 flex items-center gap-1">
              {t}
              <button onClick={() => setTags(tags.filter(x => x !== t))} className="hover:text-red-500 ml-1">&times;</button>
            </span>
          ))}
          <input
            ref={tagInputRef}
            value={newTag}
            onChange={e => { setNewTag(e.target.value); setShowTagSuggestions(true); }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            onFocus={() => setShowTagSuggestions(true)}
            onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
            placeholder="태그 추가..."
            className="font-mono-nu text-[10px] px-2 py-1 bg-transparent border border-nu-ink/10 focus:border-nu-pink focus:outline-none w-28 transition-colors"
          />
        </div>
        {/* Tag auto-complete dropdown */}
        {showTagSuggestions && newTag && filteredSuggestions.length > 0 && (
          <div className="absolute top-full left-0 mt-1 bg-white border-[2px] border-nu-ink shadow-lg z-30 max-h-32 overflow-auto min-w-[160px]">
            {filteredSuggestions.slice(0, 6).map(s => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setTags([...tags, s.name]); setNewTag(""); setShowTagSuggestions(false); }}
                className="w-full text-left px-3 py-2 font-mono-nu text-[10px] text-nu-ink hover:bg-nu-cream/50 transition-colors flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || '#e91e63' }} />
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Draft restored banner */}
      {draftRestored && (
        <div className="flex items-center justify-between bg-nu-blue/5 border border-nu-blue/20 px-4 py-2 animate-in fade-in">
          <span className="font-mono-nu text-[10px] text-nu-blue">
            💾 이전에 저장된 초안이 복원되었습니다
          </span>
          <button
            onClick={() => { setTitle(initialTitle); setContent(initialContent); clearDraft(); setDraftRestored(false); }}
            className="font-mono-nu text-[9px] text-nu-muted hover:text-red-500 transition-colors"
          >
            초안 삭제
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1 bg-nu-cream/50 border-[2px] border-nu-ink/10 p-2 flex-wrap">
        {TOOLBAR_ACTIONS.map(action => (
          <button
            key={action.label}
            onClick={() => insertMarkdown(action)}
            title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
            aria-label={action.label}
            className="p-2 hover:bg-nu-ink/10 transition-colors text-nu-graphite hover:text-nu-ink"
          >
            <action.icon size={16} />
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setPreview(!preview)}
          className={`flex items-center gap-1.5 px-3 py-1.5 font-mono-nu text-[10px] font-bold uppercase tracking-widest transition-colors ${
            preview ? "bg-nu-ink text-white" : "text-nu-muted hover:text-nu-ink"
          }`}
        >
          {preview ? <Edit3 size={12} /> : <Eye size={12} />}
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {/* Editor / Preview */}
      {preview ? (
        <div className="bg-white border-[2px] border-nu-ink/[0.08] p-8 min-h-[400px]">
          <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-6">{title || "제목 없음"}</h1>
          <div
            className="prose prose-sm max-w-none text-nu-graphite leading-relaxed"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderPreview(content)) }}
          />
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="마크다운으로 지식을 기록하세요...

# 제목
## 소제목

- 핵심 개념 1
- 핵심 개념 2

**중요한 내용**은 볼드로 강조하세요.
`코드`는 백틱으로 감싸세요."
          className="w-full min-h-[400px] bg-white border-[2px] border-nu-ink/[0.08] p-6 font-mono-nu text-sm text-nu-graphite leading-relaxed focus:outline-none focus:border-nu-pink resize-y transition-colors placeholder:text-nu-ink/15"
        />
      )}

      {/* Change Summary (for edits) */}
      {mode === "edit" && (
        <div className="flex items-center gap-2">
          <History size={14} className="text-nu-muted shrink-0" />
          <input
            value={changeSummary}
            onChange={e => setChangeSummary(e.target.value)}
            placeholder="변경 사항 요약 (예: '개념 정의 보완', '사례 추가')"
            className="flex-1 font-mono-nu text-xs px-3 py-2 border border-nu-ink/10 focus:border-nu-pink focus:outline-none transition-colors bg-transparent"
          />
        </div>
      )}

      {/* Save */}
      <div className="flex items-center justify-between">
        <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest flex items-center gap-1">
          <Clock size={10} /> Markdown · 자동 버전 관리 · 초안 자동 저장
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-nu-ink text-white font-mono-nu text-xs font-bold uppercase tracking-widest hover:bg-nu-pink transition-all shadow-[4px_4px_0px_rgba(233,30,99,0.3)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {mode === "create" ? "페이지 생성" : "수정 저장"}
        </button>
      </div>
    </div>
  );
}
