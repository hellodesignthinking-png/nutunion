"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, Loader2, Calendar, Tag, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useEscapeKey } from "@/lib/hooks/use-escape-key";

interface Track {
  id: string;
  title: string;
  description: string | null;
  status: "idea" | "active" | "paused" | "done" | "archived";
  category: string | null;
  progress: number;
  target_date: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const STATUS: { id: Track["status"]; label: string; cls: string }[] = [
  { id: "idea", label: "💡 아이디어", cls: "bg-yellow-50 border-yellow-400" },
  { id: "active", label: "🏃 진행 중", cls: "bg-nu-pink/5 border-nu-pink" },
  { id: "paused", label: "⏸ 일시정지", cls: "bg-nu-ink/5 border-nu-ink/40" },
  { id: "done", label: "✅ 완료", cls: "bg-green-50 border-green-400" },
  { id: "archived", label: "🗄 보관", cls: "bg-nu-cream/40 border-nu-muted" },
];

export function TracksClient() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Track | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Track["status"] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/personal/tracks");
      const data = await res.json();
      if (data.migration_needed) setMigrationNeeded(true);
      else setTracks((data.rows as Track[]) || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const g = new Map<Track["status"], Track[]>();
    for (const s of STATUS) g.set(s.id, []);
    for (const t of tracks) {
      const arr = g.get(t.status) || [];
      arr.push(t);
      g.set(t.status, arr);
    }
    return g;
  }, [tracks]);

  async function moveTo(id: string, status: Track["status"]) {
    const res = await fetch(`/api/personal/tracks?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.row) setTracks((prev) => prev.map((t) => (t.id === id ? data.row : t)));
  }

  async function createTrack(payload: { title: string; description?: string; status: Track["status"]; category?: string; target_date?: string }) {
    const res = await fetch("/api/personal/tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.row) {
      setTracks((prev) => [data.row, ...prev]);
      setCreating(false);
    } else {
      toast.error("생성 실패");
    }
  }

  async function saveTrack(id: string, patch: Partial<Track>) {
    const res = await fetch(`/api/personal/tracks?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (data.row) {
      setTracks((prev) => prev.map((t) => (t.id === id ? data.row : t)));
      if (selected?.id === id) setSelected(data.row);
    }
  }

  async function deleteTrack(id: string) {
    if (!confirm("삭제하시겠어요?")) return;
    const res = await fetch(`/api/personal/tracks?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setTracks((prev) => prev.filter((t) => t.id !== id));
      setSelected(null);
    }
  }

  if (migrationNeeded) {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="border-[3px] border-amber-500 bg-amber-50 p-6">
          <h2 className="font-head text-xl font-extrabold text-nu-ink mb-2">마이그레이션 필요</h2>
          <p className="text-sm text-nu-graphite">
            <code className="font-mono-nu">supabase/migrations/113_personal_projects.sql</code>을 적용해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-head text-3xl font-extrabold text-nu-ink tracking-tight">
            🏃 내 트랙
          </h1>
          <p className="font-mono-nu text-[12px] text-nu-muted uppercase tracking-widest mt-1">
            개인 진행사항 · 아이디어부터 완료까지
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 bg-nu-pink text-nu-paper hover:bg-nu-ink flex items-center gap-1.5"
        >
          <Plus size={12} /> 새 트랙
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin text-nu-pink" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {STATUS.map((s) => {
            const isDragOver = dragOverStatus === s.id;
            return (
            <div
              key={s.id}
              className={`border-[3px] ${s.cls} p-3 min-h-[400px] transition-colors ${isDragOver ? "bg-nu-pink/10" : ""}`}
              onDragOver={(e) => {
                if (draggingId) {
                  e.preventDefault();
                  if (dragOverStatus !== s.id) setDragOverStatus(s.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverStatus === s.id) setDragOverStatus(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || draggingId;
                setDragOverStatus(null);
                setDraggingId(null);
                if (id) {
                  const track = tracks.find((t) => t.id === id);
                  if (track && track.status !== s.id) moveTo(id, s.id);
                }
              }}
            >
              <div className="font-head text-sm font-extrabold text-nu-ink mb-3 flex items-center justify-between">
                {s.label}
                <span className="font-mono-nu text-[10px] text-nu-muted">{(grouped.get(s.id) || []).length}</span>
              </div>
              <div className="space-y-2">
                {(grouped.get(s.id) || []).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    draggable
                    onDragStart={(e) => {
                      setDraggingId(t.id);
                      e.dataTransfer.setData("text/plain", t.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverStatus(null);
                    }}
                    style={{ opacity: draggingId === t.id ? 0.5 : 1 }}
                    className="w-full text-left bg-white border-[2px] border-nu-ink/20 hover:border-nu-ink p-3 transition-all cursor-grab active:cursor-grabbing"
                  >
                    <div className="font-semibold text-sm text-nu-ink mb-1">{t.title}</div>
                    {t.description && (
                      <div className="text-xs text-nu-muted line-clamp-2 mb-2">{t.description}</div>
                    )}
                    {t.progress > 0 && (
                      <div className="mb-2">
                        <div className="h-1.5 bg-nu-cream">
                          <div className="h-full bg-nu-pink" style={{ width: `${t.progress}%` }} />
                        </div>
                        <div className="font-mono-nu text-[9px] text-nu-muted mt-0.5">{t.progress}%</div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {t.target_date && (
                        <span className="font-mono-nu text-[9px] uppercase px-1.5 py-0.5 bg-nu-ink/5 border border-nu-ink/20 text-nu-graphite flex items-center gap-1">
                          <Calendar size={8} /> {t.target_date}
                        </span>
                      )}
                      {t.category && (
                        <span className="font-mono-nu text-[9px] uppercase px-1.5 py-0.5 bg-nu-pink/5 border border-nu-pink/30 text-nu-pink">
                          {t.category}
                        </span>
                      )}
                      {t.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="font-mono-nu text-[9px] px-1.5 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onCreate={createTrack} />}
      {selected && (
        <DetailModal
          track={selected}
          onClose={() => setSelected(null)}
          onSave={(p) => saveTrack(selected.id, p)}
          onDelete={() => deleteTrack(selected.id)}
          onMove={(s) => moveTo(selected.id, s)}
        />
      )}
    </div>
  );
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: { title: string; description?: string; status: Track["status"]; category?: string; target_date?: string }) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Track["status"]>("idea");
  const [category, setCategory] = useState("");
  const [targetDate, setTargetDate] = useState("");
  useEscapeKey(onClose);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="new-track-title" onClick={(e) => e.stopPropagation()} className="bg-white border-[4px] border-nu-ink shadow-[8px_8px_0_0_#0D0F14] w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="new-track-title" className="font-head text-xl font-extrabold text-nu-ink">새 트랙</h2>
          <button onClick={onClose} aria-label="닫기" className="p-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper"><X size={14} /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" className="w-full px-3 py-2 border-[2px] border-nu-ink/30 focus:border-nu-ink" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="설명" rows={3} className="w-full px-3 py-2 border-[2px] border-nu-ink/30 focus:border-nu-ink" />
          <div className="grid grid-cols-2 gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value as Track["status"])} className="px-3 py-2 border-[2px] border-nu-ink/30">
              {STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="카테고리 (research 등)" className="px-3 py-2 border-[2px] border-nu-ink/30" />
          </div>
          <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full px-3 py-2 border-[2px] border-nu-ink/30" />
          <button
            onClick={() => title.trim() && onCreate({ title: title.trim(), description: description.trim() || undefined, status, category: category.trim() || undefined, target_date: targetDate || undefined })}
            disabled={!title.trim()}
            className="w-full font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2.5 bg-nu-pink text-nu-paper hover:bg-nu-ink disabled:opacity-40"
          >
            생성
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ track, onClose, onSave, onDelete, onMove }: {
  track: Track;
  onClose: () => void;
  onSave: (p: Partial<Track>) => void;
  onDelete: () => void;
  onMove: (s: Track["status"]) => void;
}) {
  const [title, setTitle] = useState(track.title);
  const [description, setDescription] = useState(track.description || "");
  const [progress, setProgress] = useState(track.progress);
  const [targetDate, setTargetDate] = useState(track.target_date || "");
  const [category, setCategory] = useState(track.category || "");
  const [tagsStr, setTagsStr] = useState(track.tags.join(", "));
  useEscapeKey(onClose);

  function save() {
    onSave({
      title: title.trim() || track.title,
      description: description || null,
      progress,
      target_date: targetDate || null,
      category: category || null,
      tags: tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="트랙 상세" onClick={(e) => e.stopPropagation()} className="bg-white border-[4px] border-nu-ink shadow-[8px_8px_0_0_#0D0F14] w-full max-w-2xl max-h-[90vh] overflow-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="트랙 제목" className="flex-1 font-head text-2xl font-extrabold text-nu-ink border-none focus:outline-none" />
          <button onClick={onClose} aria-label="닫기" className="p-1.5 border-[2px] border-nu-ink hover:bg-nu-ink hover:text-nu-paper"><X size={14} /></button>
        </div>

        <div className="flex gap-1 mb-4 flex-wrap">
          {STATUS.map((s) => (
            <button
              key={s.id}
              onClick={() => onMove(s.id)}
              className={`font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 border-[2px] ${track.status === s.id ? "bg-nu-ink text-nu-paper border-nu-ink" : "border-nu-ink/30 hover:border-nu-ink"}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="설명 / 노트 / 액션 아이템" rows={8} className="w-full px-3 py-2 border-[2px] border-nu-ink/30 focus:border-nu-ink font-mono text-sm mb-3" />

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="font-mono-nu text-[10px] uppercase text-nu-muted tracking-widest">진척도</label>
            <input type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full" />
            <div className="text-xs text-nu-graphite">{progress}%</div>
          </div>
          <div>
            <label className="font-mono-nu text-[10px] uppercase text-nu-muted tracking-widest">목표일</label>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full px-2 py-1 border-[2px] border-nu-ink/30" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="카테고리" className="px-2 py-1 border-[2px] border-nu-ink/30" />
          <input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="태그 (쉼표)" className="px-2 py-1 border-[2px] border-nu-ink/30" />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-nu-ink/10">
          <button onClick={onDelete} className="font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border-[2px] border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-1"><Trash2 size={11} /> 삭제</button>
          <button onClick={save} className="font-mono-nu text-[11px] uppercase tracking-widest px-4 py-2 bg-nu-pink text-nu-paper hover:bg-nu-ink flex items-center gap-1"><Save size={11} /> 저장</button>
        </div>

        <div className="mt-4 pt-3 border-t border-nu-ink/10 text-[10px] font-mono-nu text-nu-muted uppercase tracking-widest flex items-center gap-3">
          <span className="flex items-center gap-1"><Tag size={9} /> {track.tags.length} tags</span>
          <span>생성 {new Date(track.created_at).toLocaleDateString("ko")}</span>
        </div>
      </div>
    </div>
  );
}
