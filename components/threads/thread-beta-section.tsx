"use client";
import { useEffect, useState } from "react";
import { ThreadRunner } from "./thread-runner";
import type { ThreadInstallation } from "@/lib/threads/registry";

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
    setInstalling(true);
    setError(null);
    try {
      const res = await fetch("/api/threads/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "hello-world",
          target_type: targetType,
          target_id: targetId,
          config: { message: `설치 시각: ${new Date().toLocaleString("ko-KR")}` },
        }),
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
        className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-ink transition-colors"
      >
        🧪 Thread 베타 {expanded ? "▾" : "▸"}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <p className="text-[11px] text-nu-muted font-mono">
            Module Lattice 실험 영역 — {targetType === "nut" ? "너트" : "볼트"}에 Thread 를 설치할 수 있어요.
          </p>

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
            <button
              onClick={handleInstall}
              disabled={installing}
              className="border-[2px] border-nu-ink bg-white text-nu-ink font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 shadow-[2px_2px_0_0_#0D0F14] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#0D0F14] transition disabled:opacity-50"
            >
              {installing ? "설치 중…" : "+ Thread 설치 (베타: hello-world)"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
