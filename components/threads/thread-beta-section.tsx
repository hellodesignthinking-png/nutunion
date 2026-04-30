"use client";
import { useEffect, useMemo, useState } from "react";
import { ThreadRunner } from "./thread-runner";
import { registry, type ThreadInstallation } from "@/lib/threads/registry";
// Side-effect: load all Thread definitions so we can show install dropdown.
import "@/lib/threads/bootstrap";

interface Props {
  targetType: "nut" | "bolt";
  targetId: string;
  currentUserId: string;
  canManage: boolean; // host/moderator for nut, lead for bolt
}

export function ThreadBetaSection({ targetType, targetId, currentUserId, canManage }: Props) {
  const [installations, setInstallations] = useState<ThreadInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string>("");

  const availableDefs = useMemo(
    () => registry.forScope(targetType).sort((a, b) => (a.isCore === b.isCore ? 0 : a.isCore ? -1 : 1)),
    [targetType],
  );

  useEffect(() => {
    if (availableDefs.length > 0 && !selectedSlug) setSelectedSlug(availableDefs[0].slug);
  }, [availableDefs, selectedSlug]);

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
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, targetType, targetId]);

  const handleInstall = async () => {
    if (!selectedSlug) return;
    setInstalling(true);
    setError(null);
    try {
      const res = await fetch("/api/threads/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selectedSlug, target_type: targetType, target_id: targetId, config: {} }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "설치 실패");
      } else {
        await load();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstall = async (id: string) => {
    if (!confirm("이 Thread 를 제거할까요?")) return;
    try {
      const res = await fetch(`/api/threads/installations/${id}`, { method: "DELETE" });
      if (res.ok) await load();
    } catch { /* noop */ }
  };

  return (
    <section className="mt-12 border-t-[2px] border-dashed border-nu-ink/20 pt-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors flex items-center gap-2"
        title="Thread = 이 볼트에 끼우는 기능 모듈 (게시판/캘린더/투표 등)"
      >
        🧩 Thread 모듈 (베타) {expanded ? "▾" : "▸"}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="border-l-[3px] border-nu-pink bg-nu-pink/5 pl-3 py-2">
            <p className="text-[12px] text-nu-ink leading-relaxed">
              <strong>Thread</strong> = 이 {targetType === "nut" ? "너트" : "볼트"}에 끼우는 <strong>기능 모듈</strong>(게시판·캘린더·투표 등).
              필요한 기능만 골라 설치하세요.
            </p>
          </div>

          {error && (
            <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-[11px] text-amber-900 font-mono">
              ⚠ {error}
            </div>
          )}

          {loading ? (
            <div className="text-[11px] text-nu-muted font-mono">로딩 중…</div>
          ) : (
            <>
              {installations.length === 0 && (
                <div className="text-[11px] text-nu-muted font-mono">설치된 Thread 없음.</div>
              )}
              {installations.map((inst) => (
                <div key={inst.id} className="relative">
                  <ThreadRunner installation={inst} canEdit={canManage} currentUserId={currentUserId} />
                  {canManage && (
                    <button
                      onClick={() => handleUninstall(inst.id)}
                      className="absolute top-2 right-2 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-pink bg-white/80 px-2 py-0.5 border border-nu-ink/10"
                    >
                      제거
                    </button>
                  )}
                </div>
              ))}
            </>
          )}

          {canManage && (
            <div className="flex gap-2 items-center flex-wrap">
              <select
                value={selectedSlug}
                onChange={(e) => setSelectedSlug(e.target.value)}
                className="border-[2px] border-nu-ink/50 px-2 py-1 text-[11px] font-mono"
              >
                {availableDefs.map((d) => (
                  <option key={d.slug} value={d.slug} disabled={installedSlugs.has(d.slug)}>
                    {d.icon} {d.name} {installedSlugs.has(d.slug) ? "(설치됨)" : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={handleInstall}
                disabled={installing || !selectedSlug || installedSlugs.has(selectedSlug)}
                className="border-[2px] border-nu-ink bg-white text-nu-ink font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 shadow-[2px_2px_0_0_#0D0F14] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#0D0F14] transition disabled:opacity-50"
              >
                {installing ? "설치 중…" : "+ Thread 설치"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
