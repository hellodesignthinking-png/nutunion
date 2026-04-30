"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useEscapeKey } from "@/lib/hooks/use-escape-key";

type Thread = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
  scope: string[];
  is_core: boolean;
  pricing: "free" | "paid" | "premium";
  price_krw: number;
  install_count: number;
  avg_rating: number | null;
  version: string | null;
  created_at: string;
};

type Target = { id: string; name: string };
type Installation = { thread_id: string; target_type: "nut" | "bolt"; target_id: string };

type MyThread = Thread & { is_draft?: boolean; builder_mode?: string; created_bolt_id?: string | null };

interface Props {
  threads: Thread[];
  myThreads?: MyThread[];
  nuts: Target[];
  bolts: Target[];
  installations: Installation[];
  migrationMissing: boolean;
}

const CATEGORIES = [
  { id: "all", label: "전체", icon: "✨" },
  { id: "communication", label: "소통", icon: "💬" },
  { id: "project", label: "프로젝트", icon: "📊" },
  { id: "finance", label: "재정", icon: "💰" },
  { id: "space_ops", label: "운영", icon: "🏠" },
  { id: "growth", label: "성장", icon: "🌱" },
  { id: "ai", label: "AI", icon: "🤖" },
  { id: "integration", label: "연동", icon: "🔌" },
  { id: "custom", label: "커스텀", icon: "✨" },
];

export function StoreClient({ threads, myThreads = [], nuts, bolts, installations, migrationMissing }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [scope, setScope] = useState<"all" | "nut" | "bolt" | "both">("all");
  const [pricing, setPricing] = useState<"all" | "free" | "paid" | "premium">("all");
  const [picker, setPicker] = useState<Thread | null>(null);
  const [recommendations, setRecommendations] = useState<{ slug: string; reason: string }[] | null>(null);
  const [recoLoading, setRecoLoading] = useState(false);
  const [recoOpen, setRecoOpen] = useState<string | null>(null);
  const [recoFailed, setRecoFailed] = useState(false);

  const filtered = useMemo(() => {
    return threads.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (scope === "nut" && !t.scope.includes("nut")) return false;
      if (scope === "bolt" && !t.scope.includes("bolt")) return false;
      if (scope === "both" && !(t.scope.includes("nut") && t.scope.includes("bolt"))) return false;
      if (pricing !== "all" && t.pricing !== pricing) return false;
      if (search && !(t.name + " " + (t.description || "")).toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [threads, category, scope, pricing, search]);

  const featured = useMemo(() => [...threads].sort((a, b) => b.install_count - a.install_count).slice(0, 3), [threads]);
  const newest = useMemo(
    () => [...threads].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 3),
    [threads],
  );

  useEffect(() => {
    const run = async () => {
      setRecoLoading(true);
      setRecoFailed(false);
      try {
        const res = await fetch("/api/threads/recommend", { method: "POST" });
        const json = await res.json().catch(() => ({}));
        if (res.ok) setRecommendations(json.recommendations || []);
        else setRecoFailed(true);
      } catch {
        setRecoFailed(true);
      }
      finally { setRecoLoading(false); }
    };
    if (threads.length > 0) run();
  }, [threads.length]);

  return (
    <div className="min-h-screen bg-nu-cream/20 px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Hero */}
        <header className="border-[3px] border-nu-ink bg-white p-6 shadow-[6px_6px_0_0_#0D0F14]">
          <div className="flex items-baseline justify-between flex-wrap gap-3">
            <h1 className="font-head text-2xl sm:text-3xl font-extrabold text-nu-ink">🧩 Thread Store</h1>
            <div className="flex gap-2 flex-wrap">
              <Link
                href="/threads/build/ai"
                className="border-[3px] border-nu-ink bg-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-2 shadow-[3px_3px_0_0_#0D0F14]"
              >
                🤖 AI로 만들기
              </Link>
              <Link
                href="/threads/build/code"
                className="border-[3px] border-nu-ink bg-nu-ink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-2 shadow-[3px_3px_0_0_#0D0F14]"
              >
                💻 코드로 만들기
              </Link>
              <Link
                href="/threads/build"
                className="border-[3px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-2 shadow-[3px_3px_0_0_#0D0F14]"
              >
                + 직접 만들기
              </Link>
            </div>
          </div>
          <p className="text-sm font-mono text-nu-muted mt-2">너트와 볼트에 설치할 수 있는 모듈을 둘러보세요.</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Thread 검색..."
            className="mt-4 w-full border-[3px] border-nu-ink px-3 py-2 font-mono"
          />
        </header>

        {migrationMissing && (
          <div className="border-[3px] border-amber-500 bg-amber-50 p-4 font-mono text-sm space-y-2">
            <div className="font-bold text-amber-900">⚠️ 마이그레이션 적용 필요</div>
            <p className="text-amber-800">
              Thread Registry 테이블이 아직 생성되지 않았습니다. 관리자에게 다음 마이그레이션을 적용해 달라고 요청하세요:
            </p>
            <code className="block bg-white border-[2px] border-amber-500 px-2 py-1 text-xs select-all">
              supabase/migrations/115_thread_registry.sql
            </code>
            <p className="text-xs text-amber-700">
              로컬: <code className="bg-white px-1">supabase db push</code>
            </p>
          </div>
        )}

        {/* Empty state — no threads installed/published yet */}
        {!migrationMissing && threads.length === 0 && myThreads.length === 0 && (
          <div className="border-[3px] border-nu-ink bg-white p-8 text-center space-y-4 shadow-[3px_3px_0_0_#0D0F14]">
            <div className="text-5xl">🧩</div>
            <h2 className="font-head text-xl font-extrabold text-nu-ink">아직 설치된 Thread가 없어요</h2>
            <p className="text-sm font-mono text-nu-muted max-w-md mx-auto">
              Thread는 너트(커뮤니티)와 볼트(프로젝트)에 설치할 수 있는 모듈입니다.
              AI에게 설명하거나, 직접 만들거나, 코드로 작성해보세요.
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              <Link href="/threads/build/ai" className="border-[3px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-2 shadow-[3px_3px_0_0_#0D0F14]">
                🤖 AI로 시작
              </Link>
              <Link href="/threads/build" className="border-[3px] border-nu-ink bg-white font-mono-nu text-[11px] uppercase tracking-widest font-bold px-3 py-2 shadow-[3px_3px_0_0_#0D0F14]">
                ✨ 직접 만들기
              </Link>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="border-[3px] border-nu-ink bg-white p-4 space-y-3">
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`border-[2px] border-nu-ink font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 ${category === c.id ? "bg-nu-pink text-white" : "bg-white hover:bg-nu-cream/40"}`}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted self-center">scope:</span>
            {(["all", "nut", "bolt", "both"] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)}
                className={`border-[2px] border-nu-ink font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 ${scope === s ? "bg-nu-ink text-white" : "bg-white"}`}>
                {s === "all" ? "전체" : s === "nut" ? "너트용" : s === "bolt" ? "볼트용" : "공용"}
              </button>
            ))}
            <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted self-center ml-3">pricing:</span>
            {(["all", "free", "paid", "premium"] as const).map((p) => (
              <button key={p} onClick={() => setPricing(p)}
                className={`border-[2px] border-nu-ink font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1 ${pricing === p ? "bg-nu-ink text-white" : "bg-white"}`}>
                {p === "all" ? "전체" : p === "free" ? "무료" : p === "paid" ? "유료" : "프리미엄"}
              </button>
            ))}
          </div>
        </div>

        {/* AI 추천 */}
        <section className="border-[3px] border-nu-ink bg-nu-cream/40 p-4 shadow-[3px_3px_0_0_#0D0F14]">
          <h2 className="font-head text-lg font-extrabold text-nu-ink">🤖 당신의 너트에 어울릴 Thread</h2>
          {recoLoading && <p className="text-sm font-mono text-nu-muted mt-2">분석 중...</p>}
          {!recoLoading && recoFailed && (
            <p className="text-sm font-mono text-amber-700 mt-2">추천을 불러오지 못했습니다 — 잠시 후 새로고침해 주세요.</p>
          )}
          {!recoLoading && !recoFailed && recommendations && recommendations.length === 0 && (
            <p className="text-sm font-mono text-nu-muted mt-2">현재 추천할 Thread 가 없습니다.</p>
          )}
          {!recoLoading && recommendations && recommendations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {recommendations.map((r) => {
                const t = threads.find((x) => x.slug === r.slug);
                if (!t) return null;
                return (
                  <div key={r.slug} className="border-[2px] border-nu-ink bg-white p-3 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-sm">{t.icon} {t.name}</span>
                    </div>
                    <p className="text-xs font-mono text-nu-muted line-clamp-2">{t.description}</p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPicker(t)}
                        className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1"
                      >설치</button>
                      <button
                        onClick={() => setRecoOpen(recoOpen === r.slug ? null : r.slug)}
                        className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1"
                      >Why?</button>
                    </div>
                    <div
                      className={`grid transition-[grid-template-rows] duration-200 ease-out ${recoOpen === r.slug ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                    >
                      <div className="overflow-hidden">
                        <div className="text-xs font-mono text-nu-ink/80 border-l-[2px] border-nu-pink pl-2 pt-1">{r.reason}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* My Threads */}
        {myThreads.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-head text-lg font-extrabold text-nu-ink">🎨 내가 만든 Thread ({myThreads.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {myThreads.map((t) => (
                <div key={t.id} className="border-[3px] border-nu-ink bg-white p-3 space-y-2 shadow-[3px_3px_0_0_#0D0F14]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-sm">{t.icon} {t.name}</span>
                    {t.is_draft && (
                      <span className="font-mono-nu text-[10px] uppercase tracking-widest font-bold text-nu-pink border-[2px] border-nu-pink px-1">DRAFT</span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-nu-muted line-clamp-2">{t.description}</p>
                  <div className="flex gap-1 flex-wrap">
                    <Link href={`/threads/build/edit/${t.slug}`} className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1">편집</Link>
                    {!t.is_draft && (
                      <button onClick={() => setPicker(t)} className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1">설치</button>
                    )}
                    {t.created_bolt_id && (
                      <Link href={`/projects/${t.created_bolt_id}`} className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1">개발 볼트</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Featured */}
        <section className="space-y-3">
          <h2 className="font-head text-lg font-extrabold text-nu-ink">🔥 이번 주 인기</h2>
          <Grid threads={featured} onInstall={setPicker} installations={installations} />
        </section>

        <section className="space-y-3">
          <h2 className="font-head text-lg font-extrabold text-nu-ink">🆕 새로 추가</h2>
          <Grid threads={newest} onInstall={setPicker} installations={installations} />
        </section>

        {/* All */}
        <section className="space-y-3">
          <h2 className="font-head text-lg font-extrabold text-nu-ink">전체 ({filtered.length})</h2>
          <Grid threads={filtered} onInstall={setPicker} installations={installations} />
        </section>
      </div>

      {picker && (
        <InstallPicker
          thread={picker}
          nuts={nuts}
          bolts={bolts}
          installations={installations}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function Grid({ threads, onInstall, installations }: { threads: Thread[]; onInstall: (t: Thread) => void; installations: Installation[] }) {
  if (threads.length === 0) {
    return <div className="border-[2px] border-nu-ink bg-white p-6 text-center font-mono text-sm text-nu-muted">결과 없음</div>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {threads.map((t) => {
        const installedCount = installations.filter((i) => i.thread_id === t.id).length;
        return (
          <div key={t.id} className="border-[3px] border-nu-ink bg-white p-4 shadow-[3px_3px_0_0_#0D0F14] flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <div className="text-2xl">{t.icon}</div>
              <span className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted">v{t.version || "1.0.0"}</span>
            </div>
            <div className="font-bold text-sm text-nu-ink">{t.name}</div>
            <p className="text-xs font-mono text-nu-muted line-clamp-2 min-h-[2.5em]">{t.description}</p>
            <div className="flex flex-wrap gap-1">
              <span className="border-[1px] border-nu-ink bg-nu-cream/40 font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5">{t.category}</span>
              {t.scope.map((s) => (
                <span key={s} className="border-[1px] border-nu-ink bg-white font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5">{s}</span>
              ))}
              {t.is_core && <span className="border-[1px] border-nu-pink bg-nu-pink text-white font-mono-nu text-[9px] uppercase tracking-widest px-1.5 py-0.5">core</span>}
            </div>
            <div className="text-xs font-mono text-nu-muted">
              📥 {t.install_count} 설치 · ⭐ {t.avg_rating ? t.avg_rating.toFixed(1) : "—"}
              {installedCount > 0 && <span className="ml-2 text-nu-pink font-bold">· 내 공간에 {installedCount}개</span>}
            </div>
            <div className="flex gap-1 mt-auto pt-2">
              <Link href={`/threads/${t.slug}`}
                className="flex-1 text-center border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-1.5 hover:bg-nu-cream/40">
                자세히
              </Link>
              <button onClick={() => onInstall(t)}
                className="flex-1 border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest font-bold px-2 py-1.5 shadow-[2px_2px_0_0_#0D0F14]">
                설치
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InstallPicker({ thread, nuts, bolts, installations, onClose }: {
  thread: Thread; nuts: Target[]; bolts: Target[]; installations: Installation[]; onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const router = useRouter();
  useEscapeKey(onClose);
  const eligibleNuts = thread.scope.includes("nut") ? nuts : [];
  const eligibleBolts = thread.scope.includes("bolt") ? bolts : [];

  const isInstalled = (target_type: "nut" | "bolt", target_id: string) =>
    installations.some((i) => i.thread_id === thread.id && i.target_type === target_type && i.target_id === target_id);

  const install = async (target_type: "nut" | "bolt", target_id: string) => {
    setBusy(`${target_type}:${target_id}`); setError(null); setDone(null);
    try {
      const res = await fetch("/api/threads/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: thread.slug, target_type, target_id, config: {} }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.error || `설치 실패 (HTTP ${res.status})`;
        setError(msg);
        toast.error(msg);
      } else {
        setDone(`${target_type}:${target_id}`);
        toast.success(`${thread.name} 설치 완료`);
        // refresh server props so 설치됨 마커가 즉시 반영
        router.refresh();
      }
    } catch (e: any) {
      const msg = e?.message || "네트워크 오류";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="install-picker-title" className="bg-white border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-md w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between">
          <h3 id="install-picker-title" className="font-head text-lg font-extrabold">{thread.icon} {thread.name} 설치</h3>
          <button
            onClick={onClose}
            aria-label="설치 창 닫기"
            className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink focus:outline-none focus:ring-2 focus:ring-nu-pink px-2 py-1"
          >✕</button>
        </div>
        <p className="text-xs font-mono text-nu-muted">설치할 너트 또는 볼트를 선택하세요.</p>

        {eligibleNuts.length === 0 && eligibleBolts.length === 0 && (
          <div className="text-sm font-mono text-nu-muted">호환되는 너트/볼트가 없습니다 (호스트/리더 권한 필요).</div>
        )}

        {eligibleNuts.length > 0 && (
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">너트</div>
            <ul className="space-y-1">
              {eligibleNuts.map((n) => {
                const k = `nut:${n.id}`;
                const already = isInstalled("nut", n.id);
                return (
                  <li key={n.id} className="flex items-center justify-between border-[2px] border-nu-ink px-2 py-1">
                    <span className="text-sm">{n.name}</span>
                    {already || done === k ? (
                      <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">설치됨</span>
                    ) : (
                      <button disabled={busy === k} onClick={() => install("nut", n.id)}
                        className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 disabled:opacity-50">
                        {busy === k ? "..." : "설치"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {eligibleBolts.length > 0 && (
          <div>
            <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted mb-1">볼트</div>
            <ul className="space-y-1">
              {eligibleBolts.map((b) => {
                const k = `bolt:${b.id}`;
                const already = isInstalled("bolt", b.id);
                return (
                  <li key={b.id} className="flex items-center justify-between border-[2px] border-nu-ink px-2 py-1">
                    <span className="text-sm">{b.name}</span>
                    {already || done === k ? (
                      <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">설치됨</span>
                    ) : (
                      <button disabled={busy === k} onClick={() => install("bolt", b.id)}
                        className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5 disabled:opacity-50">
                        {busy === k ? "..." : "설치"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {error && <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-xs font-mono">{error}</div>}
      </div>
    </div>
  );
}
