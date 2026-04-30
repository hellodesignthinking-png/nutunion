"use client";
import { useEffect, useMemo, useState } from "react";
import { ThreadRunner } from "./thread-runner";
import { registry, type ThreadInstallation } from "@/lib/threads/registry";
import "@/lib/threads/bootstrap";

interface Props {
  targetType: "nut" | "bolt";
  targetId: string;
  currentUserId: string;
  canManage: boolean;
}

export function ThreadsManager({ targetType, targetId, currentUserId, canManage }: Props) {
  const [installations, setInstallations] = useState<ThreadInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAvailable, setShowAvailable] = useState(false);
  const [filter, setFilter] = useState<"installed" | "available">("installed");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);

  const availableDefs = useMemo(
    () => registry.forScope(targetType).sort((a, b) => (a.isCore === b.isCore ? 0 : a.isCore ? -1 : 1)),
    [targetType],
  );

  const installedSlugs = new Set(installations.map((i) => i.thread?.slug).filter(Boolean) as string[]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/threads/installations?target_type=${targetType}&target_id=${targetId}`, { cache: "no-store" });
      const json = await res.json();
      if (json.warning === "migration_115_missing") {
        setError("migration 115 미적용");
        setInstallations([]);
      } else {
        setInstallations(json.installations || []);
        setError(null);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [targetType, targetId]);

  const install = async (slug: string) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/threads/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, target_type: targetType, target_id: targetId, config: {} }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error || "설치 실패");
      else { setShowAvailable(false); await load(); }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const uninstall = async (id: string) => {
    if (!confirm("이 Thread 를 제거할까요? (데이터는 유지되지만 화면에서 사라집니다)")) return;
    try {
      const res = await fetch(`/api/threads/installations/${id}`, { method: "DELETE" });
      if (res.ok) await load();
    } catch { /* noop */ }
  };

  const move = async (id: string, newPos: number) => {
    try {
      await fetch(`/api/threads/installations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: newPos }),
      });
      await load();
    } catch { /* noop */ }
  };

  const swap = async (a: ThreadInstallation, b: ThreadInstallation) => {
    await Promise.all([
      fetch(`/api/threads/installations/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: b.position }) }),
      fetch(`/api/threads/installations/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: a.position }) }),
    ]);
    await load();
  };

  const handleDrop = async (targetInst: ThreadInstallation) => {
    if (!dragId || dragId === targetInst.id) return;
    const src = installations.find((x) => x.id === dragId);
    if (!src) return;
    await swap(src, targetInst);
    setDragId(null);
  };

  const sorted = [...installations].sort((a, b) => a.position - b.position);
  const notInstalledDefs = availableDefs.filter((d) => !installedSlugs.has(d.slug));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          <button onClick={() => setFilter("installed")}
            className={`border-[2px] border-nu-ink px-3 py-1 font-mono-nu text-[11px] uppercase tracking-widest ${filter === "installed" ? "bg-nu-ink text-white" : "bg-white"}`}>
            설치됨 ({sorted.length})
          </button>
          <button onClick={() => setFilter("available")}
            className={`border-[2px] border-nu-ink px-3 py-1 font-mono-nu text-[11px] uppercase tracking-widest ${filter === "available" ? "bg-nu-ink text-white" : "bg-white"}`}>
            사용 가능 ({notInstalledDefs.length})
          </button>
        </div>
        {canManage && (
          <button onClick={() => setShowAvailable((v) => !v)}
            className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-1 shadow-[2px_2px_0_0_#0D0F14]">
            + Thread 설치
          </button>
        )}
      </div>

      {error && <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-[11px] font-mono">⚠ {error}</div>}

      {showAvailable && canManage && (
        <div className="border-[3px] border-nu-pink p-3 bg-nu-cream/30 space-y-2">
          <div className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-pink">설치 가능</div>
          {notInstalledDefs.length === 0 ? (
            <div className="text-[11px] font-mono text-nu-muted">모든 Thread 가 이미 설치되어 있어요.</div>
          ) : (
            <ul className="space-y-1">
              {notInstalledDefs.map((d) => (
                <li key={d.slug} className="border-[2px] border-nu-ink p-2 bg-white flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm">{d.icon} {d.name} {d.isCore && <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-pink ml-1">CORE</span>}</div>
                    <div className="text-[11px] text-nu-muted font-mono truncate">{d.description}</div>
                  </div>
                  <button onClick={() => install(d.slug)} disabled={busy}
                    className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest font-bold px-2 py-1 disabled:opacity-50 shrink-0">
                    설치
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {filter === "available" && (
        <ul className="space-y-2">
          {availableDefs.map((d) => {
            const installed = installedSlugs.has(d.slug);
            return (
              <li key={d.slug} className="border-[2px] border-nu-ink/40 p-3 bg-white flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold">{d.icon} {d.name} <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted ml-1">v{d.version || "1.0.0"}</span></div>
                  <div className="text-[11px] text-nu-muted font-mono">{d.description}</div>
                </div>
                {installed ? (
                  <span className="font-mono-nu text-[10px] uppercase tracking-widest text-green-700">✓ 설치됨</span>
                ) : canManage ? (
                  <button onClick={() => install(d.slug)} disabled={busy}
                    className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest font-bold px-2 py-1 shrink-0">
                    설치
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {filter === "installed" && (
        loading ? (
          <div className="text-[11px] font-mono text-nu-muted">로딩 중…</div>
        ) : sorted.length === 0 ? (
          <div className="border-[2px] border-dashed border-nu-ink/30 p-6 text-center">
            <p className="text-sm text-nu-muted">설치된 Thread 가 없어요.</p>
            {canManage && <p className="text-[11px] font-mono text-nu-muted mt-1">위의 "+ Thread 설치" 버튼으로 시작해보세요.</p>}
          </div>
        ) : (
          <ul className="space-y-3">
            {sorted.map((inst, idx) => {
              const def = registry.get(inst.thread?.slug || "");
              const isOpen = expanded[inst.id] !== false; // default open
              return (
                <li key={inst.id}
                  draggable={canManage}
                  onDragStart={() => setDragId(inst.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(inst)}
                  className="border-[3px] border-nu-ink bg-white shadow-[3px_3px_0_0_#0D0F14]">
                  <div className="p-3 flex items-center justify-between gap-2 border-b-[2px] border-nu-ink/10 bg-nu-cream/30">
                    <div className="flex items-center gap-2 min-w-0">
                      {canManage && <span className="font-mono text-nu-muted cursor-grab" title="드래그로 순서 변경">⋮⋮</span>}
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{def?.icon || "🧵"} {def?.name || inst.thread?.name || inst.thread?.slug}</div>
                        <div className="text-[10px] font-mono text-nu-muted">v{def?.version || inst.thread?.version || "1.0.0"} · pos {inst.position}</div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                      <button onClick={() => setExpanded({ ...expanded, [inst.id]: !isOpen })}
                        className="font-mono-nu text-[10px] uppercase tracking-widest border-[2px] border-nu-ink bg-white px-2 py-0.5">
                        {isOpen ? "▾ 접기" : "▸ 열기"}
                      </button>
                      {canManage && idx > 0 && (
                        <button onClick={() => swap(inst, sorted[idx - 1])} aria-label="위로 이동" title="위로"
                          className="font-mono-nu text-[10px] border-[2px] border-nu-ink bg-white px-2 py-0.5">↑</button>
                      )}
                      {canManage && idx < sorted.length - 1 && (
                        <button onClick={() => swap(inst, sorted[idx + 1])} aria-label="아래로 이동" title="아래로"
                          className="font-mono-nu text-[10px] border-[2px] border-nu-ink bg-white px-2 py-0.5">↓</button>
                      )}
                      {canManage && (
                        <button onClick={() => uninstall(inst.id)}
                          className="font-mono-nu text-[10px] uppercase tracking-widest border-[2px] border-nu-pink text-nu-pink bg-white px-2 py-0.5">
                          제거
                        </button>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="p-3">
                      <ThreadRunner installation={inst} canEdit={canManage} currentUserId={currentUserId} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )
      )}
    </div>
  );
}
