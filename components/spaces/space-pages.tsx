"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Loader2, FileText, Star, Clock, Layers } from "lucide-react";
import { toast } from "sonner";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { SpacePage } from "./space-pages-types";
import { SpacePageTreeNode } from "./space-page-tree-node";
import { SpacePageEditor } from "./space-page-editor";
import { SnippetsPanel } from "./snippets-panel";
import { TemplatePicker } from "./template-picker";
import type { PageTemplate } from "./templates";

interface Props {
  ownerType: "nut" | "bolt";
  ownerId: string;
  /** 사용자 닉네임 — created_by 표시 등 */
  currentUserId?: string;
  /** 닉네임 — realtime presence broadcast 시 라벨 */
  currentUserNickname?: string;
}

type SidebarMode = "tree" | "favorites" | "recent";

/**
 * 노션 스타일 자유 페이지 관리자.
 *
 * - 좌측: 페이지 트리 (사이드바). 제목·아이콘 인라인 편집, "+" 자식 추가, ⋯ 메뉴.
 * - 우측: 선택된 페이지 에디터 (블록 기반 — text/h1-3/todo/code 등 슬래시 명령).
 * - 모든 멤버가 추가/편집/삭제 가능 (RLS).
 */
export function SpacePages({ ownerType, ownerId, currentUserId, currentUserNickname }: Props) {
  const [pages, setPages] = useState<SpacePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("tree");
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  // 실시간 presence — 같은 페이지를 보고 있는 다른 사용자
  const [presenceUsers, setPresenceUsers] = useState<Array<{ id: string; nickname: string }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${ownerType}/${ownerId}/pages`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "로드 실패");
      setPages(json.pages || []);
      // 선택 페이지가 없거나 삭제됐으면 첫 root 페이지 선택
      const list = (json.pages || []) as SpacePage[];
      if (list.length > 0 && (!selectedId || !list.find((p) => p.id === selectedId))) {
        const firstRoot = list.find((p) => p.parent_page_id === null) || list[0];
        setSelectedId(firstRoot.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "로드 실패");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerType, ownerId]);

  useEffect(() => { load(); }, [load]);

  // 즐겨찾기 fetch
  useEffect(() => {
    fetch("/api/spaces/favorites")
      .then((r) => r.ok ? r.json() : { favorites: [] })
      .then((j: { favorites: string[] }) => setFavorites(new Set(j.favorites ?? [])))
      .catch(() => undefined);
  }, []);

  const toggleFavorite = useCallback(async (pageId: string) => {
    const was = favorites.has(pageId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (was) next.delete(pageId); else next.add(pageId);
      return next;
    });
    try {
      const res = await fetch("/api/spaces/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: pageId, action: was ? "remove" : "add" }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (was) next.add(pageId); else next.delete(pageId);
        return next;
      });
      toast.error("즐겨찾기 변경 실패");
    }
  }, [favorites]);

  // 실시간 presence — 선택된 페이지에 같이 있는 다른 사용자 표시
  useEffect(() => {
    if (!selectedId || !currentUserId) return;
    const supa = createBrowserClient();
    const channel = supa.channel(`space-page:${selectedId}`, {
      config: { presence: { key: currentUserId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Array<{ nickname: string }>>;
        const others: Array<{ id: string; nickname: string }> = [];
        for (const [id, metas] of Object.entries(state)) {
          if (id === currentUserId) continue;
          const m = metas[0];
          if (m?.nickname) others.push({ id, nickname: m.nickname });
        }
        setPresenceUsers(others);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ nickname: currentUserNickname || "익명" });
        }
      });
    return () => {
      void supa.removeChannel(channel);
      setPresenceUsers([]);
    };
  }, [selectedId, currentUserId, currentUserNickname]);

  const tree = useMemo(() => {
    const byParent = new Map<string | null, SpacePage[]>();
    for (const p of pages) {
      const arr = byParent.get(p.parent_page_id) ?? [];
      arr.push(p);
      byParent.set(p.parent_page_id, arr);
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
    }
    return byParent;
  }, [pages]);

  const selected = useMemo(() => pages.find((p) => p.id === selectedId) ?? null, [pages, selectedId]);

  // 템플릿으로 페이지 생성 — 빈 페이지 + 블록 일괄 POST.
  const createFromTemplate = useCallback(async (template: PageTemplate) => {
    const res = await fetch(`/api/spaces/${ownerType}/${ownerId}/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_page_id: null, title: template.title, icon: template.icon }),
    });
    const json = await res.json();
    if (!res.ok || !json.page) throw new Error(json?.error || "페이지 생성 실패");
    setPages((prev) => [...prev, json.page]);
    setSelectedId(json.page.id);
    // 블록 순차 삽입
    for (const b of template.blocks) {
      await fetch(`/api/spaces/pages/${json.page.id}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: b.type, content: b.content || "", data: b.data || {} }),
      });
    }
    toast.success(`"${template.title}" 템플릿 적용`);
  }, [ownerType, ownerId]);

  const addPage = useCallback(async (parentId: string | null) => {
    try {
      const res = await fetch(`/api/spaces/${ownerType}/${ownerId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_page_id: parentId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "생성 실패");
      setPages((prev) => [...prev, json.page]);
      setSelectedId(json.page.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "페이지 생성 실패");
    }
  }, [ownerType, ownerId]);

  const updatePage = useCallback(async (id: string, patch: Partial<Pick<SpacePage, "title" | "icon" | "content" | "parent_page_id" | "position">>) => {
    setPages((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
    try {
      const res = await fetch(`/api/spaces/pages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "저장 실패");
      // 서버 응답으로 동기화 (updated_at 등)
      setPages((prev) => prev.map((p) => p.id === id ? { ...p, ...json.page } : p));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
      // 롤백 — 원본 다시 가져오기
      load();
    }
  }, [load]);

  const deletePage = useCallback(async (id: string) => {
    const target = pages.find((p) => p.id === id);
    if (!target) return;
    const childCount = pages.filter((p) => p.parent_page_id === id).length;
    if (childCount > 0) {
      const ok = window.confirm(`이 페이지에 하위 페이지 ${childCount}개가 있어요. 모두 함께 삭제할까요?`);
      if (!ok) return;
    } else {
      const ok = window.confirm(`"${target.title}" 페이지를 삭제할까요?`);
      if (!ok) return;
    }
    setPages((prev) => {
      // 자손 모두 제거
      const toRemove = new Set<string>([id]);
      let added = true;
      while (added) {
        added = false;
        for (const p of prev) {
          if (p.parent_page_id && toRemove.has(p.parent_page_id) && !toRemove.has(p.id)) {
            toRemove.add(p.id);
            added = true;
          }
        }
      }
      return prev.filter((p) => !toRemove.has(p.id));
    });
    if (selectedId === id) setSelectedId(null);
    try {
      const res = await fetch(`/api/spaces/pages/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "삭제 실패");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "삭제 실패");
      load();
    }
  }, [pages, selectedId, load]);

  return (
    <div className="border-[3px] border-nu-ink bg-white shadow-[3px_3px_0_0_#0D0F14] flex flex-col md:flex-row" style={{ minHeight: 480 }}>
      {/* 사이드바 — 페이지 트리 + 즐겨찾기 + 타임라인 + 스니펫 */}
      <aside className="md:w-[280px] shrink-0 border-b-[2px] md:border-b-0 md:border-r-[2px] border-nu-ink/15 bg-nu-cream/20 flex flex-col">
        <div className="px-3 py-2 border-b-[2px] border-nu-ink/15 flex items-center justify-between bg-white">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted flex items-center gap-1.5">
            <FileText size={11} />
            페이지 {pages.length}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSnippetsOpen(true)}
              title="스니펫"
              className="font-mono-nu text-[10px] uppercase tracking-widest px-1 py-0.5 border border-nu-ink/30 hover:bg-nu-cream"
            >
              <Layers size={10} />
            </button>
            <button
              type="button"
              onClick={() => setTemplateOpen(true)}
              title="템플릿"
              className="font-mono-nu text-[10px] uppercase tracking-widest px-1 py-0.5 border border-nu-ink/30 hover:bg-nu-cream"
            >
              ✨
            </button>
            <button
              type="button"
              onClick={() => addPage(null)}
              title="새 페이지"
              className="font-mono-nu text-[10px] uppercase tracking-widest px-1.5 py-0.5 border-[2px] border-nu-ink hover:bg-nu-cream flex items-center gap-1"
            >
              <Plus size={10} /> 페이지
            </button>
          </div>
        </div>
        {/* 모드 토글 — 트리 / 즐겨찾기 / 최근 */}
        <div className="flex border-b border-nu-ink/10 bg-white text-[10px] font-mono-nu uppercase tracking-widest">
          <button
            type="button"
            onClick={() => setSidebarMode("tree")}
            className={`flex-1 px-2 py-1.5 flex items-center justify-center gap-1 ${sidebarMode === "tree" ? "bg-nu-ink text-nu-paper" : "hover:bg-nu-cream text-nu-ink"}`}
          >
            <FileText size={10} /> 트리
          </button>
          <button
            type="button"
            onClick={() => setSidebarMode("favorites")}
            className={`flex-1 px-2 py-1.5 flex items-center justify-center gap-1 border-l border-nu-ink/10 ${sidebarMode === "favorites" ? "bg-nu-ink text-nu-paper" : "hover:bg-nu-cream text-nu-ink"}`}
          >
            <Star size={10} /> 즐겨{favorites.size > 0 ? ` ${favorites.size}` : ""}
          </button>
          <button
            type="button"
            onClick={() => setSidebarMode("recent")}
            className={`flex-1 px-2 py-1.5 flex items-center justify-center gap-1 border-l border-nu-ink/10 ${sidebarMode === "recent" ? "bg-nu-ink text-nu-paper" : "hover:bg-nu-cream text-nu-ink"}`}
          >
            <Clock size={10} /> 최근
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-0.5">
          {loading ? (
            <div className="flex items-center gap-1.5 px-2 py-2 text-[12px] text-nu-muted">
              <Loader2 size={12} className="animate-spin" /> 불러오는 중…
            </div>
          ) : error ? (
            <div className="px-2 py-2 text-[11px] text-red-700">{error}</div>
          ) : pages.length === 0 ? (
            <button
              type="button"
              onClick={() => addPage(null)}
              className="w-full text-left px-3 py-3 border-[2px] border-dashed border-nu-ink/30 hover:border-nu-ink hover:bg-white text-[12px] text-nu-muted hover:text-nu-ink"
            >
              + 첫 페이지 만들기
            </button>
          ) : sidebarMode === "favorites" ? (
            favorites.size === 0 ? (
              <div className="px-2 py-3 text-[11px] text-nu-muted italic">
                즐겨찾기 없음 — 페이지의 ★ 버튼으로 추가
              </div>
            ) : (
              pages.filter((p) => favorites.has(p.id)).map((p) => (
                <FlatPageRow key={p.id} page={p} selected={selectedId === p.id} onSelect={() => setSelectedId(p.id)} starred={true} onToggleStar={() => toggleFavorite(p.id)} />
              ))
            )
          ) : sidebarMode === "recent" ? (
            [...pages].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 30).map((p) => (
              <FlatPageRow key={p.id} page={p} selected={selectedId === p.id} onSelect={() => setSelectedId(p.id)} starred={favorites.has(p.id)} onToggleStar={() => toggleFavorite(p.id)} showTime={p.updated_at} />
            ))
          ) : (
            (tree.get(null) ?? []).map((p) => (
              <SpacePageTreeNode
                key={p.id}
                page={p}
                tree={tree}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAddChild={(parentId) => addPage(parentId)}
                onUpdate={updatePage}
                onDelete={deletePage}
                onToggleStar={toggleFavorite}
                isFavorite={favorites.has(p.id)}
                favorites={favorites}
                depth={0}
              />
            ))
          )}
        </div>
      </aside>

      {/* 에디터 영역 */}
      <main className="flex-1 min-w-0 flex flex-col relative">
        {/* 실시간 presence — 같은 페이지에 있는 다른 사용자 */}
        {selectedId && presenceUsers.length > 0 && (
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-white border-[2px] border-nu-ink shadow-[2px_2px_0_0_#0D0F14] px-1.5 py-0.5">
            <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink">
              {presenceUsers.length}명 보는 중
            </span>
            {presenceUsers.slice(0, 3).map((u) => (
              <span key={u.id} className="w-5 h-5 rounded-full bg-nu-pink text-white font-mono-nu text-[9px] flex items-center justify-center" title={u.nickname}>
                {u.nickname[0]}
              </span>
            ))}
            {presenceUsers.length > 3 && (
              <span className="font-mono-nu text-[9px] text-nu-muted">+{presenceUsers.length - 3}</span>
            )}
          </div>
        )}
        {selected ? (
          <SpacePageEditor
            page={selected}
            onUpdateTitle={(title) => updatePage(selected.id, { title })}
            onUpdateIcon={(icon) => updatePage(selected.id, { icon })}
            onUpdateContent={(content) => updatePage(selected.id, { content })}
            ownerType={ownerType}
            ownerId={ownerId}
            currentUserId={currentUserId}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-nu-muted">
            <FileText size={32} className="mb-3 opacity-40" />
            <p className="text-[13px]">왼쪽 페이지를 선택하거나 새 페이지를 만드세요.</p>
            <button
              type="button"
              onClick={() => addPage(null)}
              className="mt-3 font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-nu-ink hover:bg-nu-cream"
            >
              + 새 페이지
            </button>
          </div>
        )}
      </main>
      <SnippetsPanel
        open={snippetsOpen}
        onClose={() => setSnippetsOpen(false)}
        currentPageId={selectedId}
      />
      <TemplatePicker
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        onPick={createFromTemplate}
      />
    </div>
  );
}

function FlatPageRow({
  page,
  selected,
  starred,
  onSelect,
  onToggleStar,
  showTime,
}: {
  page: SpacePage;
  selected: boolean;
  starred: boolean;
  onSelect: () => void;
  onToggleStar: () => void;
  showTime?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 cursor-pointer ${selected ? "bg-nu-ink text-nu-paper" : "hover:bg-white"}`}
      onClick={onSelect}
    >
      <span className="text-[13px]">{page.icon || "📄"}</span>
      <span className="flex-1 truncate text-[12px]">{page.title}</span>
      {showTime && (
        <span className={`font-mono-nu text-[9px] uppercase tracking-widest ${selected ? "text-nu-paper/70" : "text-nu-muted"} shrink-0`}>
          {timeAgo(showTime)}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
        className={`p-0.5 ${starred ? "text-nu-yellow" : selected ? "text-nu-paper/40 hover:text-nu-yellow" : "text-nu-muted hover:text-nu-yellow"}`}
        title={starred ? "즐겨찾기 해제" : "즐겨찾기"}
      >
        <Star size={11} fill={starred ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간`;
  const d = Math.round(h / 24);
  return `${d}일`;
}
