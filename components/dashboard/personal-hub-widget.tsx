"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Rocket, Calendar as CalIcon, CheckSquare, Folder, ChevronRight } from "lucide-react";

interface Counts {
  notes: number;
  activeTracks: number;
  googleEventsToday: number;
  googleTasks: number;
  loaded: boolean;
}

export function PersonalHubWidget() {
  const [c, setC] = useState<Counts>({ notes: 0, activeTracks: 0, googleEventsToday: 0, googleTasks: 0, loaded: false });
  const [recentNotes, setRecentNotes] = useState<{ id: string; title: string; icon: string | null }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [notesRes, tracksRes, tasksRes] = await Promise.all([
          fetch("/api/personal/notes?archived=0", { cache: "no-store" }).catch(() => null),
          fetch("/api/personal/tracks", { cache: "no-store" }).catch(() => null),
          fetch("/api/google/tasks?listId=@default&showCompleted=false", { cache: "no-store" }).catch(() => null),
        ]);

        let notes: any[] = [];
        if (notesRes?.ok) {
          const d = await notesRes.json();
          notes = d.rows || [];
        }
        let tracks: any[] = [];
        if (tracksRes?.ok) {
          const d = await tracksRes.json();
          tracks = d.rows || [];
        }
        let gtasks: any[] = [];
        if (tasksRes?.ok) {
          const d = await tasksRes.json();
          gtasks = (d.tasks || []).filter((t: any) => t.status === "needsAction");
        }

        // today's google events
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
        let gevents = 0;
        try {
          const gres = await fetch(`/api/personal/google-calendar?since=${encodeURIComponent(today)}&until=${encodeURIComponent(tomorrow)}`, { cache: "no-store" });
          if (gres.ok) {
            const d = await gres.json();
            gevents = (d.events || []).length;
          }
        } catch {}

        setC({
          notes: notes.length,
          activeTracks: tracks.filter((t: any) => t.status === "active").length,
          googleEventsToday: gevents,
          googleTasks: gtasks.length,
          loaded: true,
        });
        setRecentNotes(notes.slice(0, 5).map((n: any) => ({ id: n.id, title: n.title, icon: n.icon })));
      } catch {
        setC((prev) => ({ ...prev, loaded: true }));
      }
    })();
  }, []);

  const items = [
    { href: "/notes", icon: FileText, label: "📝 내 노트", count: c.notes, color: "text-indigo-600 border-indigo-300 bg-indigo-50" },
    { href: "/tracks", icon: Rocket, label: "🏃 진행 중 트랙", count: c.activeTracks, color: "text-nu-pink border-nu-pink/40 bg-nu-pink/5" },
    { href: "/calendar", icon: CalIcon, label: "📅 오늘 구글 일정", count: c.googleEventsToday, color: "text-green-700 border-green-400 bg-green-50" },
    { href: "/dashboard#tasks", icon: CheckSquare, label: "✅ Google Tasks", count: c.googleTasks, color: "text-blue-600 border-blue-300 bg-blue-50" },
    { href: "/groups", icon: Folder, label: "📥 자료실", count: null as number | null, color: "text-amber-700 border-amber-300 bg-amber-50" },
  ];

  return (
    <div className="bg-white border-[3px] border-nu-ink p-5 shadow-[4px_4px_0_0_#0D0F14]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-head text-lg font-extrabold text-nu-ink uppercase tracking-tight flex items-center gap-2">
          🏠 개인 허브
        </h2>
        <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">Notion 대안</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`border-[2px] ${item.color} px-3 py-3 no-underline hover:shadow-[3px_3px_0_0_#0D0F14] transition-all group`}
          >
            <div className="flex items-center gap-2 mb-1">
              <item.icon size={14} />
              {item.count !== null && (
                <span className="ml-auto font-head text-xl font-extrabold">{c.loaded ? item.count : "…"}</span>
              )}
            </div>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest">{item.label}</div>
          </Link>
        ))}
      </div>

      <div className="pt-3 border-t-[2px] border-nu-ink/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-graphite">최근 노트</h3>
          <Link href="/notes" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink hover:underline no-underline flex items-center gap-0.5">
            새 노트 <ChevronRight size={10} />
          </Link>
        </div>
        {recentNotes.length === 0 ? (
          <p className="text-xs text-nu-muted italic py-2">
            {c.loaded ? "노트가 없습니다. " : "불러오는 중..."}
            {c.loaded && <Link href="/notes" className="text-nu-pink underline">첫 노트 만들기</Link>}
          </p>
        ) : (
          <div className="space-y-1">
            {recentNotes.map((n) => (
              <Link
                key={n.id}
                href="/notes"
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-nu-cream/30 no-underline text-nu-ink"
              >
                <span className="text-base">{n.icon || "📄"}</span>
                <span className="text-sm truncate flex-1">{n.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
