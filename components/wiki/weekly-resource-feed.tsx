"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Link2, Plus, Loader2, FileText, CirclePlay, Globe,
  BookOpen, ExternalLink, Trash2, ChevronDown, ChevronUp,
  Sparkles, Calendar,
} from "lucide-react";

interface Resource {
  id: string;
  title: string;
  url: string;
  resource_type: string;
  description: string | null;
  auto_summary: string | null;
  metadata: Record<string, string>;
  created_at: string;
  week_start: string;
  sharer?: { id: string; nickname: string | null; avatar_url: string | null } | null;
  linked_page?: { id: string; title: string } | null;
}

const typeConfig: Record<string, { icon: typeof Link2; color: string; bg: string; label: string }> = {
  youtube: { icon: CirclePlay, color: "text-red-500", bg: "bg-red-50", label: "YouTube" },
  pdf: { icon: FileText, color: "text-nu-blue", bg: "bg-nu-blue/5", label: "PDF" },
  article: { icon: BookOpen, color: "text-green-600", bg: "bg-green-50", label: "Article" },
  notion: { icon: Globe, color: "text-nu-ink", bg: "bg-nu-cream", label: "Notion" },
  link: { icon: Link2, color: "text-nu-muted", bg: "bg-nu-ink/5", label: "Link" },
  other: { icon: Link2, color: "text-nu-muted", bg: "bg-nu-ink/5", label: "Other" },
};

function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

export function WeeklyResourceFeed({ groupId, userId }: { groupId: string; userId: string }) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string>(getWeekStart());

  const loadResources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/wiki/resources?groupId=${groupId}&weekStart=${selectedWeek}&limit=50`);
      const data = await res.json();
      if (data.resources) setResources(data.resources);
    } catch {
      toast.error("리소스를 불러올 수 없습니다");
    } finally {
      setLoading(false);
    }
  }, [groupId, selectedWeek]);

  useEffect(() => { loadResources(); }, [loadResources]);

  async function handleSubmit() {
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/wiki/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, title: title.trim() || undefined, url: url.trim(), description: description.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "등록 실패");
      }
      toast.success("리소스가 등록되었습니다");
      setUrl(""); setTitle(""); setDescription(""); setShowForm(false);
      loadResources();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 리소스를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch("/api/wiki/resources", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "삭제 실패");
      }
      setResources(prev => prev.filter(r => r.id !== id));
      toast.success("삭제되었습니다");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  // Week navigation
  function prevWeek() {
    const d = new Date(selectedWeek);
    d.setDate(d.getDate() - 7);
    setSelectedWeek(d.toISOString().split("T")[0]);
  }
  function nextWeek() {
    const d = new Date(selectedWeek);
    d.setDate(d.getDate() + 7);
    const now = getWeekStart();
    if (d.toISOString().split("T")[0] <= now) {
      setSelectedWeek(d.toISOString().split("T")[0]);
    }
  }

  const isCurrentWeek = selectedWeek === getWeekStart();

  // Group by type
  const grouped = resources.reduce<Record<string, Resource[]>>((acc, r) => {
    const type = r.resource_type || "link";
    if (!acc[type]) acc[type] = [];
    acc[type].push(r);
    return acc;
  }, {});

  return (
    <div className="bg-white border-[2px] border-nu-ink">
      {/* Header */}
      <div className="p-5 border-b-[2px] border-nu-ink/10 flex items-center justify-between">
        <div>
          <h3 className="font-head text-lg font-extrabold text-nu-ink flex items-center gap-2">
            <Link2 size={18} className="text-nu-blue" />
            주간 리소스 피드
          </h3>
          <p className="font-mono-nu text-[9px] text-nu-muted uppercase tracking-widest mt-1">
            Shared Resources · {resources.length} items
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-blue text-white hover:bg-nu-blue/90 transition-colors flex items-center gap-1.5"
        >
          <Plus size={12} /> 리소스 공유
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="p-5 border-b border-nu-ink/10 bg-nu-cream/30">
          <div className="space-y-3">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL을 붙여넣으세요 (YouTube, PDF, 블로그, Notion 등)"
              className="w-full px-4 py-2.5 bg-white border-[2px] border-nu-ink/15 text-sm focus:outline-none focus:border-nu-blue transition-colors"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 (비워두면 URL에서 자동 추출)"
              className="w-full px-4 py-2 bg-white border border-nu-ink/10 text-sm focus:outline-none focus:border-nu-blue transition-colors"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="간단한 설명이나 메모 (선택)"
              rows={2}
              className="w-full px-4 py-2 bg-white border border-nu-ink/10 text-sm focus:outline-none focus:border-nu-blue transition-colors resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs text-nu-muted hover:text-nu-ink transition-colors">
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !url.trim()}
                className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2 bg-nu-ink text-white hover:bg-nu-graphite transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Week Navigation */}
      <div className="px-5 py-3 border-b border-nu-ink/5 flex items-center justify-between bg-nu-paper/50">
        <button onClick={prevWeek} className="font-mono-nu text-[10px] text-nu-muted hover:text-nu-ink transition-colors">
          ← 이전 주
        </button>
        <span className="font-mono-nu text-[10px] font-bold text-nu-ink flex items-center gap-1.5">
          <Calendar size={11} />
          {new Date(selectedWeek).toLocaleDateString("ko", { month: "long", day: "numeric" })} 주
          {isCurrentWeek && <span className="text-nu-pink ml-1">· 이번 주</span>}
        </span>
        <button
          onClick={nextWeek}
          disabled={isCurrentWeek}
          className="font-mono-nu text-[10px] text-nu-muted hover:text-nu-ink transition-colors disabled:opacity-30"
        >
          다음 주 →
        </button>
      </div>

      {/* Resources */}
      <div className="p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-nu-muted">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs">로딩 중...</span>
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-10">
            <Link2 size={32} className="mx-auto mb-3 text-nu-ink/10" />
            <p className="text-sm text-nu-muted font-medium">이번 주에 공유된 리소스가 없습니다</p>
            <p className="text-xs text-nu-muted/60 mt-1">YouTube, PDF, 블로그 등 학습 자료를 공유해보세요</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([type, items]) => {
              const cfg = typeConfig[type] || typeConfig.link;
              const Icon = cfg.icon;
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={13} className={cfg.color} />
                    <span className="font-mono-nu text-[9px] font-bold uppercase tracking-widest text-nu-muted">
                      {cfg.label} ({items.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map((r) => (
                      <div key={r.id} className="group flex items-start gap-3 p-3 border border-nu-ink/[0.06] hover:border-nu-blue/30 transition-colors bg-white">
                        {/* Thumbnail / Icon */}
                        {r.metadata?.thumbnail_url ? (
                          <img
                            src={r.metadata.thumbnail_url}
                            alt=""
                            className="w-16 h-12 object-cover border border-nu-ink/10 shrink-0"
                          />
                        ) : (
                          <div className={`w-10 h-10 ${cfg.bg} flex items-center justify-center shrink-0`}>
                            <Icon size={16} className={cfg.color} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-bold text-nu-ink hover:text-nu-blue transition-colors no-underline flex items-center gap-1"
                          >
                            <span className="truncate">{r.title}</span>
                            <ExternalLink size={11} className="shrink-0 text-nu-muted" />
                          </a>
                          {r.description && (
                            <p className="text-xs text-nu-muted mt-0.5 line-clamp-1">{r.description}</p>
                          )}
                          {r.auto_summary && (
                            <p className="text-xs text-nu-blue/70 mt-1 flex items-center gap-1">
                              <Sparkles size={9} /> {r.auto_summary.slice(0, 80)}...
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 font-mono-nu text-[8px] text-nu-muted/60">
                            <span>{r.sharer?.nickname || "멤버"}</span>
                            <span>·</span>
                            <span>{new Date(r.created_at).toLocaleDateString("ko", { month: "short", day: "numeric" })}</span>
                            {r.linked_page && (
                              <>
                                <span>·</span>
                                <span className="text-nu-pink flex items-center gap-0.5">
                                  <BookOpen size={8} /> {r.linked_page.title}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Delete */}
                        {r.sharer?.id === userId && (
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="text-nu-muted/30 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
