"use client";
import { useState } from "react";
import { ThreadRunner } from "@/components/threads/thread-runner";
import type { ThreadInstallation } from "@/lib/threads/registry";

interface RuntimeDef {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  scope: string[];
  isCore: boolean;
  version: string;
}

interface DbThread {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  category: string | null;
  scope: string[] | null;
  install_count: number | null;
  is_core: boolean | null;
  version: string | null;
  is_public: boolean | null;
}

interface Props {
  runtimeDefs: RuntimeDef[];
  dbThreads: DbThread[];
}

export function ThreadsAdminClient({ runtimeDefs, dbThreads }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);

  const handleAutoInstall = async () => {
    setAutoBusy(true); setAutoMsg(null);
    try {
      const pre = await fetch("/api/admin/threads/auto-install", { method: "GET" });
      const preJson = await pre.json();
      if (!pre.ok) {
        setAutoMsg(`❌ ${preJson.error || "preview_failed"}`);
        return;
      }
      const ok = confirm(
        `자동 설치 미리보기\n\n` +
        `너트(groups): ${preJson.groups_total}\n` +
        `볼트(projects): ${preJson.projects_total}\n` +
        `새로 설치할 Thread: ${preJson.inserts_planned}\n\n진행할까요?`,
      );
      if (!ok) { setAutoBusy(false); return; }
      const res = await fetch("/api/admin/threads/auto-install", { method: "POST" });
      const json = await res.json();
      if (!res.ok) setAutoMsg(`❌ ${json.error || "실패"}`);
      else setAutoMsg(`✅ ${json.inserts}개 설치됨 (너트 ${json.groups_processed} / 볼트 ${json.projects_processed})`);
    } catch (e: any) { setAutoMsg(`❌ ${e.message}`); }
    finally { setAutoBusy(false); }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/threads/sync-registry", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setSyncMsg(`❌ ${json.error || "실패"}`);
      } else {
        setSyncMsg(`✅ ${json.synced}개 Thread 싱크됨: ${(json.slugs || []).join(", ")}`);
      }
    } catch (e: any) {
      setSyncMsg(`❌ ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Fake demo installation for preview
  const demoInstallation: ThreadInstallation = {
    id: "00000000-0000-0000-0000-000000000000",
    thread_id: "00000000-0000-0000-0000-000000000000",
    target_type: "nut",
    target_id: "00000000-0000-0000-0000-000000000000",
    position: 0,
    config: { message: "관리자 프리뷰입니다 — 데이터는 저장되지 않습니다." },
    is_enabled: true,
    installed_by: "00000000-0000-0000-0000-000000000000",
    installed_at: new Date().toISOString(),
    thread: {
      id: "00000000-0000-0000-0000-000000000000",
      slug: "hello-world",
      name: "👋 Hello World",
      description: "Registry 데모",
      icon: "👋",
      category: "custom",
      scope: ["nut", "bolt"],
      schema: {},
      config_schema: null,
      is_core: false,
      version: "0.1.0",
    },
  };

  // Merge: slug → (runtime?, db?)
  const slugs = new Set<string>([...runtimeDefs.map((r) => r.slug), ...dbThreads.map((d) => d.slug)]);
  const rows = Array.from(slugs).map((slug) => ({
    slug,
    rt: runtimeDefs.find((r) => r.slug === slug),
    db: dbThreads.find((d) => d.slug === slug),
  }));

  return (
    <div className="space-y-6">
      <section className="border-[3px] border-nu-ink p-4 bg-white shadow-[4px_4px_0_0_#0D0F14] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-head text-lg font-extrabold text-nu-ink">Registry → DB 싱크</h2>
            <p className="text-xs text-nu-muted">런타임 레지스트리의 Thread 정의를 threads 테이블로 UPSERT.</p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="border-[3px] border-nu-ink bg-nu-ink text-nu-white font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 shadow-[3px_3px_0_0_#0D0F14] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#0D0F14] transition disabled:opacity-50"
          >
            {syncing ? "싱크 중…" : "Sync Registry → DB"}
          </button>
        </div>
        {syncMsg && <div className="text-sm border-[2px] border-nu-ink/20 p-2 bg-nu-cream/30">{syncMsg}</div>}
      </section>

      <section className="border-[3px] border-nu-pink p-4 bg-white shadow-[4px_4px_0_0_#0D0F14] space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-head text-lg font-extrabold text-nu-ink">🚀 모든 너트/볼트에 Core Thread 자동 설치</h2>
            <p className="text-xs text-nu-muted">너트: board / members / announcement / ai-copilot · 볼트: milestone / ai-copilot. 멱등(이미 설치된 건 건너뜀).</p>
          </div>
          <button
            onClick={handleAutoInstall}
            disabled={autoBusy}
            className="border-[3px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[12px] font-bold uppercase tracking-widest px-4 py-2 shadow-[3px_3px_0_0_#0D0F14] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#0D0F14] transition disabled:opacity-50"
          >
            {autoBusy ? "처리 중…" : "자동 설치 실행"}
          </button>
        </div>
        {autoMsg && <div className="text-sm border-[2px] border-nu-ink/20 p-2 bg-nu-cream/30">{autoMsg}</div>}
      </section>

      <section>
        <h2 className="font-head text-lg font-extrabold text-nu-ink mb-3">등록된 Thread</h2>
        <div className="border-[2px] border-nu-ink/10 divide-y divide-nu-ink/10 bg-white overflow-x-auto">
          <div className="min-w-[560px]">
          <div className="grid grid-cols-[1fr_90px_90px_90px_80px] gap-2 px-3 py-2 bg-nu-cream/40 font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">
            <div>Thread</div>
            <div>Runtime</div>
            <div>DB</div>
            <div>Scope</div>
            <div>Installs</div>
          </div>
          {rows.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-nu-muted">등록된 Thread 가 없습니다.</div>
          )}
          {rows.map((row) => (
            <div key={row.slug} className="grid grid-cols-[1fr_90px_90px_90px_80px] gap-2 px-3 py-3 items-center text-sm">
              <div>
                <div className="font-bold text-nu-ink">
                  {row.rt?.icon || row.db?.icon || "🧵"} {row.rt?.name || row.db?.name || row.slug}
                </div>
                <div className="text-[11px] text-nu-muted font-mono">{row.slug} · v{row.rt?.version || row.db?.version || "?"}</div>
              </div>
              <div className={`font-mono-nu text-[11px] font-bold ${row.rt ? "text-green-700" : "text-nu-muted"}`}>
                {row.rt ? "✓" : "—"}
              </div>
              <div className={`font-mono-nu text-[11px] font-bold ${row.db ? "text-green-700" : "text-amber-700"}`}>
                {row.db ? "✓" : "未 sync"}
              </div>
              <div className="font-mono-nu text-[11px] text-nu-ink">
                {(row.rt?.scope || row.db?.scope || []).join(" / ") || "—"}
              </div>
              <div className="font-mono-nu text-[12px] tabular-nums text-nu-ink">{row.db?.install_count ?? 0}</div>
            </div>
          ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-head text-lg font-extrabold text-nu-ink mb-3">🧪 Hello World 프리뷰 (격리 실행)</h2>
        <ThreadRunner installation={demoInstallation} canEdit={true} currentUserId="00000000-0000-0000-0000-000000000000" />
      </section>
    </div>
  );
}
