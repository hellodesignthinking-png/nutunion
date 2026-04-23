"use client";

/**
 * LivingTapEditor — Tap mode='living' 전용 에디터.
 *
 * 기능:
 *  - TipTap 3.x (ProseMirror)
 *  - yjs + y-webrtc P2P 실시간 협업 (서버 불필요 — peer-to-peer)
 *  - Collaboration cursor (다른 사용자 커서/선택 영역 표시)
 *  - HTML 저장 (bolt_taps.content_md)
 *  - 툴바: 제목/굵게/기울임/리스트/코드/인용/링크/undo/redo
 *  - 2초 debounce 자동 저장
 *
 * 주의:
 *  - y-webrtc 는 첫 피어가 signaling 통해 연결 — 해외/방화벽에서 실패 가능. 그 경우 단독 편집 모드로 동작
 *  - collaboration extension 은 editor history 와 충돌 — StarterKit history 비활성
 */

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold, Italic, List, ListOrdered, Quote, Code, Heading1, Heading2, Heading3,
  Undo, Redo, Link as LinkIcon, Save, Loader2, CheckCircle2, Users,
} from "lucide-react";

interface Props {
  initialHtml: string;
  onSave: (html: string) => Promise<void>;
  autoSaveMs?: number;
  readOnly?: boolean;
  placeholder?: string;
  /** 협업 룸 ID — 같은 문서 편집자들이 같은 ID 를 써야 함 (추천: `tap-${projectId}`) */
  roomId?: string;
  /** 내 색상/이름 — 다른 피어에게 보이는 커서 라벨 */
  user?: { name: string; color?: string };
}

const CURSOR_COLORS = ["#FF48B0", "#0055FF", "#FFA500", "#047857", "#9333EA", "#E11D48"];

export function LivingTapEditor({
  initialHtml,
  onSave,
  autoSaveMs = 2000,
  readOnly = false,
  placeholder = "위키처럼 자유롭게 작성하세요.",
  roomId,
  user,
}: Props) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [peerCount, setPeerCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // yjs Doc + WebRTC Provider — 단일 인스턴스
  const yDoc = useMemo(() => new Y.Doc(), []);
  const providerRef = useRef<WebrtcProvider | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const userName = user?.name || "익명 편집자";
    const userColor = user?.color || CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];

    const provider = new WebrtcProvider(roomId, yDoc, {
      signaling: ["wss://y-webrtc-eu.fly.dev", "wss://signaling.yjs.dev"],
    });
    providerRef.current = provider;

    provider.awareness.setLocalStateField("user", { name: userName, color: userColor });

    const onAwareness = () => {
      setPeerCount(provider.awareness.getStates().size - 1);
    };
    provider.awareness.on("change", onAwareness);
    onAwareness();

    return () => {
      provider.awareness.off("change", onAwareness);
      provider.destroy();
      providerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const extensions = useMemo(() => {
    const base: any[] = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Collaboration 은 자체 undo/redo 제공 → StarterKit 것 끔
        ...(roomId ? { undoRedo: false as const } : {}),
      }),
      Placeholder.configure({ placeholder }),
    ];
    if (roomId) {
      base.push(Collaboration.configure({ document: yDoc }));
      // CollaborationCursor 는 provider 가 준비됐을 때만 (runtime 확인은 editor 내부에서)
      if (providerRef.current) {
        base.push(
          CollaborationCursor.configure({
            provider: providerRef.current,
            user: {
              name: user?.name || "익명",
              color: user?.color || CURSOR_COLORS[0],
            },
          }),
        );
      }
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, providerRef.current]);

  const editor = useEditor({
    extensions,
    content: roomId ? undefined : initialHtml, // collab 에선 yjs 가 상태 소유
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[400px] outline-none px-4 py-3 focus:outline-none " +
          "prose-headings:font-head prose-headings:text-nu-ink prose-p:leading-relaxed " +
          "prose-a:text-nu-pink prose-a:no-underline hover:prose-a:underline",
      },
    },
    onUpdate({ editor }) {
      const html = editor.getHTML();
      setStatus("idle");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setStatus("saving");
        try {
          await onSave(html);
          setStatus("saved");
        } catch {
          setStatus("error");
        }
      }, autoSaveMs);
    },
  });

  // 초기 content 주입 (Collab 에서 yDoc 이 비었을 때)
  useEffect(() => {
    if (!editor || !roomId) return;
    // yjs 가 sync 되기까지 잠깐 기다린 뒤, 빈 문서면 initialHtml 을 삽입
    const t = setTimeout(() => {
      if (editor.getHTML() === "<p></p>" && initialHtml) {
        editor.commands.setContent(initialHtml, { emitUpdate: false });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [editor, roomId, initialHtml]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  async function saveNow() {
    if (!editor) return;
    setStatus("saving");
    try {
      await onSave(editor.getHTML());
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  if (!editor) {
    return (
      <div className="border-[2px] border-nu-ink/10 p-8 flex items-center justify-center">
        <Loader2 size={18} className="animate-spin text-nu-muted" />
      </div>
    );
  }

  return (
    <div className="border-[2px] border-nu-ink/10 rounded-[var(--ds-radius-md)] bg-white overflow-hidden">
      {!readOnly && (
        <div className="flex items-center gap-0.5 border-b border-nu-ink/10 px-2 py-1.5 bg-nu-cream/20 sticky top-0 z-10 flex-wrap">
          <TB active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1"><Heading1 size={13} /></TB>
          <TB active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2"><Heading2 size={13} /></TB>
          <TB active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="H3"><Heading3 size={13} /></TB>
          <Divider />
          <TB active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="굵게"><Bold size={13} /></TB>
          <TB active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="기울임"><Italic size={13} /></TB>
          <TB active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="인라인 코드"><Code size={13} /></TB>
          <Divider />
          <TB active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="글머리"><List size={13} /></TB>
          <TB active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="번호"><ListOrdered size={13} /></TB>
          <TB active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="인용"><Quote size={13} /></TB>
          <Divider />
          <TB onClick={() => {
            const url = prompt("링크 URL");
            if (!url) return;
            const selection = editor.state.selection;
            const text = editor.state.doc.textBetween(selection.from, selection.to) || url;
            editor.chain().focus().insertContent(`[${text}](${url})`).run();
          }} title="링크"><LinkIcon size={13} /></TB>
          <Divider />
          <TB onClick={() => editor.chain().focus().undo().run()} title="실행 취소"><Undo size={13} /></TB>
          <TB onClick={() => editor.chain().focus().redo().run()} title="다시 실행"><Redo size={13} /></TB>

          <div className="flex-1" />

          <div className="flex items-center gap-2 pr-2">
            {roomId && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-mono-nu text-nu-graphite"
                title="현재 문서에 연결된 다른 편집자 수"
              >
                <Users size={11} />
                <span className="tabular-nums">{peerCount}</span>
              </span>
            )}
            {status === "saving" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono-nu text-nu-graphite">
                <Loader2 size={11} className="animate-spin" /> 저장 중
              </span>
            )}
            {status === "saved" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono-nu text-green-700">
                <CheckCircle2 size={11} /> 저장됨
              </span>
            )}
            {status === "error" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono-nu text-nu-pink">저장 실패</span>
            )}
            <button
              onClick={saveNow}
              className="inline-flex items-center gap-1 text-[10px] font-mono-nu uppercase tracking-widest px-2 py-1 border border-nu-ink/20 hover:bg-nu-ink hover:text-white rounded"
            >
              <Save size={10} /> 저장
            </button>
          </div>
        </div>
      )}
      <style jsx global>{`
        /* Collaboration cursor styles */
        .collaboration-cursor__caret {
          border-left: 1px solid #0d0d0d;
          border-right: 1px solid #0d0d0d;
          margin-left: -1px;
          margin-right: -1px;
          pointer-events: none;
          position: relative;
          word-break: normal;
        }
        .collaboration-cursor__label {
          border-radius: 3px 3px 3px 0;
          color: #fff;
          font-family: var(--font-mono-nu);
          font-size: 10px;
          font-style: normal;
          font-weight: 600;
          left: -1px;
          line-height: normal;
          padding: 1px 5px;
          position: absolute;
          top: -1.4em;
          user-select: none;
          white-space: nowrap;
        }
      `}</style>
      <EditorContent editor={editor} />
    </div>
  );
}

function TB({ children, active, onClick, title }: {
  children: React.ReactNode; active?: boolean; onClick?: () => void; title?: string;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`p-1.5 rounded hover:bg-nu-ink/10 transition-colors ${active ? "bg-nu-ink text-white hover:bg-nu-ink/80" : "text-nu-graphite"}`}
    >
      {children}
    </button>
  );
}

function Divider() { return <div className="w-px h-5 bg-nu-ink/10 mx-0.5" />; }
