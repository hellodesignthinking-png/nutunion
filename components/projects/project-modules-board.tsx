"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Plus, Trash2, Edit3, ChevronUp, ChevronDown, Loader2, Link as LinkIcon,
  StickyNote, FileVideo, KanbanSquare, Timer, MessageSquare, Folder, FileText,
  Eye, EyeOff, ExternalLink, Settings as SettingsIcon, X, Save,
} from "lucide-react";
import { toast } from "sonner";

/**
 * ProjectModulesBoard — 볼트 안 자유 모듈 패널.
 *
 *   • 행 단위 width(1/2/3) 배치 — 노션처럼 컬럼 단위 레이아웃
 *   • 모듈 종류 8개: link / note / embed / kanban_mini / countdown / social / gdrive / notion
 *   • 모든 외부 URL → 자동으로 /api/embed/preview 호출 → OG 메타 카드
 *   • 정렬: 위/아래 화살표 (드래그-드롭 대신 단순/모바일 친화)
 */

interface ModuleRow {
  id: string;
  kind: "link" | "note" | "embed" | "kanban_mini" | "countdown" | "social" | "gdrive" | "notion";
  title: string | null;
  config: Record<string, unknown>;
  width: 1 | 2 | 3;
  sort_order: number;
  is_visible: boolean;
}

const KIND_META: Record<ModuleRow["kind"], { label: string; icon: typeof LinkIcon; hint: string }> = {
  link:        { label: "링크 카드",  icon: LinkIcon,      hint: "어떤 URL 도 OG 미리보기" },
  note:        { label: "메모",       icon: StickyNote,    hint: "짧은 텍스트 / 메모" },
  embed:       { label: "임베드",     icon: FileVideo,     hint: "iframe — 유튜브, 피그마, 미로" },
  kanban_mini: { label: "미니 칸반",  icon: KanbanSquare,  hint: "할 일 / 진행 / 완료" },
  countdown:   { label: "D-Day",      icon: Timer,         hint: "마감/이정표 카운트다운" },
  social:      { label: "소셜 카드",  icon: MessageSquare, hint: "X / 스레드 / 인스타 / 틱톡" },
  gdrive:      { label: "구글 드라이브", icon: Folder,     hint: "Drive 파일/폴더 링크" },
  notion:      { label: "노션 페이지", icon: FileText,     hint: "Notion 공개 페이지" },
};

interface Props {
  projectId: string;
  canEdit: boolean;
}

export function ProjectModulesBoard({ projectId, canEdit }: Props) {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen]   = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/modules`);
      const j = await r.json();
      if (Array.isArray(j.modules)) setModules(j.modules as ModuleRow[]);
    } catch {} finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const visibleModules = useMemo(
    () => modules.filter((m) => canEdit || m.is_visible),
    [modules, canEdit]
  );

  async function addModule(kind: ModuleRow["kind"]) {
    setBusy(true);
    try {
      const defaultConfig = defaultConfigFor(kind);
      const r = await fetch(`/api/projects/${projectId}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title: KIND_META[kind].label, config: defaultConfig, width: kind === "embed" ? 2 : 1 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "생성 실패");
      setModules((p) => [...p, j.module]);
      setAddOpen(false);
      setEditingId(j.module.id);
      toast.success("모듈 추가");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "실패");
    } finally { setBusy(false); }
  }

  async function patch(id: string, patchObj: Partial<ModuleRow>) {
    const r = await fetch(`/api/projects/modules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchObj),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "저장 실패");
    setModules((p) => p.map((m) => m.id === id ? { ...m, ...patchObj } as ModuleRow : m));
  }

  async function remove(id: string) {
    if (!window.confirm("이 모듈을 삭제할까요?")) return;
    setModules((p) => p.filter((m) => m.id !== id));
    await fetch(`/api/projects/modules/${id}`, { method: "DELETE" }).catch(() => undefined);
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = modules.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= modules.length) return;
    const next = [...modules];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setModules(next);
    await fetch(`/api/projects/${projectId}/modules`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((m) => m.id) }),
    }).catch(() => undefined);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-nu-muted py-8">
        <Loader2 size={14} className="animate-spin" /> 모듈 불러오는 중…
      </div>
    );
  }

  return (
    <section className="mt-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="font-head text-xl font-extrabold text-nu-ink">모듈</h2>
          <p className="text-[12px] text-nu-muted">
            노션처럼 필요한 위젯을 자유롭게 추가하세요. 외부 서비스도 URL 만 붙이면 미리보기가 자동.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite inline-flex items-center gap-1.5"
          >
            <Plus size={12} /> 모듈 추가
          </button>
        )}
      </div>

      {/* 빈 상태 */}
      {visibleModules.length === 0 && (
        <div className="bg-nu-white border-[2px] border-dashed border-nu-ink/15 p-10 text-center">
          <KanbanSquare size={28} className="text-nu-muted/40 mx-auto mb-2" />
          <p className="text-sm text-nu-graphite">
            {canEdit ? "비어 있어요. 모듈을 추가해 주세요." : "표시할 모듈이 없습니다."}
          </p>
          {canEdit && (
            <p className="text-[12px] text-nu-muted mt-1">링크, 메모, 임베드, 카운트다운 — 8가지 종류 중 자유 선택.</p>
          )}
        </div>
      )}

      {/* 그리드 — 12 컬럼 그리드. width(1/2/3) → 4/8/12 */}
      <div className="grid grid-cols-12 gap-3">
        {visibleModules.map((m, i) => (
          <ModuleCard
            key={m.id}
            module={m}
            canEdit={canEdit}
            isEditing={editingId === m.id}
            onEdit={() => setEditingId(m.id)}
            onCloseEdit={() => setEditingId(null)}
            onPatch={(p) => patch(m.id, p)}
            onRemove={() => remove(m.id)}
            onMoveUp={i > 0 ? () => move(m.id, -1) : undefined}
            onMoveDown={i < visibleModules.length - 1 ? () => move(m.id, 1) : undefined}
          />
        ))}
      </div>

      {/* 추가 모달 */}
      {addOpen && (
        <div className="fixed inset-0 z-[100] bg-nu-ink/60 flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div role="dialog" aria-modal="true" className="bg-nu-paper border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b-[3px] border-nu-ink bg-white flex items-center justify-between">
              <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">모듈 종류 선택</div>
              <button onClick={() => setAddOpen(false)} className="text-nu-muted hover:text-nu-ink"><X size={16} /></button>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
              {(Object.keys(KIND_META) as ModuleRow["kind"][]).map((kind) => {
                const meta = KIND_META[kind];
                const Icon = meta.icon;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => addModule(kind)}
                    disabled={busy}
                    className="text-left bg-white border-[2px] border-nu-ink/15 hover:border-nu-pink p-3 transition-colors disabled:opacity-50"
                  >
                    <Icon size={16} className="text-nu-pink mb-1" />
                    <div className="font-bold text-sm text-nu-ink">{meta.label}</div>
                    <div className="text-[11px] text-nu-muted leading-tight mt-0.5">{meta.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
function defaultConfigFor(kind: ModuleRow["kind"]): Record<string, unknown> {
  switch (kind) {
    case "link":        return { url: "" };
    case "note":        return { content: "" };
    case "embed":       return { url: "", aspect: "16/9" };
    case "kanban_mini": return { columns: { todo: [], doing: [], done: [] } };
    case "countdown":   return { target_at: new Date(Date.now() + 7 * 86400000).toISOString(), label: "마감" };
    case "social":      return { url: "" };
    case "gdrive":      return { url: "", file_name: "" };
    case "notion":      return { url: "" };
  }
}

interface CardProps {
  module: ModuleRow;
  canEdit: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCloseEdit: () => void;
  onPatch: (p: Partial<ModuleRow>) => Promise<void>;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function ModuleCard({ module: m, canEdit, isEditing, onEdit, onCloseEdit, onPatch, onRemove, onMoveUp, onMoveDown }: CardProps) {
  const Icon = KIND_META[m.kind].icon;
  const colSpan = m.width === 3 ? "col-span-12" : m.width === 2 ? "col-span-12 md:col-span-8" : "col-span-12 md:col-span-4";

  return (
    <div className={`${colSpan} bg-nu-white border-[2px] border-nu-ink/[0.08] flex flex-col ${m.is_visible ? "" : "opacity-50"}`}>
      {/* 헤더 */}
      <div className="px-3 py-2 border-b-2 border-nu-ink/10 flex items-center gap-2">
        <Icon size={12} className="text-nu-pink shrink-0" />
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite truncate flex-1 min-w-0">
          {m.title || KIND_META[m.kind].label}
        </span>
        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0">
            {onMoveUp && <button onClick={onMoveUp} title="위로" className="p-1 text-nu-muted hover:text-nu-ink"><ChevronUp size={11} /></button>}
            {onMoveDown && <button onClick={onMoveDown} title="아래로" className="p-1 text-nu-muted hover:text-nu-ink"><ChevronDown size={11} /></button>}
            <button onClick={() => onPatch({ is_visible: !m.is_visible })} title={m.is_visible ? "숨기기" : "보이기"} className="p-1 text-nu-muted hover:text-nu-ink">
              {m.is_visible ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
            <button onClick={onEdit} title="설정" className="p-1 text-nu-muted hover:text-nu-pink"><SettingsIcon size={11} /></button>
            <button onClick={onRemove} title="삭제" className="p-1 text-nu-muted hover:text-red-600"><Trash2 size={11} /></button>
          </div>
        )}
      </div>

      {/* 본문 */}
      <div className="flex-1 min-h-[80px]">
        {isEditing ? (
          <ModuleEditor module={m} onSave={async (p) => { await onPatch(p); onCloseEdit(); }} onCancel={onCloseEdit} />
        ) : (
          <ModuleRenderer module={m} />
        )}
      </div>
    </div>
  );
}

// ─────────────── 렌더러 ────────────────────────────────────────────
function ModuleRenderer({ module: m }: { module: ModuleRow }) {
  const cfg = m.config as Record<string, unknown>;
  switch (m.kind) {
    case "link":
    case "social":
    case "gdrive":
    case "notion":
      return <LinkPreview url={(cfg.url as string) || ""} kind={m.kind} />;
    case "note":
      return <NoteView content={(cfg.content as string) || ""} />;
    case "embed":
      return <EmbedView url={(cfg.url as string) || ""} aspect={(cfg.aspect as string) || "16/9"} />;
    case "kanban_mini":
      return <KanbanMini columns={(cfg.columns as { todo: string[]; doing: string[]; done: string[] }) || { todo: [], doing: [], done: [] }} />;
    case "countdown":
      return <Countdown targetAt={(cfg.target_at as string) || ""} label={(cfg.label as string) || ""} />;
  }
}

function LinkPreview({ url, kind }: { url: string; kind: ModuleRow["kind"] }) {
  const [meta, setMeta] = useState<{ title?: string; description?: string; image?: string; provider?: string; site_name?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url || !url.startsWith("http")) return;
    setLoading(true);
    fetch(`/api/embed/preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((j) => setMeta(j))
      .catch(() => setMeta(null))
      .finally(() => setLoading(false));
  }, [url]);

  if (!url) return <div className="p-4 text-[12px] text-nu-muted italic">URL 을 설정하세요</div>;
  if (loading) return <div className="p-4 flex items-center gap-1.5 text-[12px] text-nu-muted"><Loader2 size={11} className="animate-spin" /> 미리보기 가져오는 중…</div>;

  const providerLabel = meta?.provider && meta.provider !== "generic" ? meta.provider : meta?.site_name || new URL(url).hostname.replace(/^www\./, "");

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block p-3 hover:bg-nu-cream/30 transition-colors no-underline">
      <div className="flex gap-3">
        {meta?.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meta.image} alt="" className="w-20 h-20 object-cover border border-nu-ink/10 shrink-0" loading="lazy" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink mb-0.5 flex items-center gap-1">
            {providerLabel} <ExternalLink size={9} />
          </div>
          <div className="font-bold text-sm text-nu-ink truncate">{meta?.title || url}</div>
          {meta?.description && (
            <div className="text-[11px] text-nu-graphite line-clamp-2 mt-0.5">{meta.description}</div>
          )}
        </div>
      </div>
    </a>
  );
}

function NoteView({ content }: { content: string }) {
  if (!content) return <div className="p-4 text-[12px] text-nu-muted italic">메모를 작성하세요</div>;
  return (
    <div className="p-4 text-[13px] text-nu-graphite whitespace-pre-wrap leading-relaxed">{content}</div>
  );
}

function EmbedView({ url, aspect }: { url: string; aspect: string }) {
  const [provider, setProvider] = useState<string | null>(null);
  const [embedHtml, setEmbedHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!url || !url.startsWith("http")) return;
    fetch(`/api/embed/preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((j) => { setProvider(j.provider); setEmbedHtml(j.embed_html || null); })
      .catch(() => undefined);
  }, [url]);

  if (!url) return <div className="p-4 text-[12px] text-nu-muted italic">임베드할 URL 을 설정하세요</div>;

  const ratio = aspect === "1/1" ? "aspect-square" : aspect === "4/3" ? "aspect-[4/3]" : "aspect-video";

  // YouTube 만 자동 embed_html 사용. 다른 사이트는 직접 iframe (X-Frame-Options 가 막을 수 있음 — fallback 안내)
  if (embedHtml && provider === "youtube") {
    return <div className={`${ratio} w-full`} dangerouslySetInnerHTML={{ __html: embedHtml.replace(/<iframe/, '<iframe class="w-full h-full"') }} />;
  }

  return (
    <div className={`${ratio} w-full bg-nu-cream/30 relative`}>
      <iframe
        src={url}
        title="embed"
        className="w-full h-full"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

function KanbanMini({ columns }: { columns: { todo: string[]; doing: string[]; done: string[] } }) {
  const cols: Array<{ key: keyof typeof columns; label: string; color: string }> = [
    { key: "todo",  label: "할 일",  color: "bg-nu-ink/5" },
    { key: "doing", label: "진행",   color: "bg-nu-yellow/20" },
    { key: "done",  label: "완료",   color: "bg-emerald-50" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 p-3">
      {cols.map((c) => (
        <div key={c.key} className={`${c.color} border border-nu-ink/10 p-2 min-h-[80px]`}>
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite mb-1.5">{c.label}</div>
          <ul className="space-y-1 list-none p-0 m-0">
            {(columns[c.key] || []).map((t, i) => (
              <li key={i} className="text-[12px] bg-white border border-nu-ink/10 px-1.5 py-1 leading-snug">{t}</li>
            ))}
            {(columns[c.key] || []).length === 0 && (
              <li className="text-[10px] text-nu-muted/60 italic">없음</li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Countdown({ targetAt, label }: { targetAt: string; label: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!targetAt) return <div className="p-4 text-[12px] text-nu-muted italic">목표 시각을 설정하세요</div>;
  const target = new Date(targetAt).getTime();
  const diff = target - now;
  const past = diff < 0;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  return (
    <div className="p-4 text-center">
      <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">{label || "D-Day"}</div>
      <div className={`font-head text-3xl font-black ${past ? "text-red-700" : "text-nu-pink"}`}>
        {past ? `+${days}일 ${hours}시간` : `D-${days}`}
      </div>
      <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mt-1">
        {new Date(targetAt).toLocaleString("ko", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

// ─────────────── 에디터 ────────────────────────────────────────────
function ModuleEditor({ module: m, onSave, onCancel }: {
  module: ModuleRow;
  onSave: (p: Partial<ModuleRow>) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(m.title || "");
  const [config, setConfig] = useState<Record<string, unknown>>({ ...m.config });
  const [width, setWidth] = useState<1 | 2 | 3>(m.width);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave({ title, config, width });
      toast.success("저장됨");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally { setSaving(false); }
  }

  return (
    <div className="p-3 space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="w-full px-2 py-1 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none"
        maxLength={80}
      />

      <div className="flex items-center gap-1">
        <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">폭</span>
        {([1, 2, 3] as const).map((w) => (
          <button key={w} type="button" onClick={() => setWidth(w)}
            className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 border-[2px] ${
              width === w ? "bg-nu-ink text-nu-paper border-nu-ink" : "border-nu-ink/15 text-nu-graphite"
            }`}>
            {w === 1 ? "1/3" : w === 2 ? "2/3" : "전체"}
          </button>
        ))}
      </div>

      {/* kind 별 설정 */}
      {(m.kind === "link" || m.kind === "social" || m.kind === "gdrive" || m.kind === "notion") && (
        <input
          type="url"
          value={(config.url as string) || ""}
          onChange={(e) => setConfig((p) => ({ ...p, url: e.target.value }))}
          placeholder={
            m.kind === "social" ? "https://x.com/..." :
            m.kind === "gdrive" ? "https://drive.google.com/..." :
            m.kind === "notion" ? "https://notion.so/..." :
            "https://..."
          }
          className="w-full px-2 py-1 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none"
        />
      )}
      {m.kind === "note" && (
        <textarea
          value={(config.content as string) || ""}
          onChange={(e) => setConfig((p) => ({ ...p, content: e.target.value }))}
          placeholder="메모…"
          rows={4}
          className="w-full px-2 py-1 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none resize-y"
        />
      )}
      {m.kind === "embed" && (
        <>
          <input type="url" value={(config.url as string) || ""} onChange={(e) => setConfig((p) => ({ ...p, url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=…" className="w-full px-2 py-1 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none" />
          <div className="flex items-center gap-1">
            <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">비율</span>
            {(["16/9", "4/3", "1/1"] as const).map((a) => (
              <button key={a} type="button" onClick={() => setConfig((p) => ({ ...p, aspect: a }))}
                className={`font-mono-nu text-[10px] px-2 py-0.5 border-[2px] ${
                  (config.aspect || "16/9") === a ? "bg-nu-ink text-nu-paper border-nu-ink" : "border-nu-ink/15 text-nu-graphite"
                }`}>
                {a}
              </button>
            ))}
          </div>
        </>
      )}
      {m.kind === "countdown" && (
        <>
          <input
            type="datetime-local"
            value={config.target_at ? new Date(config.target_at as string).toISOString().slice(0, 16) : ""}
            onChange={(e) => setConfig((p) => ({ ...p, target_at: new Date(e.target.value).toISOString() }))}
            className="w-full px-2 py-1 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none"
          />
          <input
            type="text"
            value={(config.label as string) || ""}
            onChange={(e) => setConfig((p) => ({ ...p, label: e.target.value }))}
            placeholder="라벨 — 예: '런칭'"
            className="w-full px-2 py-1 text-[12px] border-[2px] border-nu-ink/15 focus:border-nu-pink outline-none"
          />
        </>
      )}
      {m.kind === "kanban_mini" && (
        <KanbanEditor config={config} onChange={setConfig} />
      )}

      <div className="flex gap-1 pt-1">
        <button onClick={onCancel} disabled={saving} className="flex-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] border-nu-ink/15 hover:bg-nu-ink/5">
          취소
        </button>
        <button onClick={save} disabled={saving} className="flex-1 font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 bg-nu-ink text-nu-paper hover:bg-nu-graphite inline-flex items-center justify-center gap-1">
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} 저장
        </button>
      </div>
    </div>
  );
}

function KanbanEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const cols = (config.columns as { todo: string[]; doing: string[]; done: string[] }) || { todo: [], doing: [], done: [] };

  const update = (key: keyof typeof cols, lines: string[]) => {
    onChange({ ...config, columns: { ...cols, [key]: lines.filter(Boolean) } });
  };

  return (
    <div className="space-y-1.5">
      {(["todo", "doing", "done"] as const).map((key) => (
        <div key={key}>
          <div className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted mb-0.5">
            {key === "todo" ? "할 일" : key === "doing" ? "진행" : "완료"}
          </div>
          <textarea
            value={cols[key].join("\n")}
            onChange={(e) => update(key, e.target.value.split("\n"))}
            placeholder="줄바꿈으로 항목 분리"
            rows={2}
            className="w-full px-2 py-1 text-[11px] border border-nu-ink/15 focus:border-nu-pink outline-none resize-y"
          />
        </div>
      ))}
    </div>
  );
}
