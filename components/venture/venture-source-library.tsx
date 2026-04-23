"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { toast } from "sonner";
import type { VentureSource, VentureSourceKind } from "@/lib/venture/types";
import { VentureDriveImporter } from "./venture-drive-importer";

interface Props {
  projectId: string;
  canEdit: boolean;
  driveFolderId?: string | null;
  driveFolderUrl?: string | null;
}

const KIND_META: Record<VentureSourceKind, { icon: string; label: string; color: string }> = {
  youtube:      { icon: "📺", label: "YouTube",     color: "text-red-600" },
  article:      { icon: "📰", label: "Article",     color: "text-blue-700" },
  drive_doc:    { icon: "📄", label: "Drive 문서",  color: "text-green-700" },
  pdf:          { icon: "📕", label: "PDF",         color: "text-red-700" },
  link:         { icon: "🔗", label: "Link",        color: "text-nu-ink" },
  raw_text:     { icon: "✍️", label: "텍스트",      color: "text-nu-graphite" },
  meeting_note: { icon: "🗣", label: "회의록",      color: "text-purple-700" },
  interview:    { icon: "🎤", label: "인터뷰",      color: "text-orange-700" },
};

const KIND_ORDER: VentureSourceKind[] = [
  "drive_doc", "pdf", "youtube", "article", "link", "meeting_note", "interview", "raw_text",
];

type ViewMode = "list" | "grouped";

export function VentureSourceLibrary({ projectId, canEdit, driveFolderId, driveFolderUrl }: Props) {
  const [sources, setSources] = useState<VentureSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [bulkSummarizing, setBulkSummarizing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/venture/${projectId}/sources`, { cache: "no-store" });
      const data = await res.json();
      setSources(data.sources ?? []);
    } catch {
      toast.error("소스 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const summarize = async (id: string) => {
    setSummarizingId(id);
    try {
      const res = await fetch(`/api/venture/${projectId}/sources/${id}/summarize`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "요약 실패");
      toast.success("AI 요약 완료");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "요약 실패");
    } finally {
      setSummarizingId(null);
    }
  };

  const summarizeAllPending = async () => {
    const pending = sources.filter((s) => s.summary_status !== "ready");
    if (pending.length === 0) {
      toast.info("요약 대상 없음 — 모든 소스가 요약되어 있습니다");
      return;
    }
    setBulkSummarizing(true);
    let ok = 0, fail = 0;
    // rate limit (summarize: 30/분) 회피 — 최대 10건 + 각 호출 사이 2.1초 간격
    const target = pending.slice(0, 10);
    for (let i = 0; i < target.length; i++) {
      const s = target[i];
      try {
        const res = await fetch(`/api/venture/${projectId}/sources/${s.id}/summarize`, { method: "POST" });
        if (res.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }
      if (i < target.length - 1) {
        await new Promise((r) => setTimeout(r, 2100));
      }
    }
    setBulkSummarizing(false);
    toast.success(`일괄 요약: 성공 ${ok} / 실패 ${fail}${pending.length > 10 ? ` (대기 ${pending.length - 10})` : ""}`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("이 소스를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/venture/${projectId}/sources?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제 실패");
      setSources((prev) => prev.filter((s) => s.id !== id));
      toast.success("삭제됨");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  const grouped = useMemo(() => {
    const byKind = new Map<VentureSourceKind, VentureSource[]>();
    for (const s of sources) {
      const arr = byKind.get(s.kind) ?? [];
      arr.push(s);
      byKind.set(s.kind, arr);
    }
    return KIND_ORDER.map((k) => ({ kind: k, items: byKind.get(k) ?? [] })).filter((g) => g.items.length > 0);
  }, [sources]);

  const readyCount = sources.filter((s) => s.summary_status === "ready").length;

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper">
      <div className="flex items-center justify-between px-4 py-3 border-b-[2px] border-nu-ink flex-wrap gap-2">
        <div>
          <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-pink">
            📚 Source Library
          </div>
          <div className="font-bold text-[14px] text-nu-ink mt-0.5">
            원천 자료 ({sources.length}건 · AI 요약 {readyCount}건 완료)
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            <VentureDriveImporter
              projectId={projectId}
              driveFolderId={driveFolderId ?? null}
              driveFolderUrl={driveFolderUrl ?? null}
              onImported={load}
            />
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="h-9 px-3 border-[2px] border-nu-ink bg-nu-paper text-nu-ink font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-ink hover:text-nu-paper"
            >
              {showAdd ? "닫기" : "+ 추가"}
            </button>
          </div>
        )}
      </div>

      {/* 서브 툴바 */}
      {sources.length > 0 && (
        <div className="px-4 py-2 border-b-[1px] border-nu-ink/10 flex items-center justify-between flex-wrap gap-2 bg-nu-cream/10">
          <div className="inline-flex border-[1.5px] border-nu-ink">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-2 py-1 font-mono-nu text-[10px] uppercase tracking-widest ${viewMode === "list" ? "bg-nu-ink text-nu-paper" : "bg-nu-paper text-nu-ink hover:bg-nu-ink/10"}`}
            >
              목록
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grouped")}
              className={`px-2 py-1 font-mono-nu text-[10px] uppercase tracking-widest border-l-[1.5px] border-nu-ink ${viewMode === "grouped" ? "bg-nu-ink text-nu-paper" : "bg-nu-paper text-nu-ink hover:bg-nu-ink/10"}`}
            >
              종류별
            </button>
          </div>
          {canEdit && sources.some((s) => s.summary_status !== "ready") && (
            <button
              type="button"
              onClick={summarizeAllPending}
              disabled={bulkSummarizing}
              className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink hover:underline disabled:opacity-50"
            >
              {bulkSummarizing ? "일괄 요약 중..." : "🪄 미요약 전체 AI 요약"}
            </button>
          )}
        </div>
      )}

      {showAdd && canEdit && (
        <AddForm
          projectId={projectId}
          onAdded={(src) => {
            setSources((prev) => [src, ...prev]);
            setShowAdd(false);
            toast.success("소스 추가됨 — AI 요약 버튼을 눌러주세요");
          }}
        />
      )}

      {loading ? (
        <div className="p-6 text-center font-mono-nu text-[11px] text-nu-graphite">불러오는 중...</div>
      ) : sources.length === 0 ? (
        <div className="p-6 text-center">
          <div className="text-[32px] mb-2">📭</div>
          <p className="text-[12px] text-nu-graphite leading-relaxed">
            아직 수집된 소스가 없습니다.<br />
            <strong>Drive 자료</strong>를 가져오거나, YouTube / 기사 / 메모를 추가하면<br />
            AI 가 이를 종합해 HMW 와 아이디어를 제안합니다.
          </p>
        </div>
      ) : viewMode === "list" ? (
        <ul className="divide-y divide-nu-ink/10 list-none m-0 p-0">
          {sources.map((s) => (
            <SourceRow
              key={s.id}
              source={s}
              canEdit={canEdit}
              summarizing={summarizingId === s.id}
              onSummarize={() => summarize(s.id)}
              onRemove={() => remove(s.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="divide-y-[2px] divide-nu-ink/20">
          {grouped.map((g) => (
            <div key={g.kind}>
              <div className="px-4 py-2 bg-nu-cream/30 border-b-[1px] border-nu-ink/10 flex items-center gap-2">
                <span className="text-[16px]">{KIND_META[g.kind].icon}</span>
                <span className={`font-mono-nu text-[11px] uppercase tracking-widest font-bold ${KIND_META[g.kind].color}`}>
                  {KIND_META[g.kind].label}
                </span>
                <span className="font-mono-nu text-[10px] text-nu-graphite">
                  {g.items.length}건
                </span>
              </div>
              <ul className="divide-y divide-nu-ink/10 list-none m-0 p-0">
                {g.items.map((s) => (
                  <SourceRow
                    key={s.id}
                    source={s}
                    canEdit={canEdit}
                    summarizing={summarizingId === s.id}
                    onSummarize={() => summarize(s.id)}
                    onRemove={() => remove(s.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Source Row ────────────────────────────────────────────────
function SourceRow({
  source: s,
  canEdit,
  summarizing,
  onSummarize,
  onRemove,
}: {
  source: VentureSource;
  canEdit: boolean;
  summarizing: boolean;
  onSummarize: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="p-3">
      <div className="flex items-start gap-2">
        {s.thumbnail_url ? (
          <Image src={s.thumbnail_url} alt="" width={64} height={40} className="w-16 h-10 object-cover border-[1.5px] border-nu-ink shrink-0" unoptimized />
        ) : (
          <div className="w-10 h-10 border-[1.5px] border-nu-ink flex items-center justify-center text-[18px] shrink-0">
            {KIND_META[s.kind].icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-mono-nu text-[9px] uppercase tracking-widest bg-nu-ink text-nu-paper px-1 py-0.5">
              {KIND_META[s.kind].label}
            </span>
            {s.summary_status === "ready" && (
              <span className="font-mono-nu text-[9px] uppercase tracking-widest text-green-700">✓ AI 요약됨</span>
            )}
            {s.summary_status === "failed" && (
              <span className="font-mono-nu text-[9px] uppercase tracking-widest text-red-700" title={s.summary_error ?? ""}>요약 실패</span>
            )}
            {s.summary_status === "processing" && (
              <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-graphite">처리 중...</span>
            )}
          </div>
          <h4 className="font-bold text-[13px] text-nu-ink truncate m-0">{s.title}</h4>
          {s.url && (
            <a href={s.url} target="_blank" rel="noreferrer" className="font-mono-nu text-[10px] text-nu-blue hover:underline truncate block">
              {s.url}
            </a>
          )}
          {s.ai_summary ? (
            <p className="text-[12px] text-nu-graphite leading-relaxed mt-1.5 line-clamp-3">{s.ai_summary}</p>
          ) : s.excerpt ? (
            <p className="text-[12px] text-nu-graphite leading-relaxed mt-1.5 line-clamp-2">{s.excerpt}</p>
          ) : null}
          {s.tags && s.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {s.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="font-mono-nu text-[9px] border-[1px] border-nu-ink/30 px-1.5 py-0.5">#{tag}</span>
              ))}
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-col gap-1 shrink-0">
            {s.summary_status !== "ready" && (
              <button
                type="button"
                onClick={onSummarize}
                disabled={summarizing}
                className="h-7 px-2 border-[1.5px] border-nu-ink bg-nu-pink/10 text-nu-pink font-mono-nu text-[9px] uppercase tracking-widest hover:bg-nu-pink hover:text-nu-paper disabled:opacity-50"
                title="AI 요약 생성"
              >
                {summarizing ? "..." : "AI 요약"}
              </button>
            )}
            <button
              type="button"
              onClick={onRemove}
              className="h-7 px-2 border-[1.5px] border-nu-ink/40 text-nu-graphite font-mono-nu text-[9px] uppercase tracking-widest hover:border-red-500 hover:text-red-500"
              title="삭제"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

// ── 추가 폼 ──────────────────────────────────────────────
function AddForm({ projectId, onAdded }: { projectId: string; onAdded: (src: VentureSource) => void }) {
  const [kind, setKind] = useState<VentureSourceKind>("youtube");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [busy, setBusy] = useState(false);

  const needsUrl = kind === "youtube" || kind === "article" || kind === "drive_doc" || kind === "pdf" || kind === "link";
  const needsContent = kind === "raw_text" || kind === "meeting_note" || kind === "interview";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("제목을 입력해주세요"); return; }
    if (needsUrl && !url.trim()) { toast.error("URL 을 입력해주세요"); return; }
    if (needsContent && !content.trim()) { toast.error("본문을 입력해주세요"); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/venture/${projectId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind, title: title.trim(),
          url: needsUrl ? url.trim() : null,
          content_text: needsContent ? content.trim() : null,
          excerpt: excerpt.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "추가 실패");
      onAdded(data.source);
      setTitle(""); setUrl(""); setContent(""); setExcerpt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "추가 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="border-b-[2px] border-nu-ink bg-nu-cream/20 p-4 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
        {(Object.keys(KIND_META) as VentureSourceKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`h-9 px-2 border-[1.5px] font-mono-nu text-[10px] uppercase tracking-widest ${
              kind === k ? "border-nu-pink bg-nu-pink text-nu-paper" : "border-nu-ink/40 bg-nu-paper text-nu-ink hover:border-nu-pink"
            }`}
          >
            {KIND_META[k].icon} {KIND_META[k].label}
          </button>
        ))}
      </div>

      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목"
        className="w-full h-10 px-3 border-[2px] border-nu-ink bg-nu-paper text-[13px]" maxLength={200} />

      {needsUrl && (
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder={kind === "youtube" ? "https://youtube.com/watch?v=..." : "https://..."}
          className="w-full h-10 px-3 border-[2px] border-nu-ink bg-nu-paper text-[13px] font-mono-nu" />
      )}

      {needsContent && (
        <textarea value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="본문 / 회의록 전문 / 인터뷰 스크립트 붙여넣기..." rows={6}
          className="w-full px-3 py-2 border-[2px] border-nu-ink bg-nu-paper text-[13px] resize-y" maxLength={50000} />
      )}

      <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)}
        placeholder="(선택) 한 줄 요약 — 카드 표시용" rows={2}
        className="w-full px-3 py-2 border-[2px] border-nu-ink bg-nu-paper text-[12px] resize-y" maxLength={400} />

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={busy}
          className="h-10 px-4 border-[2px] border-nu-ink bg-nu-ink text-nu-paper font-mono-nu text-[11px] uppercase tracking-widest hover:bg-nu-pink hover:border-nu-pink disabled:opacity-50">
          {busy ? "추가 중..." : "소스 추가"}
        </button>
      </div>
    </form>
  );
}
